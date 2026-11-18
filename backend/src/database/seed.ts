/**
 * System-data seeding and verification, shared by the CLI scripts (src/scripts/*) and the tests.
 *
 * What counts as "system data" here — the records the application needs before anyone can use it:
 *   - the permission catalogue            (collection: permissions)
 *   - the system roles + their defaults   (collection: roles)
 *   - the site-settings singleton         (collection: sitesettings)
 *   - optionally, the first Super Administrator (collection: users) — only when credentials are supplied
 *
 * Everything is idempotent: upserts keyed on the existing unique indexes, no collection is ever dropped
 * or cleared, user-tuned role permissions are preserved, and an existing user's password is never touched.
 * No sample courses, users or statistics are created.
 */
import mongoose from 'mongoose';
import { ALL_PERMISSIONS, SYSTEM_ROLE_KEYS, passwordSchema, emailSchema } from '@alifya/shared';
import { hashPassword } from '../modules/auth/auth.service.js';
import { PermissionModel } from '../modules/roles/permission.model.js';
import { Role } from '../modules/roles/role.model.js';
import { seedRbac, type SeedCounts } from '../modules/roles/roles.service.js';
import { SiteSettings } from '../modules/settings/settings.js';
import { User } from '../modules/users/user.model.js';

export type AdminInput = { email: string; password: string; fullName: string };
export type AdminOutcome = 'created' | 'promoted' | 'unchanged';

export type SeedStep = {
  name: string;
  status: 'ok' | 'failed' | 'skipped';
  counts?: SeedCounts;
  detail?: string;
};

const zero = (): SeedCounts => ({ inserted: 0, updated: 0, unchanged: 0, removed: 0 });

