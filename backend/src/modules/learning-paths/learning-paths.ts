/**
 * Learning paths ("roadmaps"): an ordered journey of stages, each grouping existing courses.
 * Additive module — reuses Course records; never modifies them.
 *
 * Public:  GET /learning-paths, GET /learning-paths/:slug           (published paths, published courses)
 * Admin:   /admin/learning-paths  CRUD + publish/unpublish/archive   (permission: learning_paths.manage)
 */
import { Router } from 'express';
import { Schema, model, type Types } from 'mongoose';
import type { z } from 'zod';
import {
  PUBLICATION_STATUSES,
  adminLearningPathQuerySchema,
  learningPathSchema,
  paginationQuerySchema,
  slugSchema,
  slugify,
  updateLearningPathSchema,
  type AdminLearningPathDto,
  type LearningPathStageDto,
  type ProgramCourseDto,
  type PublicLearningPathDto,
  type PublicLearningPathSummaryDto,
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
import { toProgramCourse } from '../programs/programs.js';

/* ================================ Model ================================ */
const stageSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 2000 },
  objectives: { type: [String], default: [] },
  durationText: { type: String, default: '', maxlength: 80 },
  courses: { type: [{ type: Schema.Types.ObjectId, ref: 'Course' }], default: [] },
});

const learningPathSchemaDb = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 140 },
    summary: { type: String, default: '', maxlength: 400 },
    description: { type: String, default: '', maxlength: 5000 },
    durationText: { type: String, default: '', maxlength: 80 },
    outcomes: { type: [String], default: [] },
    stages: { type: [stageSchema], default: [] },
    publicationStatus: { type: String, enum: PUBLICATION_STATUSES, default: 'draft' },
    displayOrder: { type: Number, default: 0 },
    publishedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
learningPathSchemaDb.index({ slug: 1 }, { unique: true });
learningPathSchemaDb.index({ publicationStatus: 1, displayOrder: 1 });
learningPathSchemaDb.index({ 'stages.courses': 1 });
export const LearningPath = model('LearningPath', learningPathSchemaDb);

/* ================================ Serialisation ================================ */
type CourseLean = Parameters<typeof toProgramCourse>[0] & { publicationStatus: PublicationStatus };
type StageLean = {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  objectives: string[];
  durationText?: string;
  courses: CourseLean[];
};
type PathLean = {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  summary?: string;
  description?: string;
  durationText?: string;
  outcomes: string[];
  stages: StageLean[];
  publicationStatus: PublicationStatus;
  displayOrder?: number;
  publishedAt?: Date | null;
  updatedAt: Date;
};

const POPULATE = {
  path: 'stages.courses',
  select: 'title slug level durationText feeAmount currency thumbnailUrl publicationStatus',
};

const visibleCourses = (s: StageLean, publishedOnly: boolean): ProgramCourseDto[] =>
  s.courses.filter((c) => !publishedOnly || c.publicationStatus === 'published').map(toProgramCourse);

function toStage(s: StageLean, publishedOnly: boolean): LearningPathStageDto {
  return {
    id: String(s._id),
    title: s.title,
    description: s.description ?? '',
    objectives: s.objectives,
    durationText: s.durationText ?? '',
    courses: visibleCourses(s, publishedOnly),
  };
}

function toSummary(p: PathLean, publishedOnly = true): PublicLearningPathSummaryDto {
  const courseIds = new Set(p.stages.flatMap((s) => visibleCourses(s, publishedOnly).map((c) => c.id)));
  return {
    id: String(p._id),
    title: p.title,
    slug: p.slug,
    summary: p.summary ?? '',
    durationText: p.durationText ?? '',
    stageCount: p.stages.length,
    courseCount: courseIds.size,
  };
}

function toPublic(p: PathLean): PublicLearningPathDto {
  return {
    ...toSummary(p),
    description: p.description ?? '',
    outcomes: p.outcomes,
    stages: p.stages.map((s) => toStage(s, true)),
  };
}

function toAdmin(p: PathLean): AdminLearningPathDto {
  return {
    ...toSummary(p, false),
    description: p.description ?? '',
    outcomes: p.outcomes,
    stages: p.stages.map((s) => ({ ...toStage(s, false), courseIds: s.courses.map((c) => String(c._id)) })),
    publicationStatus: p.publicationStatus,
    displayOrder: p.displayOrder ?? 0,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
  };
}

/* ================================ Service ================================ */
type PathData = z.output<typeof learningPathSchema>;

async function assertCourses(input: Partial<PathData>) {
  const ids = [...new Set((input.stages ?? []).flatMap((s) => s.courseIds))];
  if (!ids.length) return;
  const n = await Course.countDocuments({ _id: { $in: ids }, publicationStatus: { $ne: 'archived' } });
  if (n !== ids.length)
    throw ApiError.badRequest('One or more courses are unknown or archived', { stages: 'Invalid course' });
}

function toFields(input: Partial<PathData>) {
  const { stages, slug: _s, ...rest } = input;
  return {
    ...rest,
    ...(stages !== undefined
      ? {
          stages: stages.map(({ id, courseIds, ...st }) => ({
            ...(id ? { _id: id } : {}),
            ...st,
            courses: [...new Set(courseIds)],
          })),
        }
      : {}),
  };
}

async function uniqueSlug(base: string) {
  for (let i = 0; i < 50; i++) {
    const s = i ? `${base}-${i + 1}` : base;
    if (!(await LearningPath.exists({ slug: s }))) return s;
  }
  throw ApiError.conflict('Could not generate a unique slug');
}

async function getAdmin(id: string | Types.ObjectId) {
  const p = await LearningPath.findById(id).populate(POPULATE).lean<PathLean>();
  if (!p) throw ApiError.notFound('Learning path not found');
  return toAdmin(p);
}

