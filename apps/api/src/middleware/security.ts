import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';
import { safeEqual } from '../utils/crypto.js';

export const CSRF_COOKIE = 'alf_csrf';
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit CSRF protection for endpoints authenticated by cookie (refresh, logout).
 * Bearer-token endpoints are not CSRF-prone because browsers never attach the header automatically.
 */
export function requireCsrf(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.get('origin');
  if (origin && !env.webOrigins.includes(origin))
    return next(new ApiError(403, 'CSRF_FAILED', 'Origin not allowed'));
  const cookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const header = req.get(CSRF_HEADER);
  if (!cookie || !header || !safeEqual(cookie, header)) {
    return next(
      new ApiError(403, 'CSRF_FAILED', 'Security token missing or invalid. Please reload the page.'),
    );
  }
  next();
}

const rateLimitHandler = (_req: Request, _res: Response, next: NextFunction) =>
  next(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please wait and try again.'));

const skipInTests = () => env.NODE_ENV === 'test';

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipInTests,
});

/** Tight limiter for credential and email-sending endpoints. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipInTests,
});
