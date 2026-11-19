import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Forwards async errors to the centralized error handler (Express 4 does not do this natively). */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
