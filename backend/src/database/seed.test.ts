import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, SYSTEM_ROLE_KEYS } from '@alifya/shared';
import { PermissionModel } from '../modules/roles/permission.model.js';
import { Role } from '../modules/roles/role.model.js';
import { SiteSettings } from '../modules/settings/settings.js';
import { User } from '../modules/users/user.model.js';
import { ensureSuperAdmin, seedSystemData, verifySeedData } from './seed.js';

const admin = { email: 'Owner@Example.com', password: 'Str0ngPassw0rd', fullName: 'Owner' };

describe('system data seeding', () => {
  it('is idempotent: a second run inserts nothing and creates no duplicates', async () => {
    const first = await seedSystemData({ admin });
    expect(first.every((s) => s.status === 'ok')).toBe(true);
    const counts = async () => ({
      perms: await PermissionModel.countDocuments(),
      roles: await Role.countDocuments(),
      settings: await SiteSettings.countDocuments(),
      users: await User.countDocuments(),
    });
    const before = await counts();

    const second = await seedSystemData({ admin });
    const byName = Object.fromEntries(second.map((s) => [s.name, s]));
    expect(byName['Permissions']!.counts).toMatchObject({ inserted: 0, updated: 0, removed: 0 });
    expect(byName['System roles']!.counts).toMatchObject({ inserted: 0, updated: 0 });
    expect(byName['Site settings']!.counts).toMatchObject({ inserted: 0, unchanged: 1 });
    expect(byName['Super Administrator']!.counts).toMatchObject({ inserted: 0, unchanged: 1 });
    expect(await counts()).toEqual(before);
    expect(before).toEqual({
      perms: ALL_PERMISSIONS.length,
      roles: SYSTEM_ROLE_KEYS.length,
      settings: 1,
      users: 1,
    });
  });

  it('passes verification after seeding', async () => {
    await seedSystemData({ admin });
    const checks = await verifySeedData();
    expect(checks.filter((c) => c.level !== 'pass')).toEqual([]);
  });

  it('flags missing site settings and missing administrator without writing anything', async () => {
    await SiteSettings.deleteMany({});
    const checks = await verifySeedData();
    expect(checks.find((c) => c.name.startsWith('Site settings'))!.level).toBe('fail');
    expect(checks.find((c) => c.name.includes('Super Administrator'))!.level).toBe('warn');
    expect(await SiteSettings.countDocuments()).toBe(0);
  });

  it('never changes an existing account password; promotes it instead', async () => {
    await seedSystemData({ admin });
    const hashBefore = (await User.findOne({ email: 'owner@example.com' }).select('+passwordHash').lean())!
      .passwordHash;
    expect(await ensureSuperAdmin({ ...admin, password: 'An0therPassword!' })).toBe('unchanged');
    const after = await User.findOne({ email: 'owner@example.com' }).select('+passwordHash').lean();
    expect(after!.passwordHash).toBe(hashBefore);

    const student = await Role.findOne({ key: 'student' }).lean();
    await User.create({ fullName: 'S', email: 's@example.com', passwordHash: 'x', roles: [student!._id] });
    expect(await ensureSuperAdmin({ email: 's@example.com', password: '', fullName: '' })).toBe('promoted');
    const promoted = await User.findOne({ email: 's@example.com' }).select('+passwordHash').lean();
    expect(promoted!.passwordHash).toBe('x');
    expect(promoted!.roles).toHaveLength(2);
  });

  it('rejects a weak administrator password', async () => {
    const steps = await seedSystemData({ admin: { ...admin, password: 'short' } });
    expect(steps.find((s) => s.name === 'Super Administrator')!.status).toBe('failed');
    expect(await User.countDocuments()).toBe(0);
  });
});
