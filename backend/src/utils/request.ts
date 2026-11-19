import type { Request } from 'express';
import { ApiError } from './api-error.js';

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

export const requestContext = (req: Request): RequestContext => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
});

/** Returns the authenticated user or throws — use only after `authenticate`. */
export function requireUser(req: Request) {
  if (!req.auth) throw ApiError.unauthenticated();
  return req.auth;
}

export function param(req: Request, name: string): string {
  const v = req.params[name];
  if (!v) throw ApiError.notFound();
  return v;
}
