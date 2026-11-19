import type { Types } from 'mongoose';
import {
  ALL_PERMISSIONS,
  PERMISSION_CATALOGUE,
  SYSTEM_ROLES,
  SYSTEM_ROLE_KEYS,
  V3_ADDED_PERMISSIONS,
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
export type SeedCounts = { inserted: number; updated: number; unchanged: number; removed: number };
export type RbacSeedReport = { permissions: SeedCounts; roles: SeedCounts };

export async function seedRbac(): Promise<RbacSeedReport> {
  const report: RbacSeedReport = {
    permissions: { inserted: 0, updated: 0, unchanged: 0, removed: 0 },
    roles: { inserted: 0, updated: 0, unchanged: 0, removed: 0 },
  };
  // Only write catalogue entries that are missing or differ (no-op writes would still bump updatedAt).
  const current = new Map(
    (await PermissionModel.find().select('key group description').lean()).map((p) => [p.key, p]),
  );
  const changed = ALL_PERMISSIONS.filter((key) => {
    const have = current.get(key);
    const want = PERMISSION_CATALOGUE[key] as Record<string, unknown>;
    return !have || Object.entries(want).some(([f, v]) => (have as Record<string, unknown>)[f] !== v);
  });
  if (changed.length) {
    const perms = await PermissionModel.bulkWrite(
      changed.map((key) => ({
        updateOne: { filter: { key }, update: { $set: { key, ...PERMISSION_CATALOGUE[key] } }, upsert: true },
      })),
    );
    report.permissions.inserted = perms.upsertedCount;
    report.permissions.updated = perms.modifiedCount;
  }
  report.permissions.unchanged = ALL_PERMISSIONS.length - changed.length;
  // Catalogue entries removed from code are retired (role references are pulled below).
  report.permissions.removed = (
    await PermissionModel.deleteMany({ key: { $nin: ALL_PERMISSIONS } })
  ).deletedCount;
  for (const key of SYSTEM_ROLE_KEYS) {
    const def = SYSTEM_ROLES[key];
    const defaults = [...def.permissions];
    const existing = await Role.findOne({ key }).select('seededPermissions permissions isSystem').lean();
    if (!existing) {
      await Role.create({
        key,
        name: def.name,
        description: def.description,
        permissions: defaults,
        seededPermissions: defaults,
        isSystem: true,
      });
      report.roles.inserted++;
      continue;
    }
    const sameList = (a: readonly string[] | null | undefined, b: readonly string[]) =>
      !!a && a.length === b.length && a.every((v, i) => v === b[i]);
    if (key === 'super_admin') {
      if (
        existing.isSystem &&
        sameList(existing.seededPermissions, defaults) &&
        sameList(existing.permissions, ALL_PERMISSIONS)
      ) {
        report.roles.unchanged++;
        continue;
      }
      const r = await Role.updateOne(
        { key },
        { $set: { isSystem: true, permissions: [...ALL_PERMISSIONS], seededPermissions: defaults } },
      );
      report.roles[r.modifiedCount ? 'updated' : 'unchanged']++;
      continue;
    }
    // Backward-compatible migration: offer only defaults this role has never been offered.
    const offered = new Set<string>(
      existing.seededPermissions ?? defaults.filter((p) => !V3_ADDED_PERMISSIONS.includes(p)),
    );
    const fresh = defaults.filter((p) => !offered.has(p));
    if (!fresh.length && existing.isSystem && sameList(existing.seededPermissions, defaults)) {
      report.roles.unchanged++;
      continue;
    }
    const r = await Role.updateOne(
      { key },
      {
        $set: { isSystem: true, seededPermissions: defaults },
        ...(fresh.length ? { $addToSet: { permissions: { $each: fresh } } } : {}),
      },
    );
    report.roles[r.modifiedCount ? 'updated' : 'unchanged']++;
  }
  // Remove permissions that were dropped from the catalogue.
  await Role.updateMany({}, { $pull: { permissions: { $nin: ALL_PERMISSIONS } } });
  return report;
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
