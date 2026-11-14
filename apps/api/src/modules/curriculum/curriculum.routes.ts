import { Router } from 'express';
import type { z } from 'zod';
import {
  lessonSchema,
  objectIdSchema,
  reorderSchema,
  sectionSchema,
  slugSchema,
  updateLessonSchema,
  updateSectionSchema,
} from '@alifya/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { parse } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { ok } from '../../utils/respond.js';
import { param, requestContext, requireUser } from '../../utils/request.js';
import * as cur from './curriculum.service.js';

const id = (req: Parameters<typeof param>[0], name: string) => parse(objectIdSchema, param(req, name));

/**
 * Curriculum management (admins + assigned instructors). Authorization is resource-level inside the
 * service (see `curriculumAccess`), so a single router serves both portals.
 */
export const curriculumRouter = Router();
curriculumRouter.use(authenticate);

curriculumRouter.get(
  '/courses/:courseId',
  asyncHandler(async (req, res) => {
    ok(res, await cur.getManagedCurriculum(requireUser(req), id(req, 'courseId')));
  }),
);
curriculumRouter.post(
  '/courses/:courseId/sections',
  asyncHandler(async (req, res) => {
    ok(
      res,
      await cur.createSection(
        requireUser(req),
        id(req, 'courseId'),
        parse(sectionSchema, req.body),
        requestContext(req),
      ),
      201,
    );
  }),
);
curriculumRouter.post(
  '/courses/:courseId/sections/reorder',
  asyncHandler(async (req, res) => {
    ok(
      res,
      await cur.reorderSections(
        requireUser(req),
        id(req, 'courseId'),
        parse(reorderSchema, req.body).ids,
        requestContext(req),
      ),
    );
  }),
);
curriculumRouter.patch(
  '/sections/:id',
  asyncHandler(async (req, res) => {
    ok(
      res,
      await cur.updateSection(
        requireUser(req),
        id(req, 'id'),
        parse(updateSectionSchema, req.body),
        requestContext(req),
      ),
    );
  }),
);
curriculumRouter.delete(
  '/sections/:id',
  asyncHandler(async (req, res) => {
    ok(res, await cur.deleteSection(requireUser(req), id(req, 'id'), requestContext(req)));
  }),
);
curriculumRouter.post(
  '/sections/:id/lessons/reorder',
  asyncHandler(async (req, res) => {
    ok(
      res,
      await cur.reorderLessons(
        requireUser(req),
        id(req, 'id'),
        parse(reorderSchema, req.body).ids,
        requestContext(req),
      ),
    );
  }),
);
curriculumRouter.post(
  '/courses/:courseId/lessons',
  asyncHandler(async (req, res) => {
    ok(
      res,
      await cur.createLesson(
        requireUser(req),
        id(req, 'courseId'),
        parse(lessonSchema, req.body),
        requestContext(req),
      ),
      201,
    );
  }),
);
curriculumRouter.patch(
  '/lessons/:id',
  asyncHandler(async (req, res) => {
    const input = parse(updateLessonSchema, req.body) as Partial<z.output<typeof lessonSchema>>;
    ok(res, await cur.updateLesson(requireUser(req), id(req, 'id'), input, requestContext(req)));
  }),
);
curriculumRouter.post(
  '/lessons/:id/publish',
  asyncHandler(async (req, res) => {
    ok(res, await cur.setLessonPublication(requireUser(req), id(req, 'id'), true, requestContext(req)));
  }),
);
curriculumRouter.post(
  '/lessons/:id/unpublish',
  asyncHandler(async (req, res) => {
    ok(res, await cur.setLessonPublication(requireUser(req), id(req, 'id'), false, requestContext(req)));
  }),
);
curriculumRouter.delete(
  '/lessons/:id',
  asyncHandler(async (req, res) => {
    await cur.deleteLesson(requireUser(req), id(req, 'id'), requestContext(req));
    ok(res, { message: 'Lesson deleted' });
  }),
);

/** Instructor portal: /instructor/courses (only courses the caller is assigned to). */
export const instructorCoursesRouter = Router();
instructorCoursesRouter.use(authenticate, (req, _res, next) => {
  next(
    req.auth?.roles.some((r) => r.key === 'instructor')
      ? undefined
      : ApiError.forbidden('Instructor access only'),
  );
});
instructorCoursesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    ok(res, await cur.listInstructorCourses(requireUser(req)));
  }),
);

/** Public: outline + explicitly marked preview lessons. */
export const publicCurriculumRouter = Router();
publicCurriculumRouter.get(
  '/courses/:slug/curriculum',
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'public, max-age=30');
    ok(res, await cur.getOutline(parse(slugSchema, param(req, 'slug'))));
  }),
);
publicCurriculumRouter.get(
  '/courses/:slug/lessons/:lessonId/preview',
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'private, no-store'); // contains a short-lived signed media link
    ok(res, await cur.getPreview(parse(slugSchema, param(req, 'slug')), param(req, 'lessonId')));
  }),
);
