import { Router } from 'express';
import { requireAuth, AuthRequest, getEffectivePermissions } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { departments, users } from '../../db/schema.ts';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.ts';

const router = Router();

// Who may change the structure (mirrors the UI's canManageOrg): admins (Admin / Administrator /
// System Admin roles or '*') and roles with an Organization Structure or org.manage permission.
// Roles are read from the database, not the login token, so changes apply immediately.
const requireAdmin = async (req: AuthRequest, res: any, next: any) => {
  try {
    const eff = await getEffectivePermissions(req.user?.uid);
    const role = (eff?.role || '').toLowerCase();
    const allowed = !!eff && (
      eff.permissions.includes('*') ||
      ['admin', 'administrator', 'system admin'].includes(role) ||
      eff.permissions.some(p => p.startsWith('Organization Structure.') || p === 'org.manage')
    );
    if (!allowed) {
      return res.status(403).json({ error: 'Requires permission to manage the organizational structure' });
    }
    next();
  } catch (e: any) {
    res.status(500).json({ error: 'Permission check failed' });
  }
};

/** Parse a numeric :id; responds 400 and returns null when invalid. */
function parseUnitId(req: AuthRequest, res: any): number | null {
  const raw = String(req.params.id ?? '');
  if (!/^\d+$/.test(raw)) {
    res.status(400).json({ error: 'Invalid organizational unit ID' });
    return null;
  }
  return parseInt(raw, 10);
}

/** Normalize a parentId from the request: undefined = not provided, null = top level. */
function normalizeParentId(parentId: any): number | null | undefined | 'invalid' {
  if (parentId === undefined) return undefined;
  if (parentId === null || parentId === '' || parentId === 0 || parentId === '0') return null;
  const n = Number(parentId);
  return Number.isInteger(n) && n > 0 ? n : 'invalid';
}

/**
 * Validates parent, manager and sibling-name rules. Returns an error message or null.
 * - the parent must exist, must not be the unit itself, and must not be one of its descendants
 *   (that would create a loop and the unit would vanish from the tree);
 * - the manager must be an existing user;
 * - two units under the same parent may not share an English name.
 */
async function validateUnit(opts: { id?: number; name: string; parentId: number | null; managerId?: string | null }): Promise<{ status: number; error: string } | null> {
  const all = await db.select().from(departments);
  if (opts.parentId !== null) {
    if (opts.id !== undefined && opts.parentId === opts.id) {
      return { status: 400, error: 'An organizational unit cannot be its own parent.' };
    }
    if (!all.some(d => d.id === opts.parentId)) {
      return { status: 400, error: 'The selected parent unit does not exist.' };
    }
    if (opts.id !== undefined) {
      // Walk up from the new parent; reaching this unit means the parent is its descendant.
      const parentOf = new Map<number, number | null>(all.map((d: any) => [d.id as number, (d.parentId ?? null) as number | null]));
      let cursor: number | null | undefined = opts.parentId;
      const seen = new Set<number>();
      while (cursor !== null && cursor !== undefined && !seen.has(cursor)) {
        if (cursor === opts.id) {
          return { status: 400, error: 'A unit cannot be moved under one of its own sub-units.' };
        }
        seen.add(cursor);
        cursor = parentOf.get(cursor) ?? null;
      }
    }
  }
  if (opts.managerId) {
    const [manager] = await db.select({ uid: users.uid }).from(users).where(eq(users.uid, String(opts.managerId)));
    if (!manager) {
      return { status: 400, error: 'The selected manager does not exist.' };
    }
  }
  const nameNorm = opts.name.trim().toLowerCase();
  const clash = all.find(d =>
    d.id !== opts.id &&
    (d.parentId ?? null) === opts.parentId &&
    (d.name || '').trim().toLowerCase() === nameNorm);
  if (clash) {
    return { status: 409, error: 'A unit with this name already exists at this level.' };
  }
  return null;
}

// GET /api/departments - Get all organizational units
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const allOrgs = await db.select().from(departments);
    const allUsers = await db.select({
      uid: users.uid,
      fullName: users.fullName,
      email: users.email,
      avatarColor: users.avatarColor
    }).from(users);

    const defaultArabicMap: Record<string, string> = {
      'Information Technology': 'تكنولوجيا المعلومات',
      'Electronic Archiving & Records': 'الأرشفة الإلكترونية والسجلات',
      'Customer Support & Helpdesk': 'دعم العملاء ومكتب المساعدة',
      'Human Resources': 'الموارد البشرية',
      'Operations': 'العمليات والتنفيذ',
      'IT Service Desk': 'مكتب خدمة تكنولوجيا المعلومات',
      'Software Development': 'تطوير البرمجيات',
      'Cybersecurity': 'الأمن السيبراني',
      'Cloud Infrastructure': 'البنية التحتية السحابية'
    };

    const enrichedOrgs = allOrgs.map(org => {
      const manager = allUsers.find(u => u.uid === org.managerId);
      
      let parsedDesc = { nameAr: '', orgType: 'department', description: '' };
      try {
        if (org.description && org.description.startsWith('{')) {
          parsedDesc = JSON.parse(org.description);
        }
      } catch (e) {}

      const resolvedNameAr = parsedDesc.nameAr || defaultArabicMap[org.name] || org.name;

      return {
        ...org,
        nameEn: org.name,
        nameAr: resolvedNameAr,
        orgType: parsedDesc.orgType || 'department',
        description: parsedDesc.description || '',
        manager: manager ? { fullName: manager.fullName, email: manager.email, avatarColor: manager.avatarColor } : null
      };
    });

    res.json({ success: true, data: enrichedOrgs });
  } catch (error: any) {
    logger.error('Failed to fetch departments: {ErrorMessage}', { ErrorMessage: error.message });
    res.status(500).json({ error: 'Failed to fetch organizational structure' });
  }
});

