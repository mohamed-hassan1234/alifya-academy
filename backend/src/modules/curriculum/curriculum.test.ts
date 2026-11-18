import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, bearer, createUser, login, loginAs } from '../../test/helpers.js';
import { Course } from '../courses/course.model.js';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

async function setup() {
  const admin = await loginAs(['academy_admin']);
  const cat = await request(app)
    .post('/api/v1/admin/categories')
    .set(bearer(admin.token))
    .send({ name: 'Tech' });
  const teacher = await createUser({ roles: ['instructor'], fullName: 'Assigned Teacher' });
  const outsider = await createUser({ roles: ['instructor'], fullName: 'Other Teacher' });
  const c = await request(app)
    .post('/api/v1/admin/courses')
    .set(bearer(admin.token))
    .send({
      title: 'Web Basics',
      categoryId: cat.body.data.id,
      description: 'A practical course about building websites from scratch.',
      instructorIds: [teacher.id],
    });
  await request(app).post(`/api/v1/admin/courses/${c.body.data.id}/publish`).set(bearer(admin.token));
  return {
    admin,
    courseId: c.body.data.id as string,
    teacher: await login(teacher.email),
    outsider: await login(outsider.email),
  };
}

describe('curriculum management authorization', () => {
  it('lets the assigned instructor build the curriculum but blocks unassigned instructors and students', async () => {
    const { courseId, teacher, outsider } = await setup();
    const sec = await request(app)
      .post(`/api/v1/curriculum/courses/${courseId}/sections`)
      .set(bearer(teacher.token))
      .send({ title: 'Week 1' });
    expect(sec.status).toBe(201);
    expect(sec.body.data.can).toEqual({ edit: true, publish: true });

    expect(
      (
        await request(app)
          .post(`/api/v1/curriculum/courses/${courseId}/sections`)
          .set(bearer(outsider.token))
          .send({ title: 'Hijack' })
      ).status,
    ).toBe(403);
    expect(
      (await request(app).get(`/api/v1/curriculum/courses/${courseId}`).set(bearer(outsider.token))).status,
    ).toBe(403);
    const student = await loginAs(['student']);
    expect(
      (await request(app).get(`/api/v1/curriculum/courses/${courseId}`).set(bearer(student.token))).status,
    ).toBe(403);
    expect((await request(app).get(`/api/v1/curriculum/courses/${courseId}`)).status).toBe(401);
  });

  it('lists only assigned courses in the instructor portal', async () => {
    const { teacher, outsider } = await setup();
    const mine = await request(app).get('/api/v1/instructor/courses').set(bearer(teacher.token));
    expect(mine.body.data.map((c: { title: string }) => c.title)).toEqual(['Web Basics']);
    expect(
      (await request(app).get('/api/v1/instructor/courses').set(bearer(outsider.token))).body.data,
    ).toEqual([]);
    const student = await loginAs(['student']);
    expect((await request(app).get('/api/v1/instructor/courses').set(bearer(student.token))).status).toBe(
      403,
    );
  });
});

