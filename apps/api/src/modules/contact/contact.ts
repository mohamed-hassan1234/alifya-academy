import { Router } from 'express';
import { Schema, model, type Types } from 'mongoose';
import { z } from 'zod';
import {
  contactMessageSchema,
  objectIdSchema,
  paginationQuerySchema,
  type ContactMessageDto,
} from '@alifya/shared';
import { sendEmailSafely } from '../../integrations/email/index.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyPermission } from '../../middleware/authorize.js';
import { authLimiter } from '../../middleware/security.js';
import { parse } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { ok, paginationMeta } from '../../utils/respond.js';
import { param, requestContext, requireUser } from '../../utils/request.js';
import { audit } from '../audit/audit.service.js';
import { SiteSettings } from '../settings/settings.js';

const contactMessageDb = new Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    email: { type: String, required: true, maxlength: 254 },
    phone: { type: String, default: null, maxlength: 30 },
    subject: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 5000 },
    status: { type: String, enum: ['new', 'read', 'archived'], default: 'new' },
    ip: { type: String, default: null },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
contactMessageDb.index({ status: 1, createdAt: -1 });
export const ContactMessage = model('ContactMessage', contactMessageDb);

type MsgLean = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  status: ContactMessageDto['status'];
  createdAt: Date;
};
const toDto = (m: MsgLean): ContactMessageDto => ({
  id: String(m._id),
  name: m.name,
  email: m.email,
  phone: m.phone ?? null,
  subject: m.subject,
  message: m.message,
  status: m.status,
  createdAt: m.createdAt.toISOString(),
});

export const publicContactRouter = Router();
publicContactRouter.post(
  '/contact',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(contactMessageSchema, req.body);
    // Honeypot filled → silently accept without storing (bots get no signal).
    if (input.website) return ok(res, { message: 'Thank you. Your message has been received.' }, 201);
    const { website: _w, ...data } = input;
    const msg = await ContactMessage.create({ ...data, phone: data.phone ?? null, ip: req.ip ?? null });
    const settings = await SiteSettings.findOne({ key: 'site' }).select('contact.email academyName').lean();
    if (settings?.contact?.email) {
      await sendEmailSafely({
        to: settings.contact.email,
        subject: `[Website contact] ${data.subject}`,
        text: `New message from the ${settings.academyName} website.\n\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone ?? '-'}\n\n${data.message}\n\nReference: ${String(msg._id)}`,
      });
    }
    ok(res, { message: 'Thank you. Your message has been received.' }, 201);
  }),
);

export const adminContactRouter = Router();
adminContactRouter.use(authenticate, requireAnyPermission('cms.manage', 'settings.manage'));
adminContactRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(
      paginationQuerySchema.extend({
        status: z.enum(['new', 'read', 'archived']).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }),
      req.query,
    );
    const filter = q.status ? { status: q.status } : { status: { $ne: 'archived' } };
    const [docs, total] = await Promise.all([
      ContactMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean<MsgLean[]>(),
      ContactMessage.countDocuments(filter),
    ]);
    ok(res, docs.map(toDto), 200, paginationMeta(q.page, q.limit, total));
  }),
);
adminContactRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(objectIdSchema, param(req, 'id'));
    const { status } = parse(z.object({ status: z.enum(['new', 'read', 'archived']) }), req.body);
    const auth = requireUser(req);
    const msg = await ContactMessage.findByIdAndUpdate(
      id,
      { $set: { status, handledBy: auth.userId } },
      { new: true },
    ).lean<MsgLean>();
    if (!msg) throw ApiError.notFound('Message not found');
    await audit({
      actor: auth.userId,
      action: 'contact.status_changed',
      targetType: 'ContactMessage',
      targetId: id,
      metadata: { status },
      ctx: requestContext(req),
    });
    ok(res, toDto(msg));
  }),
);
