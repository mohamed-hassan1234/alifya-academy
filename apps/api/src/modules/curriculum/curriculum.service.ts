import mongoose, { Types } from 'mongoose';
import type { z } from 'zod';
import {
  deriveCourseDisplayStatus,
  type CurriculumOutlineDto,
  type InstructorCourseDto,
  type LessonPreviewDto,
  type ManagedCurriculumDto,
  type ManagedLessonDto,
  type lessonSchema,
  type sectionSchema,
} from '@alifya/shared';
import type { AuthContext } from '../../middleware/authenticate.js';
import { ApiError } from '../../utils/api-error.js';
import type { RequestContext } from '../../utils/request.js';
import { audit } from '../audit/audit.service.js';
import { Course } from '../courses/course.model.js';
import { MediaAsset } from '../media/media.model.js';
import { registerPrivateAccessResolver, signedUrl } from '../media/media.service.js';
import { CourseSection, Lesson } from './curriculum.model.js';

type LessonData = z.output<typeof lessonSchema>;
type SectionData = z.output<typeof sectionSchema>;
type CourseRef = {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  publicationStatus: string;
  instructors: Types.ObjectId[];
};

/* ============================ Authorization ============================ */

/**
 * Resource-level rule for curriculum edits:
 *  - academy staff with `courses.update` may edit any course;
 *  - otherwise the caller needs the lessons permission AND must be an assigned instructor of the course.
 */
export function curriculumAccess(actor: AuthContext, course: CourseRef) {
  const isAdmin = actor.permissions.has('courses.update');
  const assigned = course.instructors.some((i) => i.equals(actor.userId));
  const canEdit =
    isAdmin ||
    (assigned && (actor.permissions.has('lessons.update') || actor.permissions.has('lessons.create')));
  const canPublish = isAdmin || (assigned && actor.permissions.has('lessons.publish'));
  return { canEdit, canPublish };
}

async function loadCourse(courseId: string | Types.ObjectId): Promise<CourseRef> {
  const c = await Course.findById(courseId)
    .select('title slug publicationStatus instructors')
    .lean<CourseRef>();
  if (!c) throw ApiError.notFound('Course not found');
  return c;
}

async function requireEdit(actor: AuthContext, courseId: string | Types.ObjectId) {
  const course = await loadCourse(courseId);
  const access = curriculumAccess(actor, course);
  if (!access.canEdit)
    throw ApiError.forbidden('You can only manage the curriculum of courses assigned to you');
  if (course.publicationStatus === 'archived') throw ApiError.conflict('Archived courses cannot be edited');
  return { course, access };
}

/** Lesson files must be lesson_resource uploads owned by the caller (or any, for course admins). */
async function assertLessonMedia(actor: AuthContext, ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return;
  const filter: Record<string, unknown> = {
    _id: { $in: wanted },
    deletedAt: null,
    purpose: 'lesson_resource',
  };
  if (!actor.permissions.has('courses.update')) filter.owner = actor.userId;
  const n = await MediaAsset.countDocuments(filter);
  if (n !== wanted.length)
    throw ApiError.badRequest('One or more attached files are invalid or not yours', {
      resources: 'Invalid file',
    });
}

/* ============================ Serialisation ============================ */
type LessonLean = {
  _id: Types.ObjectId;
  section: Types.ObjectId;
  title: string;
  type: 'text' | 'video' | 'pdf';
  summary?: string;
  content?: string;
  videoMedia?: Types.ObjectId | null;
  videoUrl?: string | null;
  pdfMedia?: Types.ObjectId | null;
  resources: { media: Types.ObjectId; title: string }[];
  durationMinutes?: number | null;
  isPreview: boolean;
  publicationStatus: 'draft' | 'published';
  order: number;
  updatedAt: Date;
};

const toManagedLesson = (l: LessonLean): ManagedLessonDto => ({
  id: String(l._id),
  sectionId: String(l.section),
  title: l.title,
  type: l.type,
  summary: l.summary ?? '',
  content: l.content ?? '',
  videoMediaId: l.videoMedia ? String(l.videoMedia) : null,
  videoUrl: l.videoUrl ?? null,
  pdfMediaId: l.pdfMedia ? String(l.pdfMedia) : null,
  resources: l.resources.map((r) => ({ mediaId: String(r.media), title: r.title })),
  durationMinutes: l.durationMinutes ?? null,
  isPreview: l.isPreview,
  publicationStatus: l.publicationStatus,
  order: l.order,
  updatedAt: l.updatedAt.toISOString(),
});

/* ============================ Management ============================ */

