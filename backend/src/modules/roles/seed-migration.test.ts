import { describe, expect, it } from 'vitest';
import { SYSTEM_ROLES } from '@alifya/shared';
import { Role } from './role.model.js';
import { seedRbac } from './roles.service.js';

describe('RBAC seeding migration', () => {
  it('adds new v3 defaults to roles created before v3, once', async () => {
    // Simulate a pre-v3 database: instructor role with old permissions and no seededPermissions field.
    await Role.updateOne(
      { key: 'instructor' },
      { $set: { permissions: ['lessons.manage', 'attendance.manage'] }, $unset: { seededPermissions: 1 } },
    );
    await seedRbac();
    const role = await Role.findOne({ key: 'instructor' }).lean();
    expect(role!.permissions).toEqual(
      expect.arrayContaining(['lessons.create', 'lessons.update', 'assignments.grade']),
    );
    // Pre-v3 defaults the admin had removed (assignments.manage, submissions.grade) are NOT re-added.
    expect(role!.permissions).not.toContain('assignments.manage');
    expect(role!.permissions).not.toContain('submissions.grade');
  });

  it('never re-adds a v3 permission an administrator removed afterwards', async () => {
    await seedRbac();
    await Role.updateOne({ key: 'instructor' }, { $pull: { permissions: 'lessons.publish' } });
    await seedRbac();
    const role = await Role.findOne({ key: 'instructor' }).lean();
    expect(role!.permissions).not.toContain('lessons.publish');
    expect(role!.seededPermissions).toEqual([...SYSTEM_ROLES.instructor.permissions]);
  });

  it('keeps super_admin on the full catalogue', async () => {
    const sa = await Role.findOne({ key: 'super_admin' }).lean();
    expect(sa!.permissions).toContain('webinar_speakers.manage');
  });
});
