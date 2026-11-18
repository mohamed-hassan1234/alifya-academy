/**
 * Demo accounts — one sign-in per system role, for local development and demos ONLY.
 *
 *   npm run seed:demo                     create missing demo accounts (existing ones are left alone)
 *   npm run seed:demo -- --reset-passwords   give every demo account a new random password
 *
 * - Refuses to run with NODE_ENV=production (there is no override).
 * - Accounts use the reserved domain @demo.alifya.test; nothing outside that domain is ever touched.
 * - Passwords are random per account, hashed like any registration, and written ONLY to the git-ignored
 *   credentials sheet backend/demo-accounts.local.md (never to the terminal or logs).
 * - Creates no courses, enrollments or other business records.
 */
import { randomBytes } from 'node:crypto';
import {
  PERMISSION_CATALOGUE,
  SYSTEM_ROLES,
  SYSTEM_ROLE_KEYS,
  type Permission,
  type SystemRoleKey,
} from '@alifya/shared';
import { hashPassword } from '../modules/auth/auth.service.js';
import { Role } from '../modules/roles/role.model.js';
import { seedRbac } from '../modules/roles/roles.service.js';
import { User } from '../modules/users/user.model.js';

export const DEMO_DOMAIN = 'demo.alifya.test';

export type DemoAccount = { role: SystemRoleKey; email: string; fullName: string };

export const DEMO_ACCOUNTS: DemoAccount[] = SYSTEM_ROLE_KEYS.map((role) => ({
  role,
  email: `${role.replaceAll('_', '.')}@${DEMO_DOMAIN}`,
  fullName: `Demo ${SYSTEM_ROLES[role].name}`,
}));

export type DemoOutcome = {
  account: DemoAccount;
  status: 'created' | 'existing' | 'password-reset';
  /** Only present when a new password was set during this run. */
  password?: string;
  permissions: Permission[];
};

/** Random password satisfying the app policy (≥ 10 chars, a letter and a number). */
export function generateDemoPassword(): string {
  return `Demo-${randomBytes(9).toString('base64url')}-7`;
}

export async function seedDemoUsers(opts: { resetPasswords?: boolean } = {}): Promise<DemoOutcome[]> {
  await seedRbac(); // roles must exist; idempotent
  const roles = await Role.find({ key: { $in: [...SYSTEM_ROLE_KEYS] } })
    .select('_id key permissions')
    .lean();
  const roleByKey = new Map(roles.map((r) => [r.key, r]));
  const outcomes: DemoOutcome[] = [];

  for (const account of DEMO_ACCOUNTS) {
    const role = roleByKey.get(account.role);
    if (!role) throw new Error(`System role ${account.role} is missing`);
    const permissions = [...role.permissions] as Permission[];
    const existing = await User.findOne({ email: account.email }).select('_id roles').lean();

    if (!existing) {
      const password = generateDemoPassword();
      await User.create({
        fullName: account.fullName,
        email: account.email,
        passwordHash: await hashPassword(password),
        roles: [role._id],
        status: 'active',
        emailVerifiedAt: new Date(),
      });
      outcomes.push({ account, status: 'created', password, permissions });
      continue;
    }

    // Keep the demo account usable for its role, without removing anything an admin added.
    if (!existing.roles.some((r) => r.equals(role._id)))
      await User.updateOne({ _id: existing._id }, { $addToSet: { roles: role._id } });

    if (opts.resetPasswords) {
      const password = generateDemoPassword();
      await User.updateOne(
        { _id: existing._id },
        {
          $set: {
            passwordHash: await hashPassword(password),
            passwordChangedAt: new Date(),
            status: 'active',
            failedLoginCount: 0,
            lockUntil: null,
          },
        },
      );
      outcomes.push({ account, status: 'password-reset', password, permissions });
    } else {
      outcomes.push({ account, status: 'existing', permissions });
    }
  }
  return outcomes;
}

/* ------------------------------------------------------------------------------------------------ */
/* Credentials sheet                                                                                  */

