import type { Response } from 'express';
import type { PaginationMeta } from '@alifya/shared';

export function ok<T>(res: Response, data: T, status = 200, meta?: PaginationMeta): Response {
  return res.status(status).json(meta ? { success: true, data, meta } : { success: true, data });
}

export function paginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