export async function getManagedCurriculum(
  actor: AuthContext,
  courseId: string,
): Promise<ManagedCurriculumDto> {
  const course = await loadCourse(courseId);
  const access = curriculumAccess(actor, course);
  if (!access.canEdit && !actor.permissions.has('courses.read'))
    throw ApiError.forbidden('You can only view courses assigned to you');
  const [sections, lessons] = await Promise.all([
    CourseSection.find({ course: course._id, deletedAt: null }).sort({ order: 1 }).lean(),
    Lesson.find({ course: course._id, deletedAt: null }).sort({ order: 1 }).lean<LessonLean[]>(),
  ]);
  return {
    course: {
      id: String(course._id),
      title: course.title,
      slug: course.slug,
      publicationStatus: course.publicationStatus as ManagedCurriculumDto['course']['publicationStatus'],
    },
    sections: sections.map((s) => ({
      id: String(s._id),
      title: s.title,
      description: s.description ?? '',
      order: s.order,
      lessons: lessons.filter((l) => l.section.equals(s._id)).map(toManagedLesson),
    })),
    can: {
      edit: access.canEdit && course.publicationStatus !== 'archived',
      publish: access.canPublish && course.publicationStatus !== 'archived',
    },
  };
}

export async function createSection(
  actor: AuthContext,
  courseId: string,
  input: SectionData,
  ctx: RequestContext,
) {
  const { course } = await requireEdit(actor, courseId);
  const last = await CourseSection.findOne({ course: course._id, deletedAt: null })
    .sort({ order: -1 })
    .select('order')
    .lean();
  const s = await CourseSection.create({
    ...input,
    course: course._id,
    order: (last?.order ?? -1) + 1,
    createdBy: actor.userId,
    updatedBy: actor.userId,
  });
  await audit({
    actor: actor.userId,
    action: 'curriculum.section_created',
    targetType: 'Course',
    targetId: course._id,
    metadata: { sectionId: String(s._id) },
    ctx,
  });
  return getManagedCurriculum(actor, String(course._id));
}

async function loadSection(id: string) {
  const s = await CourseSection.findOne({ _id: id, deletedAt: null });
  if (!s) throw ApiError.notFound('Section not found');
  return s;
}

export async function updateSection(
  actor: AuthContext,
  id: string,
  input: Partial<SectionData>,
  ctx: RequestContext,
) {
  const s = await loadSection(id);
  await requireEdit(actor, s.course);
  s.set({ ...input, updatedBy: actor.userId });
  await s.save();
  await audit({
    actor: actor.userId,
    action: 'curriculum.section_updated',
    targetType: 'Course',
    targetId: s.course,
    metadata: { sectionId: id },
    ctx,
  });
  return getManagedCurriculum(actor, String(s.course));
}

export async function deleteSection(actor: AuthContext, id: string, ctx: RequestContext) {
  const s = await loadSection(id);
  await requireEdit(actor, s.course);
  if (await Lesson.exists({ section: s._id, deletedAt: null }))
    throw ApiError.conflict('Move or delete the lessons in this section first');
  s.deletedAt = new Date();
  await s.save();
  await audit({
    actor: actor.userId,
    action: 'curriculum.section_deleted',
    targetType: 'Course',
    targetId: s.course,
    metadata: { sectionId: id },
    ctx,
  });
  return getManagedCurriculum(actor, String(s.course));
}

/** Rewrites `order` for exactly the given items; all ids must belong to the same parent. */
export async function reorderSections(
  actor: AuthContext,
  courseId: string,
  ids: string[],
  ctx: RequestContext,
) {
  const { course } = await requireEdit(actor, courseId);
  const existing = await CourseSection.find({ course: course._id, deletedAt: null }).select('_id').lean();
  if (existing.length !== ids.length || !existing.every((s) => ids.includes(String(s._id)))) {
    throw ApiError.badRequest('Provide every section of this course exactly once');
  }
  await CourseSection.bulkWrite(
    ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })),
  );
  await audit({
    actor: actor.userId,
    action: 'curriculum.sections_reordered',
    targetType: 'Course',
    targetId: course._id,
    ctx,
  });
  return getManagedCurriculum(actor, courseId);
}

export async function reorderLessons(
  actor: AuthContext,
  sectionId: string,
  ids: string[],
  ctx: RequestContext,
) {
  const s = await loadSection(sectionId);
  await requireEdit(actor, s.course);
  const existing = await Lesson.find({ section: s._id, deletedAt: null }).select('_id').lean();
  if (existing.length !== ids.length || !existing.every((l) => ids.includes(String(l._id)))) {
    throw ApiError.badRequest('Provide every lesson of this section exactly once');
  }
  await Lesson.bulkWrite(
    ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })),
  );
  await audit({
    actor: actor.userId,
    action: 'curriculum.lessons_reordered',
    targetType: 'Course',
    targetId: s.course,
    metadata: { sectionId },
    ctx,
  });
  return getManagedCurriculum(actor, String(s.course));
}

