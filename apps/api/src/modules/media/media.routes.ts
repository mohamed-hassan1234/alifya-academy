import { randomBytes } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { MEDIA_PURPOSE_KEYS } from '@alifya/shared';
import { storage } from '../../integrations/storage/index.js';
import { authenticate } from '../../middleware/authenticate.js';
import { parse } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { objectIdSchema } from '@alifya/shared';
import { ok } from '../../utils/respond.js';
import { param, requestContext, requireUser } from '../../utils/request.js';
import * as media from './media.service.js';

/** Absolute ceiling; each purpose enforces its own (smaller) limit after the upload is sniffed. */
const HARD_LIMIT_BYTES = 200 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, storage.tempDir()),
    filename: (_req, _file, cb) => cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}.upload`),
  }),
  limits: { fileSize: HARD_LIMIT_BYTES, files: 1, fields: 5 },
});

function singleFile(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      return next(
        ApiError.badRequest(err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : 'Invalid upload', {
          file: err.message,
        }),
      );
    }
    next(err);
  });
}

/** Authenticates when a bearer token is present; otherwise continues anonymously. */
function optionalAuth(req: Request, res: Response, next: NextFunction) {
  if (req.get('authorization')?.startsWith('Bearer ')) return authenticate(req, res, next);
  next();
}

export const mediaRouter = Router();

mediaRouter.post(
  '/',
  authenticate, // before multer: anonymous callers never write to disk
  singleFile,
  asyncHandler(async (req, res) => {
    const { purpose } = parse(
      z.object({ purpose: z.enum(MEDIA_PURPOSE_KEYS as [string, ...string[]]) }),
      req.body,
    );
    if (!req.file) throw ApiError.badRequest('Choose a file to upload', { file: 'Required' });
    ok(res, await media.storeUpload(requireUser(req), purpose as never, req.file, requestContext(req)), 201);
  }),
);

/** Issues a short-lived signed URL for a private file the caller may read. */
mediaRouter.get(
  '/:id/link',
  authenticate,
  asyncHandler(async (req, res) => {
    const id = parse(objectIdSchema, param(req, 'id'));
    const asset = await media.findActiveAsset(id);
    if (asset.visibility === 'private' && !(await media.canReadPrivate(asset, req.auth)))
      throw ApiError.forbidden();
    ok(
      res,
      asset.visibility === 'public'
        ? { url: media.toMediaDto(asset).url, expiresAt: null }
        : media.signedUrl(id),
    );
  }),
);

mediaRouter.get(
  '/:id/content',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = parse(objectIdSchema, param(req, 'id'));
    const asset = await media.findActiveAsset(id);
    if (asset.visibility === 'private') {
      const signed = media.verifySignature(id, req.query.exp, req.query.sig);
      if (!signed && !(await media.canReadPrivate(asset, req.auth))) {
        throw req.auth ? ApiError.forbidden() : ApiError.unauthenticated();
      }
      res.setHeader('Cache-Control', 'private, no-store');
    } else {
      // Assets are immutable: replacing an image creates a new asset id.
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    const inline = /^(image|video)\//.test(asset.mimeType) || asset.mimeType === 'application/pdf';
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.attachment(asset.originalName);
    if (inline)
      res.setHeader(
        'Content-Disposition',
        res.getHeader('Content-Disposition')!.toString().replace('attachment', 'inline'),
      );
    if (storage.localPath) {
      res.sendFile(storage.localPath(asset.storageKey), { acceptRanges: true, headers: {} }, (err) => {
        if (err && !res.headersSent) res.status(404).end();
      });
    } else {
      storage.read(asset.storageKey).pipe(res);
    }
  }),
);

mediaRouter.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    await media.deleteAsset(requireUser(req), parse(objectIdSchema, param(req, 'id')), requestContext(req));
    ok(res, { message: 'File removed' });
  }),
);
