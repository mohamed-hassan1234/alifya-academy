/**
 * Webinars: public listing/detail, authenticated registration, private join details and staff management.
 *
 * Public   GET  /webinars?when=upcoming|past&q=&topic=     published webinars
 *          GET  /webinars/topics
 *          GET  /webinars/:slug                              + related webinars
 * Student  GET|POST|DELETE /webinars/:slug/registration      own registration; join link only in the join window
 * Staff    /admin/webinars …                                 webinars.create|update|publish|cancel,
 *                                                            webinar_registrations.manage
 *
 * Meeting links/passcodes and recordings are PRIVATE: never part of public responses, only returned to a
 * registered participant at the right time, or to staff. All webinars are free for now — paid webinars will
 * use the payment flow once it exists, so there is deliberately no price field yet.
 */
import { Router } from 'express';
import mongoose, { Schema, model, type Types } from 'mongoose';
import type { z } from 'zod';
import {
  PUBLICATION_STATUSES,
  WEBINAR_PLATFORMS,
  adminWebinarQuerySchema,
  attendanceSchema,
  cancelWebinarSchema,
  objectIdSchema,
  paginationQuerySchema,
  slugSchema,
  slugify,
  updateWebinarSchema,
  webinarQuerySchema,
  webinarSchema,
  type AdminWebinarDto,
  type MyWebinarRegistrationDto,
  type PublicWebinarDto,
  type PublicWebinarSummaryDto,
  type PublicationStatus,
  type WebinarDisplayStatus,
  type WebinarPlatform,
  type WebinarRegistrationDto,
} from '@alifya/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyPermission, requirePermission } from '../../middleware/authorize.js';
import { parse } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { escapeRegex } from '../../utils/regex.js';
import { ok, paginationMeta } from '../../utils/respond.js';
import { param, requestContext, requireUser, type RequestContext } from '../../utils/request.js';
import { audit } from '../audit/audit.service.js';
import { assertPublicAssetUrl } from '../media/media.service.js';

/* ================================ Models ================================ */
const speakerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    title: { type: String, default: '', maxlength: 160 },
    organization: { type: String, default: '', maxlength: 160 },
    bio: { type: String, default: '', maxlength: 2000 },
    photoUrl: { type: String, default: null },
  },
  { _id: false },
);

const webinarDb = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 140 },
    subtitle: { type: String, default: '', maxlength: 200 },
    summary: { type: String, default: '', maxlength: 400 },
    description: { type: String, default: '', maxlength: 10000 },
    topic: { type: String, default: '', trim: true, maxlength: 60 },
    posterUrl: { type: String, default: null },
    speakers: { type: [speakerSchema], default: [] },
    agenda: { type: [String], default: [] },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    timezone: { type: String, default: 'Africa/Mogadishu' },
    platform: { type: String, enum: WEBINAR_PLATFORMS, default: 'zoom' },
    venue: { type: String, default: '', maxlength: 160 },
    capacity: { type: Number, default: null, min: 1 },
    registrationOpen: { type: Boolean, default: true },
    /** Maintained transactionally together with WebinarRegistration. */
    registeredCount: { type: Number, default: 0, min: 0 },
    meetingUrl: { type: String, default: null, select: false },
    meetingPasscode: { type: String, default: null, select: false },
    joinOpensMinutesBefore: { type: Number, default: 15 },
    recordingUrl: { type: String, default: null, select: false },
    featured: { type: Boolean, default: false },
    publicationStatus: { type: String, enum: PUBLICATION_STATUSES, default: 'draft' },
    publishedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null, maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
webinarDb.index({ slug: 1 }, { unique: true });
webinarDb.index({ publicationStatus: 1, startsAt: 1 });
webinarDb.index({ publicationStatus: 1, topic: 1 });
export const Webinar = model('Webinar', webinarDb);

