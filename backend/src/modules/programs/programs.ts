import { Router } from 'express';
import { Schema, model, type Types } from 'mongoose';
import type { z } from 'zod';
import {
  PUBLICATION_STATUSES,
  adminProgramQuerySchema,
  paginationQuerySchema,
  programSchema,
  slugSchema,
  slugify,
  updateProgramSchema,
  type AdminProgramDto,
  type ProgramCourseDto,
  type PublicProgramDto,
  type PublicationStatus,
} from '@alifya/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { parse } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { escapeRegex } from '../../utils/regex.js';
import { ok, paginationMeta } from '../../utils/respond.js';
import { param, requestContext, requireUser, type RequestContext } from '../../utils/request.js';
import { audit } from '../audit/audit.service.js';
import { Course } from '../courses/course.model.js';
import { assertPublicAssetUrl } from '../media/media.service.js';
import { User } from '../users/user.model.js';

/* ================================ Model ================================ */
const programSchemaDb = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 140 },
    summary: { type: String, default: '', maxlength: 400 },
    description: { type: String, default: '', maxlength: 20000 },
    imageUrl: { type: String, default: null },
    durationText: { type: String, default: '', maxlength: 80 },
    objectives: { type: [String], default: [] },
    entryRequirements: { type: [String], default: [] },
    courses: { type: [{ type: Schema.Types.ObjectId, ref: 'Course' }], default: [] },
    coordinator: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    publicationStatus: { type: String, enum: PUBLICATION_STATUSES, default: 'draft' },
    displayOrder: { type: Number, default: 0 },
    publishedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
programSchemaDb.index({ slug: 1 }, { unique: true });
programSchemaDb.index({ publicationStatus: 1, displayOrder: 1 });
programSchemaDb.index({ courses: 1 });
export const Program = model('Program', programSchemaDb);

/* ================================ Serialisation ================================ */
type CourseLean = {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  level: ProgramCourseDto['level'];
  durationText?: string;
  feeAmount: number;
  currency: ProgramCourseDto['currency'];
  thumbnailUrl?: string | null;
  publicationStatus: PublicationStatus;
};
type ProgramLean = {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  summary?: string;
  description?: string;
  imageUrl?: string | null;
  durationText?: string;
  objectives: string[];
  entryRequirements: string[];
  courses: CourseLean[];
  coordinator: { _id: Types.ObjectId; fullName: string } | null;
  publicationStatus: PublicationStatus;
  displayOrder?: number;
  publishedAt?: Date | null;
  updatedAt: Date;
};

const POPULATE = [
  {
    path: 'courses',
    select: 'title slug level durationText feeAmount currency thumbnailUrl publicationStatus',
  },
  { path: 'coordinator', select: 'fullName' },
];

export const toProgramCourse = (c: CourseLean): ProgramCourseDto => ({
  id: String(c._id),
  title: c.title,
  slug: c.slug,
  level: c.level,
  durationText: c.durationText ?? '',
  isFree: c.feeAmount === 0,
  feeAmount: c.feeAmount,
  currency: c.currency,
  thumbnailUrl: c.thumbnailUrl ?? null,
});

function toPublic(p: ProgramLean, publishedCoursesOnly = true): PublicProgramDto {
  return {
    id: String(p._id),
    title: p.title,
    slug: p.slug,
    summary: p.summary ?? '',
    description: p.description ?? '',
    imageUrl: p.imageUrl ?? null,
    durationText: p.durationText ?? '',
    objectives: p.objectives,
    entryRequirements: p.entryRequirements,
    courses: p.courses
      .filter((c) => !publishedCoursesOnly || c.publicationStatus === 'published')
      .map(toProgramCourse),
    coordinator: p.coordinator ? { id: String(p.coordinator._id), fullName: p.coordinator.fullName } : null,
  };
}

function toAdmin(p: ProgramLean): AdminProgramDto {
  return {
    ...toPublic(p, false),
    courseIds: p.courses.map((c) => String(c._id)),
    coordinatorId: p.coordinator ? String(p.coordinator._id) : null,
    publicationStatus: p.publicationStatus,
    displayOrder: p.displayOrder ?? 0,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
  };
}

/* ================================ Service ================================ */
type ProgramData = z.output<typeof programSchema>;

async function assertRefs(input: Partial<ProgramData>) {
  await assertPublicAssetUrl(input.imageUrl, 'imageUrl');
  if (input.courseIds?.length) {
    const n = await Course.countDocuments({
      _id: { $in: input.courseIds },
      publicationStatus: { $ne: 'archived' },
    });
    if (n !== new Set(input.courseIds).size)
      throw ApiError.badRequest('One or more courses are unknown or archived', {
        courseIds: 'Invalid course',
      });
  }
  if (input.coordinatorId && !(await User.exists({ _id: input.coordinatorId, status: 'active' }))) {
    throw ApiError.badRequest('Coordinator not found', { coordinatorId: 'Unknown user' });
  }
}

function toFields(input: Partial<ProgramData>) {
  const { courseIds, coordinatorId, slug: _s, ...rest } = input;
  return {
    ...rest,
    ...(courseIds !== undefined ? { courses: [...new Set(courseIds)] } : {}),
    ...(coordinatorId !== undefined ? { coordinator: coordinatorId } : {}),
  };
}

async function uniqueSlug(base: string, excludeId?: Types.ObjectId) {
  for (let i = 0; i < 50; i++) {
    const s = i ? `${base}-${i + 1}` : base;
    if (!(await Program.exists({ slug: s, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }))) return s;
  }
  throw ApiError.conflict('Could not generate a unique slug');
}

