import { Router } from 'express';
import { createRoleSchema, updateRoleSchema, type Permission } from '@alifya/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyPermission, requirePermission } from '../../middleware/authorize.js';
import { parse } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { ok } from '../../utils/respond.js';
import { param, requestContext, requireUser } from '../../utils/request.js';
import * as roles from './roles.service.js';

export const adminRolesRouter = Router();
adminRolesRouter.use(authenticate);

// Reading roles is needed both to assign them (roles.manage) and to edit them (permissions.manage).
adminRolesRouter.get(
  '/roles',
  requireAnyPermission('roles.manage', 'permissions.manage', 'users.read'),
  asyncHandler(async (_req, res) => {
    ok(res, await roles.listRoles());
  }),
);

adminRolesRouter.get('/permissions', requirePermission('permissions.manage'), (_req, res) => {
  ok(res, roles.listPermissions());
});

adminRolesRouter.post(
  '/roles',
  requirePermission('permissions.manage'),
  asyncHandler(async (req, res) => {
    const input = parse(createRoleSchema, req.body);
    ok(
      res,
      await roles.createRole(
        requireUser(req),
        { ...input, permissions: input.permissions as Permission[] },
        requestContext(req),
      ),
      201,
    );
  }),
);

adminRolesRouter.patch(
  '/roles/:id',
  requirePermission('permissions.manage'),
  asyncHandler(async (req, res) => {
    const input = parse(updateRoleSchema, req.body);
    ok(
      res,
      await roles.updateRole(
        requireUser(req),
        param(req, 'id'),
        { ...input, permissions: input.permissions as Permission[] | undefined },
        requestContext(req),
      ),
    );
  }),
);

adminRolesRouter.delete(
  '/roles/:id',
  requirePermission('permissions.manage'),
  asyncHandler(async (req, res) => {
    await roles.deleteRole(requireUser(req), param(req, 'id'), requestContext(req));
    ok(res, { message: 'Role deleted' });
  }),
);
