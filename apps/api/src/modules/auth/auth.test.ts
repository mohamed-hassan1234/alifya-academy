import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  app,
  bearer,
  cookieValue,
  createUser,
  login,
  outbox,
  PASSWORD,
  tokenFromEmail,
} from '../../test/helpers.js';
import { User } from '../users/user.model.js';

const registration = {
  fullName: 'Amina Hassan',
  email: 'amina@example.com',
  phone: '+252 61 000 0000',
  password: PASSWORD,
  confirmPassword: PASSWORD,
  acceptTerms: true,
};

describe('health', () => {
  it('reports liveness and readiness', async () => {
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
    const ready = await request(app).get('/api/v1/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.data.database).toBe('up');
  });
  it('returns a JSON 404 envelope for unknown endpoints', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });
});

describe('registration → verification → login journey', () => {
  it('registers a pending student, blocks login until verified, then signs in', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registration);
    expect(reg.status).toBe(201);

    const user = await User.findOne({ email: 'amina@example.com' }).populate<{ roles: { key: string }[] }>(
      'roles',
    );
    expect(user?.status).toBe('pending_verification');
    expect(user?.roles.map((r) => r.key)).toEqual(['student']);

    const blocked = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'amina@example.com', password: PASSWORD });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');

    const token = tokenFromEmail('amina@example.com');
    expect((await request(app).post('/api/v1/auth/verify-email').send({ token })).status).toBe(200);
    // single-use
    expect((await request(app).post('/api/v1/auth/verify-email').send({ token })).status).toBe(400);

    const { token: access } = await login('AMINA@example.com');
    const me = await request(app).get('/api/v1/auth/me').set(bearer(access));
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ email: 'amina@example.com', status: 'active', permissions: [] });
    expect(me.body.data.passwordHash).toBeUndefined();
  });

  it('never stores plain-text passwords', async () => {
    await request(app).post('/api/v1/auth/register').send(registration);
    const doc = await User.findOne({ email: 'amina@example.com' }).select('+passwordHash').lean();
    expect(doc?.passwordHash).toMatch(/^\$2[aby]\$04\$/); // test cost
    // Production must keep cost 12 (only NODE_ENV=test lowers it).
    const { PRODUCTION_BCRYPT_COST } = await import('./auth.service.js');
    expect(PRODUCTION_BCRYPT_COST).toBe(12);
  });

  it('does not reveal whether an email is already registered', async () => {
    await createUser({ email: 'taken@example.com' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registration, email: 'taken@example.com' });
    expect(res.status).toBe(201);
    expect(await User.countDocuments({ email: 'taken@example.com' })).toBe(1);
    expect(outbox().at(-1)?.subject).toMatch(/sign-up attempt/i);
  });

  it('returns field errors for invalid input', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registration, password: 'short', acceptTerms: false });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('password');
    expect(res.body.error.fields).toHaveProperty('acceptTerms');
  });
});

describe('login protection', () => {
  it('uses one generic message for unknown email and wrong password', async () => {
    await createUser({ email: 'real@example.com' });
    const a = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@example.com', password: PASSWORD });
    const b = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'real@example.com', password: 'WrongPassword1' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it('locks the account after repeated failures', async () => {
    await createUser({ email: 'lock@example.com' });
    for (let i = 0; i < 8; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'lock@example.com', password: 'WrongPassword1' });
    }
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'lock@example.com', password: PASSWORD });
    expect(res.status).toBe(423);
  });

  it('rejects suspended accounts', async () => {
    await createUser({ email: 'sus@example.com', status: 'suspended' });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'sus@example.com', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  it('rejects tampered or missing access tokens', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/v1/auth/me').set(bearer('abc.def.ghi'))).status).toBe(401);
  });
});