async function getAdmin(id: string | Types.ObjectId) {
  const p = await Program.findById(id).populate(POPULATE).lean<ProgramLean>();
  if (!p) throw ApiError.notFound('Program not found');
  return toAdmin(p);
}

async function createProgram(actor: Types.ObjectId, input: ProgramData, ctx: RequestContext) {
  await assertRefs(input);
  let slug = input.slug;
  if (slug) {
    if (await Program.exists({ slug }))
      throw ApiError.conflict('This slug is already in use', { slug: 'Already in use' });
  } else slug = await uniqueSlug(slugify(input.title) || 'program');
  const p = await Program.create({ ...toFields(input), slug, createdBy: actor, updatedBy: actor });
  await audit({
    actor,
    action: 'program.created',
    targetType: 'Program',
    targetId: p._id,
    metadata: { title: p.title },
    ctx,
  });
  return getAdmin(p._id);
}

async function updateProgram(
  actor: Types.ObjectId,
  id: string,
  input: Partial<ProgramData>,
  ctx: RequestContext,
) {
  const p = await Program.findById(id);
  if (!p) throw ApiError.notFound('Program not found');
  if (p.publicationStatus === 'archived') throw ApiError.conflict('Archived programs cannot be edited');
  await assertRefs(input);
  if (input.slug && input.slug !== p.slug) {
    if (await Program.exists({ slug: input.slug, _id: { $ne: p._id } }))
      throw ApiError.conflict('This slug is already in use', { slug: 'Already in use' });
    p.slug = input.slug;
  }
  p.set({ ...toFields(input), updatedBy: actor });
  const fields = p.modifiedPaths();
  await p.save();
  await audit({
    actor,
    action: 'program.updated',
    targetType: 'Program',
    targetId: p._id,
    metadata: { fields },
    ctx,
  });
  return getAdmin(p._id);
}

async function setStatus(actor: Types.ObjectId, id: string, target: PublicationStatus, ctx: RequestContext) {
  const p = await Program.findById(id);
  if (!p) throw ApiError.notFound('Program not found');
  if (p.publicationStatus === 'archived') throw ApiError.conflict('Archived programs cannot change state');
  if (target === 'published') {
    const missing: Record<string, string> = {};
    if (p.description.trim().length < 20)
      missing.description = 'Add a description (at least 20 characters) before publishing';
    if (Object.keys(missing).length)
      throw ApiError.badRequest('This program is not ready to publish', missing);
    p.publishedAt ??= new Date();
  }
  if (target === 'archived') p.archivedAt = new Date();
  const from = p.publicationStatus;
  p.publicationStatus = target;
  p.updatedBy = actor;
  await p.save();
  await audit({
    actor,
    action: `program.${target === 'draft' ? 'unpublished' : target}`,
    targetType: 'Program',
    targetId: p._id,
    metadata: { from, to: target },
    ctx,
  });
  return getAdmin(p._id);
}

/* ================================ Routes ================================ */
export const publicProgramsRouter = Router();
publicProgramsRouter.get(
  '/programs',
  asyncHandler(async (req, res) => {
    const q = parse(
      paginationQuerySchema.extend({ limit: paginationQuerySchema.shape.limit.default(24) }),
      req.query,
    );
    const filter = { publicationStatus: 'published' };
    const [docs, total] = await Promise.all([
      Program.find(filter)
        .sort({ displayOrder: 1, publishedAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate(POPULATE)
        .lean<ProgramLean[]>(),
      Program.countDocuments(filter),
    ]);
    res.set('Cache-Control', 'public, max-age=30');
    ok(
      res,
      docs.map((d) => toPublic(d)),
      200,
      paginationMeta(q.page, q.limit, total),
    );
  }),
);
publicProgramsRouter.get(
  '/programs/:slug',
  asyncHandler(async (req, res) => {
    const slug = parse(slugSchema, param(req, 'slug'));
    const p = await Program.findOne({ slug, publicationStatus: 'published' })
      .populate(POPULATE)
      .lean<ProgramLean>();
    if (!p) throw ApiError.notFound('Program not found');
    res.set('Cache-Control', 'public, max-age=30');
    ok(res, toPublic(p));
  }),
);

export const adminProgramsRouter = Router();
adminProgramsRouter.use(authenticate, requirePermission('programs.manage'));
adminProgramsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(adminProgramQuerySchema, req.query);
    const filter: Record<string, unknown> = {};
    if (q.status) filter.publicationStatus = q.status;
    if (q.q) filter.title = new RegExp(escapeRegex(q.q), 'i');
    const [docs, total] = await Promise.all([
      Program.find(filter)
        .sort({ updatedAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate(POPULATE)
        .lean<ProgramLean[]>(),
      Program.countDocuments(filter),
    ]);
    ok(res, docs.map(toAdmin), 200, paginationMeta(q.page, q.limit, total));
  }),
);
adminProgramsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    ok(res, await getAdmin(param(req, 'id')));
  }),
);
adminProgramsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    ok(
      res,
      await createProgram(requireUser(req).userId, parse(programSchema, req.body), requestContext(req)),
      201,
    );
  }),
);
adminProgramsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = parse(updateProgramSchema, req.body) as Partial<ProgramData>;
    ok(res, await updateProgram(requireUser(req).userId, param(req, 'id'), input, requestContext(req)));
  }),
);
for (const [action, target] of [
  ['publish', 'published'],
  ['unpublish', 'draft'],
  ['archive', 'archived'],
] as const) {
  adminProgramsRouter.post(
    `/:id/${action}`,
    asyncHandler(async (req, res) => {
      ok(res, await setStatus(requireUser(req).userId, param(req, 'id'), target, requestContext(req)));
    }),
  );
}
