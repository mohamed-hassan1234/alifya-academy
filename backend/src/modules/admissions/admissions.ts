/**
 * Course applications and enrolments — the academy's admission workflow:
 *   select course → sign in → apply → admissions review → (approve) enrolment.
 *
 * - A signed-in user applies while course registration is open. One open application per course.
 * - Admissions staff approve or reject (applications.approve / applications.reject).
 * - Approval allocates a seat transactionally (capacity-safe) and creates the enrolment:
 *     free course → `active` (access granted)
 *     paid course → `pending_payment` (NO access until payment is verified — payments are not built yet)
 *
 * Student  POST /courses/:slug/applications, GET /courses/:slug/my-status,
 *          POST /me/applications/:id/withdraw, GET /me/learning
 * Staff    GET /admin/applications, POST /admin/applications/:id/approve|reject
 */
import { Router } from 'express';
import mongoose, { Schema, model, type Types } from 'mongoose';
import {
  APPLICATION_STATUSES,
  ENROLLMENT_STATUSES,
  adminApplicationQuerySchema,
  applicationDecisionSchema,
  courseApplicationSchema,
  isRegistrationOpen,
  objectIdSchema,
  slugSchema,
  type AdminApplicationDto,
  type ApplicationCourseDto,
  type ApplicationStatus,
  type EnrollmentStatus,
  type MyApplicationDto,
  type MyCourseStatusDto,
  type MyEnrollmentDto,
  type MyLearningDto,
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
import { User } from '../users/user.model.js';

/* ================================ Models ================================ */
const applicationDb = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: APPLICATION_STATUSES, default: 'submitted' },
    motivation: { type: String, default: '', maxlength: 1500 },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, default: null, maxlength: 1000 },
  },
  { timestamps: true },
);
// At most one OPEN (submitted) application per student per course; history is kept.
applicationDb.index(
  { course: 1, student: 1 },
  { unique: true, partialFilterExpression: { status: 'submitted' }, name: 'one_open_application' },
);
applicationDb.index({ status: 1, createdAt: -1 });
applicationDb.index({ student: 1, createdAt: -1 });
export const CourseApplication = model('CourseApplication', applicationDb);

const enrollmentDb = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ENROLLMENT_STATUSES, required: true },
    source: { type: String, enum: ['application', 'admin'], default: 'application' },
    application: { type: Schema.Types.ObjectId, ref: 'CourseApplication', default: null },
    enrolledAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);
enrollmentDb.index({ course: 1, student: 1 }, { unique: true });
enrollmentDb.index({ student: 1, status: 1 });
export const Enrollment = model('Enrollment', enrollmentDb);

/* ================================ Serialisation ================================ */
type CourseLean = {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  thumbnailUrl?: string | null;
  feeAmount: number;
  currency: ApplicationCourseDto['currency'];
};
type ApplicationLean = {
  _id: Types.ObjectId;
  status: ApplicationStatus;
  motivation?: string;
  createdAt: Date;
  decidedAt?: Date | null;
  decisionNote?: string | null;
};
type EnrollmentLean = { _id: Types.ObjectId; status: EnrollmentStatus; enrolledAt: Date };

const COURSE_FIELDS = 'title slug thumbnailUrl feeAmount currency';

const toCourse = (c: CourseLean): ApplicationCourseDto => ({
  id: String(c._id),
  title: c.title,
  slug: c.slug,
  thumbnailUrl: c.thumbnailUrl ?? null,
  isFree: c.feeAmount === 0,
  feeAmount: c.feeAmount,
  currency: c.currency,
});
const toApplication = (a: ApplicationLean): MyApplicationDto => ({
  id: String(a._id),
  status: a.status,
  motivation: a.motivation ?? '',
  submittedAt: a.createdAt.toISOString(),
  decidedAt: a.decidedAt?.toISOString() ?? null,
  decisionNote: a.decisionNote ?? null,
});
const toEnrollment = (e: EnrollmentLean): MyEnrollmentDto => ({
  id: String(e._id),
  status: e.status,
  enrolledAt: e.enrolledAt.toISOString(),
});

/* ================================ Service ================================ */
async function findPublishedCourse(slug: string) {
  const c = await Course.findOne({ slug, publicationStatus: 'published' });
  if (!c) throw ApiError.notFound('Course not found');
  return c;
}

const registrationOpen = (c: InstanceType<typeof Course>) =>
  isRegistrationOpen({
    publicationStatus: c.publicationStatus as 'published',
    registrationMode: c.registrationMode as 'open' | 'closed',
    registrationOpensAt: c.registrationOpensAt,
    registrationClosesAt: c.registrationClosesAt,
    lifecycleOverride: c.lifecycleOverride as never,
    capacity: c.capacity,
    seatsTaken: c.enrolledCount,
  });

