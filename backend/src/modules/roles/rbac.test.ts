import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, bearer, createUser, loginAs } from '../../test/helpers.js';
import { AuditLog } from '../audit/audit-log.model.js';
import { Role } from './role.model.js';

const roleId = async (key: string) => String((await Role.findOne({ key }).lean())!._id);

describe('RBAC enforcement', () => {
  it('blocks students from admin endpoints', async () => {
    const { token } = await loginAs(['student']);
    for (const path of [
      '/api/v1/admin/users',
      '/api/v1/admin/courses',
      '/api/v1/admin/audit-logs',
      '/api/v1/admin/settings',
    ]) {
      const res = await request(app).get(path).set(bearer(token));
      expect(res.status, path).toBe(403);
    }
  });

  it('requires authentication for admin endpoints', async () => {
    expect((await request(app).get('/api/v1/admin/users')).status).toBe(401);
  });

  it('finance officers cannot manage courses; admissions officers cannot see audit logs', async () => {
    const fin = await loginAs(['finance_officer']);
    expect(
      (await request(app).post('/api/v1/admin/courses').set(bearer(fin.token)).send({ title: 'X course' }))
        .status,
    ).toBe(403);
    const adm = await loginAs(['admissions_officer']);
    expect((await request(app).get('/api/v1/admin/audit-logs').set(bearer(adm.token))).status).toBe(403);
  });

  it('applies role changes immediately without re-login', async () => {
    const { user, token } = await loginAs(['student']);
    expect((await request(app).get('/api/v1/admin/courses').set(bearer(token))).status).toBe(403);
    await user.updateOne({ $set: { roles: [await roleId('academy_admin')] } });
    expect((await request(app).get('/api/v1/admin/courses').set(bearer(token))).status).toBe(200);
  });

  it('a suspended user is cut off immediately', async () => {
    const admin = await loginAs(['academy_admin']);
    const victim = await loginAs(['student']);
    const res = await request(app)
      .patch(`/api/v1/admin/users/${victim.user.id}/status`)
      .set(bearer(admin.token))
      .send({ status: 'suspended', reason: 'Policy violation' });
    expect(res.status).toBe(200);
    expect((await request(app).get('/api/v1/users/me').set(bearer(victim.token))).status).toBe(401);
    expect(await AuditLog.countDocuments({ action: 'user.status_changed' })).toBe(1);
  });
});

describe('role assignment safeguards', () => {
  it('only super admins can grant super_admin', async () => {
    const target = await createUser();
    const admin = await createUser({ roles: ['academy_admin'] });
    // give academy admin roles.manage via a custom role to test the escalation guard
    const custom = await Role.create({
      key: 'role_mgr',
      name: 'Role manager',
      permissions: ['roles.manage', 'users.read'],
    });
    await admin.updateOne({ $push: { roles: custom._id } });
    const { token } = await (await import('../../test/helpers.js')).login(admin.email);
    const res = await request(app)
      .put(`/api/v1/admin/users/${target.id}/roles`)
      .set(bearer(token))
      .send({ roleIds: [await roleId('super_admin')] });
    expect(res.status).toBe(403);
    // and cannot grant a role holding permissions they lack (finance)
    const res2 = await request(app)
      .put(`/api/v1/admin/users/${target.id}/roles`)
      .set(bearer(token))
      .send({ roleIds: [await roleId('finance_officer')] });
    expect(res2.status).toBe(403);
  });

  it('super admin assigns roles (transactional + audited) and cannot edit their own roles', async () => {
    const sa = await loginAs(['super_admin']);
    const target = await createUser();
    const res = await request(app)
      .put(`/api/v1/admin/users/${target.id}/roles`)
      .set(bearer(sa.token))
      .send({ roleIds: [await roleId('instructor'), await roleId('student')] });
    expect(res.status).toBe(200);
    expect(res.body.data.roles.map((r: { key: string }) => r.key).sort()).toEqual(['instructor', 'student']);
    expect(await AuditLog.countDocuments({ action: 'user.roles_changed' })).toBe(1);

    expect(
      (
        await request(app)
          .put(`/api/v1/admin/users/${sa.user.id}/roles`)
          .set(bearer(sa.token))
          .send({ roleIds: [await roleId('student')] })
      ).status,
    ).toBe(403);

    // Another super admin may demote a peer, because the caller remains as an active super admin.
    const demote = await request(app)
      .put(`/api/v1/admin/users/${sa.user.id}/roles`)
      .set(bearer((await loginAs(['super_admin'])).token))
      .send({ roleIds: [await roleId('student')] });
    expect(demote.status).toBe(200);
  });

  it('super_admin permissions are immutable and system roles cannot be deleted', async () => {
    const sa = await loginAs(['super_admin']);
    const id = await roleId('super_admin');
    expect(
      (await request(app).patch(`/api/v1/admin/roles/${id}`).set(bearer(sa.token)).send({ permissions: [] }))
        .status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .delete(`/api/v1/admin/roles/${await roleId('student')}`)
          .set(bearer(sa.token))
      ).status,
    ).toBe(403);
  });

  it('creates and edits custom roles with catalogue validation', async () => {
    const sa = await loginAs(['super_admin']);
    const bad = await request(app)
      .post('/api/v1/admin/roles')
      .set(bearer(sa.token))
      .send({ key: 'tutor', name: 'Tutor', permissions: ['root.all'] });
    expect(bad.status).toBe(400);
    const created = await request(app)
      .post('/api/v1/admin/roles')
      .set(bearer(sa.token))
      .send({ key: 'tutor', name: 'Tutor', permissions: ['lessons.manage'] });
    expect(created.status).toBe(201);
    const list = await request(app).get('/api/v1/admin/roles').set(bearer(sa.token));
    expect(list.body.data.some((r: { key: string }) => r.key === 'tutor')).toBe(true);
    const perms = await request(app).get('/api/v1/admin/permissions').set(bearer(sa.token));
    expect(perms.body.data.length).toBeGreaterThan(30);
  });
});
