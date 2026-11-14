import type { Types } from 'mongoose';
import {
  ALL_PERMISSIONS,
  PERMISSION_CATALOGUE,
  SYSTEM_ROLES,
  SYSTEM_ROLE_KEYS,
  type Permission,
  type PermissionInfo,
  type RoleDetail,
} from '@alifya/shared';
import { ApiError } from '../../utils/api-error.js';
import type { RequestContext } from '../../utils/request.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { audit } from '../audit/audit.service.js';
import { User } from '../users/user.model.js';
import { PermissionModel } from './permission.model.js';
import { Role } from './role.model.js';

/**
 * Idempotently syncs the permission catalogue and system roles.
 * Existing system-role permission sets are preserved (admins may have tuned them), except super_admin,
 * which is always forced to the full catalogue.
 */
export async function seedRbac(): Promise<void> {
  await PermissionModel.bulkWrite(
    ALL_PERMISSIONS.map((key) => ({
      updateOne: { filter: { key }, update: { $set: { key, ...PERMISSION_CATALOGUE[key] } }, upsert: true },
    })),
  );
  await PermissionModel.deleteMany({ key: { $nin: ALL_PERMISSIONS } });
  for (const key of SYSTEM_ROLE_KEYS) {
    const def = SYSTEM_ROLES[key];
    await Role.updateOne(
      { key },
      {
        $set: { isSystem: true, ...(key === 'super_admin' ? { permissions: [...ALL_PERMISSIONS] } : {}) },
        $setOnInsert: {
          name: def.name,
          description: def.description,
          ...(key === 'super_admin' ? {} : { permissions: [...def.permissions] }),
        },
      },
      { upsert: true },
    );
  }
  // Remove permissions that were dropped from the catalogue.
  await Role.updateMany({}, { $pull: { permissions: { $nin: ALL_PERMISSIONS } } });
}

export function listPermissions(): PermissionInfo[] {
  return ALL_PERMISSIONS.map((key) => ({ key, ...PERMISSION_CATALOGUE[key] }));
}

type RoleLean = {
  _id: Types.ObjectId;
  key: string;
  name: string;
  description?: string | null;
  permissions: Permission[];
  isSystem?: boolean | null;
};

function toDetail(r: RoleLean, userCount: number): RoleDetail {
  return {
    id: String(r._id),
    key: r.key,
    name: r.name,
    description: r.description ?? '',
    permissions: r.permissions,
    isSystem: !!r.isSystem,
    userCount,
  };
}

export async function listRoles(): Promise<RoleDetail[]> {
  const [roles, counts] = await Promise.all([
    Role.find().sort({ isSystem: -1, name: 1 }).lean<RoleLean[]>(),
    User.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $unwind: '$roles' },
      { $group: { _id: '$roles', n: { $sum: 1 } } },
    ]),
  ]);
  const byRole = new Map(counts.map((c) => [String(c._id), c.n]));
  return roles.map((r) => toDetail(r, byRole.get(String(r._id)) ?? 0));
}

function assertCanGrant(actor: AuthContext, permissions: Permission[]) {
  const missing = permissions.filter((p) => !actor.permissions.has(p));
  if (missing.length) throw ApiError.forbidden('You cannot grant permissions you do not hold');
}

export async function createRole(
  actor: AuthContext,
  input: { key: string; name: string; description: string; permissions: Permission[] },
  ctx: RequestContext,
): Promise<RoleDetail> {
  assertCanGrant(actor, input.permissions);
  const role = await Role.create({
    ...input,
    permissions: [...new Set(input.permissions)],
    isSystem: false,
    createdBy: actor.userId,
  });
  await audit({
    actor: actor.userId,
    action: 'role.created',
    targetType: 'Role',
    targetId: role._id,
    metadata: { key: role.key, permissions: role.permissions },
    ctx,
  });
  return toDetail(role.toObject() as RoleLean, 0);
}

export async function updateRole(
  actor: AuthContext,
  id: string,
  input: { name?: string; description?: string; permissions?: Permission[] },
  ctx: RequestContext,
): Promise<RoleDetail> {
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound('Role not found');
  if (role.key === 'super_admin' && input.permissions) {
    throw ApiError.forbidden('Super Administrator permissions are fixed to the full catalogue');
  }
  const before = [...role.permissions];
  if (input.permissions) {
    // Only additions need to be held by the actor; removing is always allowed for permissions.manage holders.
    assertCanGrant(
      actor,
      input.permissions.filter((p) => !before.includes(p)),
    );
    role.set('permissions', [...new Set(input.permissions)]);
  }
  if (input.name !== undefined) role.name = input.name;
  if (input.description !== undefined) role.description = input.description;
  role.updatedBy = actor.userId;
  await role.save();
  await audit({
    actor: actor.userId,
    action: 'role.updated',
    targetType: 'Role',
    targetId: role._id,
    metadata: {
      key: role.key,
      added: role.permissions.filter((p) => !before.includes(p)),
      removed: before.filter((p) => !role.permissions.includes(p)),
    },
    ctx,
  });
  const userCount = await User.countDocuments({ roles: role._id });
  return toDetail(role.toObject() as RoleLean, userCount);
}

export async function deleteRole(actor: AuthContext, id: string, ctx: RequestContext): Promise<void> {
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound('Role not found');
  if (role.isSystem) throw ApiError.forbidden('System roles cannot be deleted');
  const inUse = await User.countDocuments({ roles: role._id });
  if (inUse > 0) throw ApiError.conflict('Remove this role from all users before deleting it');
  await role.deleteOne();
  await audit({
    actor: actor.userId,
    action: 'role.deleted',
    targetType: 'Role',
    targetId: role._id,
    metadata: { key: role.key },
    ctx,
  });
}
