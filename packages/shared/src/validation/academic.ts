import { z } from 'zod';
import { PUBLICATION_STATUSES } from '../enums.js';
import { assetUrlSchema, objectIdSchema, paginationQuerySchema, slugSchema } from './common.js';

const text = (max: number) => z.string().trim().max(max);
const lines = z.array(z.string().trim().min(1).max(300)).max(30);

/* ------------------------------ Programs ------------------------------ */
export const programSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: slugSchema.optional(),
  summary: text(400).optional().default(''),
  description: text(20000).optional().default(''),
  imageUrl: assetUrlSchema.nullable().optional(),
  durationText: text(80).optional().default(''),
  objectives: lines.optional().default([]),
  entryRequirements: lines.optional().default([]),
  courseIds: z.array(objectIdSchema).max(50).optional().default([]),
  coordinatorId: objectIdSchema.nullable().optional(),
  displayOrder: z.number().int().min(0).max(10000).default(0),
});
export type ProgramInput = z.input<typeof programSchema>;
export const updateProgramSchema = programSchema
  .extend({
    summary: text(400).optional(),
    description: text(20000).optional(),
    durationText: text(80).optional(),
    objectives: lines.optional(),
    entryRequirements: lines.optional(),
    courseIds: z.array(objectIdSchema).max(50).optional(),
    displayOrder: z.number().int().min(0).max(10000).optional(),
  })
  .partial();

export const adminProgramQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(PUBLICATION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/* ------------------------------ Instructor profiles ------------------------------ */
const optionalHttps = z.string().trim().url().max(2048).nullable().optional();
export const instructorProfileSchema = z.object({
  professionalTitle: text(120).optional().default(''),
  specialization: text(160).optional().default(''),
  biography: text(5000).optional().default(''),
  photoUrl: assetUrlSchema.nullable().optional(),
  social: z
    .object({ linkedin: optionalHttps, x: optionalHttps, website: optionalHttps, facebook: optionalHttps })
    .optional()
    .default({}),
  isPublic: z.boolean().default(false),
});
export type InstructorProfileInput = z.input<typeof instructorProfileSchema>;

/* ------------------------------ Curriculum ------------------------------ */
export const LESSON_TYPES = ['text', 'video', 'pdf'] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

export const sectionSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: text(1000).optional().default(''),
});
export const updateSectionSchema = sectionSchema.extend({ description: text(1000).optional() }).partial();

const lessonResourceSchema = z.object({ mediaId: objectIdSchema, title: z.string().trim().min(1).max(160) });

const lessonBase = z.object({
  sectionId: objectIdSchema,
  title: z.string().trim().min(2).max(160),
  type: z.enum(LESSON_TYPES),
  summary: text(500).optional().default(''),
  /** Text lesson body (plain text / markdown-like; rendered as text, never as HTML). */
  content: text(50000).optional().default(''),
  /** Video lesson: uploaded private video id, or an https link to an external host. */
  videoMediaId: objectIdSchema.nullable().optional(),
  videoUrl: z.string().trim().url().max(2048).nullable().optional(),
  /** PDF lesson: uploaded private PDF. */
  pdfMediaId: objectIdSchema.nullable().optional(),
  resources: z.array(lessonResourceSchema).max(20).optional().default([]),
  durationMinutes: z.number().int().min(0).max(1000).nullable().optional(),
  isPreview: z.boolean().default(false),
});

function refineLesson(
  l: { type?: string; videoMediaId?: string | null; videoUrl?: string | null; pdfMediaId?: string | null },
  ctx: z.RefinementCtx,
) {
  if (l.videoUrl && !l.videoUrl.startsWith('https://'))
    ctx.addIssue({ code: 'custom', path: ['videoUrl'], message: 'Use an https link' });
  if (l.type === 'video' && !l.videoMediaId && !l.videoUrl) {
    ctx.addIssue({ code: 'custom', path: ['videoUrl'], message: 'Upload a video or provide a video link' });
  }
  if (l.type === 'pdf' && !l.pdfMediaId)
    ctx.addIssue({ code: 'custom', path: ['pdfMediaId'], message: 'Upload the PDF for this lesson' });
}

export const lessonSchema = lessonBase.superRefine(refineLesson);
export type LessonInput = z.input<typeof lessonSchema>;
export const updateLessonSchema = lessonBase
  .extend({
    summary: text(500).optional(),
    content: text(50000).optional(),
    resources: z.array(lessonResourceSchema).max(20).optional(),
    isPreview: z.boolean().optional(),
  })
  .partial()
  .superRefine(refineLesson);

export const reorderSchema = z.object({ ids: z.array(objectIdSchema).min(1).max(500) });

/* ------------------------------ Contact ------------------------------ */
export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  subject: z.string().trim().min(3, 'Enter a subject').max(160),
  message: z.string().trim().min(10, 'Please write at least 10 characters').max(5000),
  /** Honeypot: real users never fill this hidden field. */
  website: z.string().max(0).optional().or(z.literal('')),
});
export type ContactMessageInput = z.input<typeof contactMessageSchema>;
