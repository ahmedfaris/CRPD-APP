import { Router } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { departments, users } from '../../db/schema.ts';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.ts';

const router = Router();

// Middleware to check if user is admin
const requireAdmin = async (req: AuthRequest, res: any, next: any) => {
  if (req.user?.role !== 'Admin' && req.user?.email !== 'admin@system.local') {
    return res.status(403).json({ error: 'Requires Admin role' });
  }
  next();
};

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

    const parsedParentId = (parentId === null || parentId === '' || parentId === undefined) ? null : Number(parentId);

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
    const id = parseInt(req.params.id as string);
    const { nameEn, nameAr, orgType, description, parentId, managerId } = req.body;

    if (!nameEn || !nameEn.trim()) {
      return res.status(400).json({ error: 'English Name is required' });
    }
    if (!nameAr || !nameAr.trim()) {
      return res.status(400).json({ error: 'Arabic Name is required' });
    }
    
    if (parentId === id) {
      return res.status(400).json({ error: 'An organizational unit cannot be its own parent.' });
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

    if (parentId !== undefined) {
      updateValues.parentId = (parentId === null || parentId === '' || parentId === 0) ? null : Number(parentId);
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
    const id = parseInt(req.params.id as string);
    
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
