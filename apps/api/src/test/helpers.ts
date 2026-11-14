import request from 'supertest';
import type { SystemRoleKey } from '@alifya/shared';
import { createApp } from '../app.js';
import { emailSender, type MemoryEmailSender } from '../integrations/email/index.js';
import { hashPassword } from '../modules/auth/auth.service.js';
import { Role } from '../modules/roles/role.model.js';
import { User } from '../modules/users/user.model.js';

export const app = createApp();
export const outbox = () => (emailSender as MemoryEmailSender).outbox;
export const PASSWORD = 'CorrectHorse2026';

export async function createUser(
  opts: { email?: string; roles?: SystemRoleKey[]; status?: string; fullName?: string } = {},
) {
  const roles = await Role.find({ key: { $in: opts.roles ?? ['student'] } })
    .select('_id')
    .lean();
  return User.create({
    fullName: opts.fullName ?? 'Test User',
    email: opts.email ?? `user${Math.random().toString(36).slice(2, 10)}@example.com`,
    passwordHash: await hashPassword(PASSWORD),
    roles: roles.map((r) => r._id),
    status: opts.status ?? 'active',
    emailVerifiedAt: new Date(),
  });
}

export function cookieValue(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const line = raw?.find((c) => c.startsWith(`${name}=`));
  return line?.split(';')[0]?.slice(name.length + 1);
}

/** Logs in with a cookie-preserving agent and returns the bearer token + CSRF token. */
export async function login(email: string, password = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, token: res.body.data.accessToken as string, csrf: cookieValue(res, 'alf_csrf')!, res };
}

export async function loginAs(roles: SystemRoleKey[]) {
  const user = await createUser({ roles });
  return { user, ...(await login(user.email)) };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Extracts the `token=` query value from the most recent email sent to `to`. */
export function tokenFromEmail(to: string): string {
  const mail = [...outbox()].reverse().find((m) => m.to === to);
  const match = mail?.text.match(/token=([A-Za-z0-9_%-]+)/);
  if (!match?.[1]) throw new Error(`no token email for ${to}`);
  return decodeURIComponent(match[1]);
}
