import { Schema, model } from 'mongoose';

/**
 * One document per refresh token. Rotation creates a new document in the same `family`;
 * presenting an already-rotated token signals theft and revokes the whole family.
 */
const userSessionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    family: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    rotatedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true },
);
userSessionSchema.index({ tokenHash: 1 }, { unique: true });
userSessionSchema.index({ user: 1, revokedAt: 1 });
userSessionSchema.index({ family: 1 });
userSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 }); // purge a week after expiry

export const UserSession = model('UserSession', userSessionSchema);
