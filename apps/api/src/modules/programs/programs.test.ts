import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, bearer, createUser, login, loginAs, outbox } from '../../test/helpers.js';
import { ContactMessage } from '../contact/contact.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const DESC = 'A structured pathway through modern software development topics.';

describe('programs', () => {
  it('admin creates, links courses and publishes; public sees only published programs and published courses', async () => {
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
    const live = await mkCourse('Live Course', true);
    const hidden = await mkCourse('Draft Course', false);

    const p = await request(app)
      .post('/api/v1/admin/programs')
      .set(bearer(admin.token))
      .send({ title: 'Software Pathway', courseIds: [live, hidden] });
    expect(p.status).toBe(201);
    expect(p.body.data).toMatchObject({ slug: 'software-pathway', publicationStatus: 'draft' });
    expect((await request(app).get('/api/v1/programs/software-pathway')).status).toBe(404);

    expect(
      (await request(app).post(`/api/v1/admin/programs/${p.body.data.id}/publish`).set(bearer(admin.token)))
        .status,
    ).toBe(400); // no description
    await request(app)
      .patch(`/api/v1/admin/programs/${p.body.data.id}`)
      .set(bearer(admin.token))
      .send({ description: DESC });
    expect(
      (await request(app).post(`/api/v1/admin/programs/${p.body.data.id}/publish`).set(bearer(admin.token)))
        .status,
    ).toBe(200);

    const pub = await request(app).get('/api/v1/programs/software-pathway');
    expect(pub.body.data.courses.map((c: { title: string }) => c.title)).toEqual(['Live Course']);
    expect((await request(app).get('/api/v1/programs')).body.meta.total).toBe(1);
  });

  it('requires programs.manage', async () => {
    const fin = await loginAs(['finance_officer']);
    expect(
      (await request(app).post('/api/v1/admin/programs').set(bearer(fin.token)).send({ title: 'X program' }))
        .status,
    ).toBe(403);
  });

  it('rejects private files as program images', async () => {
    const admin = await loginAs(['academy_admin']);
    const teacher = await loginAs(['instructor']);
    const pdf = await request(app)
      .post('/api/v1/media')
      .set(bearer(teacher.token))
      .field('purpose', 'lesson_resource')
      .attach('file', Buffer.from('%PDF-1.4\n%%EOF\n'), 'a.pdf');
    const res = await request(app)
      .post('/api/v1/admin/programs')
      .set(bearer(admin.token))
      .send({ title: 'Image test', imageUrl: pdf.body.data.url });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('imageUrl');
  });
});

describe('instructor profiles', () => {
  it('shows only public profiles of active instructors, with their published courses', async () => {
    const admin = await loginAs(['academy_admin']);
    const teacher = await createUser({ roles: ['instructor'], fullName: 'Dr. Hodan' });
    const shy = await createUser({ roles: ['instructor'], fullName: 'Private Person' });

    const self = await login(teacher.email);
    const photo = await request(app)
      .post('/api/v1/media')
      .set(bearer(self.token))
      .field('purpose', 'instructor_photo')
      .attach('file', PNG, 'me.png');
    const saved = await request(app)
      .put('/api/v1/instructor/profile')
      .set(bearer(self.token))
      .send({
        professionalTitle: 'Senior Lecturer',
        specialization: 'Data science',
        biography: 'Teaches data.',
        photoUrl: photo.body.data.url,
        isPublic: true,
        social: { linkedin: 'https://linkedin.com/in/x' },
      });
    expect(saved.status).toBe(200);
    await request(app)
      .put(`/api/v1/admin/instructors/${shy.id}/profile`)
      .set(bearer(admin.token))
      .send({ professionalTitle: 'Lecturer', isPublic: false });

    const list = await request(app).get('/api/v1/instructors');
    expect(list.body.data.map((i: { fullName: string }) => i.fullName)).toEqual(['Dr. Hodan']);
    expect(list.body.data[0]).not.toHaveProperty('email');
    expect(list.body.data[0].photoUrl).toBe(photo.body.data.url);
    expect((await request(app).get(`/api/v1/instructors/${shy.id}`)).status).toBe(404);

    // Suspending the instructor removes them from the public site.
    await request(app)
      .patch(`/api/v1/admin/users/${teacher.id}/status`)
      .set(bearer(admin.token))
      .send({ status: 'suspended' });
    expect((await request(app).get('/api/v1/instructors')).body.data).toEqual([]);
  });

  it('students cannot edit instructor profiles', async () => {
    const student = await loginAs(['student']);
    const teacher = await createUser({ roles: ['instructor'] });
    expect(
      (await request(app).put('/api/v1/instructor/profile').set(bearer(student.token)).send({})).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .put(`/api/v1/admin/instructors/${teacher.id}/profile`)
          .set(bearer(student.token))
          .send({})
      ).status,
    ).toBe(403);
  });
});

describe('contact form', () => {
  const msg = {
    name: 'Asha Ali',
    email: 'asha@example.com',
    subject: 'Course enquiry',
    message: 'When does the next intake start?',
  };

  it('stores messages, emails the academy when configured, and lists them for staff', async () => {
    const admin = await loginAs(['super_admin']);
    await request(app)
      .patch('/api/v1/admin/settings')
      .set(bearer(admin.token))
      .send({ contact: { email: 'info@alifya.test' } });
    const res = await request(app).post('/api/v1/contact').send(msg);
    expect(res.status).toBe(201);
    expect(outbox().some((m) => m.to === 'info@alifya.test' && m.subject.includes('Course enquiry'))).toBe(
      true,
    );
    const list = await request(app).get('/api/v1/admin/contact-messages').set(bearer(admin.token));
    expect(list.body.data[0]).toMatchObject({ name: 'Asha Ali', status: 'new' });
    const student = await loginAs(['student']);
    expect((await request(app).get('/api/v1/admin/contact-messages').set(bearer(student.token))).status).toBe(
      403,
    );
  });

  it('validates input and silently drops honeypot submissions', async () => {
    expect(
      (
        await request(app)
          .post('/api/v1/contact')
          .send({ ...msg, message: 'short' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/contact')
          .send({ ...msg, website: 'http://spam' })
      ).status,
    ).toBe(400);
    const before = await ContactMessage.countDocuments();
    expect(
      (
        await request(app)
          .post('/api/v1/contact')
          .send({ ...msg, website: '' })
      ).status,
    ).toBe(201);
    expect(await ContactMessage.countDocuments()).toBe(before + 1);
  });
});
