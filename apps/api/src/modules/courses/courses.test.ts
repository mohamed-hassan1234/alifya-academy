import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, bearer, createUser, loginAs } from '../../test/helpers.js';
import { AuditLog } from '../audit/audit-log.model.js';
import { Course } from './course.model.js';

async function adminWithCategory() {
  const admin = await loginAs(['academy_admin']);
  const cat = await request(app)
    .post('/api/v1/admin/categories')
    .set(bearer(admin.token))
    .send({ name: 'Data Science' });
  expect(cat.status).toBe(201);
  return { ...admin, categoryId: cat.body.data.id as string };
}

const DESCRIPTION = 'A practical introduction to analysing data with real-world projects.';

describe('course administration', () => {
  it('creates a draft that is invisible publicly until published', async () => {
    const { token, categoryId } = await adminWithCategory();
    const created = await request(app)
      .post('/api/v1/admin/courses')
      .set(bearer(token))
      .send({
        title: 'Introduction to Data Science',
        categoryId,
        description: DESCRIPTION,
        feeAmount: 15000,
        registrationMode: 'open',
        startDate: '2099-01-10',
        endDate: '2099-03-10',
      });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      slug: 'introduction-to-data-science',
      publicationStatus: 'draft',
      displayStatus: 'draft',
    });

    expect((await request(app).get('/api/v1/courses')).body.data).toHaveLength(0);
    expect((await request(app).get('/api/v1/courses/introduction-to-data-science')).status).toBe(404);

    const pub = await request(app)
      .post(`/api/v1/admin/courses/${created.body.data.id}/publish`)
      .set(bearer(token));
    expect(pub.status).toBe(200);
    expect(pub.body.data.displayStatus).toBe('registration_open');

    const list = await request(app).get('/api/v1/courses');
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta).toMatchObject({ total: 1, page: 1 });
    const detail = await request(app).get('/api/v1/courses/introduction-to-data-science');
    expect(detail.body.data).toMatchObject({
      isFree: false,
      feeAmount: 15000,
      category: { slug: 'data-science' },
    });
    expect(detail.body.data.publicationStatus).toBeUndefined(); // admin-only field
    expect(await AuditLog.countDocuments({ action: 'course.published' })).toBe(1);
  });

  it('refuses to publish incomplete courses', async () => {
    const { token } = await adminWithCategory();
    const c = await request(app)
      .post('/api/v1/admin/courses')
      .set(bearer(token))
      .send({ title: 'Bare course' });
    const pub = await request(app).post(`/api/v1/admin/courses/${c.body.data.id}/publish`).set(bearer(token));
    expect(pub.status).toBe(400);
    expect(pub.body.error.fields).toHaveProperty('description');
    expect(pub.body.error.fields).toHaveProperty('categoryId');
  });

  it('generates unique slugs and rejects explicit duplicates', async () => {
    const { token } = await adminWithCategory();
    const a = await request(app)
      .post('/api/v1/admin/courses')
      .set(bearer(token))
      .send({ title: 'Web Basics' });
    const b = await request(app)
      .post('/api/v1/admin/courses')
      .set(bearer(token))
      .send({ title: 'Web Basics' });
    expect(a.body.data.slug).toBe('web-basics');
    expect(b.body.data.slug).toBe('web-basics-2');
    const c = await request(app)
      .post('/api/v1/admin/courses')
      .set(bearer(token))
      .send({ title: 'Other', slug: 'web-basics' });
    expect(c.status).toBe(409);
  });

  it('only accepts active users with the instructor role as instructors', async () => {
    const { token } = await adminWithCategory();
    const student = await createUser({ roles: ['student'] });
    const teacher = await createUser({ roles: ['instructor'], fullName: 'Dr. Farah' });
    const bad = await request(app)
      .post('/api/v1/admin/courses')
      .set(bearer(token))
      .send({ title: 'Stats', instructorIds: [student.id] });
    expect(bad.status).toBe(400);
    const good = await request(app)
      .post('/api/v1/admin/courses')
      .set(bearer(token))
      .send({ title: 'Stats', instructorIds: [teacher.id] });
    expect(good.status).toBe(201);
    expect(good.body.data.instructors[0]).toMatchObject({ fullName: 'Dr. Farah' });
  });

  it('archives courses, closes registration and blocks further edits', async () => {
    const { token } = await adminWithCategory();
    const c = await request(app)
      .post('/api/v1/admin/courses')
      .set(bearer(token))
      .send({ title: 'Old course', registrationMode: 'open' });
    const arch = await request(app)
      .post(`/api/v1/admin/courses/${c.body.data.id}/archive`)
      .set(bearer(token));
    expect(arch.body.data).toMatchObject({ publicationStatus: 'archived', registrationMode: 'closed' });
    expect(
      (
        await request(app)
          .patch(`/api/v1/admin/courses/${c.body.data.id}`)
          .set(bearer(token))
          .send({ title: 'New' })
      ).status,
    ).toBe(409);
  });

  it('validates dates and money', async () => {
    const { token } = await adminWithCategory();
    const res = await request(app)
      .post('/api/v1/admin/courses')
      .set(bearer(token))
      .send({ title: 'Bad dates', startDate: '2099-02-01', endDate: '2099-01-01', feeAmount: 10.5 });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('endDate');
    expect(res.body.error.fields).toHaveProperty('feeAmount');
  });
});