const registrationDb = new Schema(
  {
    webinar: { type: Schema.Types.ObjectId, ref: 'Webinar', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['registered', 'cancelled'], default: 'registered' },
    registeredAt: { type: Date, default: () => new Date() },
    cancelledAt: { type: Date, default: null },
    attendedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
registrationDb.index({ webinar: 1, user: 1 }, { unique: true }); // one registration per person per webinar
registrationDb.index({ user: 1, status: 1 });
export const WebinarRegistration = model('WebinarRegistration', registrationDb);

/* ================================ Rules ================================ */
type WebinarLean = {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  subtitle?: string;
  summary?: string;
  description?: string;
  topic?: string;
  posterUrl?: string | null;
  speakers: PublicWebinarSummaryDto['speakers'];
  agenda: string[];
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  platform: WebinarPlatform;
  venue?: string;
  capacity?: number | null;
  registrationOpen: boolean;
  registeredCount: number;
  meetingUrl?: string | null;
  meetingPasscode?: string | null;
  joinOpensMinutesBefore: number;
  recordingUrl?: string | null;
  featured?: boolean;
  publicationStatus: PublicationStatus;
  publishedAt?: Date | null;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
  updatedAt: Date;
};

const seatsLeft = (w: WebinarLean) => (w.capacity ? Math.max(0, w.capacity - w.registeredCount) : null);

export function displayStatus(w: WebinarLean, now = new Date()): WebinarDisplayStatus {
  if (w.cancelledAt) return 'cancelled';
  if (now >= w.endsAt) return 'completed';
  if (now >= w.startsAt) return 'live';
  if (!w.registrationOpen || seatsLeft(w) === 0) return 'registration_closed';
  return 'registration_open';
}

/** Registration is possible until the webinar ends (late joiners), never after cancellation. */
const canRegister = (w: WebinarLean, now = new Date()) =>
  w.publicationStatus === 'published' &&
  !w.cancelledAt &&
  now < w.endsAt &&
  w.registrationOpen &&
  seatsLeft(w) !== 0;

const joinOpensAt = (w: WebinarLean) => new Date(w.startsAt.getTime() - w.joinOpensMinutesBefore * 60_000);

/* ================================ Serialisation ================================ */
function toSummary(w: WebinarLean): PublicWebinarSummaryDto {
  return {
    id: String(w._id),
    title: w.title,
    slug: w.slug,
    subtitle: w.subtitle ?? '',
    summary: w.summary ?? '',
    topic: w.topic ?? '',
    posterUrl: w.posterUrl ?? null,
    speakers: w.speakers.map((s) => ({
      name: s.name,
      title: s.title ?? '',
      organization: s.organization ?? '',
      bio: s.bio ?? '',
      photoUrl: s.photoUrl ?? null,
    })),
    startsAt: w.startsAt.toISOString(),
    endsAt: w.endsAt.toISOString(),
    timezone: w.timezone,
    platform: w.platform,
    venue: w.venue ?? '',
    status: displayStatus(w),
    capacity: w.capacity ?? null,
    seatsLeft: seatsLeft(w),
    featured: !!w.featured,
  };
}

function toPublic(w: WebinarLean, related: WebinarLean[]): PublicWebinarDto {
  return {
    ...toSummary(w),
    description: w.description ?? '',
    agenda: w.agenda,
    cancelReason: w.cancelledAt ? (w.cancelReason ?? '') : null,
    related: related.map(toSummary),
  };
}

function toAdmin(w: WebinarLean): AdminWebinarDto {
  const { related: _r, ...pub } = toPublic(w, []);
  return {
    ...pub,
    publicationStatus: w.publicationStatus,
    registrationOpen: w.registrationOpen,
    registeredCount: w.registeredCount,
    meetingUrl: w.meetingUrl ?? null,
    meetingPasscode: w.meetingPasscode ?? null,
    joinOpensMinutesBefore: w.joinOpensMinutesBefore,
    recordingUrl: w.recordingUrl ?? null,
    cancelledAt: w.cancelledAt?.toISOString() ?? null,
    publishedAt: w.publishedAt?.toISOString() ?? null,
    updatedAt: w.updatedAt.toISOString(),
  };
}

/* ================================ Service ================================ */
type WebinarData = z.output<typeof webinarSchema>;
const PRIVATE = '+meetingUrl +meetingPasscode +recordingUrl';

async function assertAssets(input: Partial<WebinarData>) {
  await assertPublicAssetUrl(input.posterUrl, 'posterUrl');
  for (const [i, s] of (input.speakers ?? []).entries())
    await assertPublicAssetUrl(s.photoUrl, `speakers.${i}.photoUrl`);
}

async function uniqueSlug(base: string) {
  for (let i = 0; i < 50; i++) {
    const s = i ? `${base}-${i + 1}` : base;
    if (!(await Webinar.exists({ slug: s }))) return s;
  }
  throw ApiError.conflict('Could not generate a unique slug');
}

async function getAdmin(id: string | Types.ObjectId) {
  const w = await Webinar.findById(id).select(PRIVATE).lean<WebinarLean>();
  if (!w) throw ApiError.notFound('Webinar not found');
  return toAdmin(w);
}

async function findPublished(slug: string) {
  const w = await Webinar.findOne({ slug, publicationStatus: 'published' })
    .select(PRIVATE)
    .lean<WebinarLean>();
  if (!w) throw ApiError.notFound('Webinar not found');
  return w;
}

async function createWebinar(actor: Types.ObjectId, input: WebinarData, ctx: RequestContext) {
  await assertAssets(input);
  let slug = input.slug;
  if (slug) {
    if (await Webinar.exists({ slug }))
      throw ApiError.conflict('This slug is already in use', { slug: 'Already in use' });
  } else slug = await uniqueSlug(slugify(input.title) || 'webinar');
  const w = await Webinar.create({ ...input, slug, createdBy: actor, updatedBy: actor });
  await audit({
    actor,
    action: 'webinar.created',
    targetType: 'Webinar',
    targetId: w._id,
    metadata: { title: w.title },
    ctx,
  });
  return getAdmin(w._id);
}

async function updateWebinar(
  actor: Types.ObjectId,
  id: string,
  input: Partial<WebinarData>,
  ctx: RequestContext,
) {
  const w = await Webinar.findById(id).select(PRIVATE);
  if (!w) throw ApiError.notFound('Webinar not found');
  if (w.publicationStatus === 'archived') throw ApiError.conflict('Archived webinars cannot be edited');
  await assertAssets(input);
  const startsAt = input.startsAt ?? w.startsAt;
  const endsAt = input.endsAt ?? w.endsAt;
  if (endsAt <= startsAt)
    throw ApiError.badRequest('End time must be after the start time', { endsAt: 'Invalid' });
  if (input.capacity != null && input.capacity < w.registeredCount)
    throw ApiError.badRequest('Capacity cannot be lower than current registrations', {
      capacity: `${w.registeredCount} people are already registered`,
    });
  if (input.slug && input.slug !== w.slug) {
    if (await Webinar.exists({ slug: input.slug, _id: { $ne: w._id } }))
      throw ApiError.conflict('This slug is already in use', { slug: 'Already in use' });
  }
  w.set({ ...input, updatedBy: actor });
  const fields = w.modifiedPaths().map((f) => (/^meeting|^recording/.test(f) ? `${f} (private)` : f));
  await w.save();
  await audit({
    actor,
    action: 'webinar.updated',
    targetType: 'Webinar',
    targetId: w._id,
    metadata: { fields },
    ctx,
  });
  return getAdmin(w._id);
}

async function setPublication(
  actor: Types.ObjectId,
  id: string,
  target: PublicationStatus,
  ctx: RequestContext,
) {
  const w = await Webinar.findById(id);
  if (!w) throw ApiError.notFound('Webinar not found');
  if (w.publicationStatus === 'archived') throw ApiError.conflict('Archived webinars cannot change state');
  if (target === 'published') {
    const missing: Record<string, string> = {};
    if (w.description.trim().length < 20) missing.description = 'Add a description (at least 20 characters)';
    if (!w.speakers.length) missing.speakers = 'Add at least one speaker';
    if (Object.keys(missing).length)
      throw ApiError.badRequest('This webinar is not ready to publish', missing);
    w.publishedAt ??= new Date();
  }
  const from = w.publicationStatus;
  w.publicationStatus = target;
  w.updatedBy = actor;
  await w.save();
  await audit({
    actor,
    action: `webinar.${target === 'draft' ? 'unpublished' : target}`,
    targetType: 'Webinar',
    targetId: w._id,
    metadata: { from, to: target },
    ctx,
  });
  return getAdmin(w._id);
}

async function cancelWebinar(actor: Types.ObjectId, id: string, reason: string, ctx: RequestContext) {
  const w = await Webinar.findById(id);
  if (!w) throw ApiError.notFound('Webinar not found');
  if (w.cancelledAt) throw ApiError.conflict('This webinar is already cancelled');
  w.cancelledAt = new Date();
  w.cancelReason = reason;
  w.updatedBy = actor;
  await w.save();
  await audit({
    actor,
    action: 'webinar.cancelled',
    targetType: 'Webinar',
    targetId: w._id,
    metadata: { reason },
    ctx,
  });
  return getAdmin(w._id);
}

async function myRegistration(w: WebinarLean, userId: Types.ObjectId): Promise<MyWebinarRegistrationDto> {
  const r = await WebinarRegistration.findOne({ webinar: w._id, user: userId }).lean();
  const registered = r?.status === 'registered';
  const now = new Date();
  const canJoinNow =
    registered && !w.cancelledAt && !!w.meetingUrl && now >= joinOpensAt(w) && now < w.endsAt;
  return {
    registered,
    registeredAt: registered ? r!.registeredAt.toISOString() : null,
    canJoinNow,
    joinOpensAt: joinOpensAt(w).toISOString(),
    meetingUrl: canJoinNow ? w.meetingUrl! : null,
    meetingPasscode: canJoinNow ? (w.meetingPasscode ?? null) : null,
    recordingUrl: registered && !w.cancelledAt && now >= w.endsAt ? (w.recordingUrl ?? null) : null,
  };
}

async function register(w: WebinarLean, userId: Types.ObjectId, ctx: RequestContext) {
  if (!canRegister(w)) throw ApiError.conflict('Registration is not open for this webinar');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const existing = await WebinarRegistration.findOne({ webinar: w._id, user: userId }).session(session);
      if (existing?.status === 'registered')
        throw ApiError.conflict('You are already registered for this webinar');
      // Atomic seat reservation: the conditional update fails once capacity is reached.
      const seat = await Webinar.updateOne(
        { _id: w._id, ...(w.capacity ? { registeredCount: { $lt: w.capacity } } : {}) },
        { $inc: { registeredCount: 1 } },
        { session },
      );
      if (!seat.modifiedCount) throw ApiError.conflict('This webinar is fully booked');
      if (existing) {
        existing.set({ status: 'registered', registeredAt: new Date(), cancelledAt: null });
        await existing.save({ session });
      } else {
        await WebinarRegistration.create([{ webinar: w._id, user: userId }], { session });
      }
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000)
      throw ApiError.conflict('You are already registered for this webinar');
    throw err;
  } finally {
    await session.endSession();
  }
  await audit({ actor: userId, action: 'webinar.registered', targetType: 'Webinar', targetId: w._id, ctx });
}

