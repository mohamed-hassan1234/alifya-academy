import type { NextFunction, Request, Response } from 'express';
import type { Permission } from '@alifya/shared';
import { ApiError } from '../utils/api-error.js';

/** Requires ALL listed permissions. Must run after `authenticate`. */
export const requirePermission =
  (...required: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(ApiError.unauthenticated());
    const missing = required.filter((p) => !req.auth!.permissions.has(p));
    next(missing.length ? ApiError.forbidden() : undefined);
  };

/** Requires AT LEAST ONE of the listed permissions. */
export const requireAnyPermission =
  (...options: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(ApiError.unauthenticated());
    next(options.some((p) => req.auth!.permissions.has(p)) ? undefined : ApiError.forbidden());
  };

export const hasPermission = (req: Request, p: Permission): boolean => !!req.auth?.permissions.has(p);