async function myStatus(
  courseId: Types.ObjectId,
  studentId: Types.ObjectId,
  open: boolean,
): Promise<MyCourseStatusDto> {
  const [application, enrollment] = await Promise.all([
    CourseApplication.findOne({ course: courseId, student: studentId })
      .sort({ createdAt: -1 })
      .lean<ApplicationLean>(),
    Enrollment.findOne({
      course: courseId,
      student: studentId,
      status: { $ne: 'cancelled' },
    }).lean<EnrollmentLean>(),
  ]);
  const blocked = !!enrollment || application?.status === 'submitted' || application?.status === 'approved';
  return {
    application: application ? toApplication(application) : null,
    enrollment: enrollment ? toEnrollment(enrollment) : null,
    canApply: open && !blocked,
  };
}

async function apply(slug: string, studentId: Types.ObjectId, motivation: string, ctx: RequestContext) {
  const course = await findPublishedCourse(slug);
  const status = await myStatus(course._id, studentId, registrationOpen(course));
  if (status.enrollment) throw ApiError.conflict('You are already enrolled in this course');
  if (status.application?.status === 'submitted')
    throw ApiError.conflict('You already have an application under review for this course');
  if (status.application?.status === 'approved')
    throw ApiError.conflict('You have already been admitted to this course');
  if (!status.canApply) throw ApiError.conflict('Applications are not open for this course');
  try {
    const a = await CourseApplication.create({ course: course._id, student: studentId, motivation });
    await audit({
      actor: studentId,
      action: 'application.submitted',
      targetType: 'CourseApplication',
      targetId: a._id,
      metadata: { course: course.slug },
      ctx,
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000)
      throw ApiError.conflict('You already have an application under review for this course');
    throw err;
  }
  return myStatus(course._id, studentId, registrationOpen(course));
}

async function withdraw(id: string, studentId: Types.ObjectId, ctx: RequestContext) {
  const a = await CourseApplication.findOneAndUpdate(
    { _id: id, student: studentId, status: 'submitted' },
    { $set: { status: 'withdrawn', decidedAt: new Date() } },
    { new: true },
  );
  if (!a) throw ApiError.notFound('No open application found');
  await audit({
    actor: studentId,
    action: 'application.withdrawn',
    targetType: 'CourseApplication',
    targetId: a._id,
    ctx,
  });
}

async function decide(
  actor: Types.ObjectId,
  id: string,
  decision: 'approved' | 'rejected',
  note: string,
  ctx: RequestContext,
) {
  const session = await mongoose.startSession();
  let enrollmentStatus: EnrollmentStatus | null = null;
  try {
    await session.withTransaction(async () => {
      const a = await CourseApplication.findById(id).session(session);
      if (!a) throw ApiError.notFound('Application not found');
      if (a.status !== 'submitted') throw ApiError.conflict(`This application is already ${a.status}`);
      if (decision === 'approved') {
        const course = await Course.findById(a.course).session(session);
        if (!course) throw ApiError.notFound('Course not found');
        // Capacity-safe seat allocation: the conditional update fails once the course is full.
        const seat = await Course.updateOne(
          {
            _id: course._id,
            ...(course.capacity != null ? { enrolledCount: { $lt: course.capacity } } : {}),
          },
          { $inc: { enrolledCount: 1 } },
          { session },
        );
        if (!seat.modifiedCount) throw ApiError.conflict('This course is full — no seats remain');
        enrollmentStatus = course.feeAmount === 0 ? 'active' : 'pending_payment';
        await Enrollment.updateOne(
          { course: course._id, student: a.student },
          {
            $set: {
              status: enrollmentStatus,
              source: 'application',
              application: a._id,
              enrolledAt: new Date(),
            },
          },
          { upsert: true, session },
        );
      }
      a.set({ status: decision, decidedBy: actor, decidedAt: new Date(), decisionNote: note || null });
      await a.save({ session });
    });
  } finally {
    await session.endSession();
  }
  await audit({
    actor,
    action: `application.${decision}`,
    targetType: 'CourseApplication',
    targetId: id,
    metadata: { ...(enrollmentStatus ? { enrollment: enrollmentStatus } : {}), note: note || undefined },
    ctx,
  });
  return getAdmin(id);
}

async function getAdmin(id: string): Promise<AdminApplicationDto> {
  const a = await CourseApplication.findById(id)
    .populate<{ course: CourseLean }>('course', COURSE_FIELDS)
    .populate<{ student: { _id: Types.ObjectId; fullName: string; email: string } }>(
      'student',
      'fullName email',
    )
    .populate<{ decidedBy: { _id: Types.ObjectId; fullName: string } | null }>('decidedBy', 'fullName')
    .lean();
  if (!a) throw ApiError.notFound('Application not found');
  return toAdmin(a as never);
}

function toAdmin(
  a: ApplicationLean & {
    course: CourseLean;
    student: { _id: Types.ObjectId; fullName: string; email: string };
    decidedBy: { _id: Types.ObjectId; fullName: string } | null;
  },
): AdminApplicationDto {
  return {
    ...toApplication(a),
    course: toCourse(a.course),
    student: { id: String(a.student._id), fullName: a.student.fullName, email: a.student.email },
    decidedBy: a.decidedBy ? { id: String(a.decidedBy._id), fullName: a.decidedBy.fullName } : null,
  };
}

/* ================================ Student routes ================================ */
export const studentAdmissionsRouter = Router();

studentAdmissionsRouter.get(
  '/courses/:slug/my-status',
  authenticate,
  asyncHandler(async (req, res) => {
    const course = await findPublishedCourse(parse(slugSchema, param(req, 'slug')));
    res.set('Cache-Control', 'no-store');
    ok(res, await myStatus(course._id, requireUser(req).userId, registrationOpen(course)));
  }),
);

studentAdmissionsRouter.post(
  '/courses/:slug/applications',
  authenticate,
  asyncHandler(async (req, res) => {
    const { motivation } = parse(courseApplicationSchema, req.body ?? {});
    ok(
      res,
      await apply(
        parse(slugSchema, param(req, 'slug')),
        requireUser(req).userId,
        motivation,
        requestContext(req),
      ),
      201,
    );
  }),
);

studentAdmissionsRouter.post(
  '/me/applications/:id/withdraw',
  authenticate,
  asyncHandler(async (req, res) => {
    await withdraw(parse(objectIdSchema, param(req, 'id')), requireUser(req).userId, requestContext(req));
    ok(res, { withdrawn: true });
  }),
);

studentAdmissionsRouter.get(
  '/me/learning',
  authenticate,
  asyncHandler(async (req, res) => {
    const me = requireUser(req).userId;
    const [apps, enrolls] = await Promise.all([
      CourseApplication.find({ student: me })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate<{ course: CourseLean }>('course', COURSE_FIELDS)
        .lean(),
      Enrollment.find({ student: me, status: { $ne: 'cancelled' } })
        .sort({ enrolledAt: -1 })
        .populate<{ course: CourseLean }>('course', COURSE_FIELDS)
        .lean(),
    ]);
    const data: MyLearningDto = {
      applications: apps
        .filter((a) => a.course)
        .map((a) => ({ ...toApplication(a as unknown as ApplicationLean), course: toCourse(a.course) })),
      enrollments: enrolls
        .filter((e) => e.course)
        .map((e) => ({ ...toEnrollment(e as unknown as EnrollmentLean), course: toCourse(e.course) })),
    };
    res.set('Cache-Control', 'no-store');
    ok(res, data);
  }),
);

/* ================================ Staff routes ================================ */
export const adminApplicationsRouter = Router();
adminApplicationsRouter.use(authenticate, requirePermission('applications.read'));

adminApplicationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(adminApplicationQuerySchema, req.query);
    const filter: Record<string, unknown> = {};
    if (q.status) filter.status = q.status;
    if (q.q) {
      const re = new RegExp(escapeRegex(q.q), 'i');
      const [users, courses] = await Promise.all([
        User.find({ $or: [{ fullName: re }, { email: re }] })
          .select('_id')
          .limit(200)
          .lean(),
        Course.find({ title: re }).select('_id').limit(200).lean(),
      ]);
      filter.$or = [
        { student: { $in: users.map((u) => u._id) } },
        { course: { $in: courses.map((c) => c._id) } },
      ];
    }
    const [docs, total] = await Promise.all([
      CourseApplication.find(filter)
        .sort({ status: 1, createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate('course', COURSE_FIELDS)
        .populate('student', 'fullName email')
        .populate('decidedBy', 'fullName')
        .lean(),
      CourseApplication.countDocuments(filter),
    ]);
    ok(
      res,
      docs.filter((d) => d.course && d.student).map((d) => toAdmin(d as never)),
      200,
      paginationMeta(q.page, q.limit, total),
    );
  }),
);

for (const [action, decision, permission] of [
  ['approve', 'approved', 'applications.approve'],
  ['reject', 'rejected', 'applications.reject'],
] as const) {
  adminApplicationsRouter.post(
    `/:id/${action}`,
    requirePermission(permission),
    asyncHandler(async (req, res) => {
      const { note } = parse(applicationDecisionSchema, req.body ?? {});
      ok(
        res,
        await decide(
          requireUser(req).userId,
          parse(objectIdSchema, param(req, 'id')),
          decision,
          note,
          requestContext(req),
        ),
      );
    }),
  );
}