describe('public catalogue filtering', () => {
  it('filters by price, registration state, level, category and search', async () => {
    const { token, categoryId } = await adminWithCategory();
    const mk = async (body: Record<string, unknown>) => {
      const c = await request(app)
        .post('/api/v1/admin/courses')
        .set(bearer(token))
        .send({ categoryId, description: DESCRIPTION, ...body });
      await request(app).post(`/api/v1/admin/courses/${c.body.data.id}/publish`).set(bearer(token));
      return c.body.data.id as string;
    };
    await mk({ title: 'Free Python', feeAmount: 0, registrationMode: 'open', level: 'beginner' });
    await mk({ title: 'Paid Statistics', feeAmount: 5000, registrationMode: 'closed', level: 'advanced' });
    const fullId = await mk({ title: 'Full Course', feeAmount: 5000, registrationMode: 'open', capacity: 2 });
    await Course.updateOne({ _id: fullId }, { $set: { enrolledCount: 2 } });

    const titles = async (qs: string) =>
      (await request(app).get(`/api/v1/courses?${qs}`)).body.data
        .map((c: { title: string }) => c.title)
        .sort();
    expect(await titles('price=free')).toEqual(['Free Python']);
    expect(await titles('price=paid')).toEqual(['Full Course', 'Paid Statistics']);
    expect(await titles('registration=open')).toEqual(['Free Python']);
    expect(await titles('registration=closed')).toEqual(['Full Course', 'Paid Statistics']);
    expect(await titles('level=advanced')).toEqual(['Paid Statistics']);
    expect(await titles('q=pyth')).toEqual(['Free Python']);
    expect(await titles('q=.*')).toEqual([]); // regex input is escaped
    expect(await titles('category=data-science')).toHaveLength(3);
    expect(await titles('category=unknown-cat')).toEqual([]);

    const full = (await request(app).get('/api/v1/courses/full-course')).body.data;
    expect(full).toMatchObject({
      seatsRemaining: 0,
      registrationOpen: false,
      displayStatus: 'registration_closed',
    });

    const page = await request(app).get('/api/v1/courses?limit=2&page=2&sort=title');
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta).toMatchObject({ total: 3, totalPages: 2 });
  });

  it('rejects operator injection in query parameters', async () => {
    const res = await request(app).get('/api/v1/courses?level[$ne]=x');
    expect(res.status).toBe(400);
  });
});