async function cancelRegistration(w: WebinarLean, userId: Types.ObjectId, ctx: RequestContext) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const r = await WebinarRegistration.findOneAndUpdate(
        { webinar: w._id, user: userId, status: 'registered' },
        { $set: { status: 'cancelled', cancelledAt: new Date() } },
        { session },
      );
      if (!r) throw ApiError.notFound('You are not registered for this webinar');
      await Webinar.updateOne(
        { _id: w._id, registeredCount: { $gt: 0 } },
        { $inc: { registeredCount: -1 } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  await audit({
    actor: userId,
    action: 'webinar.registration_cancelled',
    targetType: 'Webinar',
    targetId: w._id,
    ctx,
  });
}

/* ================================ Public routes ================================ */
export const publicWebinarsRouter = Router();

publicWebinarsRouter.get(
  '/webinars/topics',
  asyncHandler(async (_req, res) => {
    const topics = (await Webinar.distinct('topic', { publicationStatus: 'published' }))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    res.set('Cache-Control', 'public, max-age=60');
    ok(res, topics);
  }),
);

publicWebinarsRouter.get(
  '/webinars',
  asyncHandler(async (req, res) => {
    const q = parse(webinarQuerySchema, req.query);
    const now = new Date();
    const filter: Record<string, unknown> = {
      publicationStatus: 'published',
      // Upcoming includes live sessions; cancelled ones move to the past list once their date has passed.
      ...(q.when === 'upcoming' ? { endsAt: { $gt: now } } : { endsAt: { $lte: now } }),
    };
    if (q.topic) filter.topic = q.topic;
    if (q.q) {
      const re = new RegExp(escapeRegex(q.q), 'i');
      filter.$or = [{ title: re }, { subtitle: re }, { topic: re }, { 'speakers.name': re }];
    }
    const [docs, total] = await Promise.all([
      Webinar.find(filter)
        .sort(q.when === 'upcoming' ? { featured: -1, startsAt: 1 } : { startsAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean<WebinarLean[]>(),
      Webinar.countDocuments(filter),
    ]);
    res.set('Cache-Control', 'public, max-age=30');
    ok(res, docs.map(toSummary), 200, paginationMeta(q.page, q.limit, total));
  }),
);

publicWebinarsRouter.get(
  '/webinars/:slug',
  asyncHandler(async (req, res) => {
    const slug = parse(slugSchema, param(req, 'slug'));
    const w = await findPublished(slug);
    const related = await Webinar.find({
      _id: { $ne: w._id },
      publicationStatus: 'published',
      cancelledAt: null,
      ...(w.topic
        ? { $or: [{ topic: w.topic }, { endsAt: { $gt: new Date() } }] }
        : { endsAt: { $gt: new Date() } }),
    })
      .sort({ startsAt: -1 })
      .limit(3)
      .lean<WebinarLean[]>();
    res.set('Cache-Control', 'public, max-age=30');
    ok(res, toPublic(w, related));
  }),
);

publicWebinarsRouter.get(
  '/webinars/:slug/registration',
  authenticate,
  asyncHandler(async (req, res) => {
    const w = await findPublished(parse(slugSchema, param(req, 'slug')));
    res.set('Cache-Control', 'no-store');
    ok(res, await myRegistration(w, requireUser(req).userId));
  }),
);

publicWebinarsRouter.post(
  '/webinars/:slug/registration',
  authenticate,
  asyncHandler(async (req, res) => {
    const auth = requireUser(req);
    const w = await findPublished(parse(slugSchema, param(req, 'slug')));
    await register(w, auth.userId, requestContext(req));
    ok(res, await myRegistration(await findPublished(w.slug), auth.userId), 201);
  }),
);

publicWebinarsRouter.delete(
  '/webinars/:slug/registration',
  authenticate,
  asyncHandler(async (req, res) => {
    const auth = requireUser(req);
    const w = await findPublished(parse(slugSchema, param(req, 'slug')));
    await cancelRegistration(w, auth.userId, requestContext(req));
    ok(res, await myRegistration(w, auth.userId));
  }),
);

/* ================================ Staff routes ================================ */
export const adminWebinarsRouter = Router();
adminWebinarsRouter.use(
  authenticate,
  requireAnyPermission(
    'webinars.create',
    'webinars.update',
    'webinars.publish',
    'webinars.cancel',
    'webinar_registrations.manage',
  ),
);

adminWebinarsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(adminWebinarQuerySchema, req.query);
    const filter: Record<string, unknown> = {};
    if (q.status) filter.publicationStatus = q.status;
    if (q.q) filter.title = new RegExp(escapeRegex(q.q), 'i');
    const [docs, total] = await Promise.all([
      Webinar.find(filter)
        .select(PRIVATE)
        .sort({ startsAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean<WebinarLean[]>(),
      Webinar.countDocuments(filter),
    ]);
    ok(res, docs.map(toAdmin), 200, paginationMeta(q.page, q.limit, total));
  }),
);
adminWebinarsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    ok(res, await getAdmin(parse(objectIdSchema, param(req, 'id'))));
  }),
);
adminWebinarsRouter.post(
  '/',
  requirePermission('webinars.create'),
  asyncHandler(async (req, res) => {
    ok(
      res,
      await createWebinar(requireUser(req).userId, parse(webinarSchema, req.body), requestContext(req)),
      201,
    );
  }),
);
adminWebinarsRouter.patch(
  '/:id',
  requirePermission('webinars.update'),
  asyncHandler(async (req, res) => {
    const input = parse(updateWebinarSchema, req.body) as Partial<WebinarData>;
    ok(
      res,
      await updateWebinar(
        requireUser(req).userId,
        parse(objectIdSchema, param(req, 'id')),
        input,
        requestContext(req),
      ),
    );
  }),
);
for (const [action, target] of [
  ['publish', 'published'],
  ['unpublish', 'draft'],
  ['archive', 'archived'],
] as const) {
  adminWebinarsRouter.post(
    `/:id/${action}`,
    requirePermission('webinars.publish'),
    asyncHandler(async (req, res) => {
      ok(
        res,
        await setPublication(
          requireUser(req).userId,
          parse(objectIdSchema, param(req, 'id')),
          target,
          requestContext(req),
        ),
      );
    }),
  );
}
adminWebinarsRouter.post(
  '/:id/cancel',
  requirePermission('webinars.cancel'),
  asyncHandler(async (req, res) => {
    const { reason } = parse(cancelWebinarSchema, req.body ?? {});
    ok(
      res,
      await cancelWebinar(
        requireUser(req).userId,
        parse(objectIdSchema, param(req, 'id')),
        reason,
        requestContext(req),
      ),
    );
  }),
);

