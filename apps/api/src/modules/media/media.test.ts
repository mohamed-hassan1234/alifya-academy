import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, bearer, loginAs } from '../../test/helpers.js';
import { AuditLog } from '../audit/audit-log.model.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

const upload = (token: string, purpose: string, buf: Buffer, name: string) =>
  request(app).post('/api/v1/media').set(bearer(token)).field('purpose', purpose).attach('file', buf, name);

describe('media uploads', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/media')
      .field('purpose', 'avatar')
      .attach('file', PNG, 'a.png');
    expect(res.status).toBe(401);
  });

  it('stores a sniffed image and serves it publicly with immutable caching', async () => {
    const { token } = await loginAs(['student']);
    const res = await upload(token, 'avatar', PNG, '../../etc/My Photo!.png');
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      mimeType: 'image/png',
      visibility: 'public',
      originalName: 'My Photo_.png',
    });
    const content = await request(app).get(res.body.data.url);
    expect(content.status).toBe(200);
    expect(content.headers['content-type']).toBe('image/png');
    expect(content.headers['cache-control']).toContain('immutable');
    expect(await AuditLog.countDocuments({ action: 'media.uploaded' })).toBe(1);
  });

  it('rejects files whose content does not match an allowed type (extension is ignored)', async () => {
    const { token } = await loginAs(['student']);
    const res = await upload(token, 'avatar', Buffer.from('<script>alert(1)</script>'), 'evil.png');
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('file');
    // A real PDF is still not acceptable as an avatar.
    expect((await upload(token, 'avatar', PDF, 'cv.pdf')).status).toBe(400);
  });

  it('enforces per-purpose size limits', async () => {
    const { token } = await loginAs(['student']);
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024 + 10)]);
    const res = await upload(token, 'avatar', big, 'big.png');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/too large/i);
  });

  it('enforces purpose permissions', async () => {
    const student = await loginAs(['student']);
    expect((await upload(student.token, 'course_thumbnail', PNG, 't.png')).status).toBe(403);
    expect((await upload(student.token, 'lesson_resource', PDF, 'notes.pdf')).status).toBe(403);
    const instructor = await loginAs(['instructor']);
    expect((await upload(instructor.token, 'instructor_photo', PNG, 'me.png')).status).toBe(201);
    expect((await upload(instructor.token, 'site_asset', PNG, 'logo.png')).status).toBe(403);
  });

  it('protects private files: owner yes, others no, anonymous needs a valid signed link', async () => {
    const owner = await loginAs(['instructor']);
    const up = await upload(owner.token, 'lesson_resource', PDF, 'week1.pdf');
    expect(up.status).toBe(201);
    expect(up.body.data.visibility).toBe('private');
    const url = up.body.data.url as string;

    expect((await request(app).get(url)).status).toBe(401);
    expect((await request(app).get(url).set(bearer(owner.token))).status).toBe(200);
    const other = await loginAs(['student']);
    expect((await request(app).get(url).set(bearer(other.token))).status).toBe(403);
    expect(
      (await request(app).get(`/api/v1/media/${up.body.data.id}/link`).set(bearer(other.token))).status,
    ).toBe(403);

    const link = await request(app).get(`/api/v1/media/${up.body.data.id}/link`).set(bearer(owner.token));
    expect(link.status).toBe(200);
    const signed = await request(app).get(link.body.data.url);
    expect(signed.status).toBe(200);
    expect(signed.headers['cache-control']).toContain('no-store');
    const tampered = (link.body.data.url as string).replace(/sig=.{4}/, 'sig=AAAA');
    expect((await request(app).get(tampered)).status).toBe(401);
    expect((await request(app).get(`${url}?exp=1&sig=x`)).status).toBe(401);
  });

  it('lets owners delete their files', async () => {
    const { token } = await loginAs(['student']);
    const up = await upload(token, 'avatar', PNG, 'a.png');
    const other = await loginAs(['student']);
    expect(
      (await request(app).delete(`/api/v1/media/${up.body.data.id}`).set(bearer(other.token))).status,
    ).toBe(403);
    expect((await request(app).delete(`/api/v1/media/${up.body.data.id}`).set(bearer(token))).status).toBe(
      200,
    );
    expect((await request(app).get(up.body.data.url)).status).toBe(404);
  });
});
