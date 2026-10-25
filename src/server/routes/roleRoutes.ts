import { Router } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { roles, users, roleAuditLogs } from '../../db/schema.ts';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.ts';
import { SessionManager } from '../services/sessionManager.ts';

const router = Router();

import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';

const roleSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(20, 'Name maximum length is 20 characters')
    .regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, 'Only English, Arabic letters, and spaces are allowed'),
  permissions: z.array(z.string()).optional().default([])
});

// CSRF Protection Middleware
const requireCsrfToken = (req: any, res: any, next: any) => {
  const csrfHeader = req.headers['x-app-action'];
  if (!csrfHeader || csrfHeader !== 'strict-client-action') {
    return res.status(403).json({ error: 'CSRF token validation failed.' });
  }
  next();
};


// Middleware to check if user is admin
const requireAdmin = async (req: AuthRequest, res: any, next: any) => {
  if (req.user?.role !== 'Admin' && req.user?.email !== 'admin@system.local') {
    return res.status(403).json({ error: 'Requires Admin role' });
  }
  next();
};

// GET /api/roles
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const allRoles = await db.select().from(roles);
    const allUsers = await db.select({ 
      id: users.id, 
      uid: users.uid, 
      fullName: users.fullName, 
      email: users.email, 
      role: users.role, 
      avatarColor: users.avatarColor 
    }).from(users);
    
    const allLogs = await db.select().from(roleAuditLogs);
    
    const enrichedRoles = allRoles.map(role => {
      const assignedUsers = allUsers.filter(u => u.role === role.name);
      
      const creator = allUsers.find(u => u.uid === role.createdBy);
      const deleter = allUsers.find(u => u.uid === role.deletedBy);
      
      const roleLogs = allLogs.filter(l => l.roleId === role.id).map(log => {
        const perf = allUsers.find(u => u.uid === log.performedBy);
        return {
          ...log,
          performedBy: perf ? { fullName: perf.fullName, email: perf.email } : null
        };
      }).sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

      return {
        ...role,
        assignedUsers: assignedUsers.map(u => ({ id: u.id, fullName: u.fullName, email: u.email, avatarColor: u.avatarColor })),
        createdBy: creator ? { fullName: creator.fullName, email: creator.email } : null,
        deletedBy: deleter ? { fullName: deleter.fullName, email: deleter.email } : null,
        auditLogs: roleLogs
      };
    });
    
    res.json({ success: true, data: enrichedRoles });
  } catch (error: any) { console.error('Error in route:', error); res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// POST /api/roles
router.post('/', requireAuth, requireAdmin, requireCsrfToken, async (req: AuthRequest, res) => {
  try {
    // 1. Sanitize HTML
    const rawName = req.body.name || '';
    const sanitizedName = sanitizeHtml(rawName, { allowedTags: [], allowedAttributes: {} });
    
    // 2. Validate using Zod
    const validation = roleSchema.safeParse({ name: sanitizedName, permissions: req.body.permissions });
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues[0]?.message || 'Validation failed' });
    }
    
    const { name, permissions } = validation.data;
    
    const [newRole] = await db.insert(roles).values({
      name,
      permissions: permissions || [],
      createdBy: req.user!.uid
    }).returning();
    
    await db.insert(roleAuditLogs).values({
      roleId: newRole.id,
      action: 'CREATE',
      performedBy: req.user!.uid,
      details: 'Role created.'
    });
    
    logger.information('Role created: {RoleName} by {AdminUser}', {
      RoleName: newRole.name,
      AdminUser: req.user?.name || req.user?.email || 'System',
      Action: 'CreateRole'
    });
    res.status(201).json({ success: true, data: newRole });
  } catch (error: any) { console.error('Error in route:', error); res.status(500).json({ error: 'Failed to create role' });
  }
});

// PUT /api/roles/:id
router.put('/:id', requireAuth, requireAdmin, requireCsrfToken, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    
    // 1. Sanitize HTML
    const rawName = req.body.name || '';
    const sanitizedName = sanitizeHtml(rawName, { allowedTags: [], allowedAttributes: {} });
    
    // 2. Validate using Zod
    const validation = roleSchema.safeParse({ name: sanitizedName, permissions: req.body.permissions });
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues[0]?.message || 'Validation failed' });
    }
    
    const { name, permissions } = validation.data;
    
    const [existingRole] = await db.select().from(roles).where(eq(roles.id, id));
    if (!existingRole) return res.status(404).json({ error: 'Role not found' });
    
    if (existingRole.isDeleted) {
       return res.status(400).json({ error: 'Cannot edit a deleted role' });
    }
    
    const [updatedRole] = await db.update(roles).set({
      name,
      permissions: permissions || [],
      updatedAt: new Date()
    }).where(eq(roles.id, id)).returning();
    
    await db.insert(roleAuditLogs).values({
      roleId: id,
      action: 'EDIT',
      performedBy: req.user!.uid,
      details: 'Role edited.'
    });
    
    // POLICY: Session Invalidation on Privilege Change
    // Invalidate active sessions for all users assigned to this role
    await SessionManager.invalidateSessionsByRole(updatedRole.name, 'PRIVILEGE_CHANGE');

    logger.information('Role edited: {RoleName} by {AdminUser}', {
      RoleName: updatedRole.name,
      AdminUser: req.user?.name || req.user?.email || 'System',
      Action: 'EditRole'
    });
    res.json({ success: true, data: updatedRole });
  } catch (error: any) { console.error('Error in route:', error); res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/roles/:id
router.delete('/:id', requireAuth, requireAdmin, requireCsrfToken, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    
    const [existingRole] = await db.select().from(roles).where(eq(roles.id, id));
    if (!existingRole) return res.status(404).json({ error: 'Role not found' });
    
    // Check if users are assigned
    const assignedUsers = await db.select().from(users).where(eq(users.role, existingRole.name));
    if (assignedUsers.length > 0) {
       return res.status(400).json({ error: 'Cannot delete role while it is assigned to users.' });
    }
    
    const [updatedRole] = await db.update(roles).set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: req.user!.uid
    }).where(eq(roles.id, id)).returning();
    
    await db.insert(roleAuditLogs).values({
      roleId: id,
      action: 'DELETE',
      performedBy: req.user!.uid,
      details: 'Role soft-deleted.'
    });
    
    logger.information('Role deleted: {RoleName} by {AdminUser}', {
      RoleName: updatedRole.name,
      AdminUser: req.user?.name || req.user?.email || 'System',
      Action: 'DeleteRole'
    });
    res.json({ success: true });
  } catch (error: any) { console.error('Error in route:', error); res.status(500).json({ error: 'Failed to delete role' });
  }
});

export default router;
