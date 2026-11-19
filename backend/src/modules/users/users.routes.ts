import { Router } from 'express';
import {
  assignRolesSchema,
  changePasswordSchema,
  updateProfileSchema,
  updateUserStatusSchema,
  userListQuerySchema,
} from '@alifya/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { parse } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { ok, paginationMeta } from '../../utils/respond.js';
import { param, requestContext, requireUser } from '../../utils/request.js';
import { changePassword, loadCurrentUser } from '../auth/auth.service.js';
import * as users from './users.service.js';

/** Self-service account endpoints: /users/me */
export const meRouter = Router();
meRouter.use(authenticate);

meRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    ok(res, await loadCurrentUser(requireUser(req).userId));
  }),
);

meRouter.patch(
  '/',
  asyncHandler(async (req, res) => {
    const auth = requireUser(req);
    await users.updateProfile(auth.userId, parse(updateProfileSchema, req.body), requestContext(req));
    ok(res, await loadCurrentUser(auth.userId));
  }),
);

meRouter.patch(
  '/password',
  asyncHandler(async (req, res) => {
    const auth = requireUser(req);
    const input = parse(changePasswordSchema, req.body);
    await changePassword(
      auth.userId,
      auth.sessionFamily,
      input.currentPassword,
      input.newPassword,
      requestContext(req),
    );
    ok(res, { message: 'Password changed. Other sessions have been signed out.' });
  }),
);

/** Staff administration: /admin/users */
export const adminUsersRouter = Router();
adminUsersRouter.use(authenticate);

adminUsersRouter.get(
  '/',
  requirePermission('users.read'),
  asyncHandler(async (req, res) => {
    const q = parse(userListQuerySchema, req.query);
    const { rows, total } = await users.listUsers(q);
    ok(res, rows, 200, paginationMeta(q.page, q.limit, total));
  }),
);

adminUsersRouter.get(
  '/:id',
  requirePermission('users.read'),
  asyncHandler(async (req, res) => {
    ok(res, await users.getUser(param(req, 'id')));
  }),
);

adminUsersRouter.patch(
  '/:id/status',
  requirePermission('users.suspend'),
  asyncHandler(async (req, res) => {
    const input = parse(updateUserStatusSchema, req.body);
    ok(
      res,
      await users.setUserStatus(
        requireUser(req),
        param(req, 'id'),
        input.status,
        input.reason,
        requestContext(req),
      ),
    );
  }),
);

adminUsersRouter.put(
  '/:id/roles',
  requirePermission('roles.manage'),
  asyncHandler(async (req, res) => {
    const { roleIds } = parse(assignRolesSchema, req.body);
    ok(res, await users.assignRoles(requireUser(req), param(req, 'id'), roleIds, requestContext(req)));
  }),
);