function lessonFields(input: Partial<LessonData>) {
  const { sectionId, videoMediaId, pdfMediaId, resources, ...rest } = input;
  return {
    ...rest,
    ...(sectionId !== undefined ? { section: sectionId } : {}),
    ...(videoMediaId !== undefined ? { videoMedia: videoMediaId } : {}),
    ...(pdfMediaId !== undefined ? { pdfMedia: pdfMediaId } : {}),
    ...(resources !== undefined
      ? { resources: resources.map((r) => ({ media: r.mediaId, title: r.title })) }
      : {}),
  };
}

export async function createLesson(
  actor: AuthContext,
  courseId: string,
  input: LessonData,
  ctx: RequestContext,
) {
  const { course } = await requireEdit(actor, courseId);
  const section = await CourseSection.findOne({ _id: input.sectionId, course: course._id, deletedAt: null })
    .select('_id')
    .lean();
  if (!section)
    throw ApiError.badRequest('Section does not belong to this course', { sectionId: 'Invalid section' });
  await assertLessonMedia(actor, [
    input.videoMediaId,
    input.pdfMediaId,
    ...input.resources.map((r) => r.mediaId),
  ]);
  const last = await Lesson.findOne({ section: section._id, deletedAt: null })
    .sort({ order: -1 })
    .select('order')
    .lean();
  const l = await Lesson.create({
    ...lessonFields(input),
    course: course._id,
    order: (last?.order ?? -1) + 1,
    publicationStatus: 'draft',
    createdBy: actor.userId,
    updatedBy: actor.userId,
  });
  await audit({
    actor: actor.userId,
    action: 'curriculum.lesson_created',
    targetType: 'Lesson',
    targetId: l._id,
    metadata: { courseId: String(course._id) },
    ctx,
  });
  return toManagedLesson(l.toObject() as LessonLean);
}

async function loadLesson(id: string) {
  const l = await Lesson.findOne({ _id: id, deletedAt: null });
  if (!l) throw ApiError.notFound('Lesson not found');
  return l;
}

export async function updateLesson(
  actor: AuthContext,
  id: string,
  input: Partial<LessonData>,
  ctx: RequestContext,
) {
  const l = await loadLesson(id);
  await requireEdit(actor, l.course);
  if (input.sectionId) {
    const ok = await CourseSection.exists({ _id: input.sectionId, course: l.course, deletedAt: null });
    if (!ok)
      throw ApiError.badRequest('Section does not belong to this course', { sectionId: 'Invalid section' });
  }
  await assertLessonMedia(actor, [
    input.videoMediaId,
    input.pdfMediaId,
    ...(input.resources ?? []).map((r) => r.mediaId),
  ]);
  l.set({ ...lessonFields(input), updatedBy: actor.userId });
  // Re-validate type-specific requirements against the merged document.
  if (l.type === 'video' && !l.videoMedia && !l.videoUrl)
    throw ApiError.badRequest('Upload a video or provide a video link', { videoUrl: 'Required' });
  if (l.type === 'pdf' && !l.pdfMedia)
    throw ApiError.badRequest('Upload the PDF for this lesson', { pdfMediaId: 'Required' });
  const fields = l.modifiedPaths();
  await l.save();
  await audit({
    actor: actor.userId,
    action: 'curriculum.lesson_updated',
    targetType: 'Lesson',
    targetId: l._id,
    metadata: { fields },
    ctx,
  });
  return toManagedLesson(l.toObject() as LessonLean);
}

export async function setLessonPublication(
  actor: AuthContext,
  id: string,
  publish: boolean,
  ctx: RequestContext,
) {
  const l = await loadLesson(id);
  const { access } = await requireEdit(actor, l.course);
  if (!access.canPublish) throw ApiError.forbidden('You do not have permission to publish lessons');
  l.publicationStatus = publish ? 'published' : 'draft';
  if (publish) l.publishedAt ??= new Date();
  l.updatedBy = actor.userId;
  await l.save();
  await audit({
    actor: actor.userId,
    action: publish ? 'curriculum.lesson_published' : 'curriculum.lesson_unpublished',
    targetType: 'Lesson',
    targetId: l._id,
    ctx,
  });
  return toManagedLesson(l.toObject() as LessonLean);
}

export async function deleteLesson(actor: AuthContext, id: string, ctx: RequestContext) {
  const l = await loadLesson(id);
  await requireEdit(actor, l.course);
  l.deletedAt = new Date();
  l.updatedBy = actor.userId;
  await l.save();
  await audit({
    actor: actor.userId,
    action: 'curriculum.lesson_deleted',
    targetType: 'Lesson',
    targetId: l._id,
    ctx,
  });
}

