import { z } from 'zod';
import {
  COURSE_LEVELS,
  DEFAULT_TIMEZONE,
  LIFECYCLE_OVERRIDES,
  REGISTRATION_MODES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LANGUAGES,
  WEEKDAYS,
} from '../enums.js';
import {
  assetUrlSchema,
  objectIdSchema,
  paginationQuerySchema,
  slugSchema,
  timezoneSchema,
} from './common.js';

const isoDate = z.coerce.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24h)');

export const scheduleSlotSchema = z
  .object({ day: z.enum(WEEKDAYS), startTime: time, endTime: time })
  .refine((s) => s.endTime > s.startTime, {
    path: ['endTime'],
    message: 'End time must be after start time',
  });

const listOfText = z.array(z.string().trim().min(1).max(300)).max(30);

const courseBase = z.object({
  title: z.string().trim().min(3).max(160),
  slug: slugSchema.optional(),
  subtitle: z.string().trim().max(240).optional().default(''),
  description: z.string().trim().max(20000).optional().default(''),
  thumbnailUrl: assetUrlSchema.nullable().optional(),
  categoryId: objectIdSchema.nullable().optional(),
  instructorIds: z.array(objectIdSchema).max(10).optional().default([]),
  /** Fee in minor units (cents). 0 = free. */
  feeAmount: z.number().int().min(0).max(100_000_00).default(0),
  currency: z.enum(SUPPORTED_CURRENCIES).default('USD'),
  durationText: z.string().trim().max(80).optional().default(''),
  startDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
  schedule: z.array(scheduleSlotSchema).max(14).optional().default([]),
  timezone: timezoneSchema.default(DEFAULT_TIMEZONE),
  level: z.enum(COURSE_LEVELS).default('all_levels'),
  language: z.enum(SUPPORTED_LANGUAGES).default('en'),
  learningObjectives: listOfText.optional().default([]),
  entryRequirements: listOfText.optional().default([]),
  capacity: z.number().int().min(1).max(100000).nullable().optional(),
  registrationMode: z.enum(REGISTRATION_MODES).default('closed'),
  registrationOpensAt: isoDate.nullable().optional(),
  registrationClosesAt: isoDate.nullable().optional(),
  lifecycleOverride: z.enum(LIFECYCLE_OVERRIDES).nullable().optional(),
  featured: z.boolean().default(false),
});

type DateRangeShape = {
  startDate?: Date | null;
  endDate?: Date | null;
  registrationOpensAt?: Date | null;
  registrationClosesAt?: Date | null;
};

function refineDates(d: DateRangeShape, ctx: z.RefinementCtx) {
  if (d.startDate && d.endDate && d.endDate <= d.startDate) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be after start date' });
  }
  if (d.registrationOpensAt && d.registrationClosesAt && d.registrationClosesAt <= d.registrationOpensAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['registrationClosesAt'],
      message: 'Registration must close after it opens',
    });
  }
}

export const createCourseSchema = courseBase.superRefine(refineDates);
export type CreateCourseInput = z.input<typeof createCourseSchema>;

/** Updates are partial: defaults must NOT be re-applied, so strip them. */
export const updateCourseSchema = z
  .object(
    Object.fromEntries(
      Object.entries(courseBase.shape).map(([k, v]) => [
        k,
        (v instanceof z.ZodDefault ? v.removeDefault() : v).optional(),
      ]),
    ) as { [K in keyof typeof courseBase.shape]: z.ZodOptional<z.ZodTypeAny> },
  )
  .superRefine((d, ctx) => refineDates(d as DateRangeShape, ctx));
export type UpdateCourseInput = z.input<typeof createCourseSchema> extends infer T ? Partial<T> : never;

export const COURSE_SORTS = ['newest', 'start_date', 'title', 'fee_low', 'fee_high'] as const;

export const courseListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  category: slugSchema.optional(),
  level: z.enum(COURSE_LEVELS).optional(),
  price: z.enum(['free', 'paid']).optional(),
  registration: z.enum(['open', 'closed']).optional(),
  featured: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sort: z.enum(COURSE_SORTS).default('newest'),
});
export type CourseListQuery = z.infer<typeof courseListQuerySchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugSchema.optional(),
  description: z.string().trim().max(500).optional().default(''),
  order: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});
export type CategoryInput = z.input<typeof categorySchema>;
