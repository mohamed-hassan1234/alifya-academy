import { Router } from 'express';
import { Schema, model } from 'mongoose';
import {
  DEFAULT_TIMEZONE,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LANGUAGES,
  updateSiteSettingsSchema,
  type PublicSiteSettings,
  type UpdateSiteSettingsInput,
} from '@alifya/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { parse } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { ok } from '../../utils/respond.js';
import { requestContext, requireUser } from '../../utils/request.js';
import { audit } from '../audit/audit.service.js';
import { assertPublicAssetUrl } from '../media/media.service.js';

/* ------------------------------ model ------------------------------ */
const siteSettingsSchema = new Schema(
  {
    key: { type: String, default: 'site', immutable: true },
    academyName: { type: String, default: 'Alifya Academy' },
    tagline: { type: String, default: '' },
    /** Official logo reference. Null until the real asset is supplied — never substituted. */
    logoUrl: { type: String, default: null },
    contact: {
      email: { type: String, default: null },
      phones: { type: [String], default: [] },
      address: { type: String, default: null },
    },
    social: {
      facebook: { type: String, default: null },
      instagram: { type: String, default: null },
      linkedin: { type: String, default: null },
      x: { type: String, default: null },
      youtube: { type: String, default: null },
      tiktok: { type: String, default: null },
    },
    hero: {
      title: { type: String, default: null },
      subtitle: { type: String, default: null },
      imageUrl: { type: String, default: null },
    },
    about: {
      imageUrl: { type: String, default: null },
      summary: { type: String, default: null },
      introduction: { type: String, default: null },
      mission: { type: String, default: null },
      vision: { type: String, default: null },
      approach: { type: String, default: null },
      values: { type: [String], default: [] },
      objectives: { type: [String], default: [] },
    },
    defaultTimezone: { type: String, default: DEFAULT_TIMEZONE },
    defaultCurrency: { type: String, enum: SUPPORTED_CURRENCIES, default: 'USD' },
    supportedLanguages: { type: [{ type: String, enum: SUPPORTED_LANGUAGES }], default: ['en', 'so'] },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
siteSettingsSchema.index({ key: 1 }, { unique: true });
export const SiteSettings = model('SiteSettings', siteSettingsSchema);

/* ------------------------------ service ------------------------------ */
async function getOrCreate() {
  return SiteSettings.findOneAndUpdate(
    { key: 'site' },
    { $setOnInsert: { key: 'site' } },
    { upsert: true, new: true },
  ).lean();
}

export async function getPublicSettings(): Promise<PublicSiteSettings> {
  const s = await getOrCreate();
  return {
    academyName: s.academyName,
    tagline: s.tagline,
    logoUrl: s.logoUrl ?? null,
    contact: {
      email: s.contact?.email ?? null,
      phones: s.contact?.phones ?? [],
      address: s.contact?.address ?? null,
    },
    social: { ...(s.social ?? {}) },
    hero: {
      title: s.hero?.title ?? null,
      subtitle: s.hero?.subtitle ?? null,
      imageUrl: s.hero?.imageUrl ?? null,
    },
    about: {
      imageUrl: s.about?.imageUrl ?? null,
      summary: s.about?.summary ?? null,
      introduction: s.about?.introduction ?? null,
      mission: s.about?.mission ?? null,
      vision: s.about?.vision ?? null,
      approach: s.about?.approach ?? null,
      values: s.about?.values ?? [],
      objectives: s.about?.objectives ?? [],
    },
    defaultTimezone: s.defaultTimezone,
    defaultCurrency: s.defaultCurrency as PublicSiteSettings['defaultCurrency'],
    supportedLanguages: s.supportedLanguages as PublicSiteSettings['supportedLanguages'],
  };
}

/** Flattens nested objects into dotted $set paths so partial updates don't wipe sibling fields. */
function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  return Object.entries(obj).reduce<Record<string, unknown>>((acc, [k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v))
      Object.assign(acc, flatten(v as Record<string, unknown>, path));
    else if (v !== undefined) acc[path] = v;
    return acc;
  }, {});
}

/* ------------------------------ routes ------------------------------ */
export const publicSettingsRouter = Router();
publicSettingsRouter.get(
  '/public',
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    ok(res, await getPublicSettings());
  }),
);

export const adminSettingsRouter = Router();
adminSettingsRouter.use(authenticate, requirePermission('settings.manage'));
adminSettingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    ok(res, await getPublicSettings());
  }),
);
adminSettingsRouter.patch(
  '/',
  asyncHandler(async (req, res) => {
    const auth = requireUser(req);
    const input: UpdateSiteSettingsInput = parse(updateSiteSettingsSchema, req.body);
    await assertPublicAssetUrl(input.logoUrl, 'logoUrl');
    await assertPublicAssetUrl(input.hero?.imageUrl, 'hero.imageUrl');
    await assertPublicAssetUrl(input.about?.imageUrl, 'about.imageUrl');
    const set = flatten(input as Record<string, unknown>);
    await getOrCreate();
    await SiteSettings.updateOne({ key: 'site' }, { $set: { ...set, updatedBy: auth.userId } });
    await audit({
      actor: auth.userId,
      action: 'settings.updated',
      targetType: 'SiteSettings',
      metadata: { fields: Object.keys(set) },
      ctx: requestContext(req),
    });
    ok(res, await getPublicSettings());
  }),
);