adminWebinarsRouter.get(
  '/:id/registrations',
  requirePermission('webinar_registrations.manage'),
  asyncHandler(async (req, res) => {
    const id = parse(objectIdSchema, param(req, 'id'));
    const q = parse(
      paginationQuerySchema.extend({ limit: paginationQuerySchema.shape.limit.default(50) }),
      req.query,
    );
    const filter = { webinar: id };
    const [docs, total] = await Promise.all([
      WebinarRegistration.find(filter)
        .sort({ registeredAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate<{ user: { _id: Types.ObjectId; fullName: string; email: string } }>(
          'user',
          'fullName email',
        )
        .lean(),
      WebinarRegistration.countDocuments(filter),
    ]);
    const rows: WebinarRegistrationDto[] = docs.map((r) => ({
      id: String(r._id),
      user: { id: String(r.user._id), fullName: r.user.fullName, email: r.user.email },
      status: r.status as WebinarRegistrationDto['status'],
      registeredAt: r.registeredAt.toISOString(),
      cancelledAt: r.cancelledAt?.toISOString() ?? null,
      attendedAt: r.attendedAt?.toISOString() ?? null,
    }));
    ok(res, rows, 200, paginationMeta(q.page, q.limit, total));
  }),
);

adminWebinarsRouter.patch(
  '/:id/registrations/:registrationId',
  requirePermission('webinar_registrations.manage'),
  asyncHandler(async (req, res) => {
    const id = parse(objectIdSchema, param(req, 'id'));
    const regId = parse(objectIdSchema, param(req, 'registrationId'));
    const { attended } = parse(attendanceSchema, req.body);
    const r = await WebinarRegistration.findOneAndUpdate(
      { _id: regId, webinar: id, status: 'registered' },
      { $set: { attendedAt: attended ? new Date() : null } },
      { new: true },
    );
    if (!r) throw ApiError.notFound('Registration not found');
    await audit({
      actor: requireUser(req).userId,
      action: 'webinar.attendance_marked',
      targetType: 'WebinarRegistration',
      targetId: r._id,
      metadata: { attended },
      ctx: requestContext(req),
    });
    ok(res, { id: String(r._id), attendedAt: r.attendedAt?.toISOString() ?? null });
  }),
);