/** Creates the site-settings singleton with its schema defaults if it does not exist yet. */
export async function ensureSiteSettings(): Promise<SeedCounts> {
  const r = await SiteSettings.updateOne(
    { key: 'site' },
    { $setOnInsert: { key: 'site' } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return { ...zero(), inserted: r.upsertedCount, unchanged: r.upsertedCount ? 0 : 1 };
}

/**
 * Creates the first Super Administrator, or grants the role to an existing account with that email.
 * An existing account's password, status and profile are NEVER changed.
 */
export async function ensureSuperAdmin(input: AdminInput): Promise<AdminOutcome> {
  const email = emailSchema.parse(input.email);
  const superRole = await Role.findOne({ key: 'super_admin' }).select('_id').lean();
  if (!superRole) throw new Error('The super_admin role is missing — run `npm run seed` first.');

  const existing = await User.findOne({ email }).select('_id roles').lean();
  if (existing) {
    if (existing.roles.some((r) => r.equals(superRole._id))) return 'unchanged';
    await User.updateOne({ _id: existing._id }, { $addToSet: { roles: superRole._id } });
    return 'promoted';
  }
  const pw = passwordSchema.safeParse(input.password);
  if (!pw.success) throw new Error(`Administrator password rejected: ${pw.error.issues[0]?.message}`);
  await User.create({
    fullName: input.fullName.trim() || 'Super Administrator',
    email,
    passwordHash: await hashPassword(input.password),
    roles: [superRole._id],
    status: 'active',
    emailVerifiedAt: new Date(),
  });
  return 'created';
}

/** Runs every seed step; a failing step is reported and does not hide the others. */
export async function seedSystemData(opts: { admin?: AdminInput | null } = {}): Promise<SeedStep[]> {
  const steps: SeedStep[] = [];

  let rbacOk = false;
  try {
    const rbac = await seedRbac();
    steps.push({ name: 'Permissions', status: 'ok', counts: rbac.permissions });
    steps.push({ name: 'System roles', status: 'ok', counts: rbac.roles });
    rbacOk = true;
  } catch (err) {
    steps.push({ name: 'Permissions & system roles', status: 'failed', detail: (err as Error).message });
  }

  try {
    steps.push({ name: 'Site settings', status: 'ok', counts: await ensureSiteSettings() });
  } catch (err) {
    steps.push({ name: 'Site settings', status: 'failed', detail: (err as Error).message });
  }

  if (!opts.admin) {
    steps.push({
      name: 'Super Administrator',
      status: 'skipped',
      detail: 'no SEED_SUPERADMIN_EMAIL/PASSWORD given (use `npm run admin:create` to create one)',
    });
  } else if (!rbacOk) {
    steps.push({ name: 'Super Administrator', status: 'skipped', detail: 'roles could not be seeded' });
  } else {
    try {
      const outcome = await ensureSuperAdmin(opts.admin);
      const counts = zero();
      if (outcome === 'created') counts.inserted = 1;
      else if (outcome === 'promoted') counts.updated = 1;
      else counts.unchanged = 1;
      const detail =
        outcome === 'created'
          ? 'account created'
          : outcome === 'promoted'
            ? 'existing account granted Super Administrator (password unchanged)'
            : 'already a Super Administrator (password unchanged)';
      steps.push({ name: 'Super Administrator', status: 'ok', counts, detail });
    } catch (err) {
      steps.push({ name: 'Super Administrator', status: 'failed', detail: (err as Error).message });
    }
  }
  return steps;
}

/* ------------------------------------------------------------------------------------------------ */

export type Check = { name: string; level: 'pass' | 'fail' | 'warn'; detail?: string };

async function duplicateKeys(collection: string, field: string): Promise<string[]> {
  const rows = await mongoose.connection
    .db!.collection(collection)
    .aggregate<{ _id: string }>([
      { $group: { _id: `$${field}`, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  return rows.map((r) => String(r._id));
}

async function hasUniqueIndex(collection: string, field: string): Promise<boolean> {
  const indexes = await mongoose.connection
    .db!.collection(collection)
    .indexes()
    .catch(() => []);
  return indexes.some((i) => i.unique && Object.keys(i.key).length === 1 && field in i.key);
}

const list = (items: string[], max = 8) =>
  items.slice(0, max).join(', ') + (items.length > max ? ` … (+${items.length - max})` : '');

/** Read-only verification of the seeded system data. Never writes. */
export async function verifySeedData(): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail?: string, level: 'fail' | 'warn' = 'fail') =>
    checks.push({ name, level: ok ? 'pass' : level, detail });

  // Deployment prerequisite: the API uses multi-document transactions.
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  add(
    'MongoDB runs as a replica set (required for transactions)',
    Boolean(hello.setName || hello.msg === 'isdbgrid'),
    hello.setName ? `replica set "${hello.setName}"` : 'standalone server — see README › Database setup',
  );

  // Permissions
  const permKeys = (await PermissionModel.find().select('key').lean()).map((p) => p.key);
  const permSet = new Set(permKeys);
  const missingPerms = ALL_PERMISSIONS.filter((k) => !permSet.has(k));
  add(
    `All ${ALL_PERMISSIONS.length} catalogue permissions exist`,
    missingPerms.length === 0,
    missingPerms.length ? `missing: ${list(missingPerms)}` : undefined,
  );
  const unknownPerms = permKeys.filter((k) => !(ALL_PERMISSIONS as string[]).includes(k));
  add(
    'No obsolete permissions',
    unknownPerms.length === 0,
    unknownPerms.length ? `not in catalogue: ${list(unknownPerms)} (run npm run seed)` : undefined,
    'warn',
  );
  const dupPerms = await duplicateKeys('permissions', 'key');
  add('No duplicate permissions', dupPerms.length === 0, dupPerms.length ? list(dupPerms) : undefined);

  // Roles
  const roles = await Role.find().select('key isSystem permissions').lean();
  const byKey = new Map(roles.map((r) => [r.key, r]));
  const missingRoles = SYSTEM_ROLE_KEYS.filter((k) => !byKey.has(k));
  add(
    `All ${SYSTEM_ROLE_KEYS.length} system roles exist`,
    missingRoles.length === 0,
    missingRoles.length ? `missing: ${list(missingRoles)}` : list([...SYSTEM_ROLE_KEYS], 20),
  );
  const notFlagged = SYSTEM_ROLE_KEYS.filter((k) => byKey.has(k) && !byKey.get(k)!.isSystem);
  add(
    'System roles are flagged isSystem',
    notFlagged.length === 0,
    notFlagged.length ? list(notFlagged) : undefined,
  );
  const dupRoles = await duplicateKeys('roles', 'key');
  add('No duplicate roles', dupRoles.length === 0, dupRoles.length ? list(dupRoles) : undefined);
  const sa = byKey.get('super_admin');
  const saMissing = sa ? ALL_PERMISSIONS.filter((p) => !sa.permissions.includes(p)) : [...ALL_PERMISSIONS];
  add(
    'super_admin holds the full permission catalogue',
    saMissing.length === 0,
    saMissing.length ? `missing: ${list(saMissing)}` : undefined,
  );
  const dangling = roles.flatMap((r) =>
    r.permissions.filter((p) => !permSet.has(p)).map((p) => `${r.key}→${p}`),
  );
  add(
    'Every role permission references an existing permission',
    dangling.length === 0,
    dangling.length ? list(dangling) : undefined,
  );

  // Indexes that keep re-seeding duplicate-free
  for (const [coll, field] of [
    ['permissions', 'key'],
    ['roles', 'key'],
    ['sitesettings', 'key'],
    ['users', 'email'],
  ] as const) {
    add(`Unique index on ${coll}.${field}`, await hasUniqueIndex(coll, field));
  }

  // Site settings singleton
  const settingsCount = await SiteSettings.countDocuments({ key: 'site' });
  add(
    'Site settings singleton exists exactly once',
    settingsCount === 1,
    settingsCount === 1 ? undefined : `found ${settingsCount}`,
  );

  // Users → roles references
  const roleIds = roles.map((r) => r._id);
  const usersWithDanglingRoles = await User.countDocuments({
    roles: { $elemMatch: { $nin: roleIds } },
  });
  add(
    'Every user role reference points to an existing role',
    usersWithDanglingRoles === 0,
    usersWithDanglingRoles ? `${usersWithDanglingRoles} user(s) affected` : undefined,
  );

  // Administrator (recommended, not required)
  const saCount = sa ? await User.countDocuments({ roles: sa._id, status: 'active' }) : 0;
  add(
    'At least one active Super Administrator',
    saCount > 0,
    saCount > 0 ? `${saCount} found` : 'none yet — run `npm run admin:create`',
    'warn',
  );

  return checks;
}