/* ============================ Instructor portal ============================ */

export async function listInstructorCourses(actor: AuthContext): Promise<InstructorCourseDto[]> {
  const courses = await Course.find({ instructors: actor.userId, publicationStatus: { $ne: 'archived' } })
    .sort({ startDate: 1, title: 1 })
    .lean();
  const counts = await Lesson.aggregate<{ _id: Types.ObjectId; total: number; published: number }>([
    { $match: { course: { $in: courses.map((c) => c._id) }, deletedAt: null } },
    {
      $group: {
        _id: '$course',
        total: { $sum: 1 },
        published: { $sum: { $cond: [{ $eq: ['$publicationStatus', 'published'] }, 1, 0] } },
      },
    },
  ]);
  const byCourse = new Map(counts.map((c) => [String(c._id), c]));
  return courses.map((c) => ({
    id: String(c._id),
    title: c.title,
    slug: c.slug,
    thumbnailUrl: c.thumbnailUrl ?? null,
    publicationStatus: c.publicationStatus,
    displayStatus: deriveCourseDisplayStatus({
      ...c,
      seatsTaken: c.enrolledCount,
      lifecycleOverride: c.lifecycleOverride ?? null,
    }),
    startDate: c.startDate?.toISOString() ?? null,
    endDate: c.endDate?.toISOString() ?? null,
    timezone: c.timezone ?? 'Africa/Mogadishu',
    schedule: c.schedule.map((s) => ({ day: s.day, startTime: s.startTime, endTime: s.endTime })),
    lessonCount: byCourse.get(String(c._id))?.total ?? 0,
    publishedLessonCount: byCourse.get(String(c._id))?.published ?? 0,
  }));
}

/* ============================ Public ============================ */

async function publishedCourseBySlug(slug: string) {
  const c = await Course.findOne({ slug, publicationStatus: 'published' }).select('_id').lean();
  if (!c) throw ApiError.notFound('Course not found');
  return c._id;
}

/** Titles/structure only; lesson bodies and files are never part of the public outline. */
export async function getOutline(slug: string): Promise<CurriculumOutlineDto> {
  const courseId = await publishedCourseBySlug(slug);
  const [sections, lessons] = await Promise.all([
    CourseSection.find({ course: courseId, deletedAt: null }).sort({ order: 1 }).select('title').lean(),
    Lesson.find({ course: courseId, deletedAt: null, publicationStatus: 'published' })
      .sort({ order: 1 })
      .select('section title type durationMinutes isPreview')
      .lean(),
  ]);
  const out = sections
    .map((s) => ({
      id: String(s._id),
      title: s.title,
      lessons: lessons
        .filter((l) => l.section.equals(s._id))
        .map((l) => ({
          id: String(l._id),
          title: l.title,
          type: l.type as 'text',
          durationMinutes: l.durationMinutes ?? null,
          isPreview: l.isPreview,
        })),
    }))
    .filter((s) => s.lessons.length > 0);
  return {
    sections: out,
    totalLessons: lessons.length,
    totalMinutes: lessons.reduce((sum, l) => sum + (l.durationMinutes ?? 0), 0),
  };
}

export async function getPreview(slug: string, lessonId: string): Promise<LessonPreviewDto> {
  const courseId = await publishedCourseBySlug(slug);
  if (!mongoose.isValidObjectId(lessonId)) throw ApiError.notFound('Lesson not found');
  const l = await Lesson.findOne({
    _id: lessonId,
    course: courseId,
    deletedAt: null,
    publicationStatus: 'published',
    isPreview: true,
  }).lean<LessonLean>();
  if (!l) throw ApiError.notFound('Lesson not found');
  const media = l.type === 'video' ? l.videoMedia : l.type === 'pdf' ? l.pdfMedia : null;
  return {
    id: String(l._id),
    title: l.title,
    type: l.type,
    summary: l.summary ?? '',
    content: l.content ?? '',
    mediaUrl: media ? signedUrl(String(media)).url : l.type === 'video' ? (l.videoUrl ?? null) : null,
    durationMinutes: l.durationMinutes ?? null,
  };
}

/* ============================ Private file access ============================ */

/** Course managers (admins, assigned instructors) may read files attached to that course's lessons. */
registerPrivateAccessResolver(async (assetId, actor) => {
  const id = new Types.ObjectId(assetId);
  const lessons = await Lesson.find({
    deletedAt: null,
    $or: [{ videoMedia: id }, { pdfMedia: id }, { 'resources.media': id }],
  })
    .select('course')
    .lean();
  for (const l of lessons) {
    const course = await loadCourse(l.course);
    if (curriculumAccess(actor, course).canEdit || actor.permissions.has('courses.read')) return true;
  }
  return false;
});
