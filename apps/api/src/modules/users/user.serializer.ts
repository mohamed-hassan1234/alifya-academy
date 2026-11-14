import type { Types } from 'mongoose';
import {
  ALL_PERMISSIONS,
  type AdminUserRow,
  type CurrentUser,
  type Permission,
  type RoleSummary,
} from '@alifya/shared';

interface RoleLike {
  _id: Types.ObjectId;
  key: string;
  name: string;
  permissions?: Permission[];
}

interface UserLike {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  status: CurrentUser['status'];
  preferredLanguage?: CurrentUser['preferredLanguage'] | null;
  emailVerifiedAt?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  roles: RoleLike[];
}

const roleSummary = (r: RoleLike): RoleSummary => ({ id: String(r._id), key: r.key, name: r.name });

export function toCurrentUser(u: UserLike): CurrentUser {
  const permissions: Permission[] = u.roles.some((r) => r.key === 'super_admin')
    ? [...ALL_PERMISSIONS]
    : [...new Set(u.roles.flatMap((r) => r.permissions ?? []))];
  return {
    id: String(u._id),
    fullName: u.fullName,
    email: u.email,
    phone: u.phone ?? null,
    avatarUrl: u.avatarUrl ?? null,
    status: u.status,
    preferredLanguage: u.preferredLanguage ?? 'en',
    emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null,
    roles: u.roles.map(roleSummary),
    permissions,
    createdAt: u.createdAt.toISOString(),
  };
}

export function toAdminUserRow(u: UserLike): AdminUserRow {
  return {
    id: String(u._id),
    fullName: u.fullName,
    email: u.email,
    phone: u.phone ?? null,
    status: u.status,
    roles: u.roles.map(roleSummary),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}
