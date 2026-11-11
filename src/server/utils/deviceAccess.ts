// src/server/utils/deviceAccess.ts
import { Response } from 'express';
import { AuthRequest, getEffectivePermissions } from '../../middleware/auth.ts';
import { isUserTechnical } from '../../types.ts';

// ---------------------------------------------------------------------------
// Access rules (mirror the UI): anyone signed in may view devices and register a
// device for their own department (e.g. from the hardware ticket form). Managing
// devices requires an admin, a technical user, or an asset permission; deleting
// requires an admin or an explicit asset delete/manage permission.
// ---------------------------------------------------------------------------
const MANAGE_PERMS = ['Asset Management', 'Electronic Device Management', 'devices.', 'assets.'];
const DELETE_PERMS = ['Asset Management.Delete', 'devices.manage', 'assets.manage', 'devices.delete', 'assets.delete'];

export async function getDeviceAccess(req: AuthRequest) {
  const eff = await getEffectivePermissions(req.user?.uid);
  if (!eff) return { canManage: false, canDelete: false, department: '' };
  const isAll = eff.permissions.includes('*');
  const canManage = isAll
    || isUserTechnical({ userType: eff.userType, role: eff.role, email: eff.email })
    || eff.permissions.some(p => MANAGE_PERMS.some(prefix => p.startsWith(prefix)));
  const canDelete = isAll || eff.permissions.some(p => DELETE_PERMS.includes(p));
  return { canManage, canDelete, department: eff.department };
}

export const forbid = (res: Response, what: string) =>
  res.status(403).json({ error: `Forbidden: you do not have permission to ${what}.`, code: 'FORBIDDEN' });

export const requireDeviceManager = async (req: AuthRequest, res: Response, next: () => void) => {
  try {
    if ((await getDeviceAccess(req)).canManage) return next();
    return forbid(res, 'manage assets');
  } catch (e: any) {
    return res.status(500).json({ error: 'Permission check failed' });
  }
};

export const requireDeviceDeleter = async (req: AuthRequest, res: Response, next: () => void) => {
  try {
    if ((await getDeviceAccess(req)).canDelete) return next();
    return forbid(res, 'delete assets');
  } catch (e: any) {
    return res.status(500).json({ error: 'Permission check failed' });
  }
};

