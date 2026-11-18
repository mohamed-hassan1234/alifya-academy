import { z } from 'zod';
import { USER_STATUSES, SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES } from '../enums.js';
import { isPermission } from '../permissions.js';
import { assetUrlSchema, objectIdSchema, paginationQuerySchema, timezoneSchema } from './common.js';

export const userListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(USER_STATUSES).optional(),
  role: z
    .string()
    .regex(/^[a-z_]{2,40}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(USER_STATUSES),
  reason: z.string().trim().max(500).optional(),
});

export const assignRolesSchema = z.object({ roleIds: z.array(objectIdSchema).min(1).max(10) });

const permissionKey = z.string().refine(isPermission, 'Unknown permission');

export const createRoleSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z_]{1,39}$/, 'Use lowercase letters and underscores'),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional().default(''),
  permissions: z.array(permissionKey).max(200).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(permissionKey).max(200).optional(),
});

export const auditLogQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().max(80).optional(),
  actorId: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const url = z.string().trim().url().max(2048);
const optionalUrl = url.nullable().optional();

export const updateSiteSettingsSchema = z.object({
  academyName: z.string().trim().min(2).max(120).optional(),
  tagline: z.string().trim().max(200).optional(),
  logoUrl: assetUrlSchema.nullable().optional(),
  contact: z
    .object({
      email: z.string().trim().email().max(254).nullable().optional(),
      phones: z.array(z.string().trim().max(30)).max(5).optional(),
      address: z.string().trim().max(300).nullable().optional(),
    })
    .optional(),
  social: z
    .object({
      facebook: optionalUrl,
      instagram: optionalUrl,
      linkedin: optionalUrl,
      x: optionalUrl,
      youtube: optionalUrl,
      tiktok: optionalUrl,
    })
    .optional(),
  hero: z
    .object({
      title: z.string().trim().max(160).nullable().optional(),
      subtitle: z.string().trim().max(400).nullable().optional(),
      imageUrl: assetUrlSchema.nullable().optional(),
    })
    .optional(),
  about: z
    .object({
      imageUrl: assetUrlSchema.nullable().optional(),
      summary: z.string().trim().max(1500).nullable().optional(),
      introduction: z.string().trim().max(5000).nullable().optional(),
      mission: z.string().trim().max(1500).nullable().optional(),
      vision: z.string().trim().max(1500).nullable().optional(),
      approach: z.string().trim().max(3000).nullable().optional(),
      values: z.array(z.string().trim().min(1).max(200)).max(12).optional(),
      objectives: z.array(z.string().trim().min(1).max(300)).max(12).optional(),
    })
    .optional(),
  defaultTimezone: timezoneSchema.optional(),
  defaultCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
  supportedLanguages: z.array(z.enum(SUPPORTED_LANGUAGES)).min(1).optional(),
});
export type UpdateSiteSettingsInput = z.infer<typeof updateSiteSettingsSchema>;
