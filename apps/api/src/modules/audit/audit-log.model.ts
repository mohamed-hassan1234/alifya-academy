import { Schema, model } from 'mongoose';

const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true, maxlength: 80 },
    targetType: { type: String, default: null, maxlength: 40 },
    targetId: { type: String, default: null, maxlength: 64 },
    outcome: { type: String, enum: ['success', 'failure'], default: 'success' },
    /** Safe, non-secret context only. Never passwords, tokens or meeting credentials. */
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = model('AuditLog', auditLogSchema);
