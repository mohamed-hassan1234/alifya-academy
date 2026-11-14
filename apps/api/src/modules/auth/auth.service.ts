import bcrypt from 'bcryptjs';
import type { Types } from 'mongoose';
import type { CurrentUser } from '@alifya/shared';
import { env } from '../../config/env.js';
import { sendEmailSafely } from '../../integrations/email/index.js';
import { ApiError } from '../../utils/api-error.js';
import { randomToken, sha256 } from '../../utils/crypto.js';
import type { RequestContext } from '../../utils/request.js';
import { audit } from '../audit/audit.service.js';
import { Role } from '../roles/role.model.js';
import { User } from '../users/user.model.js';
import { toCurrentUser } from '../users/user.serializer.js';
import { OneTimeToken, type OneTimeTokenType } from './one-time-token.model.js';
import { UserSession } from './session.model.js';
import { signAccessToken } from './tokens.js';
import * as emails from './auth.emails.js';

/** Production cost. Tests use the minimum so the suite stays fast and deterministic under load. */
export const PRODUCTION_BCRYPT_COST = 12;
export const BCRYPT_COST = env.NODE_ENV === 'test' ? 4 : PRODUCTION_BCRYPT_COST;
const MAX_FAILED_LOGINS = 8;
const LOCK_MINUTES = 15;
const VERIFY_TTL_MS = 24 * 3600_000;
const RESET_TTL_MS = 3600_000;
/** Parallel refreshes (e.g. two tabs) inside this window are treated as benign, not as token theft. */
const ROTATION_GRACE_MS = 15_000;
/** Used to equalise timing when the account does not exist. */
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-password', 10);

export const hashPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_COST);

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: CurrentUser;
}

export async function loadCurrentUser(userId: Types.ObjectId | string): Promise<CurrentUser> {
  const user = await User.findById(userId)
    .populate<{ roles: { _id: Types.ObjectId; key: string; name: string; permissions: string[] }[] }>(
      'roles',
      'key name permissions',
    )
    .lean();
  if (!user) throw ApiError.unauthenticated();
  return toCurrentUser(user as Parameters<typeof toCurrentUser>[0]);
}