async function createPath(actor: Types.ObjectId, input: PathData, ctx: RequestContext) {
  await assertCourses(input);
  let slug = input.slug;
  if (slug) {
    if (await LearningPath.exists({ slug }))
      throw ApiError.conflict('This slug is already in use', { slug: 'Already in use' });
  } else slug = await uniqueSlug(slugify(input.title) || 'learning-path');
  const p = await LearningPath.create({ ...toFields(input), slug, createdBy: actor, updatedBy: actor });
  await audit({
    actor,
    action: 'learning_path.created',
    targetType: 'LearningPath',
    targetId: p._id,
    metadata: { title: p.title, stages: p.stages.length },
    ctx,
  });
  return getAdmin(p._id);
}

async function updatePath(actor: Types.ObjectId, id: string, input: Partial<PathData>, ctx: RequestContext) {
  const p = await LearningPath.findById(id);
  if (!p) throw ApiError.notFound('Learning path not found');
  if (p.publicationStatus === 'archived') throw ApiError.conflict('Archived learning paths cannot be edited');
  await assertCourses(input);
  if (input.slug && input.slug !== p.slug) {
    if (await LearningPath.exists({ slug: input.slug, _id: { $ne: p._id } }))
      throw ApiError.conflict('This slug is already in use', { slug: 'Already in use' });
    p.slug = input.slug;
  }
  p.set({ ...toFields(input), updatedBy: actor });
  const fields = p.modifiedPaths();
  await p.save();
  await audit({
    actor,
    action: 'learning_path.updated',
    targetType: 'LearningPath',
    targetId: p._id,
    metadata: { fields },
    ctx,
  });
  return getAdmin(p._id);
}

async function setStatus(actor: Types.ObjectId, id: string, target: PublicationStatus, ctx: RequestContext) {
  const p = await LearningPath.findById(id);
  if (!p) throw ApiError.notFound('Learning path not found');
  if (p.publicationStatus === 'archived')
    throw ApiError.conflict('Archived learning paths cannot change state');
  if (target === 'published') {
    if (p.stages.length < 2)
      throw ApiError.badRequest('This learning path is not ready to publish', {
        stages: 'Add at least two stages before publishing',
      });
    p.publishedAt ??= new Date();
  }
  if (target === 'archived') p.archivedAt = new Date();
  const from = p.publicationStatus;
  p.publicationStatus = target;
  p.updatedBy = actor;
  await p.save();
  await audit({
    actor,
    action: `learning_path.${target === 'draft' ? 'unpublished' : target}`,
    targetType: 'LearningPath',
    targetId: p._id,
    metadata: { from, to: target },
    ctx,
  });
  return getAdmin(p._id);
}

/* ================================ Routes ================================ */
export const publicLearningPathsRouter = Router();
publicLearningPathsRouter.get(
  '/learning-paths',
  asyncHandler(async (req, res) => {
    const q = parse(
      paginationQuerySchema.extend({ limit: paginationQuerySchema.shape.limit.default(24) }),
      req.query,
    );
    const filter = { publicationStatus: 'published' };
    const [docs, total] = await Promise.all([
      LearningPath.find(filter)
        .sort({ displayOrder: 1, publishedAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate(POPULATE)
        .lean<PathLean[]>(),
      LearningPath.countDocuments(filter),
    ]);
    res.set('Cache-Control', 'public, max-age=30');
    ok(
      res,
      docs.map((d) => toSummary(d)),
      200,
      paginationMeta(q.page, q.limit, total),
    );
  }),
);
publicLearningPathsRouter.get(
  '/learning-paths/:slug',
  asyncHandler(async (req, res) => {
    const slug = parse(slugSchema, param(req, 'slug'));
    const p = await LearningPath.findOne({ slug, publicationStatus: 'published' })
      .populate(POPULATE)
      .lean<PathLean>();
    if (!p) throw ApiError.notFound('Learning path not found');
    res.set('Cache-Control', 'public, max-age=30');
    ok(res, toPublic(p));
  }),
);

export const adminLearningPathsRouter = Router();
adminLearningPathsRouter.use(authenticate, requirePermission('learning_paths.manage'));
adminLearningPathsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(adminLearningPathQuerySchema, req.query);
    const filter: Record<string, unknown> = {};
    if (q.status) filter.publicationStatus = q.status;
    if (q.q) filter.title = new RegExp(escapeRegex(q.q), 'i');
    const [docs, total] = await Promise.all([
      LearningPath.find(filter)
        .sort({ updatedAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate(POPULATE)
        .lean<PathLean[]>(),
      LearningPath.countDocuments(filter),
    ]);
    ok(res, docs.map(toAdmin), 200, paginationMeta(q.page, q.limit, total));
  }),
);
adminLearningPathsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    ok(res, await getAdmin(param(req, 'id')));
  }),
);
adminLearningPathsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    ok(
      res,
      await createPath(requireUser(req).userId, parse(learningPathSchema, req.body), requestContext(req)),
      201,
    );
  }),
);
adminLearningPathsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = parse(updateLearningPathSchema, req.body) as Partial<PathData>;
    ok(res, await updatePath(requireUser(req).userId, param(req, 'id'), input, requestContext(req)));
  }),
);
for (const [action, target] of [
  ['publish', 'published'],
  ['unpublish', 'draft'],
  ['archive', 'archived'],
] as const) {
  adminLearningPathsRouter.post(
    `/:id/${action}`,
    asyncHandler(async (req, res) => {
      ok(res, await setStatus(requireUser(req).userId, param(req, 'id'), target, requestContext(req)));
    }),
  );
}
