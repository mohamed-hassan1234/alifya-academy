import { Schema, model, type InferSchemaType } from 'mongoose';
import { MEDIA_PURPOSE_KEYS } from '@alifya/shared';

/** Metadata for an uploaded file. The binary lives in the storage driver, never in MongoDB. */
const mediaAssetSchema = new Schema(
  {
    purpose: { type: String, enum: MEDIA_PURPOSE_KEYS, required: true },
    storageKey: { type: String, required: true },
    originalName: { type: String, required: true, maxlength: 200 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 1 },
    visibility: { type: String, enum: ['public', 'private'], required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
mediaAssetSchema.index({ storageKey: 1 }, { unique: true });
mediaAssetSchema.index({ owner: 1, createdAt: -1 });

export type MediaAssetAttrs = InferSchemaType<typeof mediaAssetSchema>;
export const MediaAsset = model('MediaAsset', mediaAssetSchema);
