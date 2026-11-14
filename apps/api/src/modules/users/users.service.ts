import mongoose, { Types } from 'mongoose';
import type { AdminUserRow, Permission, UpdateProfileInput, UserStatus } from '@alifya/shared';
import { ApiError } from '../../utils/api-error.js';
import { escapeRegex } from '../../utils/regex.js';
import type { RequestContext } from '../../utils/request.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { audit } from '../audit/audit.service.js';
import { revokeAllSessions } from '../auth/auth.service.js';
import { Role } from '../roles/role.model.js';
import { User } from './user.model.js';
import { toAdminUserRow } from './user.serializer.js';

type RoleLean = { _id: Types.ObjectId; key: string; name: string; permissions: Permission[] };

export async function updateProfile(userId: Types.ObjectId, input: UpdateProfileInput, ctx: RequestContext) {
  const update: Record<string, unknown> = { updatedBy: userId };
  if (input.fullName !== undefined) update.fullName = input.fullName;
  if (input.phone !== undefined) update.phone = input.phone;
  if (input.preferredLanguage !== undefined) update.preferredLanguage = input.preferredLanguage;
  await User.updateOne({ _id: userId }, { $set: update });
  await audit({
    actor: userId,
    action: 'user.profile_updated',
    targetType: 'User',
    targetId: userId,
    metadata: { fields: Object.keys(input) },
    ctx,
  });
}

export async function listUsers(q: {
  page: number;
  limit: number;
  q?: string;
  status?: UserStatus;
  role?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ fullName: rx }, { email: rx }, { phone: rx }];
  }
  if (q.role) {
    const role = await Role.findOne({ key: q.role }).select('_id').lean();
    if (!role) return { rows: [] as AdminUserRow[], total: 0 };
    filter.roles = role._id;
  }
  const [docs, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate<{ roles: RoleLean[] }>('roles', 'key name')
      .lean(),
    User.countDocuments(filter),
  ]);
  return { rows: docs.map((d) => toAdminUserRow(d as Parameters<typeof toAdminUserRow>[0])), total };
}

export async function getUser(id: string): Promise<AdminUserRow> {
  const doc = await User.findById(id).populate<{ roles: RoleLean[] }>('roles', 'key name').lean();
  if (!doc) throw ApiError.notFound('User not found');
  return toAdminUserRow(doc as Parameters<typeof toAdminUserRow>[0]);
}

const isSuperAdmin = (actor: AuthContext) => actor.roles.some((r) => r.key === 'super_admin');

export async function setUserStatus(
  actor: AuthContext,
  id: string,
  status: UserStatus,
  reason: string | undefined,
  ctx: RequestContext,
) {
  if (actor.userId.equals(id)) throw ApiError.forbidden('You cannot change the status of your own account');
  const target = await User.findById(id).populate<{ roles: RoleLean[] }>('roles', 'key');
  if (!target) throw ApiError.notFound('User not found');
  if (target.roles.some((r) => r.key === 'super_admin') && !isSuperAdmin(actor)) {
    throw ApiError.forbidden('Only a Super Administrator can change another Super Administrator');
  }
  const previous = target.status;
  target.status = status;
  target.statusReason = reason ?? null;
  target.updatedBy = actor.userId;
  if (status === 'active' && !target.emailVerifiedAt) target.emailVerifiedAt = new Date();
  await target.save();
  if (status === 'suspended' || status === 'disabled')
    await revokeAllSessions(target._id, `account_${status}`);
  await audit({
    actor: actor.userId,
    action: 'user.status_changed',
    targetType: 'User',
    targetId: target._id,
    metadata: { from: previous, to: status, reason: reason ?? null },
    ctx,
  });
  return getUser(id);
}

/**
 * Replaces a user's roles. Guards against privilege escalation:
 *  - nobody edits their own roles;
 *  - only super admins grant/revoke super_admin or touch a super admin;
 *  - non-super-admins can only grant roles whose permissions they already hold;
 *  - the last active super admin can never be demoted.
 * Runs in a transaction so the change and its audit entry commit together.
 */
export async function assignRoles(actor: AuthContext, id: string, roleIds: string[], ctx: RequestContext) {
  if (actor.userId.equals(id)) throw ApiError.forbidden('You cannot change your own roles');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const target = await User.findById(id)
        .populate<{ roles: RoleLean[] }>('roles', 'key permissions')
        .session(session);
      if (!target) throw ApiError.notFound('User not found');
      const newRoles = await Role.find({ _id: { $in: roleIds.map((r) => new Types.ObjectId(r)) } })
        .session(session)
        .lean<RoleLean[]>();
      if (newRoles.length !== new Set(roleIds).size)
        throw ApiError.badRequest('One or more roles do not exist', { roleIds: 'Unknown role' });

      const wasSuper = target.roles.some((r) => r.key === 'super_admin');
      const willBeSuper = newRoles.some((r) => r.key === 'super_admin');
      if ((wasSuper || willBeSuper) && !isSuperAdmin(actor)) {
        throw ApiError.forbidden('Only a Super Administrator can grant or revoke Super Administrator access');
      }
      if (!isSuperAdmin(actor)) {
        const exceeds = newRoles.some((r) => r.permissions.some((p) => !actor.permissions.has(p)));
        if (exceeds) throw ApiError.forbidden('You cannot grant permissions you do not hold');
      }
      if (wasSuper && !willBeSuper) {
        const superRole = await Role.findOne({ key: 'super_admin' }).session(session).lean();
        const remaining = await User.countDocuments({
          _id: { $ne: target._id },
          roles: superRole?._id,
          status: 'active',
        }).session(session);
        if (remaining === 0) throw ApiError.conflict('At least one active Super Administrator must remain');
      }
      const before = target.roles.map((r) => r.key);
      target.set(
        'roles',
        newRoles.map((r) => r._id),
      );
      target.updatedBy = actor.userId;
      await target.save({ session });
      await audit(
        {
          actor: actor.userId,
          action: 'user.roles_changed',
          targetType: 'User',
          targetId: target._id,
          metadata: { from: before, to: newRoles.map((r) => r.key) },
          ctx,
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
  return getUser(id);
}