async function createOneTimeToken(userId: Types.ObjectId, type: OneTimeTokenType, ttlMs: number) {
  // Only the newest token of a type stays valid.
  await OneTimeToken.updateMany({ user: userId, type, usedAt: null }, { $set: { usedAt: new Date() } });
  const token = randomToken(32);
  await OneTimeToken.create({
    user: userId,
    type,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

/** Atomically consumes a valid token (single use, even under concurrent requests). */
async function consumeOneTimeToken(token: string, type: OneTimeTokenType) {
  const doc = await OneTimeToken.findOneAndUpdate(
    { tokenHash: sha256(token), type, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true },
  );
  if (!doc) throw ApiError.badRequest('This link is invalid or has expired. Please request a new one.');
  return doc;
}

async function issueSession(userId: Types.ObjectId, ctx: RequestContext, family = randomToken(16)) {
  const refreshToken = randomToken(48);
  await UserSession.create({
    user: userId,
    family,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400_000),
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return {
    refreshToken,
    accessToken: signAccessToken(String(userId), family),
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  };
}

export async function revokeAllSessions(userId: Types.ObjectId, reason: string, exceptFamily?: string) {
  await UserSession.updateMany(
    { user: userId, revokedAt: null, ...(exceptFamily ? { family: { $ne: exceptFamily } } : {}) },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

/* ------------------------------------------------------------------ */

export async function register(
  input: { fullName: string; email: string; phone?: string; password: string },
  ctx: RequestContext,
): Promise<void> {
  const existing = await User.findOne({ email: input.email }).select('_id status').lean();
  if (existing) {
    // Do not reveal that the address is registered; tell the real owner instead.
    await sendEmailSafely(emails.alreadyRegistered(input.email));
    return;
  }
  const studentRole = await Role.findOne({ key: 'student' }).select('_id').lean();
  if (!studentRole) throw new Error('RBAC not seeded: student role missing');

  const user = await User.create({
    fullName: input.fullName,
    email: input.email,
    phone: input.phone ?? null,
    passwordHash: await hashPassword(input.password),
    roles: [studentRole._id],
    status: 'pending_verification',
  });
  const token = await createOneTimeToken(user._id, 'email_verification', VERIFY_TTL_MS);
  await sendEmailSafely(emails.verifyEmail(user.email, user.fullName, token));
  await audit({ actor: user._id, action: 'auth.register', targetType: 'User', targetId: user._id, ctx });
}

export async function resendVerification(email: string): Promise<void> {
  const user = await User.findOne({ email, status: 'pending_verification' }).select('_id email fullName');
  if (!user) return; // generic response either way
  const token = await createOneTimeToken(user._id, 'email_verification', VERIFY_TTL_MS);
  await sendEmailSafely(emails.verifyEmail(user.email, user.fullName, token));
}

export async function verifyEmail(token: string, ctx: RequestContext): Promise<void> {
  const t = await consumeOneTimeToken(token, 'email_verification');
  const user = await User.findById(t.user);
  if (!user) throw ApiError.badRequest('This link is invalid or has expired.');
  if (user.status === 'pending_verification') user.status = 'active';
  user.emailVerifiedAt ??= new Date();
  await user.save();
  await audit({
    actor: user._id,
    action: 'auth.email_verified',
    targetType: 'User',
    targetId: user._id,
    ctx,
  });
}

export async function login(email: string, password: string, ctx: RequestContext): Promise<IssuedSession> {
  const user = await User.findOne({ email }).select('+passwordHash +failedLoginCount +lockUntil');
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw ApiError.unauthenticated('Invalid email or password');
  }
  if (user.lockUntil && user.lockUntil > new Date()) {
    throw new ApiError(
      423,
      'ACCOUNT_LOCKED',
      'Too many failed attempts. Try again later or reset your password.',
    );
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const failed = (user.failedLoginCount ?? 0) + 1;
    const lock = failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
    await User.updateOne(
      { _id: user._id },
      { $set: { failedLoginCount: lock ? 0 : failed, lockUntil: lock } },
    );
    await audit({
      actor: user._id,
      action: 'auth.login',
      outcome: 'failure',
      targetType: 'User',
      targetId: user._id,
      metadata: { locked: !!lock },
      ctx,
    });
    throw ApiError.unauthenticated('Invalid email or password');
  }
  if (user.status === 'pending_verification') {
    throw new ApiError(403, 'ACCOUNT_NOT_VERIFIED', 'Please verify your email address before signing in.');
  }
  if (user.status !== 'active') {
    throw new ApiError(403, 'ACCOUNT_INACTIVE', 'This account is not active. Please contact the Academy.');
  }
  await User.updateOne(
    { _id: user._id },
    { $set: { failedLoginCount: 0, lockUntil: null, lastLoginAt: new Date() } },
  );
  const session = await issueSession(user._id, ctx);
  await audit({ actor: user._id, action: 'auth.login', targetType: 'User', targetId: user._id, ctx });
  return { ...session, user: await loadCurrentUser(user._id) };
}

export async function refresh(refreshToken: string, ctx: RequestContext): Promise<IssuedSession> {
  const now = new Date();
  const current = await UserSession.findOne({ tokenHash: sha256(refreshToken) });
  if (!current || current.expiresAt <= now) throw ApiError.unauthenticated('Session expired');

  if (current.revokedAt) throw ApiError.unauthenticated('Session expired');
  if (current.rotatedAt) {
    if (now.getTime() - current.rotatedAt.getTime() > ROTATION_GRACE_MS) {
      // A rotated token was replayed: assume theft and kill the whole family.
      await UserSession.updateMany(
        { family: current.family, revokedAt: null },
        { $set: { revokedAt: now, revokedReason: 'reuse_detected' } },
      );
      await audit({
        actor: current.user,
        action: 'auth.refresh_reuse_detected',
        outcome: 'failure',
        targetType: 'User',
        targetId: current.user,
        ctx,
      });
    }
    throw ApiError.unauthenticated('Session expired');
  }

  // Atomic claim so only one concurrent request can rotate this token.
  const claimed = await UserSession.findOneAndUpdate(
    { _id: current._id, rotatedAt: null, revokedAt: null },
    { $set: { rotatedAt: now } },
  );
  if (!claimed) throw ApiError.unauthenticated('Session expired');

  const user = await User.findById(current.user).select('status').lean();
  if (!user || user.status !== 'active') {
    await revokeAllSessions(current.user, 'account_inactive');
    throw new ApiError(401, 'ACCOUNT_INACTIVE', 'Account is not active');
  }
  const session = await issueSession(current.user, ctx, current.family);
  return { ...session, user: await loadCurrentUser(current.user) };
}

export async function logout(refreshToken: string | undefined, ctx: RequestContext): Promise<void> {
  if (!refreshToken) return;
  const s = await UserSession.findOne({ tokenHash: sha256(refreshToken) })
    .select('family user')
    .lean();
  if (!s) return;
  await UserSession.updateMany(
    { family: s.family, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: 'logout' } },
  );
  await audit({ actor: s.user, action: 'auth.logout', targetType: 'User', targetId: s.user, ctx });
}

export async function forgotPassword(email: string, ctx: RequestContext): Promise<void> {
  const user = await User.findOne({ email, status: { $in: ['active', 'pending_verification'] } }).select(
    '_id email fullName',
  );
  if (!user) return; // generic response — no account enumeration
  const token = await createOneTimeToken(user._id, 'password_reset', RESET_TTL_MS);
  await sendEmailSafely(emails.passwordReset(user.email, user.fullName, token));
  await audit({
    actor: user._id,
    action: 'auth.password_reset_requested',
    targetType: 'User',
    targetId: user._id,
    ctx,
  });
}

export async function resetPassword(token: string, password: string, ctx: RequestContext): Promise<void> {
  const t = await consumeOneTimeToken(token, 'password_reset');
  const user = await User.findById(t.user);
  if (!user || user.status === 'suspended' || user.status === 'disabled') {
    throw ApiError.badRequest('This link is invalid or has expired.');
  }
  user.passwordHash = await hashPassword(password);
  user.passwordChangedAt = new Date();
  user.set({ failedLoginCount: 0, lockUntil: null });
  // Following an emailed link proves mailbox ownership.
  if (user.status === 'pending_verification') user.status = 'active';
  user.emailVerifiedAt ??= new Date();
  await user.save();
  await revokeAllSessions(user._id, 'password_reset');
  await audit({
    actor: user._id,
    action: 'auth.password_reset',
    targetType: 'User',
    targetId: user._id,
    ctx,
  });
}

export async function changePassword(
  userId: Types.ObjectId,
  currentFamily: string,
  currentPassword: string,
  newPassword: string,
  ctx: RequestContext,
): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.unauthenticated();
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw ApiError.badRequest('Current password is incorrect', {
      currentPassword: 'Current password is incorrect',
    });
  }
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();
  await revokeAllSessions(user._id, 'password_changed', currentFamily);
  await audit({
    actor: user._id,
    action: 'auth.password_changed',
    targetType: 'User',
    targetId: user._id,
    ctx,
  });
}
