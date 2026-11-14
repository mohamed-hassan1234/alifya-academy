import type { ApiErrorCode } from '@alifya/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, fields?: Record<string, string>) {
    return new ApiError(400, 'VALIDATION_ERROR', message, fields);
  }
  static unauthenticated(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHENTICATED', message);
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }
  static conflict(message: string, fields?: Record<string, string>) {
    return new ApiError(409, 'CONFLICT', message, fields);
  }
}