/** Screens in the web app and the permissions that unlock them (mirrors frontend DashboardLayout nav). */
const SCREENS: { path: string; label: string; any?: Permission[]; role?: SystemRoleKey }[] = [
  { path: '/student/dashboard', label: 'My dashboard & profile' },
  {
    path: '/instructor/dashboard',
    label: 'Instructor dashboard, teaching profile, curriculum of assigned courses',
    role: 'instructor',
  },
  { path: '/admin/courses', label: 'Courses (admin)', any: ['courses.read'] },
  { path: '/admin/categories', label: 'Categories', any: ['categories.manage', 'courses.update'] },
  { path: '/admin/programs', label: 'Programs', any: ['programs.manage'] },
  {
    path: '/admin/instructors',
    label: 'Instructors',
    any: ['instructors.read', 'instructors.manage', 'users.read'],
  },
  { path: '/admin/users', label: 'Users', any: ['users.read'] },
  { path: '/admin/roles', label: 'Roles & permissions', any: ['permissions.manage'] },
  { path: '/admin/audit-logs', label: 'Audit logs', any: ['audit_logs.read'] },
  { path: '/admin/contact-messages', label: 'Contact messages', any: ['cms.manage', 'settings.manage'] },
  { path: '/admin/settings', label: 'Site settings', any: ['settings.manage'] },
];

const ADMIN_AREA: Permission[] = [
  'courses.read',
  'programs.manage',
  'instructors.read',
  'users.read',
  'permissions.manage',
  'audit_logs.read',
];

function landingPage(role: SystemRoleKey, perms: Permission[]): string {
  if (perms.some((p) => ADMIN_AREA.includes(p))) return '/admin';
  if (role === 'instructor') return '/instructor/dashboard';
  return '/student/dashboard';
}

/** Reads passwords recorded by earlier runs: rows look like  | `role` | `email` | `password` | … */
export function parseSheet(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of text.matchAll(/^\| `[^`]+` \| `([^`]+)` \| `([^`]+)` \|/gm)) map.set(m[1]!, m[2]!);
  return map;
}

export function renderSheet(outcomes: DemoOutcome[], known: Map<string, string>, appUrl: string): string {
  const lines: string[] = [];
  lines.push('# Demo accounts — LOCAL DEVELOPMENT ONLY');
  lines.push('');
  lines.push('> Generated by `npm run seed:demo`. This file is git-ignored: never commit it or share it.');
  lines.push('> Never use these accounts on a server reachable by others. Regenerate passwords with');
  lines.push('> `npm run seed:demo -- --reset-passwords`.');
  lines.push('');
  lines.push(`Sign in at ${appUrl}/login`);
  lines.push('');
  lines.push('| Role | Email (username) | Password | Name | Opens at |');
  lines.push('| ---- | ---------------- | -------- | ---- | -------- |');
  for (const o of outcomes) {
    const pw = o.password ?? known.get(o.account.email);
    const pwCell = pw ? `\`${pw}\`` : '_unknown (account existed before) — run with `--reset-passwords`_';
    lines.push(
      `| \`${o.account.role}\` | \`${o.account.email}\` | ${pwCell} | ${o.account.fullName} | ${landingPage(o.account.role, o.permissions)} |`,
    );
  }
  lines.push('');
  lines.push('## What each role can do');
  for (const o of outcomes) {
    const def = SYSTEM_ROLES[o.account.role];
    const held = new Set(o.permissions);
    const screens = SCREENS.filter(
      (s) => (!s.any && !s.role) || s.role === o.account.role || s.any?.some((p) => held.has(p)),
    );
    lines.push('');
    lines.push(`### ${def.name} — \`${o.account.email}\``);
    lines.push('');
    lines.push(def.description);
    lines.push('');
    lines.push('**Screens available in the app today:**');
    for (const s of screens) lines.push(`- ${s.label} — \`${s.path}\``);
    const unbuilt = o.permissions.filter((p) => !SCREENS.some((s) => s.any?.includes(p)));
    if (o.account.role !== 'super_admin' && unbuilt.length && screens.length <= 1)
      lines.push(
        '- _Most of this role’s permissions belong to modules that are not built yet (see docs/KNOWN_BLOCKERS.md), so it currently sees only the basic dashboard._',
      );
    lines.push('');
    if (o.permissions.length === 0) {
      lines.push(
        '**Permissions:** none from the catalogue — learners act only on their own records (profile, enrollments).',
      );
    } else {
      lines.push(`**Permissions (${o.permissions.length}):**`);
      lines.push('');
      const byGroup = new Map<string, Permission[]>();
      for (const p of o.permissions) {
        const g = PERMISSION_CATALOGUE[p].group;
        byGroup.set(g, [...(byGroup.get(g) ?? []), p]);
      }
      for (const [group, ps] of byGroup) lines.push(`- ${group}: ${ps.map((p) => `\`${p}\``).join(', ')}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}
