import { describe, expect, it } from 'vitest';
import { SYSTEM_ROLE_KEYS, passwordSchema } from '@alifya/shared';
import { Role } from '../modules/roles/role.model.js';
import { User } from '../modules/users/user.model.js';
import { app } from '../test/helpers.js';
import request from 'supertest';
import { DEMO_ACCOUNTS, generateDemoPassword, parseSheet, renderSheet, seedDemoUsers } from './demo-seed.js';

const hashOf = async (email: string) =>
  (await User.findOne({ email }).select('+passwordHash').lean())!.passwordHash;

describe('demo accounts seed', () => {
  it('creates one active, verified account per system role, with a policy-compliant password', async () => {
    const out = await seedDemoUsers();
    expect(out.map((o) => o.account.role)).toEqual([...SYSTEM_ROLE_KEYS]);
    expect(out.every((o) => o.status === 'created' && passwordSchema.safeParse(o.password).success)).toBe(
      true,
    );
    for (const o of out) {
      const u = await User.findOne({ email: o.account.email }).lean();
      const role = await Role.findOne({ key: o.account.role }).lean();
      expect(u!.status).toBe('active');
      expect(u!.emailVerifiedAt).toBeTruthy();
      expect(u!.roles.map(String)).toEqual([String(role!._id)]);
    }
  });

  it('can sign in with the generated credentials', async () => {
    const out = await seedDemoUsers();
    const admin = out.find((o) => o.account.role === 'academy_admin')!;
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: admin.account.email, password: admin.password });
    expect(res.status).toBe(200);
  });

  it('is idempotent and never changes passwords unless asked', async () => {
    await seedDemoUsers();
    const before = await hashOf(DEMO_ACCOUNTS[0]!.email);
    const again = await seedDemoUsers();
    expect(again.every((o) => o.status === 'existing' && !o.password)).toBe(true);
    expect(await User.countDocuments()).toBe(DEMO_ACCOUNTS.length);
    expect(await hashOf(DEMO_ACCOUNTS[0]!.email)).toBe(before);
  });

  it('--reset-passwords only touches demo accounts', async () => {
    await User.create({ fullName: 'Real', email: 'real@example.com', passwordHash: 'keep-me' });
    await seedDemoUsers();
    const before = await hashOf(DEMO_ACCOUNTS[1]!.email);
    const reset = await seedDemoUsers({ resetPasswords: true });
    expect(reset.every((o) => o.status === 'password-reset' && o.password)).toBe(true);
    expect(await hashOf(DEMO_ACCOUNTS[1]!.email)).not.toBe(before);
    expect(await hashOf('real@example.com')).toBe('keep-me');
  });

  it('credentials sheet round-trips known passwords across runs', async () => {
    const first = await seedDemoUsers();
    const sheet = renderSheet(first, new Map(), 'http://localhost:5173');
    const known = parseSheet(sheet);
    expect(known.size).toBe(DEMO_ACCOUNTS.length);
    const second = renderSheet(await seedDemoUsers(), known, 'http://localhost:5173');
    for (const o of first) expect(second).toContain(`\`${o.password}\``);
    expect(second).toContain('Site settings');
    expect(generateDemoPassword()).not.toBe(generateDemoPassword());
  });
});
