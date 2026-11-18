import { Router } from 'express';
import { z } from 'zod';
import {
  PUBLICATION_STATUSES,
  categorySchema,
  courseListQuerySchema,
  createCourseSchema,
  paginationQuerySchema,
  slugSchema,
  updateCourseSchema,
} from '@alifya/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyPermission, requirePermission } from '../../middleware/authorize.js';
import { parse } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { ok, paginationMeta } from '../../utils/respond.js';
import { param, requestContext, requireUser } from '../../utils/request.js';
import * as courses from './courses.service.js';

/* -------- Public catalogue: /courses, /categories -------- */
export const publicCoursesRouter = Router();

publicCoursesRouter.get(
  '/courses',
  asyncHandler(async (req, res) => {
    const q = parse(courseListQuerySchema, req.query);
    const { rows, total } = await courses.listPublicCourses(q);
    res.set('Cache-Control', 'public, max-age=30');
    ok(res, rows, 200, paginationMeta(q.page, q.limit, total));
  }),
);

publicCoursesRouter.get(
  '/courses/:slug',
  asyncHandler(async (req, res) => {
    const slug = parse(slugSchema, param(req, 'slug'));
    res.set('Cache-Control', 'public, max-age=30');
    ok(res, await courses.getPublicCourse(slug));
  }),
);

publicCoursesRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    ok(res, await courses.listPublicCategories());
  }),
);

/* -------- Administration: /admin/courses, /admin/categories -------- */
export const adminCoursesRouter = Router();
adminCoursesRouter.use(authenticate);

const adminListQuery = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(PUBLICATION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

adminCoursesRouter.get(
  '/courses',
  requirePermission('courses.read'),
  asyncHandler(async (req, res) => {
    const q = parse(adminListQuery, req.query);
    const { rows, total } = await courses.listAdminCourses(q);
    ok(res, rows, 200, paginationMeta(q.page, q.limit, total));
  }),
);

adminCoursesRouter.get(
  '/courses/:id',
  requirePermission('courses.read'),
  asyncHandler(async (req, res) => {
    ok(res, await courses.getAdminCourse(param(req, 'id')));
  }),
);

adminCoursesRouter.post(
  '/courses',
  requirePermission('courses.create'),
  asyncHandler(async (req, res) => {
    const input = parse(createCourseSchema, req.body);
    ok(res, await courses.createCourse(requireUser(req).userId, input, requestContext(req)), 201);
  }),
);

adminCoursesRouter.patch(
  '/courses/:id',
  requirePermission('courses.update'),
  asyncHandler(async (req, res) => {
    const input = parse(updateCourseSchema, req.body) as Parameters<typeof courses.updateCourse>[2];
    ok(
      res,
      await courses.updateCourse(requireUser(req).userId, param(req, 'id'), input, requestContext(req)),
    );
  }),
);

const transition = (target: 'published' | 'draft' | 'archived') =>
  asyncHandler(async (req, res) => {
    ok(
      res,
      await courses.setPublication(requireUser(req).userId, param(req, 'id'), target, requestContext(req)),
    );
  });

adminCoursesRouter.post(
  '/courses/:id/publish',
  requirePermission('courses.publish'),
  transition('published'),
);
adminCoursesRouter.post('/courses/:id/unpublish', requirePermission('courses.publish'), transition('draft'));
adminCoursesRouter.post('/courses/:id/archive', requirePermission('courses.archive'), transition('archived'));

adminCoursesRouter.get(
  '/categories',
  requirePermission('courses.read'),
  asyncHandler(async (_req, res) => {
    ok(res, await courses.listAllCategories());
  }),
);

adminCoursesRouter.post(
  '/categories',
  requireAnyPermission('categories.manage', 'courses.update'),
  asyncHandler(async (req, res) => {
    const input = parse(categorySchema, req.body);
    ok(res, await courses.createCategory(requireUser(req).userId, input, requestContext(req)), 201);
  }),
);

adminCoursesRouter.patch(
  '/categories/:id',
  requireAnyPermission('categories.manage', 'courses.update'),
  asyncHandler(async (req, res) => {
    const input = parse(categorySchema.partial(), req.body);
    ok(
      res,
      await courses.updateCategory(requireUser(req).userId, param(req, 'id'), input, requestContext(req)),
    );
  }),
);
