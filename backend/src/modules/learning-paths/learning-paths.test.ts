import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, bearer, loginAs } from '../../test/helpers.js';

const DESC = 'A structured pathway through modern software development topics.';

async function setup() {
  const admin = await loginAs(['academy_admin']);
  const cat = await request(app)
    .post('/api/v1/admin/categories')
    .set(bearer(admin.token))
    .send({ name: 'Tech' });
  const mkCourse = async (title: string, publish: boolean) => {
    const c = await request(app)
      .post('/api/v1/admin/courses')
      .set(bearer(admin.token))
      .send({ title, categoryId: cat.body.data.id, description: DESC });
    if (publish)
      await request(app).post(`/api/v1/admin/courses/${c.body.data.id}/publish`).set(bearer(admin.token));
    return c.body.data.id as string;
  };
  return { admin, live: await mkCourse('Live Course', true), hidden: await mkCourse('Draft Course', false) };
}

describe('learning paths', () => {
  it('admin builds stages and publishes; public sees only published paths and published courses', async () => {
    const { admin, live, hidden } = await setup();
    const created = await request(app)
      .post('/api/v1/admin/learning-paths')
      .set(bearer(admin.token))
      .send({ title: 'Web Developer Path', stages: [{ title: 'Foundations', courseIds: [live, hidden] }] });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      slug: 'web-developer-path',
      publicationStatus: 'draft',
      stageCount: 1,
    });
    const id = created.body.data.id as string;
    expect((await request(app).get('/api/v1/learning-paths/web-developer-path')).status).toBe(404);

    // Needs at least two stages
    expect(
      (await request(app).post(`/api/v1/admin/learning-paths/${id}/publish`).set(bearer(admin.token))).status,
    ).toBe(400);

    const stageId = created.body.data.stages[0].id as string;
    const patched = await request(app)
      .patch(`/api/v1/admin/learning-paths/${id}`)
      .set(bearer(admin.token))
      .send({
        stages: [
          {
            id: stageId,
            title: 'Foundations',
            courseIds: [live, hidden],
            objectives: ['Understand the web'],
          },
          { title: 'Projects', courseIds: [] },
        ],
      });
    expect(patched.status).toBe(200);
    expect(patched.body.data.stages[0].id).toBe(stageId); // stage identity kept on edit
    expect(patched.body.data.stages[0].courseIds).toEqual([live, hidden]);

    expect(
      (await request(app).post(`/api/v1/admin/learning-paths/${id}/publish`).set(bearer(admin.token))).status,
    ).toBe(200);
    const pub = await request(app).get('/api/v1/learning-paths/web-developer-path');
    expect(pub.status).toBe(200);
    expect(pub.body.data.stages).toHaveLength(2);
    expect(pub.body.data.stages[0].courses.map((c: { title: string }) => c.title)).toEqual(['Live Course']);
    expect(pub.body.data.courseCount).toBe(1);
    expect(pub.body.data.stages[0]).not.toHaveProperty('courseIds');

    const list = await request(app).get('/api/v1/learning-paths');
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0]).toMatchObject({ stageCount: 2, courseCount: 1 });
    expect(list.body.data[0]).not.toHaveProperty('stages');
  });

  it('rejects unknown courses and requires learning_paths.manage', async () => {
    const { admin } = await setup();
    const bad = await request(app)
      .post('/api/v1/admin/learning-paths')
      .set(bearer(admin.token))
      .send({ title: 'Broken path', stages: [{ title: 'A', courseIds: ['6af8108481a4a18d4f371d9f'] }] });
    expect(bad.status).toBe(400);

    const fin = await loginAs(['finance_officer']);
    expect(
      (
        await request(app)
          .post('/api/v1/admin/learning-paths')
          .set(bearer(fin.token))
          .send({ title: 'X path' })
      ).status,
    ).toBe(403);
    expect((await request(app).get('/api/v1/admin/learning-paths')).status).toBe(401);
  });
});
