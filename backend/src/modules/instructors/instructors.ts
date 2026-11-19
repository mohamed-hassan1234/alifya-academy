import { Router } from 'express';
import { Schema, model, type Types } from 'mongoose';
import type { z } from 'zod';
import {
  instructorProfileSchema,
  objectIdSchema,
  paginationQuerySchema,
  type AdminInstructorDto,
  type InstructorSocial,
  type PublicInstructorDetailDto,
  type PublicInstructorDto,
  type PublicationStatus,
} from '@alifya/shared';
import { authenticate, type AuthContext } from '../../middleware/authenticate.js';
import { requireAnyPermission, requirePermission } from '../../middleware/authorize.js';
import { parse } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { ok, paginationMeta } from '../../utils/respond.js';
import { param, requestContext, requireUser, type RequestContext } from '../../utils/request.js';
import { audit } from '../audit/audit.service.js';
import { Course } from '../courses/course.model.js';
import { assertPublicAssetUrl } from '../media/media.service.js';
import { toProgramCourse } from '../programs/programs.js';
import { Role } from '../roles/role.model.js';
import { User } from '../users/user.model.js';

/* ================================ Model ================================ */
const instructorProfileDb = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    professionalTitle: { type: String, default: '', maxlength: 120 },
    specialization: { type: String, default: '', maxlength: 160 },
    biography: { type: String, default: '', maxlength: 5000 },
    photoUrl: { type: String, default: null },
    social: {
      linkedin: { type: String, default: null },
      x: { type: String, default: null },
      website: { type: String, default: null },
      facebook: { type: String, default: null },
    },
    /** Only profiles explicitly made public appear on the website. */
    isPublic: { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
instructorProfileDb.index({ user: 1 }, { unique: true });
instructorProfileDb.index({ isPublic: 1 });
export const InstructorProfile = model('InstructorProfile', instructorProfileDb);

/* ================================ Helpers ================================ */
type ProfileLean = {
  user: Types.ObjectId;
  professionalTitle?: string;
  specialization?: string;
  biography?: string;
  photoUrl?: string | null;
  social?: InstructorSocial;
  isPublic?: boolean;
};
type UserLean = {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  status: AdminInstructorDto['status'];
};

const instructorRoleId = async () => (await Role.findOne({ key: 'instructor' }).select('_id').lean())?._id;

const cleanSocial = (s?: InstructorSocial): InstructorSocial =>
  Object.fromEntries(Object.entries(s ?? {}).filter(([, v]) => !!v)) as InstructorSocial;

function toPublic(u: UserLean, p: ProfileLean | undefined): PublicInstructorDto {
  return {
    id: String(u._id),
    fullName: u.fullName,
    professionalTitle: p?.professionalTitle ?? '',
    specialization: p?.specialization ?? '',
    biography: p?.biography ?? '',
    photoUrl: p?.photoUrl ?? null,
    social: cleanSocial(p?.social),
  };
}

/** Public instructors: active users holding the instructor role whose profile is public. */
async function publicInstructorIds(): Promise<Types.ObjectId[]> {
  const roleId = await instructorRoleId();
  const profiles = await InstructorProfile.find({ isPublic: true }).select('user').lean();
  const users = await User.find({
    _id: { $in: profiles.map((p) => p.user) },
    roles: roleId,
    status: 'active',
  })
    .select('_id')
    .lean();
  return users.map((u) => u._id);
}

type ProfileData = z.output<typeof instructorProfileSchema>;

async function saveProfile(actor: AuthContext, userId: string, input: ProfileData, ctx: RequestContext) {
  const roleId = await instructorRoleId();
  const user = await User.findOne({ _id: userId, roles: roleId }).select('_id').lean();
  if (!user) throw ApiError.notFound('Instructor not found');
  await assertPublicAssetUrl(input.photoUrl, 'photoUrl');
  await InstructorProfile.updateOne(
    { user: user._id },
    { $set: { ...input, photoUrl: input.photoUrl ?? null, updatedBy: actor.userId } },
    { upsert: true, runValidators: true },
  );
  await audit({
    actor: actor.userId,
    action: 'instructor.profile_updated',
    targetType: 'User',
    targetId: user._id,
    metadata: { isPublic: input.isPublic },
    ctx,
  });
}

async function adminRow(u: UserLean): Promise<AdminInstructorDto> {
  const [profile, courses] = await Promise.all([
    InstructorProfile.findOne({ user: u._id }).lean<ProfileLean>(),
    Course.find({ instructors: u._id }).select('title publicationStatus').sort({ title: 1 }).lean(),
  ]);
  return {
    ...toPublic(u, profile ?? undefined),
    email: u.email,
    status: u.status,
    isPublic: !!profile?.isPublic,
    assignedCourses: courses.map((c) => ({
      id: String(c._id),
      title: c.title,
      publicationStatus: c.publicationStatus as PublicationStatus,
    })),
  };
}

/* ================================ Public routes ================================ */
export const publicInstructorsRouter = Router();

publicInstructorsRouter.get(
  '/instructors',
  asyncHandler(async (req, res) => {
    const q = parse(
      paginationQuerySchema.extend({ limit: paginationQuerySchema.shape.limit.default(24) }),
      req.query,
    );
    const ids = await publicInstructorIds();
    const users = await User.find({ _id: { $in: ids } })
      .sort({ fullName: 1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .select('fullName email status')
      .lean<UserLean[]>();
    const profiles = await InstructorProfile.find({ user: { $in: users.map((u) => u._id) } }).lean<
      ProfileLean[]
    >();
    const byUser = new Map(profiles.map((p) => [String(p.user), p]));
    res.set('Cache-Control', 'public, max-age=60');
    ok(
      res,
      users.map((u) => toPublic(u, byUser.get(String(u._id)))),
      200,
      paginationMeta(q.page, q.limit, ids.length),
    );
  }),
);

publicInstructorsRouter.get(
  '/instructors/:id',
  asyncHandler(async (req, res) => {
    const id = parse(objectIdSchema, param(req, 'id'));
    const ids = await publicInstructorIds();
    if (!ids.some((x) => x.equals(id))) throw ApiError.notFound('Instructor not found');
    const [user, profile, courses] = await Promise.all([
      User.findById(id).select('fullName email status').lean<UserLean>(),
      InstructorProfile.findOne({ user: id }).lean<ProfileLean>(),
      Course.find({ instructors: id, publicationStatus: 'published' }).sort({ publishedAt: -1 }).lean(),
    ]);
    const body: PublicInstructorDetailDto = {
      ...toPublic(user!, profile ?? undefined),
      courses: courses.map((c) => toProgramCourse(c as Parameters<typeof toProgramCourse>[0])),
    };
    res.set('Cache-Control', 'public, max-age=60');
    ok(res, body);
  }),
);

/* ================================ Admin routes ================================ */
export const adminInstructorsRouter = Router();
adminInstructorsRouter.use(authenticate);

adminInstructorsRouter.get(
  '/',
  requireAnyPermission('instructors.read', 'instructors.manage', 'users.read'),
  asyncHandler(async (req, res) => {
    const q = parse(
      paginationQuerySchema.extend({ limit: paginationQuerySchema.shape.limit.default(50) }),
      req.query,
    );
    const roleId = await instructorRoleId();
    const filter = { roles: roleId };
    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ fullName: 1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .select('fullName email status')
        .lean<UserLean[]>(),
      User.countDocuments(filter),
    ]);
    ok(res, await Promise.all(users.map(adminRow)), 200, paginationMeta(q.page, q.limit, total));
  }),
);

adminInstructorsRouter.put(
  '/:userId/profile',
  requirePermission('instructors.manage'),
  asyncHandler(async (req, res) => {
    const userId = parse(objectIdSchema, param(req, 'userId'));
    await saveProfile(
      requireUser(req),
      userId,
      parse(instructorProfileSchema, req.body),
      requestContext(req),
    );
    const user = await User.findById(userId).select('fullName email status').lean<UserLean>();
    ok(res, await adminRow(user!));
  }),
);

/* ================================ Instructor self-service ================================ */
export const instructorProfileRouter = Router();
instructorProfileRouter.use(authenticate, (req, _res, next) => {
  next(
    req.auth?.roles.some((r) => r.key === 'instructor')
      ? undefined
      : ApiError.forbidden('Instructor access only'),
  );
});

instructorProfileRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = await User.findById(requireUser(req).userId)
      .select('fullName email status')
      .lean<UserLean>();
    ok(res, await adminRow(user!));
  }),
);

instructorProfileRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const auth = requireUser(req);
    await saveProfile(
      auth,
      String(auth.userId),
      parse(instructorProfileSchema, req.body),
      requestContext(req),
    );
    const user = await User.findById(auth.userId).select('fullName email status').lean<UserLean>();
    ok(res, await adminRow(user!));
  }),
);
