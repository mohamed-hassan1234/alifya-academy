import type { Types } from 'mongoose';
import type { z } from 'zod';
import {
  slugify,
  type AdminCourseDto,
  type CategoryDto,
  type CourseListQuery,
  type PublicCourseDto,
  type PublicationStatus,
  type categorySchema,
  type createCourseSchema,
} from '@alifya/shared';
import { ApiError } from '../../utils/api-error.js';
import { escapeRegex } from '../../utils/regex.js';
import type { RequestContext } from '../../utils/request.js';
import { audit } from '../audit/audit.service.js';
import { Role } from '../roles/role.model.js';
import { User } from '../users/user.model.js';
import { Category, Course } from './course.model.js';
import {
  COURSE_POPULATE,
  toAdminCourse,
  toCategoryDto,
  toPublicCourse,
  type PopulatedCourse,
} from './course.serializer.js';

type CreateCourse = z.output<typeof createCourseSchema>;
type UpdateCourse = Partial<CreateCourse>;
type CategoryData = z.output<typeof categorySchema>;

/* ----------------------------- helpers ----------------------------- */

async function uniqueSlug(
  model: typeof Course | typeof Category,
  base: string,
  excludeId?: Types.ObjectId,
): Promise<string> {
  const root = base || 'item';
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const exists = await (model as typeof Course).exists({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!exists) return candidate;
  }
  throw ApiError.conflict('Could not generate a unique slug; please provide one');
}

