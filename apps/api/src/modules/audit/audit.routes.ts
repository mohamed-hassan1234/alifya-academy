import { Router } from 'express';
import type { Types } from 'mongoose';
import { auditLogQuerySchema, type AuditLogEntry } from '@alifya/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { parse } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { escapeRegex } from '../../utils/regex.js';
import { ok, paginationMeta } from '../../utils/respond.js';
import { AuditLog } from './audit-log.model.js';

export const adminAuditRouter = Router();

adminAuditRouter.get(
  '/',
  authenticate,
  requirePermission('audit_logs.read'),
  asyncHandler(async (req, res) => {
    const q = parse(auditLogQuerySchema, req.query);
    const filter: Record<string, unknown> = {};
    if (q.action) filter.action = new RegExp(`^${escapeRegex(q.action)}`);
    if (q.actorId) filter.actor = q.actorId;

    const [docs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate<{ actor: { _id: Types.ObjectId; fullName: string; email: string } | null }>(
          'actor',
          'fullName email',
        )
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    const rows: AuditLogEntry[] = docs.map((d) => ({
      id: String(d._id),
      actor: d.actor ? { id: String(d.actor._id), fullName: d.actor.fullName, email: d.actor.email } : null,
      action: d.action,
      targetType: d.targetType ?? null,
      targetId: d.targetId ?? null,
      outcome: d.outcome as 'success' | 'failure',
      metadata: (d.metadata ?? {}) as Record<string, unknown>,
      ip: d.ip ?? null,
      createdAt: (d.createdAt as Date).toISOString(),
    }));
    ok(res, rows, 200, paginationMeta(q.page, q.limit, total));
  }),
);
