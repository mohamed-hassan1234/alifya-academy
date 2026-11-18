import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { USER_STATUSES, SUPPORTED_LANGUAGES } from '@alifya/shared';

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, default: null, maxlength: 30 },
    passwordHash: { type: String, required: true, select: false },
    status: { type: String, enum: USER_STATUSES, default: 'pending_verification', required: true },
    roles: { type: [{ type: Schema.Types.ObjectId, ref: 'Role' }], default: [] },
    avatarUrl: { type: String, default: null },
    preferredLanguage: { type: String, enum: SUPPORTED_LANGUAGES, default: 'en' },
    emailVerifiedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    failedLoginCount: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },
    statusReason: { type: String, default: null, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ status: 1, createdAt: -1 });
userSchema.index({ roles: 1 });

export type UserAttrs = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserAttrs>;
export const User = model('User', userSchema);
