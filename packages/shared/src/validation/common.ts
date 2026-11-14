import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid identifier');

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

/** IANA timezone validated with the runtime's Intl database. */
export const timezoneSchema = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Unknown timezone');

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

/** Uploaded-media URL (/api/v1/media/:id/content) or an absolute https URL. */
export const assetUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (v) => /^\/api\/v1\/media\/[a-f0-9]{24}\/content$/.test(v) || /^https:\/\//.test(v),
    'Use an uploaded file or an https URL',
  );

/** Matches the API's own upload URLs and extracts the media id. */
export const MEDIA_URL_RE = /^\/api\/v1\/media\/([a-f0-9]{24})\/content$/;
