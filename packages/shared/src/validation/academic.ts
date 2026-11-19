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

/* ------------------------------ Learning paths (roadmaps) ------------------------------ */
export const learningPathStageSchema = z.object({
  /** Present when editing an existing stage, so its identity is kept. */
  id: objectIdSchema.optional(),
  title: z.string().trim().min(2).max(120),
  description: text(2000).optional().default(''),
  objectives: lines.optional().default([]),
  durationText: text(80).optional().default(''),
  courseIds: z.array(objectIdSchema).max(20).optional().default([]),
});
export type LearningPathStageInput = z.input<typeof learningPathStageSchema>;

export const learningPathSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: slugSchema.optional(),
  summary: text(400).optional().default(''),
  description: text(5000).optional().default(''),
  durationText: text(80).optional().default(''),
  outcomes: lines.optional().default([]),
  stages: z.array(learningPathStageSchema).max(24).optional().default([]),
  displayOrder: z.number().int().min(0).max(10000).default(0),
});
export type LearningPathInput = z.input<typeof learningPathSchema>;
export const updateLearningPathSchema = learningPathSchema
  .extend({
    summary: text(400).optional(),
    description: text(5000).optional(),
    durationText: text(80).optional(),
    outcomes: lines.optional(),
    stages: z.array(learningPathStageSchema).max(24).optional(),
    displayOrder: z.number().int().min(0).max(10000).optional(),
  })
  .partial();

export const adminLearningPathQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(PUBLICATION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/* ------------------------------ Webinars ------------------------------ */
export const WEBINAR_PLATFORMS = [
  'zoom',
  'google_meet',
  'microsoft_teams',
  'youtube_live',
  'in_person',
  'other',
] as const;
export type WebinarPlatform = (typeof WEBINAR_PLATFORMS)[number];

/** Public display state, derived on the server from schedule, registration settings and cancellation. */
export const WEBINAR_DISPLAY_STATUSES = [
  'upcoming',
  'registration_open',
  'registration_closed',
  'live',
  'completed',
  'cancelled',
] as const;
export type WebinarDisplayStatus = (typeof WEBINAR_DISPLAY_STATUSES)[number];

export const webinarSpeakerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  title: text(160).optional().default(''),
  organization: text(160).optional().default(''),
  bio: text(2000).optional().default(''),
  photoUrl: assetUrlSchema.nullable().optional(),
});

const meetingUrlSchema = z
  .string()
  .trim()
  .url('Enter a full https:// link')
  .max(2048)
  .refine((u) => u.startsWith('https://'), 'Meeting links must use https://');

export const webinarSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    slug: slugSchema.optional(),
    subtitle: text(200).optional().default(''),
    summary: text(400).optional().default(''),
    description: text(10000).optional().default(''),
    topic: text(60).optional().default(''),
    posterUrl: assetUrlSchema.nullable().optional(),
    speakers: z.array(webinarSpeakerSchema).max(8).optional().default([]),
    agenda: lines.optional().default([]),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    timezone: z.string().trim().min(1).max(64).default('Africa/Mogadishu'),
    platform: z.enum(WEBINAR_PLATFORMS).default('zoom'),
    venue: text(160).optional().default(''),
    capacity: z.number().int().min(1).max(100000).nullable().optional(),
    registrationOpen: z.boolean().default(true),
    /** PRIVATE — only returned to registered participants during the join window. */
    meetingUrl: meetingUrlSchema.nullable().optional(),
    meetingPasscode: text(80).nullable().optional(),
    joinOpensMinutesBefore: z.number().int().min(0).max(240).default(15),
    /** PRIVATE — shown to registered participants after the webinar. */
    recordingUrl: meetingUrlSchema.nullable().optional(),
    featured: z.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    if (d.endsAt <= d.startsAt)
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End time must be after the start time' });
  });
export type WebinarInput = z.input<typeof webinarSchema>;

export const updateWebinarSchema = z
  .object(
    Object.fromEntries(
      Object.entries(webinarSchema._def.schema.shape).map(([k, v]) => [
        k,
        (v instanceof z.ZodDefault ? v.removeDefault() : v).optional(),
      ]),
    ) as { [K in keyof typeof webinarSchema._def.schema.shape]: z.ZodOptional<z.ZodTypeAny> },
  )
  .superRefine((d, ctx) => {
    const s = d.startsAt as Date | undefined;
    const e = d.endsAt as Date | undefined;
    if (s && e && e <= s)
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End time must be after the start time' });
  });

export const webinarQuerySchema = paginationQuerySchema.extend({
  when: z.enum(['upcoming', 'past']).default('upcoming'),
  q: z.string().trim().max(100).optional(),
  topic: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

export const adminWebinarQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(PUBLICATION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const cancelWebinarSchema = z.object({ reason: text(300).optional().default('') });
export const attendanceSchema = z.object({ attended: z.boolean() });

/* ------------------------------ Course applications ------------------------------ */
export const courseApplicationSchema = z.object({
  motivation: text(1500).optional().default(''),
});
export const applicationDecisionSchema = z.object({ note: text(1000).optional().default('') });
export const adminApplicationQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['submitted', 'approved', 'rejected', 'withdrawn']).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
