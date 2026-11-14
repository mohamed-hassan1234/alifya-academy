import { Router, type CookieOptions, type Response } from 'express';
import {
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
  type AuthSession,
} from '@alifya/shared';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { CSRF_COOKIE, authLimiter, requireCsrf } from '../../middleware/security.js';
import { parse } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { randomToken } from '../../utils/crypto.js';
import { ok } from '../../utils/respond.js';
import { requestContext, requireUser } from '../../utils/request.js';
import * as auth from './auth.service.js';

export const REFRESH_COOKIE = 'alf_rt';

const baseCookie = (): CookieOptions => ({
  secure: env.cookieSecure,
  sameSite: 'strict',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86400_000,
});

function setSessionCookies(res: Response, refreshToken: string) {
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseCookie(), httpOnly: true, path: '/api/v1/auth' });
  // Readable by JS so the SPA can echo it in the X-CSRF-Token header (double-submit pattern).
  res.cookie(CSRF_COOKIE, randomToken(24), { ...baseCookie(), httpOnly: false, path: '/' });
}

function clearSessionCookies(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    path: '/api/v1/auth',
    secure: env.cookieSecure,
    sameSite: 'strict',
    httpOnly: true,
  });
  res.clearCookie(CSRF_COOKIE, { path: '/', secure: env.cookieSecure, sameSite: 'strict' });
}

const sessionBody = (s: auth.IssuedSession): AuthSession => ({
  accessToken: s.accessToken,
  expiresIn: s.expiresIn,
  user: s.user,
});

const GENERIC_EMAIL_SENT = 'If the details are valid, we have sent an email with further instructions.';

export const authRouter = Router();

authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(registerSchema, req.body);
    await auth.register(input, requestContext(req));
    ok(res, { message: 'Account created. Check your email to verify your address before signing in.' }, 201);
  }),
);

authRouter.post(
  '/verify-email',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token } = parse(tokenSchema, req.body);
    await auth.verifyEmail(token, requestContext(req));
    ok(res, { message: 'Email verified. You can now sign in.' });
  }),
);

authRouter.post(
  '/resend-verification',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = parse(emailOnlySchema, req.body);
    await auth.resendVerification(email);
    ok(res, { message: GENERIC_EMAIL_SENT }, 202);
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const session = await auth.login(email, password, requestContext(req));
    setSessionCookies(res, session.refreshToken);
    ok(res, sessionBody(session));
  }),
);

authRouter.post(
  '/refresh',
  requireCsrf,
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) {
      clearSessionCookies(res);
      return ok(res, null);
    }
    try {
      const session = await auth.refresh(token, requestContext(req));
      setSessionCookies(res, session.refreshToken);
      ok(res, sessionBody(session));
    } catch (err) {
      clearSessionCookies(res);
      throw err;
    }
  }),
);

authRouter.post(
  '/logout',
  requireCsrf,
  asyncHandler(async (req, res) => {
    await auth.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined, requestContext(req));
    clearSessionCookies(res);
    ok(res, { message: 'Signed out' });
  }),
);

authRouter.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = parse(emailOnlySchema, req.body);
    await auth.forgotPassword(email, requestContext(req));
    ok(res, { message: GENERIC_EMAIL_SENT }, 202);
  }),
);

authRouter.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token, password } = parse(resetPasswordSchema, req.body);
    await auth.resetPassword(token, password, requestContext(req));
    clearSessionCookies(res);
    ok(res, { message: 'Password updated. Please sign in with your new password.' });
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    ok(res, await auth.loadCurrentUser(requireUser(req).userId));
  }),
);
