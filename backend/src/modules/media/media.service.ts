import { createHmac, randomBytes } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromFile } from 'file-type';
import type { Types } from 'mongoose';
import {
  MEDIA_PURPOSES,
  MEDIA_URL_RE,
  mediaContentPath,
  type MediaAssetDto,
  type MediaPurpose,
} from '@alifya/shared';
import { env } from '../../config/env.js';
import { storage } from '../../integrations/storage/index.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { ApiError } from '../../utils/api-error.js';
import { safeEqual } from '../../utils/crypto.js';
import type { RequestContext } from '../../utils/request.js';
import { audit } from '../audit/audit.service.js';
import { MediaAsset } from './media.model.js';

type MediaDoc = {
  _id: Types.ObjectId;
  purpose: string;
  originalName: string;
  mimeType: string;
  size: number;
  visibility: string;
  owner: Types.ObjectId;
  storageKey: string;
  createdAt: Date;
};

export function toMediaDto(m: MediaDoc): MediaAssetDto {
  return {
    id: String(m._id),
    purpose: m.purpose as MediaPurpose,
    originalName: m.originalName,
    mimeType: m.mimeType,
    size: m.size,
    visibility: m.visibility as 'public' | 'private',
    url: mediaContentPath(String(m._id)),
    createdAt: m.createdAt.toISOString(),
  };
}

export function canUploadPurpose(actor: AuthContext, purpose: MediaPurpose): boolean {
  const rule = MEDIA_PURPOSES[purpose];
  if (rule.anyPermission.length === 0) return true;
  if (rule.anyPermission.some((p) => actor.permissions.has(p))) return true;
  const roles = 'roles' in rule ? (rule.roles as readonly string[]) : [];
  return actor.roles.some((r) => roles.includes(r.key));
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

/** Keeps a readable display name only; storage keys are always server-generated. */
const sanitizeName = (name: string) =>
  path
    .basename(name)
    .replace(/[^\w.\- ()]+/g, '_')
    .slice(0, 150) || 'file';

/**
 * Validates a temp upload by CONTENT (magic bytes), size and purpose rules, then moves it into storage.
 * The temp file is always removed on failure.
 */
export async function storeUpload(
  actor: AuthContext,
  purpose: MediaPurpose,
  file: { path: string; originalname: string; size: number },
  ctx: RequestContext,
): Promise<MediaAssetDto> {
  const rule = MEDIA_PURPOSES[purpose];
  try {
    if (!canUploadPurpose(actor, purpose))
      throw ApiError.forbidden('You cannot upload files for this purpose');
    if (file.size > rule.maxBytes) {
      throw ApiError.badRequest(`File is too large (max ${Math.round(rule.maxBytes / 1024 / 1024)} MB)`, {
        file: 'Too large',
      });
    }
    const detected = await fileTypeFromFile(file.path);
    if (!detected || !(rule.types as readonly string[]).includes(detected.mime)) {
      throw ApiError.badRequest('This file type is not allowed here', { file: 'Unsupported file type' });
    }
    const now = new Date();
    const storageKey = `${rule.visibility}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomBytes(16).toString('hex')}.${EXT[detected.mime] ?? 'bin'}`;
    await storage.putFromTempFile(file.path, storageKey);
    const asset = await MediaAsset.create({
      purpose,
      storageKey,
      originalName: sanitizeName(file.originalname),
      mimeType: detected.mime,
      size: file.size,
      visibility: rule.visibility,
      owner: actor.userId,
    });
    await audit({
      actor: actor.userId,
      action: 'media.uploaded',
      targetType: 'MediaAsset',
      targetId: asset._id,
      metadata: { purpose, mimeType: detected.mime, size: file.size },
      ctx,
    });
    return toMediaDto(asset.toObject() as MediaDoc);
  } catch (err) {
    await rm(file.path, { force: true });
    throw err;
  }
}

/* ---------------- private access ---------------- */

/**
 * Modules that attach private files (lessons, submissions, payment evidence...) register a resolver that
 * decides whether a user may read a given asset. Access is denied unless some resolver allows it.
 */
export type PrivateAccessResolver = (assetId: string, actor: AuthContext) => Promise<boolean>;
const resolvers: PrivateAccessResolver[] = [];
export const registerPrivateAccessResolver = (fn: PrivateAccessResolver) => resolvers.push(fn);

export async function canReadPrivate(asset: MediaDoc, actor: AuthContext | undefined): Promise<boolean> {
  if (!actor) return false;
  if (asset.owner.equals(actor.userId)) return true;
  for (const r of resolvers) if (await r(String(asset._id), actor)) return true;
  return false;
}

const SIGNED_TTL_SECONDS = 10 * 60;
const sign = (id: string, exp: number) =>
  createHmac('sha256', env.JWT_ACCESS_SECRET).update(`media:${id}:${exp}`).digest('base64url');

/** Short-lived link usable in <video>/<a download> without exposing a bearer token. */
export function signedUrl(id: string, now = Date.now()): { url: string; expiresAt: string } {
  const exp = Math.floor(now / 1000) + SIGNED_TTL_SECONDS;
  return {
    url: `${mediaContentPath(id)}?exp=${exp}&sig=${sign(id, exp)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifySignature(id: string, exp: unknown, sig: unknown): boolean {
  if (typeof exp !== 'string' || typeof sig !== 'string' || !/^\d+$/.test(exp)) return false;
  if (Number(exp) * 1000 < Date.now()) return false;
  return safeEqual(sign(id, Number(exp)), sig);
}

export async function findActiveAsset(id: string): Promise<MediaDoc> {
  const asset = await MediaAsset.findOne({ _id: id, deletedAt: null }).lean<MediaDoc>();
  if (!asset) throw ApiError.notFound('File not found');
  return asset;
}

export async function deleteAsset(actor: AuthContext, id: string, ctx: RequestContext): Promise<void> {
  const asset = await findActiveAsset(id);
  // Non-owners need an explicit staff permission for this purpose. Being *allowed to upload* (e.g. any
  // user may upload an avatar, instructors their own photo) never grants deleting other people's files.
  const isOwner = asset.owner.equals(actor.userId);
  const rule = MEDIA_PURPOSES[asset.purpose as MediaPurpose];
  const isStaff = rule.anyPermission.some((p) => actor.permissions.has(p));
  if (!isOwner && !isStaff) throw ApiError.forbidden();
  await MediaAsset.updateOne({ _id: asset._id }, { $set: { deletedAt: new Date() } });
  await storage.remove(asset.storageKey);
  await audit({
    actor: actor.userId,
    action: 'media.deleted',
    targetType: 'MediaAsset',
    targetId: asset._id,
    metadata: { purpose: asset.purpose },
    ctx,
  });
}

/**
 * Validates a URL about to be stored in a PUBLIC-facing field (thumbnails, photos, logos).
 * Uploaded assets must exist, not be deleted and be public; external links must be https (schema-checked).
 */
export async function assertPublicAssetUrl(url: string | null | undefined, field: string): Promise<void> {
  if (!url) return;
  const m = MEDIA_URL_RE.exec(url);
  if (!m) return;
  const asset = await MediaAsset.findOne({ _id: m[1], deletedAt: null }).select('visibility').lean();
  if (!asset) throw ApiError.badRequest('The uploaded file no longer exists', { [field]: 'File not found' });
  if (asset.visibility !== 'public')
    throw ApiError.badRequest('Private files cannot be used here', { [field]: 'Private file' });
}
