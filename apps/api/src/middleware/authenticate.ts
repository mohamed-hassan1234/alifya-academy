import type { NextFunction, Request, Response } from 'express';
import type { Types } from 'mongoose';
import { ALL_PERMISSIONS, type Permission, type RoleSummary } from '@alifya/shared';
import { verifyAccessToken } from '../modules/auth/tokens.js';
import { UserSession } from '../modules/auth/session.model.js';
import { User } from '../modules/users/user.model.js';
import { ApiError } from '../utils/api-error.js';

export interface AuthContext {
  userId: Types.ObjectId;
  sessionFamily: string;
  roles: RoleSummary[];
  permissions: Set<Permission>;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

interface PopulatedRole {
  _id: Types.ObjectId;
  key: string;
  name: string;
  permissions: Permission[];
}

export function resolvePermissions(roles: PopulatedRole[]): Set<Permission> {
  if (roles.some((r) => r.key === 'super_admin')) return new Set(ALL_PERMISSIONS);
  return new Set(roles.flatMap((r) => r.permissions));
}

/**
 * Validates the bearer access token and loads the user's CURRENT roles and status on every request,
 * so suspensions, role changes and logouts take effect immediately rather than at token expiry.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.get('authorization');
    if (!header?.startsWith('Bearer ')) throw ApiError.unauthenticated();
    const claims = verifyAccessToken(header.slice(7));

    const [user, sessionAlive] = await Promise.all([
      User.findById(claims.sub)
        .select('status roles')
        .populate<{ roles: PopulatedRole[] }>('roles', 'key name permissions')
        .lean(),
      UserSession.exists({ family: claims.sid, revokedAt: null, expiresAt: { $gt: new Date() } }),
    ]);

    if (!user || !sessionAlive) throw ApiError.unauthenticated('Session is no longer valid');
    // Password changes/resets revoke session families, which invalidates their access tokens via `sessionAlive`.
    if (user.status !== 'active') throw new ApiError(401, 'ACCOUNT_INACTIVE', 'Account is not active');

    req.auth = {
      userId: user._id,
      sessionFamily: claims.sid,
      roles: user.roles.map((r) => ({ id: String(r._id), key: r.key, name: r.name })),
      permissions: resolvePermissions(user.roles),
    };
    next();
  } catch (err) {
    next(err);
  }
}
