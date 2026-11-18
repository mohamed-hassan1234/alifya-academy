import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { isDatabaseReady } from './database/connection.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { CSRF_HEADER, apiLimiter } from './middleware/security.js';
import { adminAuditRouter } from './modules/audit/audit.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { adminCoursesRouter, publicCoursesRouter } from './modules/courses/courses.routes.js';
import { adminRolesRouter } from './modules/roles/roles.routes.js';
import { adminSettingsRouter, publicSettingsRouter } from './modules/settings/settings.js';
import { adminUsersRouter, meRouter } from './modules/users/users.routes.js';
import { mediaRouter } from './modules/media/media.routes.js';
import { adminProgramsRouter, publicProgramsRouter } from './modules/programs/programs.js';
import {
  adminLearningPathsRouter,
  publicLearningPathsRouter,
} from './modules/learning-paths/learning-paths.js';
import { adminWebinarsRouter, publicWebinarsRouter } from './modules/webinars/webinars.js';
import { adminApplicationsRouter, studentAdmissionsRouter } from './modules/admissions/admissions.js';
import {
  adminInstructorsRouter,
  instructorProfileRouter,
  publicInstructorsRouter,
} from './modules/instructors/instructors.js';
import {
  curriculumRouter,
  instructorCoursesRouter,
  publicCurriculumRouter,
} from './modules/curriculum/curriculum.routes.js';
import { adminContactRouter, publicContactRouter } from './modules/contact/contact.js';
import { ok } from './utils/respond.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.webOrigins.includes(origin)),
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', CSRF_HEADER],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  const v1 = Router();
  v1.get('/health', (_req, res) => ok(res, { status: 'ok', uptime: Math.round(process.uptime()) }));
  v1.get('/health/ready', (_req, res) => {
    const ready = isDatabaseReady();
    res.status(ready ? 200 : 503).json({ success: ready, data: { database: ready ? 'up' : 'down' } });
  });

  v1.use(apiLimiter);
  v1.use('/auth', authRouter);
  v1.use('/users/me', meRouter);
  v1.use('/settings', publicSettingsRouter);
  v1.use('/', publicCoursesRouter);
  v1.use('/admin/users', adminUsersRouter);
  v1.use('/admin', adminRolesRouter);
  v1.use('/admin', adminCoursesRouter);
  v1.use('/admin/audit-logs', adminAuditRouter);
  v1.use('/admin/settings', adminSettingsRouter);
  v1.use('/media', mediaRouter);
  v1.use('/', publicProgramsRouter);
  v1.use('/', publicInstructorsRouter);
  v1.use('/', publicCurriculumRouter);
  v1.use('/', publicContactRouter);
  v1.use('/admin/programs', adminProgramsRouter);
  v1.use('/', publicLearningPathsRouter);
  v1.use('/admin/learning-paths', adminLearningPathsRouter);
  v1.use('/', publicWebinarsRouter);
  v1.use('/admin/webinars', adminWebinarsRouter);
  v1.use('/', studentAdmissionsRouter);
  v1.use('/admin/applications', adminApplicationsRouter);
  v1.use('/admin/instructors', adminInstructorsRouter);
  v1.use('/admin/contact-messages', adminContactRouter);
  v1.use('/curriculum', curriculumRouter);
  v1.use('/instructor/profile', instructorProfileRouter);
  v1.use('/instructor/courses', instructorCoursesRouter);

  app.use('/api/v1', v1);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
