// src/server/controllers/roleController.ts
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { RoleModel } from '../models/roleModel.ts';
import { SessionManager } from '../services/sessionManager.ts';
import { logger } from '../utils/logger.ts';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';

const roleSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(30, 'Name maximum length is 30 characters')
    .regex(/^[؀-ۿa-zA-Z0-9\s_\-]+$/, 'Only letters, numbers, spaces, and hyphens are allowed'),
  permissions: z.array(z.string()).optional().default([])
});

export class RoleController {
  /**
   * GET /api/roles
   * Retrieve all roles with assigned users and audit history
   */
  static async getRoles(req: AuthRequest, res: Response) {
    try {
      const enrichedRoles = await RoleModel.getAllRoles();
      
      logger.information('Roles list retrieved by {UserEmail}, count: {Count}', {
        UserEmail: req.user?.email || 'Unknown',
        Count: enrichedRoles.length,
        Action: 'GetRoles'
      });

      res.status(200).json({ success: true, data: enrichedRoles });
    } catch (error: any) {
      logger.error('Failed to fetch roles: {Error}', {
        Error: error.message,
        Stack: error.stack,
        UserEmail: req.user?.email || 'Unknown'
      });
      res.status(500).json({ error: 'Failed to fetch roles' });
    }
  }

  /**
   * POST /api/roles
   * Create a new role with nested permissions and Serilog logging
   */
  static async createRole(req: AuthRequest, res: Response) {
    try {
      const rawName = req.body.name || '';
      const sanitizedName = sanitizeHtml(rawName, { allowedTags: [], allowedAttributes: {} });

      const validation = roleSchema.safeParse({
        name: sanitizedName,
        permissions: req.body.permissions
      });

      if (!validation.success) {
        logger.warning('Failed role creation validation: {ValidationError} by {UserEmail}', {
          ValidationError: validation.error.issues[0]?.message,
          UserEmail: req.user?.email || 'Unknown',
          Action: 'RoleValidationFailed'
        });
        return res.status(400).json({ error: validation.error.issues[0]?.message || 'Validation failed' });
      }

      const { name, permissions } = validation.data;

      const existing = await RoleModel.getRoleByName(name);
      if (existing && !existing.isDeleted) {
        return res.status(409).json({ error: 'A role with this name already exists.' });
      }

      const newRole = await RoleModel.createRole({
        name,
        permissions: permissions || [],
        createdBy: req.user?.uid || 'usr_admin'
      });

      logger.information('Role created successfully: {RoleName} with {PermissionCount} permissions by {AdminUser}', {
        RoleName: newRole.name,
        RoleId: newRole.id,
        PermissionCount: permissions.length,
        Permissions: permissions,
        AdminUser: req.user?.fullName || req.user?.email || 'Admin',
        Action: 'CreateRole'
      });

      res.status(201).json({ success: true, data: newRole });
    } catch (error: any) {
      logger.error('Failed to create role: {Error}', {
        Error: error.message,
        Stack: error.stack,
        UserEmail: req.user?.email || 'Unknown'
      });
      res.status(500).json({ error: 'Failed to create role' });
    }
  }

  /**
   * PUT /api/roles/:id
   * Update a role and invalidate active sessions for assigned users
   */
  static async updateRole(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid role ID' });
      }

      const rawName = req.body.name || '';
      const sanitizedName = sanitizeHtml(rawName, { allowedTags: [], allowedAttributes: {} });

      const validation = roleSchema.safeParse({
        name: sanitizedName,
        permissions: req.body.permissions
      });

      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues[0]?.message || 'Validation failed' });
      }

      const { name, permissions } = validation.data;

      const existingRole = await RoleModel.getRoleById(id);
      if (!existingRole) {
        return res.status(404).json({ error: 'Role not found' });
      }

      if (existingRole.isDeleted) {
        return res.status(400).json({ error: 'Cannot edit a deleted role' });
      }

      const updatedRole = await RoleModel.updateRole(id, {
        name,
        permissions: permissions || [],
        updatedBy: req.user?.uid || 'usr_admin'
      });

      // Session Invalidation on Privilege Change
      await SessionManager.invalidateSessionsByRole(updatedRole.name, 'PRIVILEGE_CHANGE');

      logger.information('Role updated: {RoleName} (ID: {RoleId}) by {AdminUser} with {PermissionCount} permissions', {
        RoleName: updatedRole.name,
        RoleId: updatedRole.id,
        PermissionCount: permissions.length,
        Permissions: permissions,
        AdminUser: req.user?.fullName || req.user?.email || 'Admin',
        Action: 'EditRole'
      });

      res.status(200).json({ success: true, data: updatedRole });
    } catch (error: any) {
      logger.error('Failed to update role: {Error}', {
        Error: error.message,
        Stack: error.stack,
        UserEmail: req.user?.email || 'Unknown'
      });
      res.status(500).json({ error: 'Failed to update role' });
    }
  }

  /**
   * DELETE /api/roles/:id
   * Soft-delete a role if no active users are assigned
   */
  static async deleteRole(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid role ID' });
      }

      const existingRole = await RoleModel.getRoleById(id);
      if (!existingRole) {
        return res.status(404).json({ error: 'Role not found' });
      }

      const assignedCount = await RoleModel.getAssignedUsersCount(existingRole.name);
      if (assignedCount > 0) {
        logger.warning('Attempted to delete role {RoleName} which has {AssignedCount} active users assigned', {
          RoleName: existingRole.name,
          AssignedCount: assignedCount,
          UserEmail: req.user?.email || 'Unknown',
          Action: 'DeleteRoleBlocked'
        });
        return res.status(400).json({ error: 'Cannot delete role while it is assigned to users.' });
      }

      const updatedRole = await RoleModel.deleteRole(id, req.user?.uid || 'usr_admin');

      logger.information('Role soft-deleted: {RoleName} (ID: {RoleId}) by {AdminUser}', {
        RoleName: updatedRole.name,
        RoleId: updatedRole.id,
        AdminUser: req.user?.fullName || req.user?.email || 'Admin',
        Action: 'DeleteRole'
      });

      res.status(200).json({ success: true });
    } catch (error: any) {
      logger.error('Failed to delete role: {Error}', {
        Error: error.message,
        Stack: error.stack,
        UserEmail: req.user?.email || 'Unknown'
      });
      res.status(500).json({ error: 'Failed to delete role' });
    }
  }
}
