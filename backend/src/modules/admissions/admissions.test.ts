import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, bearer, loginAs } from '../../test/helpers.js';
import { Course } from '../courses/course.model.js';
import { Enrollment } from './admissions.js';

const DESC = 'A structured course covering practical skills with hands-on projects throughout.';

async function publishedCourse(token: string, extra: Record<string, unknown> = {}) {
  const cat = await request(app)
    .post('/api/v1/admin/categories')
    .set(bearer(token))
    .send({ name: `Cat ${Math.random()}` });
  const c = await request(app)
    .post('/api/v1/admin/courses')
    .set(bearer(token))
    .send({
      title: `Course ${Math.random().toString(36).slice(2, 7)}`,
      categoryId: cat.body.data.id,
      description: DESC,
      registrationMode: 'open',
      ...extra,
    });
  expect(c.status).toBe(201);
  expect(
    (await request(app).post(`/api/v1/admin/courses/${c.body.data.id}/publish`).set(bearer(token))).status,
  ).toBe(200);
  return c.body.data as { id: string; slug: string };
}

const applyTo = (token: string, slug: string, motivation = 'I want to learn.') =>
  request(app).post(`/api/v1/courses/${slug}/applications`).set(bearer(token)).send({ motivation });

describe('course applications', () => {
  it('requires sign-in; a student applies once; admissions approves; a free course enrols immediately', async () => {
    const admin = await loginAs(['academy_admin']);
    const c = await publishedCourse(admin.token);
    expect((await request(app).post(`/api/v1/courses/${c.slug}/applications`).send({})).status).toBe(401);

    const student = await loginAs(['student']);
    const first = await applyTo(student.token, c.slug);
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({
      application: { status: 'submitted' },
      enrollment: null,
      canApply: false,
    });
    expect((await applyTo(student.token, c.slug)).status).toBe(409); // duplicate prevented

    const admissions = await loginAs(['admissions_officer']);
    const list = await request(app)
      .get('/api/v1/admin/applications?status=submitted')
      .set(bearer(admissions.token));
    expect(list.body.data).toHaveLength(1);
    const appId = list.body.data[0].id as string;
    const approved = await request(app)
      .post(`/api/v1/admin/applications/${appId}/approve`)
      .set(bearer(admissions.token))
      .send({ note: 'Welcome!' });
    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({ status: 'approved', decisionNote: 'Welcome!' });

    const status = await request(app).get(`/api/v1/courses/${c.slug}/my-status`).set(bearer(student.token));
    expect(status.body.data).toMatchObject({ enrollment: { status: 'active' }, canApply: false });
    expect((await Course.findById(c.id).lean())!.enrolledCount).toBe(1);
    const learning = await request(app).get('/api/v1/me/learning').set(bearer(student.token));
    expect(learning.body.data.enrollments[0]).toMatchObject({ status: 'active', course: { slug: c.slug } });

    // Deciding twice is refused
    expect(
      (await request(app).post(`/api/v1/admin/applications/${appId}/approve`).set(bearer(admissions.token)))
        .status,
    ).toBe(409);
  });

  it('paid courses are admitted as pending payment (no access) and capacity is enforced', async () => {
    const admin = await loginAs(['academy_admin']);
    const c = await publishedCourse(admin.token, { feeAmount: 5000, capacity: 1 });
    const a = await loginAs(['student']);
    const b = await loginAs(['student']);
    await applyTo(a.token, c.slug);
    await applyTo(b.token, c.slug);
    const list = await request(app).get('/api/v1/admin/applications').set(bearer(admin.token));
    const [first, second] = list.body.data as { id: string }[];
    expect(
      (await request(app).post(`/api/v1/admin/applications/${first!.id}/approve`).set(bearer(admin.token)))
        .status,
    ).toBe(200);
    expect(
      (await request(app).post(`/api/v1/admin/applications/${second!.id}/approve`).set(bearer(admin.token)))
        .status,
    ).toBe(409); // full
    const enrolments = await Enrollment.find({ course: c.id }).lean();
    expect(enrolments).toHaveLength(1);
    expect(enrolments[0]!.status).toBe('pending_payment');
  });

  it('closed registration, rejection, withdrawal and re-application', async () => {
    const admin = await loginAs(['academy_admin']);
    const closed = await publishedCourse(admin.token, { registrationMode: 'closed' });
    const student = await loginAs(['student']);
    expect((await applyTo(student.token, closed.slug)).status).toBe(409);

    const c = await publishedCourse(admin.token);
    const sub = await applyTo(student.token, c.slug);
    await request(app)
      .post(`/api/v1/me/applications/${sub.body.data.application.id}/withdraw`)
      .set(bearer(student.token));
    const again = await applyTo(student.token, c.slug); // allowed after withdrawing
    expect(again.status).toBe(201);
    const rejected = await request(app)
      .post(`/api/v1/admin/applications/${again.body.data.application.id}/reject`)
      .set(bearer(admin.token))
      .send({ note: 'Prerequisites missing' });
    expect(rejected.body.data).toMatchObject({ status: 'rejected', decisionNote: 'Prerequisites missing' });
    const status = await request(app).get(`/api/v1/courses/${c.slug}/my-status`).set(bearer(student.token));
    expect(status.body.data).toMatchObject({
      application: { status: 'rejected' },
      enrollment: null,
      canApply: true,
    });
  });

  it('only staff with application permissions can review; students cannot withdraw others’ applications', async () => {
    const admin = await loginAs(['academy_admin']);
    const c = await publishedCourse(admin.token);
    const student = await loginAs(['student']);
    const sub = await applyTo(student.token, c.slug);
    const id = sub.body.data.application.id as string;

    for (const role of ['student', 'finance_officer', 'instructor'] as const) {
      const u = await loginAs([role]);
      expect((await request(app).get('/api/v1/admin/applications').set(bearer(u.token))).status).toBe(403);
      expect(
        (await request(app).post(`/api/v1/admin/applications/${id}/approve`).set(bearer(u.token))).status,
      ).toBe(403);
    }
    const other = await loginAs(['student']);
    expect(
      (await request(app).post(`/api/v1/me/applications/${id}/withdraw`).set(bearer(other.token))).status,
    ).toBe(404);
  });
});