// POST /api/departments - Create new organizational unit
router.post('/', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { nameEn, nameAr, orgType, description, parentId, managerId } = req.body;
    
    if (!nameEn || !nameEn.trim()) {
      return res.status(400).json({ error: 'English Name is required' });
    }
    if (!nameAr || !nameAr.trim()) {
      return res.status(400).json({ error: 'Arabic Name is required' });
    }

    const payloadDesc = JSON.stringify({
      nameAr: nameAr.trim(),
      orgType: orgType || 'department',
      description: description || ''
    });

    const normalizedParent = normalizeParentId(parentId);
    if (normalizedParent === 'invalid') {
      return res.status(400).json({ error: 'Invalid parent unit ID' });
    }
    const parsedParentId = normalizedParent ?? null;
    const problem = await validateUnit({ name: nameEn, parentId: parsedParentId, managerId: managerId || null });
    if (problem) {
      return res.status(problem.status).json({ error: problem.error });
    }

    const [newOrg] = await db.insert(departments).values({
      name: nameEn.trim(),
      description: payloadDesc,
      parentId: parsedParentId,
      managerId: managerId || null
    }).returning();

    logger.information('Organizational unit created: {OrgName} by {AdminUser}', {
      OrgName: newOrg.name,
      AdminUser: req.user?.email || 'System',
      Action: 'CreateOrgUnit'
    });

    res.status(201).json({ 
      success: true, 
      data: {
        ...newOrg,
        nameEn: newOrg.name,
        nameAr: nameAr.trim(),
        orgType: orgType || 'department'
      } 
    });
  } catch (error: any) {
    logger.error('Failed to create department: {ErrorMessage}', { ErrorMessage: error.message });
    res.status(500).json({ error: 'Failed to create organizational unit' });
  }
});

// PUT /api/departments/:id - Update an organizational unit
router.put('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseUnitId(req, res);
    if (id === null) return;
    const { nameEn, nameAr, orgType, description, parentId, managerId } = req.body;

    if (!nameEn || !nameEn.trim()) {
      return res.status(400).json({ error: 'English Name is required' });
    }
    if (!nameAr || !nameAr.trim()) {
      return res.status(400).json({ error: 'Arabic Name is required' });
    }
    
    const normalizedParent = normalizeParentId(parentId);
    if (normalizedParent === 'invalid') {
      return res.status(400).json({ error: 'Invalid parent unit ID' });
    }
    const [current] = await db.select().from(departments).where(eq(departments.id, id));
    if (!current) {
      return res.status(404).json({ error: 'Organizational unit not found' });
    }
    const effectiveParent = normalizedParent === undefined ? (current.parentId ?? null) : normalizedParent;
    const problem = await validateUnit({
      id,
      name: nameEn,
      parentId: effectiveParent,
      managerId: managerId === undefined ? null : (managerId || null),
    });
    if (problem) {
      return res.status(problem.status).json({ error: problem.error });
    }

    const payloadDesc = JSON.stringify({
      nameAr: nameAr.trim(),
      orgType: orgType || 'department',
      description: description || ''
    });

    const updateValues: any = {
      name: nameEn.trim(),
      description: payloadDesc,
      updatedAt: new Date()
    };

    if (managerId !== undefined) {
      updateValues.managerId = managerId || null;
    }

    if (normalizedParent !== undefined) {
      updateValues.parentId = normalizedParent;
    }

    const [updatedOrg] = await db.update(departments).set(updateValues).where(eq(departments.id, id)).returning();

    if (!updatedOrg) {
      return res.status(404).json({ error: 'Organizational unit not found' });
    }

    logger.information('Organizational unit edited: {OrgName} by {AdminUser}', {
      OrgName: updatedOrg.name,
      AdminUser: req.user?.email || 'System',
      Action: 'EditOrgUnit'
    });

    res.json({ 
      success: true, 
      data: {
        ...updatedOrg,
        nameEn: updatedOrg.name,
        nameAr: nameAr.trim(),
        orgType: orgType || 'department'
      } 
    });
  } catch (error: any) {
    logger.error('Failed to update department: {ErrorMessage}', { ErrorMessage: error.message });
    res.status(500).json({ error: 'Failed to update organizational unit' });
  }
});

// DELETE /api/departments/:id - Delete an organizational unit
router.delete('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseUnitId(req, res);
    if (id === null) return;

    // Check if it has children
    const children = await db.select().from(departments).where(eq(departments.parentId, id));
    if (children.length > 0) {
      return res.status(400).json({ error: 'Cannot delete an organizational unit that contains sub-units. Reassign them first.' });
    }

    const [deletedOrg] = await db.delete(departments).where(eq(departments.id, id)).returning();

    if (!deletedOrg) {
      return res.status(404).json({ error: 'Organizational unit not found' });
    }

    logger.information('Organizational unit deleted: {OrgName} by {AdminUser}', {
      OrgName: deletedOrg.name,
      AdminUser: req.user?.email || 'System',
      Action: 'DeleteOrgUnit'
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to delete department: {ErrorMessage}', { ErrorMessage: error.message });
    res.status(500).json({ error: 'Failed to delete organizational unit' });
  }
});

export default router;
