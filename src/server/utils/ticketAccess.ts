// src/server/utils/ticketAccess.ts
import { Response, NextFunction } from 'express';
import { AuthRequest, getEffectivePermissions } from '../../middleware/auth.ts';
import { isUserTechnical } from '../../types.ts';

/**
 * Who may do what with tickets (mirrors the UI):
 * - Technical users / agents / admins see and work on every ticket.
 * - Other users see tickets they requested and tickets of their own department,
 *   may comment on and attach files to those, but never see internal notes.
 * - Only admins delete tickets, change system settings, or (with a Team Management
 *   permission) manage support teams.
 */
export interface TicketAccess {
  uid: string;
  id: string;
  email: string;
  fullName: string;
  department: string;
  isTechnical: boolean;
  isAdmin: boolean;
  canManageTeams: boolean;
}

export async function getTicketAccess(req: AuthRequest): Promise<TicketAccess> {
  const u = req.user || {};
  const eff = await getEffectivePermissions(u.uid);
  const role = (eff?.role || '').toLowerCase();
  const isAll = !!eff && eff.permissions.includes('*');
  const isAdmin = isAll || role === 'admin' || role === 'administrator' || role === 'system admin';
  const isTechnical = !!eff && (isAdmin || isUserTechnical({ userType: eff.userType, role: eff.role, email: eff.email }));
  const canManageTeams = isAdmin || (!!eff && eff.permissions.some(p =>
    (p.startsWith('Team Management.') && p !== 'Team Management.View') || p === 'teams.manage'));
  return {
    uid: String(u.uid || ''),
    id: String(u.id || ''),
    email: String(eff?.email || u.email || ''),
    fullName: String(u.name || u.fullName || ''),
    department: String(eff?.department || u.department || ''),
    isTechnical,
    isAdmin,
    canManageTeams,
  };
}

// Department names are compared exactly (case-insensitive), or as members of the same
// synonym group. Substring matching leaked tickets: "facilities" contains "it".
const SYNONYM_GROUPS: string[][] = [
  ['operations', 'operations & logistics', 'العمليات', 'العمليات والتنفيذ'],
  ['information technology', 'it', 'it operations', 'it service desk', 'تكنولوجيا المعلومات', 'تقنية المعلومات'],
  ['customer support & helpdesk', 'customer support', 'helpdesk', 'دعم العملاء ومكتب المساعدة', 'الدعم الفني'],
  ['electronic archiving & records', 'archiving', 'الأرشيف الإلكتروني', 'الأرشفة الإلكترونية والسجلات', 'الأرشفة'],
  ['human resources', 'hr', 'الموارد البشرية'],
];
const norm = (s: unknown) => String(s || '').trim().toLowerCase();

export function sameDepartment(a: unknown, b: unknown): boolean {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return SYNONYM_GROUPS.some(g => g.includes(x) && g.includes(y));
}

export function canViewTicket(ticket: any, access: TicketAccess): boolean {
  if (!ticket) return false;
  if (access.isTechnical) return true;
  const requester = String(ticket.requesterId || '');
  if (requester && (requester === access.uid || requester === access.id)) return true;
  if (ticket.requesterEmail && access.email && norm(ticket.requesterEmail) === norm(access.email)) return true;

  if (!access.department || norm(access.department) === 'unassigned') return false;
  let hw: any = ticket.hardwareDetails;
  if (typeof hw === 'string') { try { hw = JSON.parse(hw); } catch { hw = null; } }
  return [ticket.department, ticket.requesterDept, hw?.department].some(d => sameDepartment(d, access.department));
}

/** Remove internal staff notes (and their history excerpts) for non-technical viewers. */
export function sanitizeTicketFor<T extends Record<string, any>>(ticket: T, access: TicketAccess): T {
  if (!ticket || access.isTechnical) return ticket;
  const copy: any = { ...ticket };
  if (Array.isArray(copy.comments)) {
    copy.comments = copy.comments.filter((c: any) => !(c.isInternalNote || c.isInternal));
  }
  if (Array.isArray(copy.history)) {
    copy.history = copy.history.map((h: any) =>
      /internal note/i.test(String(h.action || '')) ? { ...h, details: '' } : h);
  }
  return copy;
}

export const forbidTicket = (res: Response, what: string) =>
  res.status(403).json({ success: false, error: `Forbidden: you do not have permission to ${what}.`, code: 'FORBIDDEN' });

/**
 * Guard for routes and static folders keyed by ticket number (tickets archive):
 * the first path segment (or :ticketNo) must be a ticket the user may view.
 */
export function requireTicketFolderAccess(lookup: (ticketNo: string) => Promise<any>) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const raw = (req.params as any)?.ticketNo
        ?? decodeURIComponent(String(req.path || '').split('/').filter(Boolean)[0] || '');
      if (!raw) return res.status(404).json({ error: 'Not found' });
      const ticket = await lookup(String(raw));
      const access = await getTicketAccess(req);
      if (!ticket || !canViewTicket(ticket, access)) {
        return res.status(404).json({ error: 'Not found' });
      }
      next();
    } catch (e: any) {
      res.status(500).json({ error: 'Access check failed' });
    }
  };
}
