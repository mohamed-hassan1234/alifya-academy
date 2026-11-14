import type { ClientSession, Types } from 'mongoose';
import { logger } from '../../config/logger.js';
import type { RequestContext } from '../../utils/request.js';
import { AuditLog } from './audit-log.model.js';

export interface AuditEntry {
  actor: Types.ObjectId | string | null;
  action: string;
  targetType?: string;
  targetId?: string | Types.ObjectId;
  outcome?: 'success' | 'failure';
  metadata?: Record<string, unknown>;
  ctx?: RequestContext;
}

/**
 * Records a sensitive action. With a MongoDB session, the entry commits atomically with the change it
 * describes (and failure aborts the change). Without one, failures are logged but never block the action.
 */
export async function audit(entry: AuditEntry, session?: ClientSession): Promise<void> {
  const doc = {
    actor: entry.actor,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ? String(entry.targetId) : null,
    outcome: entry.outcome ?? 'success',
    metadata: entry.metadata ?? {},
    ip: entry.ctx?.ip ?? null,
    userAgent: entry.ctx?.userAgent ?? null,
  };
  if (session) {
    await AuditLog.create([doc], { session });
    return;
  }
  try {
    await AuditLog.create(doc);
  } catch (err) {
    logger.error({ err, action: entry.action }, 'Failed to write audit log');
  }
}
