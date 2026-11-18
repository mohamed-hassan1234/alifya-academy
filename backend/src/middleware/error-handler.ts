import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@alifya/shared';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/api-error.js';
import { zodFieldErrors } from './validate.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) =>
  next(ApiError.notFound('Endpoint not found'));

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = String(req.id ?? '');
  let apiErr: ApiError;

  if (err instanceof ApiError) {
    apiErr = err;
  } else if (err instanceof ZodError) {
    apiErr = ApiError.badRequest('Please correct the highlighted fields', zodFieldErrors(err));
  } else if (err instanceof mongoose.Error.CastError) {
    apiErr = ApiError.notFound();
  } else if (err instanceof mongoose.Error.ValidationError) {
    const fields = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    apiErr = ApiError.badRequest('Validation failed', fields);
  } else if ((err as { code?: number }).code === 11000) {
    const keys = Object.keys((err as { keyPattern?: object }).keyPattern ?? {});
    apiErr = ApiError.conflict(
      'A record with these details already exists',
      Object.fromEntries(keys.map((k) => [k, 'Already in use'])),
    );
  } else if ((err as { type?: string }).type === 'entity.parse.failed') {
    apiErr = ApiError.badRequest('Malformed JSON body');
  } else if ((err as { type?: string }).type === 'entity.too.large') {
    apiErr = new ApiError(413, 'VALIDATION_ERROR', 'Request body too large');
  } else {
    logger.error({ err, requestId }, 'Unhandled error');
    apiErr = new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  }

  const body: ApiErrorBody = {
    success: false,
    error: {
      code: apiErr.code,
      message: apiErr.message,
      requestId,
      ...(apiErr.fields ? { fields: apiErr.fields } : {}),
    },
  };
  res.status(apiErr.status).json(body);
};