async function assertSlugFree(
  model: typeof Course | typeof Category,
  slug: string,
  excludeId?: Types.ObjectId,
) {
  const exists = await (model as typeof Course).exists({
    slug,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (exists) throw ApiError.conflict('This slug is already in use', { slug: 'Already in use' });
}

async function assertInstructors(ids: string[]) {
  if (!ids.length) return;
  const role = await Role.findOne({ key: 'instructor' }).select('_id').lean();
  const count = await User.countDocuments({ _id: { $in: ids }, roles: role?._id, status: 'active' });
  if (count !== new Set(ids).size) {
    throw ApiError.badRequest('Every assigned instructor must be an active user with the Instructor role', {
      instructorIds: 'Invalid instructor',
    });
  }
}

async function assertCategory(id: string | null | undefined) {
  if (!id) return;
  if (!(await Category.exists({ _id: id })))
    throw ApiError.badRequest('Category not found', { categoryId: 'Unknown category' });
}

/** Mongo filter equivalent of displayStatus === 'registration_open' (see shared deriveCourseDisplayStatus). */
function registrationOpenFilter(now: Date) {
  return {
    registrationMode: 'open',
    lifecycleOverride: null,
    $and: [
      { $or: [{ registrationOpensAt: null }, { registrationOpensAt: { $lte: now } }] },
      { $or: [{ registrationClosesAt: null }, { registrationClosesAt: { $gt: now } }] },
      { $or: [{ startDate: null }, { startDate: { $gt: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gt: now } }] },
      { $or: [{ capacity: null }, { $expr: { $lt: ['$enrolledCount', '$capacity'] } }] },
    ],
  };
}

const SORTS: Record<CourseListQuery['sort'], Record<string, 1 | -1>> = {
  newest: { featured: -1, publishedAt: -1, _id: -1 },
  start_date: { startDate: 1, _id: 1 },
  title: { title: 1, _id: 1 },
  fee_low: { feeAmount: 1, _id: 1 },
  fee_high: { feeAmount: -1, _id: 1 },
};

/* ----------------------------- public ----------------------------- */

export async function listPublicCourses(
  q: CourseListQuery,
): Promise<{ rows: PublicCourseDto[]; total: number }> {
  const now = new Date();
  const filter: Record<string, unknown> = { publicationStatus: 'published' };
  const and: Record<string, unknown>[] = [];
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    and.push({ $or: [{ title: rx }, { subtitle: rx }] });
  }
  if (q.category) {
    const cat = await Category.findOne({ slug: q.category, isActive: true }).select('_id').lean();
    if (!cat) return { rows: [], total: 0 };
    filter.category = cat._id;
  }
  if (q.level) filter.level = q.level;
  if (q.price === 'free') filter.feeAmount = 0;
  if (q.price === 'paid') filter.feeAmount = { $gt: 0 };
  if (q.featured !== undefined) filter.featured = q.featured;
  if (q.registration === 'open') and.push(registrationOpenFilter(now));
  if (q.registration === 'closed') and.push({ $nor: [registrationOpenFilter(now)] });
  if (and.length) filter.$and = and;

  const [docs, total] = await Promise.all([
    Course.find(filter)
      .sort(SORTS[q.sort])
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate(COURSE_POPULATE)
      .lean<PopulatedCourse[]>(),
    Course.countDocuments(filter),
  ]);
  return { rows: docs.map((d) => toPublicCourse(d, now)), total };
}

export async function getPublicCourse(slug: string): Promise<PublicCourseDto> {
  const doc = await Course.findOne({ slug, publicationStatus: 'published' })
    .populate(COURSE_POPULATE)
    .lean<PopulatedCourse>();
  if (!doc) throw ApiError.notFound('Course not found');
  return toPublicCourse(doc);
}

export async function listPublicCategories(): Promise<CategoryDto[]> {
  const docs = await Category.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
  return docs.map(toCategoryDto);
}

/* ----------------------------- admin ----------------------------- */

export async function listAdminCourses(q: {
  page: number;
  limit: number;
  q?: string;
  status?: PublicationStatus;
}) {
  const filter: Record<string, unknown> = {};
  if (q.status) filter.publicationStatus = q.status;
  if (q.q) filter.title = new RegExp(escapeRegex(q.q), 'i');
  const [docs, total] = await Promise.all([
    Course.find(filter)
      .sort({ updatedAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate(COURSE_POPULATE)
      .lean<PopulatedCourse[]>(),
    Course.countDocuments(filter),
  ]);
  return { rows: docs.map(toAdminCourse), total };
}

export async function getAdminCourse(id: string): Promise<AdminCourseDto> {
  const doc = await Course.findById(id).populate(COURSE_POPULATE).lean<PopulatedCourse>();
  if (!doc) throw ApiError.notFound('Course not found');
  return toAdminCourse(doc);
}

function toDocFields(input: UpdateCourse): Record<string, unknown> {
  const { categoryId, instructorIds, slug: _slug, ...rest } = input;
  const out: Record<string, unknown> = { ...rest };
  if (categoryId !== undefined) out.category = categoryId;
  if (instructorIds !== undefined) out.instructors = [...new Set(instructorIds)];
  return out;
}

export async function createCourse(
  actor: Types.ObjectId,
  input: CreateCourse,
  ctx: RequestContext,
): Promise<AdminCourseDto> {
  await Promise.all([assertCategory(input.categoryId), assertInstructors(input.instructorIds)]);
  let slug: string;
  if (input.slug) {
    await assertSlugFree(Course, input.slug);
    slug = input.slug;
  } else {
    slug = await uniqueSlug(Course, slugify(input.title));
  }
  const course = await Course.create({
    ...toDocFields(input),
    slug,
    publicationStatus: 'draft',
    createdBy: actor,
    updatedBy: actor,
  });
  await audit({
    actor,
    action: 'course.created',
    targetType: 'Course',
    targetId: course._id,
    metadata: { title: course.title },
    ctx,
  });
  return getAdminCourse(String(course._id));
}

export async function updateCourse(
  actor: Types.ObjectId,
  id: string,
  input: UpdateCourse,
  ctx: RequestContext,
): Promise<AdminCourseDto> {
  const course = await Course.findById(id);
  if (!course) throw ApiError.notFound('Course not found');
  if (course.publicationStatus === 'archived') throw ApiError.conflict('Archived courses cannot be edited');
  await Promise.all([
    assertCategory(input.categoryId),
    input.instructorIds ? assertInstructors(input.instructorIds) : null,
  ]);
  if (input.slug && input.slug !== course.slug) {
    await assertSlugFree(Course, input.slug, course._id);
    course.slug = input.slug;
  }
  course.set({ ...toDocFields(input), updatedBy: actor });
  const changed = course.modifiedPaths();
  await course.save();
  await audit({
    actor,
    action: 'course.updated',
    targetType: 'Course',
    targetId: course._id,
    metadata: { fields: changed },
    ctx,
  });
  return getAdminCourse(id);
}

export async function setPublication(
  actor: Types.ObjectId,
  id: string,
  target: PublicationStatus,
  ctx: RequestContext,
): Promise<AdminCourseDto> {
  const course = await Course.findById(id);
  if (!course) throw ApiError.notFound('Course not found');
  const from = course.publicationStatus;
  if (from === target) return getAdminCourse(id);
  if (from === 'archived') throw ApiError.conflict('Archived courses cannot change publication state');
  if (target === 'published') {
    const missing: Record<string, string> = {};
    if (course.description.trim().length < 20)
      missing.description = 'Add a description (at least 20 characters) before publishing';
    if (!course.category) missing.categoryId = 'Choose a category before publishing';
    if (Object.keys(missing).length)
      throw ApiError.badRequest('This course is not ready to publish', missing);
    course.publishedAt ??= new Date();
  }
  if (target === 'archived') {
    course.archivedAt = new Date();
    course.registrationMode = 'closed';
    course.featured = false;
  }
  course.publicationStatus = target;
  course.updatedBy = actor;
  await course.save();
  const action =
    target === 'published'
      ? 'course.published'
      : target === 'archived'
        ? 'course.archived'
        : 'course.unpublished';
  await audit({
    actor,
    action,
    targetType: 'Course',
    targetId: course._id,
    metadata: { from, to: target },
    ctx,
  });
  return getAdminCourse(id);
}

/* ----------------------------- categories ----------------------------- */

export async function listAllCategories(): Promise<CategoryDto[]> {
  const docs = await Category.find().sort({ order: 1, name: 1 }).lean();
  return docs.map(toCategoryDto);
}

export async function createCategory(
  actor: Types.ObjectId,
  input: CategoryData,
  ctx: RequestContext,
): Promise<CategoryDto> {
  const slug = input.slug ?? (await uniqueSlug(Category, slugify(input.name)));
  if (input.slug) await assertSlugFree(Category, slug);
  const cat = await Category.create({ ...input, slug, createdBy: actor, updatedBy: actor });
  await audit({
    actor,
    action: 'category.created',
    targetType: 'Category',
    targetId: cat._id,
    metadata: { name: cat.name },
    ctx,
  });
  return toCategoryDto(cat);
}

export async function updateCategory(
  actor: Types.ObjectId,
  id: string,
  input: Partial<CategoryData>,
  ctx: RequestContext,
): Promise<CategoryDto> {
  const cat = await Category.findById(id);
  if (!cat) throw ApiError.notFound('Category not found');
  if (input.slug && input.slug !== cat.slug) await assertSlugFree(Category, input.slug, cat._id);
  cat.set({ ...input, updatedBy: actor });
  await cat.save();
  await audit({ actor, action: 'category.updated', targetType: 'Category', targetId: cat._id, ctx });
  return toCategoryDto(cat);
}