describe('lessons, publication and the public outline', () => {
  it('only exposes published lessons in the outline, and only preview lessons in full', async () => {
    const { courseId, teacher } = await setup();
    const sec = await request(app)
      .post(`/api/v1/curriculum/courses/${courseId}/sections`)
      .set(bearer(teacher.token))
      .send({ title: 'Week 1' });
    const sectionId = sec.body.data.sections[0].id;

    const mk = (body: object) =>
      request(app)
        .post(`/api/v1/curriculum/courses/${courseId}/lessons`)
        .set(bearer(teacher.token))
        .send({ sectionId, ...body });
    const intro = await mk({
      title: 'Welcome',
      type: 'text',
      content: 'Hello class',
      isPreview: true,
      durationMinutes: 5,
    });
    const secret = await mk({
      title: 'Members only',
      type: 'text',
      content: 'PRIVATE BODY',
      durationMinutes: 20,
    });
    const draft = await mk({ title: 'Unfinished', type: 'text' });
    expect(intro.status).toBe(201);
    expect(draft.body.data.publicationStatus).toBe('draft');

    for (const l of [intro, secret]) {
      expect(
        (
          await request(app)
            .post(`/api/v1/curriculum/lessons/${l.body.data.id}/publish`)
            .set(bearer(teacher.token))
        ).status,
      ).toBe(200);
    }

    const outline = await request(app).get('/api/v1/courses/web-basics/curriculum');
    expect(outline.status).toBe(200);
    expect(outline.body.data.totalLessons).toBe(2);
    expect(outline.body.data.totalMinutes).toBe(25);
    expect(JSON.stringify(outline.body)).not.toContain('PRIVATE BODY');
    expect(JSON.stringify(outline.body)).not.toContain('Unfinished');

    const preview = await request(app).get(
      `/api/v1/courses/web-basics/lessons/${intro.body.data.id}/preview`,
    );
    expect(preview.status).toBe(200);
    expect(preview.body.data.content).toBe('Hello class');
    // Non-preview and draft lessons are never returned publicly — even by guessing ids.
    expect(
      (await request(app).get(`/api/v1/courses/web-basics/lessons/${secret.body.data.id}/preview`)).status,
    ).toBe(404);
    expect(
      (await request(app).get(`/api/v1/courses/web-basics/lessons/${draft.body.data.id}/preview`)).status,
    ).toBe(404);
    expect((await request(app).get('/api/v1/courses/web-basics/lessons/not-an-id/preview')).status).toBe(404);
  });

  it('validates type-specific content', async () => {
    const { courseId, teacher } = await setup();
    const sec = await request(app)
      .post(`/api/v1/curriculum/courses/${courseId}/sections`)
      .set(bearer(teacher.token))
      .send({ title: 'W1' });
    const sectionId = sec.body.data.sections[0].id;
    const bad = await request(app)
      .post(`/api/v1/curriculum/courses/${courseId}/lessons`)
      .set(bearer(teacher.token))
      .send({ sectionId, title: 'Clip', type: 'video' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields).toHaveProperty('videoUrl');
    const http = await request(app)
      .post(`/api/v1/curriculum/courses/${courseId}/lessons`)
      .set(bearer(teacher.token))
      .send({ sectionId, title: 'Clip', type: 'video', videoUrl: 'http://insecure.example/v' });
    expect(http.status).toBe(400);
  });

  it('rejects attaching someone else’s private file, and grants file access to course managers only', async () => {
    const { courseId, teacher, outsider, admin } = await setup();
    const sec = await request(app)
      .post(`/api/v1/curriculum/courses/${courseId}/sections`)
      .set(bearer(teacher.token))
      .send({ title: 'W1' });
    const sectionId = sec.body.data.sections[0].id;

    const theirs = await request(app)
      .post('/api/v1/media')
      .set(bearer(outsider.token))
      .field('purpose', 'lesson_resource')
      .attach('file', PDF, 'theirs.pdf');
    const steal = await request(app)
      .post(`/api/v1/curriculum/courses/${courseId}/lessons`)
      .set(bearer(teacher.token))
      .send({ sectionId, title: 'Reading', type: 'pdf', pdfMediaId: theirs.body.data.id });
    expect(steal.status).toBe(400);

    const mine = await request(app)
      .post('/api/v1/media')
      .set(bearer(teacher.token))
      .field('purpose', 'lesson_resource')
      .attach('file', PDF, 'week1.pdf');
    const lesson = await request(app)
      .post(`/api/v1/curriculum/courses/${courseId}/lessons`)
      .set(bearer(teacher.token))
      .send({
        sectionId,
        title: 'Reading',
        type: 'pdf',
        pdfMediaId: mine.body.data.id,
        resources: [{ mediaId: mine.body.data.id, title: 'Slides' }],
      });
    expect(lesson.status).toBe(201);

    // Admin can read it via the lesson resolver; an unrelated instructor and students cannot.
    expect((await request(app).get(mine.body.data.url).set(bearer(admin.token))).status).toBe(200);
    expect((await request(app).get(mine.body.data.url).set(bearer(outsider.token))).status).toBe(403);
    const student = await loginAs(['student']);
    expect((await request(app).get(mine.body.data.url).set(bearer(student.token))).status).toBe(403);
  });

  it('reorders sections and refuses to delete non-empty sections', async () => {
    const { courseId, teacher } = await setup();
    const a = await request(app)
      .post(`/api/v1/curriculum/courses/${courseId}/sections`)
      .set(bearer(teacher.token))
      .send({ title: 'Part A' });
    const b = await request(app)
      .post(`/api/v1/curriculum/courses/${courseId}/sections`)
      .set(bearer(teacher.token))
      .send({ title: 'Part B' });
    const [idA, idB] = b.body.data.sections.map((s: { id: string }) => s.id);
    expect(a.status).toBe(201);
    const re = await request(app)
      .post(`/api/v1/curriculum/courses/${courseId}/sections/reorder`)
      .set(bearer(teacher.token))
      .send({ ids: [idB, idA] });
    expect(re.body.data.sections.map((s: { title: string }) => s.title)).toEqual(['Part B', 'Part A']);
    expect(
      (
        await request(app)
          .post(`/api/v1/curriculum/courses/${courseId}/sections/reorder`)
          .set(bearer(teacher.token))
          .send({ ids: [idB] })
      ).status,
    ).toBe(400);

    await request(app)
      .post(`/api/v1/curriculum/courses/${courseId}/lessons`)
      .set(bearer(teacher.token))
      .send({ sectionId: idA, title: 'L1', type: 'text' });
    expect(
      (await request(app).delete(`/api/v1/curriculum/sections/${idA}`).set(bearer(teacher.token))).status,
    ).toBe(409);
    expect(
      (await request(app).delete(`/api/v1/curriculum/sections/${idB}`).set(bearer(teacher.token))).status,
    ).toBe(200);
  });

  it('blocks curriculum edits on archived courses', async () => {
    const { courseId, teacher } = await setup();
    await Course.updateOne({ _id: courseId }, { $set: { publicationStatus: 'archived' } });
    expect(
      (
        await request(app)
          .post(`/api/v1/curriculum/courses/${courseId}/sections`)
          .set(bearer(teacher.token))
          .send({ title: 'Week X' })
      ).status,
    ).toBe(409);
  });
});
