import { Router } from 'express';
import { requireAuth, AuthRequest, getEffectivePermissions } from '../../middleware/auth.ts';
import { actorIsAdmin } from '../utils/userAdmin.ts';
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


// Role management: administrators (Admin / Administrator / System Admin, read from the database)
// or users with the roles.manage permission. Non-admins may not grant '*' or edit admin roles.
const requireAdmin = async (req: AuthRequest, res: any, next: any) => {
  try {
    const isAdmin = await actorIsAdmin(req);
    const eff = await getEffectivePermissions(req.user?.uid);
    if (!isAdmin && !(eff && eff.permissions.includes('roles.manage'))) {
      return res.status(403).json({ error: 'Requires permission to manage roles' });
    }
    (req as any).isRoleAdmin = isAdmin;
    next();
  } catch (e: any) {
    res.status(500).json({ error: 'Permission check failed' });
  }
};

const ADMIN_ROLE_NAMES = ['admin', 'administrator', 'system admin'];
const isAdminRole = (role: { name?: string | null; permissions?: string[] | null }) =>
  ADMIN_ROLE_NAMES.includes(String(role.name || '').trim().toLowerCase()) ||
  (Array.isArray(role.permissions) && role.permissions.includes('*'));

function parseRoleId(req: AuthRequest, res: any): number | null {
  const raw = String(req.params.id ?? '');
  if (!/^\d+$/.test(raw)) {
    res.status(400).json({ error: 'Invalid role ID' });
    return null;
  }
  return parseInt(raw, 10);
}

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

    if (!(req as any).isRoleAdmin && isAdminRole({ name, permissions })) {
      return res.status(403).json({ error: 'Only administrators can create administrator roles.' });
    }

    const allRoles = await db.select().from(roles);
    const sameName = allRoles.find(r => r.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (sameName && !sameName.isDeleted) {
      return res.status(409).json({ error: 'A role with this name already exists.' });
    }

    let newRole;
    if (sameName && sameName.isDeleted) {
      // The name belonged to a deleted role (names are unique): bring that role back with the new permissions.
      [newRole] = await db.update(roles).set({
        name,
        permissions: permissions || [],
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        updatedAt: new Date()
      }).where(eq(roles.id, sameName.id)).returning();
    } else {
      [newRole] = await db.insert(roles).values({
        name,
        permissions: permissions || [],
        createdBy: req.user!.uid
      }).returning();
    }

    await db.insert(roleAuditLogs).values({
      roleId: newRole.id,
      action: sameName ? 'RESTORE' : 'CREATE',
      performedBy: req.user!.uid,
      details: sameName ? 'Deleted role restored with new permissions.' : 'Role created.'
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
    const id = parseRoleId(req, res);
    if (id === null) return;

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

    if (!(req as any).isRoleAdmin && (isAdminRole(existingRole) || isAdminRole({ name, permissions }))) {
      return res.status(403).json({ error: 'Only administrators can edit administrator roles or grant all permissions.' });
    }
    if (!(req as any).isRoleAdmin) {
      const eff = await getEffectivePermissions(req.user?.uid);
      if (eff && eff.role.trim().toLowerCase() === existingRole.name.trim().toLowerCase()) {
        return res.status(403).json({ error: 'You cannot edit the role you hold.' });
      }
    }

    const renamed = existingRole.name.trim().toLowerCase() !== name.trim().toLowerCase();
    if (renamed) {
      const clash = (await db.select().from(roles)).find(r => r.id !== id && r.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (clash) {
        return res.status(409).json({ error: 'A role with this name already exists.' });
      }
    }

    // Users are linked to roles by name: sign them out first (under the old name), then move them
    // to the new name so they keep the role after a rename.
    await SessionManager.invalidateSessionsByRole(existingRole.name, 'PRIVILEGE_CHANGE');
    if (existingRole.name !== name) {
      await db.update(users).set({ role: name }).where(eq(users.role, existingRole.name));
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
    
    // POLICY: Session Invalidation on Privilege Change (also covers users now holding the new name)
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
    const id = parseRoleId(req, res);
    if (id === null) return;

    const [existingRole] = await db.select().from(roles).where(eq(roles.id, id));
    if (!existingRole || existingRole.isDeleted) return res.status(404).json({ error: 'Role not found' });
    if (!(req as any).isRoleAdmin && isAdminRole(existingRole)) {
      return res.status(403).json({ error: 'Only administrators can delete administrator roles.' });
    }

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
