import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, bearer, loginAs } from '../../test/helpers.js';
import { Webinar } from './webinars.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const DESC = 'A practical session on the essential skills for working with modern AI tools.';
const MEETING = 'https://zoom.us/j/1234567890';
const hours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

async function createWebinar(token: string, extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/admin/webinars')
    .set(bearer(token))
    .send({
      title: 'Mastering AI',
      description: DESC,
      topic: 'Artificial Intelligence',
      speakers: [{ name: 'Guest Speaker', title: 'Founder' }],
      startsAt: hours(48),
      endsAt: hours(50),
      meetingUrl: MEETING,
      meetingPasscode: 'secret-pass',
      ...extra,
    });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; slug: string };
}

const publish = (token: string, id: string) =>
  request(app).post(`/api/v1/admin/webinars/${id}/publish`).set(bearer(token));
const registerFor = (token: string, slug: string) =>
  request(app).post(`/api/v1/webinars/${slug}/registration`).set(bearer(token));

describe('webinars', () => {
  it('admin creates with a poster and publishes; students register once; join details stay private', async () => {
    const admin = await loginAs(['academy_admin']);
    const poster = await request(app)
      .post('/api/v1/media')
      .set(bearer(admin.token))
      .field('purpose', 'webinar_image')
      .attach('file', PNG, 'poster.png');
    expect(poster.status).toBe(201);

    const w = await createWebinar(admin.token, { posterUrl: poster.body.data.url });
    expect((await request(app).get(`/api/v1/webinars/${w.slug}`)).status).toBe(404); // still a draft
    expect((await publish(admin.token, w.id)).status).toBe(200);

    const list = await request(app).get('/api/v1/webinars');
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ slug: w.slug, status: 'registration_open' });
    const detail = await request(app).get(`/api/v1/webinars/${w.slug}`);
    expect(detail.body.data.posterUrl).toBe(poster.body.data.url);
    // Private fields never appear publicly
    expect(JSON.stringify(list.body)).not.toContain(MEETING);
    expect(JSON.stringify(detail.body)).not.toContain('secret-pass');

    const student = await loginAs(['student']);
    const reg = await registerFor(student.token, w.slug);
    expect(reg.status).toBe(201);
    expect(reg.body.data).toMatchObject({ registered: true, canJoinNow: false, meetingUrl: null });
    expect((await registerFor(student.token, w.slug)).status).toBe(409); // duplicate prevented
    expect((await Webinar.findById(w.id).lean())!.registeredCount).toBe(1);

    // Staff see the registration and can record attendance
    const regs = await request(app)
      .get(`/api/v1/admin/webinars/${w.id}/registrations`)
      .set(bearer(admin.token));
    expect(regs.body.data).toHaveLength(1);
    const att = await request(app)
      .patch(`/api/v1/admin/webinars/${w.id}/registrations/${regs.body.data[0].id}`)
      .set(bearer(admin.token))
      .send({ attended: true });
    expect(att.body.data.attendedAt).toBeTruthy();

    // Cancelling frees the seat; registering again is allowed
    const cancel = await request(app)
      .delete(`/api/v1/webinars/${w.slug}/registration`)
      .set(bearer(student.token));
    expect(cancel.status).toBe(200);
    expect((await Webinar.findById(w.id).lean())!.registeredCount).toBe(0);
    expect((await registerFor(student.token, w.slug)).status).toBe(201);
  });

  it('shows join details only to registered participants inside the join window', async () => {
    const admin = await loginAs(['academy_admin']);
    // Starts in 10 minutes; joining opens 15 minutes before, so it is open now.
    const w = await createWebinar(admin.token, { startsAt: hours(1 / 6), endsAt: hours(2) });
    await publish(admin.token, w.id);

    const outsider = await loginAs(['student']);
    const notReg = await request(app)
      .get(`/api/v1/webinars/${w.slug}/registration`)
      .set(bearer(outsider.token));
    expect(notReg.body.data).toMatchObject({ registered: false, canJoinNow: false, meetingUrl: null });

    const student = await loginAs(['student']);
    await registerFor(student.token, w.slug);
    const mine = await request(app).get(`/api/v1/webinars/${w.slug}/registration`).set(bearer(student.token));
    expect(mine.body.data).toMatchObject({
      registered: true,
      canJoinNow: true,
      meetingUrl: MEETING,
      meetingPasscode: 'secret-pass',
    });
    expect((await request(app).get(`/api/v1/webinars/${w.slug}/registration`)).status).toBe(401);
  });

  it('enforces capacity, cancellation and closed registration', async () => {
    const admin = await loginAs(['academy_admin']);
    const w = await createWebinar(admin.token, { capacity: 1 });
    await publish(admin.token, w.id);
    const a = await loginAs(['student']);
    const b = await loginAs(['student']);
    expect((await registerFor(a.token, w.slug)).status).toBe(201);
    expect((await registerFor(b.token, w.slug)).status).toBe(409); // full
    expect((await request(app).get(`/api/v1/webinars/${w.slug}`)).body.data).toMatchObject({
      status: 'registration_closed',
      seatsLeft: 0,
    });

    await request(app)
      .post(`/api/v1/admin/webinars/${w.id}/cancel`)
      .set(bearer(admin.token))
      .send({ reason: 'Speaker unavailable' });
    const after = await request(app).get(`/api/v1/webinars/${w.slug}`);
    expect(after.body.data).toMatchObject({ status: 'cancelled', cancelReason: 'Speaker unavailable' });
    expect((await registerFor(b.token, w.slug)).status).toBe(409);
  });

  it('requires publishing prerequisites and staff permissions', async () => {
    const admin = await loginAs(['academy_admin']);
    const bare = await request(app)
      .post('/api/v1/admin/webinars')
      .set(bearer(admin.token))
      .send({ title: 'Bare webinar', startsAt: hours(24), endsAt: hours(25) });
    expect(bare.status).toBe(201);
    expect((await publish(admin.token, bare.body.data.id)).status).toBe(400); // no description/speaker
    const backwards = await request(app)
      .post('/api/v1/admin/webinars')
      .set(bearer(admin.token))
      .send({ title: 'Backwards', startsAt: hours(5), endsAt: hours(4) });
    expect(backwards.status).toBe(400);

    for (const role of ['student', 'finance_officer'] as const) {
      const u = await loginAs([role]);
      expect((await request(app).get('/api/v1/admin/webinars').set(bearer(u.token))).status).toBe(403);
      const create = await request(app)
        .post('/api/v1/admin/webinars')
        .set(bearer(u.token))
        .send({ title: 'X webinar' });
      expect(create.status).toBe(403);
    }
  });
});
