import { Schema, model } from 'mongoose';

export const ONE_TIME_TOKEN_TYPES = ['email_verification', 'password_reset'] as const;
export type OneTimeTokenType = (typeof ONE_TIME_TOKEN_TYPES)[number];

/** Email-verification and password-reset tokens. Only the SHA-256 hash is stored. */
const oneTimeTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ONE_TIME_TOKEN_TYPES, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
oneTimeTokenSchema.index({ tokenHash: 1 }, { unique: true });
oneTimeTokenSchema.index({ user: 1, type: 1 });
oneTimeTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 3600 });

export const OneTimeToken = model('OneTimeToken', oneTimeTokenSchema);