describe('session cookies, refresh rotation and CSRF', () => {
  it('sets an HttpOnly SameSite=Strict refresh cookie', async () => {
    const u = await createUser();
    const { res } = await login(u.email);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const rt = cookies.find((c) => c.startsWith('alf_rt='))!;
    expect(rt).toMatch(/HttpOnly/);
    expect(rt).toMatch(/SameSite=Strict/);
    expect(rt).toMatch(/Path=\/api\/v1\/auth/);
    expect(res.body.data.refreshToken).toBeUndefined();
  });

  it('requires the CSRF header to refresh', async () => {
    const u = await createUser();
    const { agent } = await login(u.email);
    const res = await agent.post('/api/v1/auth/refresh');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('rotates refresh tokens and revokes the family when an old token is replayed', async () => {
    const u = await createUser();
    const { agent, csrf, res: loginRes } = await login(u.email);
    const firstRt = cookieValue(loginRes, 'alf_rt')!;

    const r1 = await agent.post('/api/v1/auth/refresh').set('x-csrf-token', csrf);
    expect(r1.status).toBe(200);
    const newCsrf = cookieValue(r1, 'alf_csrf')!;
    const newAccess = r1.body.data.accessToken as string;

    // Replay the first (already rotated) token after the grace window.
    const { UserSession } = await import('./session.model.js');
    await UserSession.updateMany(
      { rotatedAt: { $ne: null } },
      { $set: { rotatedAt: new Date(Date.now() - 60_000) } },
    );
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`alf_rt=${firstRt}`, `alf_csrf=${newCsrf}`])
      .set('x-csrf-token', newCsrf);
    expect(replay.status).toBe(401);

    // The legitimate (latest) session was revoked too, and so is its access token.
    expect((await agent.post('/api/v1/auth/refresh').set('x-csrf-token', newCsrf)).status).toBe(401);
    expect((await request(app).get('/api/v1/auth/me').set(bearer(newAccess))).status).toBe(401);
  });

  it('logout invalidates the refresh token and outstanding access token', async () => {
    const u = await createUser();
    const { agent, csrf, token } = await login(u.email);
    expect((await agent.post('/api/v1/auth/logout').set('x-csrf-token', csrf)).status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set(bearer(token))).status).toBe(401);
  });
});

describe('password reset & change', () => {
  it('resets the password with a one-time token and revokes existing sessions', async () => {
    const u = await createUser({ email: 'reset@example.com' });
    const { token: oldAccess } = await login(u.email);

    const fp = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'reset@example.com' });
    expect(fp.status).toBe(202);
    const resetToken = tokenFromEmail('reset@example.com');

    const newPw = 'BrandNewPass2026';
    const rp = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: newPw, confirmPassword: newPw });
    expect(rp.status).toBe(200);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/reset-password')
          .send({ token: resetToken, password: newPw, confirmPassword: newPw })
      ).status,
    ).toBe(400);

    expect((await request(app).get('/api/v1/auth/me').set(bearer(oldAccess))).status).toBe(401);
    expect(
      (await request(app).post('/api/v1/auth/login').send({ email: 'reset@example.com', password: PASSWORD }))
        .status,
    ).toBe(401);
    await login('reset@example.com', newPw);
  });

  it('gives the same response for unknown emails (no enumeration)', async () => {
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(202);
    expect(outbox()).toHaveLength(0);
  });

  it('changes password, keeps the current session and signs out others', async () => {
    const u = await createUser();
    const a = await login(u.email);
    const b = await login(u.email);
    const newPw = 'AnotherPass2026';
    const res = await request(app)
      .patch('/api/v1/users/me/password')
      .set(bearer(a.token))
      .send({ currentPassword: PASSWORD, newPassword: newPw, confirmPassword: newPw });
    expect(res.status).toBe(200);
    expect((await request(app).get('/api/v1/users/me').set(bearer(a.token))).status).toBe(200);
    expect((await request(app).get('/api/v1/users/me').set(bearer(b.token))).status).toBe(401);
  });
});
