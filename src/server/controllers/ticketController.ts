// src/server/controllers/ticketController.ts
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { TicketModel } from '../models/ticketModel.ts';
import { logger } from '../utils/logger.ts';
import { getTicketAccess, canViewTicket, sanitizeTicketFor, forbidTicket } from '../utils/ticketAccess.ts';
import { USER_REQUEST_ACTION_LIST, missingUserRequestFields, isValidIsoDate } from '../../utils/userRequests.ts';

function getParam(val: string | string[] | undefined): string {
  if (!val) return '';
  return Array.isArray(val) ? val[0] : val;
}

export class TicketController {
  /**
   * Resolve the acting user from the verified session token only.
   * Client-supplied identity (req.body.actor, x-user-* headers) is ignored, since
   * trusting it would let any caller act as any user or role.
   */
  private static getActor(req: AuthRequest) {
    const u = req.user || {};
    return {
      uid: String(u.uid || u.id || u.sub || ''),
      id: String(u.id || u.uid || u.sub || ''),
      fullName: u.fullName || u.displayName || u.name || u.email || 'User',
      email: u.email || '',
      role: u.role || 'Employee',
      userType: u.userType || (u.role === 'Admin' ? 'System Admin' : u.role === 'Agent' ? 'Technical' : 'Operational User'),
      department: u.department || 'Unassigned',
    };
  }

  /**
   * GET /api/tickets
   * Retrieve tickets with optional filtering
   */
  static async getAllTickets(req: AuthRequest, res: Response) {
    try {
      const actor = TicketController.getActor(req);
      const { status, priority, department, stage, category, search, requesterId, assigneeId } = req.query;

      const filters = {
        status: status as string | undefined,
        priority: priority as string | undefined,
        department: department as string | undefined,
        stage: stage as string | undefined,
        category: category as string | undefined,
        search: search as string | undefined,
        requesterId: requesterId as string | undefined,
        assigneeId: assigneeId as string | undefined,
      };

      const access = await getTicketAccess(req);
      const ticketsList = (await TicketModel.getAllTickets(filters))
        .filter((t: any) => canViewTicket(t, access))
        .map((t: any) => sanitizeTicketFor(t, access));

      res.status(200).json({
        success: true,
        count: ticketsList.length,
        data: ticketsList,
      });
    } catch (error: any) {
      logger.error('Failed to retrieve tickets: {Error}', { Error: error.message, Stack: error.stack });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch tickets from database',
      });
    }
  }

  /**
   * GET /api/tickets/metrics
   * Aggregate metrics for dashboards and SLA compliance
   */
  static async getMetrics(req: AuthRequest, res: Response) {
    try {
      const metrics = await TicketModel.getMetrics();
      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      logger.error('Failed to calculate ticket metrics: {Error}', { Error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to calculate ticket metrics',
      });
    }
  }

  /**
   * GET /api/tickets/reports/user-requests?from=YYYY-MM-DD&to=YYYY-MM-DD[&action=&status=&department=]
   * User-account requests in a date range (by the official request's date; the ticket's creation
   * date for older tickets without one): totals by action, status and department, and the list.
   * Only tickets the caller may see are counted.
   */
  static async getUserRequestReport(req: AuthRequest, res: Response) {
    try {
      const q = (k: string) => String(getParam(req.query[k] as any) || '').trim();
      const from = q('from'), to = q('to');
      if ((from && !isValidIsoDate(from)) || (to && !isValidIsoDate(to))) {
        return res.status(400).json({ success: false, error: 'Dates must be YYYY-MM-DD' });
      }
      if (from && to && from > to) {
        return res.status(400).json({ success: false, error: 'The start date is after the end date' });
      }
      const action = q('action'), status = q('status'), department = q('department').toLowerCase();
      const access = await getTicketAccess(req);
      const all = await TicketModel.getAllTickets({});
      const rows = all
        .filter((t: any) => t.ticketType === 'User Request' && canViewTicket(t, access))
        .map((t: any) => {
          const d = t.userRequestDetails || {};
          const created = t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : '';
          return {
            id: t.id,
            ticketNo: t.ticketNo,
            username: d.targetUsername || '',
            fullName: d.targetFullName || '',
            department: d.targetDepartment || '',
            action: t.userRequestAction || '',
            requestNumber: d.requestNumber || '',
            requestDate: d.requestDate || '',
            date: d.requestDate || created,
            createdAt: t.createdAt,
            status: t.status,
            stage: t.stage,
            requesterName: t.requesterName,
            assigneeName: t.assigneeName || '',
          };
        })
        .filter(r => (!from || r.date >= from) && (!to || r.date <= to))
        .filter(r => (!action || r.action === action) && (!status || r.status === status)
          && (!department || r.department.toLowerCase().includes(department)))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(b.ticketNo).localeCompare(String(a.ticketNo)));

      const countBy = (key: 'action' | 'status' | 'department') => {
        const m = new Map<string, number>();
        for (const r of rows) { const k = r[key] || ''; m.set(k, (m.get(k) || 0) + 1); }
        return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      };
      const done = rows.filter(r => r.status === 'Resolved' || r.status === 'Closed').length;
      res.status(200).json({
        success: true,
        data: {
          from: from || null,
          to: to || null,
          total: rows.length,
          completed: done,
          open: rows.length - done,
          byAction: countBy('action'),
          byStatus: countBy('status'),
          byDepartment: countBy('department'),
          rows,
        },
      });
    } catch (error: any) {
      logger.error('Failed to build the user request report: {Error}', { Error: error.message });
      res.status(500).json({ success: false, error: 'Failed to build the report' });
    }
  }

  /**
   * GET /api/tickets/:id
   * Retrieve single ticket with comments, history, and attachments
   */
  static async getTicketById(req: AuthRequest, res: Response) {
    try {
      const id = getParam(req.params.id);
      const ticket = await TicketModel.getTicketById(id);
      const access = await getTicketAccess(req);

      // Tickets the user may not see are reported as not found (no existence leak).
      if (!ticket || !canViewTicket(ticket, access)) {
        return res.status(404).json({
          success: false,
          error: `Ticket '${id}' not found`,
        });
      }

      res.status(200).json({
        success: true,
        data: sanitizeTicketFor(ticket, access),
      });
    } catch (error: any) {
      logger.error('Failed to fetch ticket {TicketId}: {Error}', { TicketId: getParam(req.params.id), Error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch ticket details',
      });
    }
  }

  /**
   * POST /api/tickets
   * Create a new support ticket
   */
  static async createTicket(req: AuthRequest, res: Response) {
    try {
      const { title, description, ticketType, assignedTeam, priority } = req.body;
      const actor = TicketController.getActor(req);

      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Ticket title is required',
        });
      }

      if (!description || !description.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Ticket description is required',
        });
      }

      // User-account requests: creating, suspending or changing an account needs the username,
      // its department, and the official request's number and date.
      if (ticketType === 'User Request') {
        const action = req.body.userRequestAction;
        if (!action || !(USER_REQUEST_ACTION_LIST as readonly string[]).includes(action)) {
          return res.status(400).json({ success: false, error: 'Choose the requested action' });
        }
        const raw = req.body.userRequestDetails && typeof req.body.userRequestDetails === 'object' ? req.body.userRequestDetails : {};
        const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
        const details = {
          targetFullName: clean(raw.targetFullName, 200),
          targetUsername: clean(raw.targetUsername, 120),
          targetDepartment: clean(raw.targetDepartment, 200),
          requestNumber: clean(raw.requestNumber, 60),
          requestDate: isValidIsoDate(raw.requestDate) ? String(raw.requestDate) : '',
          roleOrPermissions: clean(raw.roleOrPermissions, 1000),
          businessJustification: clean(raw.businessJustification, 4000),
        };
        // Latest calendar date anywhere (UTC+14), so a request dated "today" is never rejected.
        const latestToday = new Date(Date.now() + 14 * 3600 * 1000).toISOString().slice(0, 10);
        const missing = missingUserRequestFields(action, details, latestToday);
        if (missing.length) {
          return res.status(400).json({ success: false, error: `Missing or invalid user request fields: ${missing.join(', ')}`, fields: missing });
        }
        req.body.userRequestDetails = details;
      } else {
        delete req.body.userRequestAction;
        delete req.body.userRequestDetails;
      }

      // User requirement: Any ticket submitted by any user is sent to technical teams
      // New tickets always start as Open / New; status, stage and requester come from the
      // workflow and the session, never from the submitted form.
      const { status: _s, stage: _st, requesterId: _r, createdBy: _c, assigneeId: _a, ...body } = req.body || {};
      const ticketPayload = {
        ...body,
        status: 'Open',
        stage: 'New',
        assignedTeam: 'Technical Team',
        teamId: body.teamId || 'tech-team',
      };

      const newTicket = await TicketModel.createTicket(ticketPayload, actor);

      logger.information('New ticket created: {TicketNo} - {Title} by {UserEmail}', {
        TicketNo: newTicket.ticketNo,
        Title: newTicket.title,
        UserEmail: actor.email,
        Priority: newTicket.priority,
        Team: newTicket.assignedTeam,
        Action: 'CreateTicket',
      });

      res.status(201).json({
        success: true,
        data: newTicket,
      });
    } catch (error: any) {
      logger.error('Error creating ticket: {Error}', { Error: error.message, Stack: error.stack });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create ticket in database',
      });
    }
  }

  /**
   * PUT /api/tickets/:id
   * Update ticket status, stage, priority, or assignment
   */
  static async updateTicket(req: AuthRequest, res: Response) {
    try {
      const id = getParam(req.params.id);
      const actor = TicketController.getActor(req);
      const access = await getTicketAccess(req);
      if (!access.isTechnical) {
        const existing = await TicketModel.getTicketById(id);
        if (!existing || !canViewTicket(existing, access)) {
          return res.status(404).json({ success: false, error: `Ticket '${id}' not found for update` });
        }
        return forbidTicket(res, 'change ticket status, priority or assignment');
      }

      const updated = await TicketModel.updateTicket(id, req.body, actor);
      if (!updated) {
        return res.status(404).json({
          success: false,
          error: `Ticket '${id}' not found for update`,
        });
      }

      logger.information('Ticket updated: {TicketNo} by {UserEmail}', {
        TicketNo: updated.ticketNo,
        UserEmail: actor.email,
        Status: updated.status,
        Stage: updated.stage,
        Action: 'UpdateTicket',
      });

      res.status(200).json({
        success: true,
        data: sanitizeTicketFor(updated, access),
      });
    } catch (error: any) {
      logger.error('Error updating ticket {TicketId}: {Error}', { TicketId: getParam(req.params.id), Error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update ticket in database',
      });
    }
  }

  /**
   * DELETE /api/tickets/:id
   * Remove a ticket
   */
  static async deleteTicket(req: AuthRequest, res: Response) {
    try {
      const id = getParam(req.params.id);
      const actor = TicketController.getActor(req);
      if (!(await getTicketAccess(req)).isAdmin) {
        return forbidTicket(res, 'delete tickets');
      }

      const deleted = await TicketModel.deleteTicket(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: `Ticket '${id}' not found`,
        });
      }

      logger.warning('Ticket deleted: {TicketId} by {UserEmail}', {
        TicketId: id,
        UserEmail: actor.email,
        Action: 'DeleteTicket',
      });

      res.status(200).json({
        success: true,
        message: `Ticket ${id} deleted successfully`,
      });
    } catch (error: any) {
      logger.error('Error deleting ticket {TicketId}: {Error}', { TicketId: getParam(req.params.id), Error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete ticket',
      });
    }
  }

  /**
   * POST /api/tickets/:id/comments
   * Add a public reply or internal staff note
   */
  static async addComment(req: AuthRequest, res: Response) {
    try {
      const id = getParam(req.params.id);
      const { content, isInternalNote, isInternal } = req.body;
      const actor = TicketController.getActor(req);

      if (!content || !content.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Comment content cannot be empty',
        });
      }

      const isNote = Boolean(isInternalNote !== undefined ? isInternalNote : isInternal);
      const access = await getTicketAccess(req);
      const existing = await TicketModel.getTicketById(id);
      if (!existing || !canViewTicket(existing, access)) {
        return res.status(404).json({ success: false, error: `Ticket '${id}' not found` });
      }
      if (isNote && !access.isTechnical) {
        return forbidTicket(res, 'post internal staff notes');
      }
      const comment = await TicketModel.addComment(id, content, isNote, actor);

      if (!comment) {
        return res.status(404).json({
          success: false,
          error: `Ticket '${id}' not found`,
        });
      }

      logger.information('Comment added to ticket {TicketId} by {UserEmail} (Internal: {IsInternal})', {
        TicketId: id,
        UserEmail: actor.email,
        IsInternal: isNote,
        Action: 'AddComment',
      });

      res.status(201).json({
        success: true,
        data: comment,
      });
    } catch (error: any) {
      logger.error('Error adding comment to ticket {TicketId}: {Error}', { TicketId: getParam(req.params.id), Error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to add comment',
      });
    }
  }

  /**
   * POST /api/tickets/:id/attachments
   * Upload and attach picture or scan document
   */
  static async addAttachment(req: AuthRequest, res: Response) {
    try {
      const id = getParam(req.params.id);
      const { fileName, fileSize, fileType, dataUrl } = req.body;
      const actor = TicketController.getActor(req);

      if (!fileName) {
        return res.status(400).json({
          success: false,
          error: 'File name is required',
        });
      }

      const access = await getTicketAccess(req);
      const existing = await TicketModel.getTicketById(id);
      if (!existing || !canViewTicket(existing, access)) {
        return res.status(404).json({ success: false, error: `Ticket '${id}' not found` });
      }

      const attachment = await TicketModel.addAttachment(
        id,
        {
          fileName,
          fileSize: fileSize || '1.0 MB',
          fileType: fileType || 'image/jpeg',
          dataUrl,
        },
        actor
      );

      if (!attachment) {
        return res.status(404).json({
          success: false,
          error: `Ticket '${id}' not found`,
        });
      }

      logger.information('Attachment added to ticket {TicketId}: {FileName} by {UserEmail}', {
        TicketId: id,
        FileName: fileName,
        UserEmail: actor.email,
        Action: 'AddAttachment',
      });

      res.status(201).json({
        success: true,
        data: attachment,
      });
    } catch (error: any) {
      logger.error('Error adding attachment to ticket {TicketId}: {Error}', { TicketId: getParam(req.params.id), Error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to attach file',
      });
    }
  }

  /**
   * GET /api/tickets/teams
   * Retrieve support teams
   */
  static async getTeams(req: AuthRequest, res: Response) {
    try {
      const teams = await TicketModel.getSupportTeams();
      res.status(200).json({
        success: true,
        data: teams,
      });
    } catch (error: any) {
      logger.error('Failed to get support teams: {Error}', { Error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to load support teams',
      });
    }
  }

  /**
   * POST /api/tickets/teams
   * Create new support team
   */
  static async createTeam(req: AuthRequest, res: Response) {
    try {
      if (!(await getTicketAccess(req)).canManageTeams) {
        return forbidTicket(res, 'manage support teams');
      }
      const { name, nameAr, type, description, descriptionAr, memberUserIds, leadUserId } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Team English name is required' });
      }
      if (!nameAr || !nameAr.trim()) {
        return res.status(400).json({ success: false, error: 'Team Arabic name is required' });
      }

      const newTeam = await TicketModel.createSupportTeam({
        name: name.trim(),
        nameAr: nameAr.trim(),
        type: type || name.trim(),
        description: description?.trim() || '',
        descriptionAr: descriptionAr?.trim() || '',
        memberUserIds: Array.isArray(memberUserIds) ? memberUserIds : [],
        leadUserId: leadUserId || undefined
      });

      logger.information('New support team created: {TeamName} ({TeamNameAr})', {
        TeamName: newTeam.name,
        TeamNameAr: newTeam.nameAr,
        TeamId: newTeam.id,
        MembersCount: newTeam.memberUserIds.length
      });

      res.status(201).json({
        success: true,
        data: newTeam
      });
    } catch (error: any) {
      logger.error('Failed to create support team: {Error}', { Error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create support team'
      });
    }
  }

  /**
   * PUT /api/tickets/teams/:teamId
   * Update support team
   */
  static async updateTeam(req: AuthRequest, res: Response) {
    try {
      if (!(await getTicketAccess(req)).canManageTeams) {
        return forbidTicket(res, 'manage support teams');
      }
      const teamId = getParam(req.params.teamId);
      const { name, nameAr, type, description, descriptionAr, memberUserIds, leadUserId } = req.body;

      const updated = await TicketModel.updateSupportTeam(teamId, {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(nameAr !== undefined ? { nameAr: nameAr.trim() } : {}),
        ...(type !== undefined ? { type: type.trim() } : {}),
        ...(description !== undefined ? { description: description.trim() } : {}),
        ...(descriptionAr !== undefined ? { descriptionAr: descriptionAr.trim() } : {}),
        ...(memberUserIds !== undefined ? { memberUserIds: Array.isArray(memberUserIds) ? memberUserIds : [] } : {}),
        ...(leadUserId !== undefined ? { leadUserId } : {})
      });

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Team not found' });
      }

      logger.information('Support team updated: {TeamId} - {TeamName}', {
        TeamId: teamId,
        TeamName: updated.name
      });

      res.status(200).json({
        success: true,
        data: updated
      });
    } catch (error: any) {
      logger.error('Failed to update support team: {Error}', { Error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update support team'
      });
    }
  }

  /**
   * DELETE /api/tickets/teams/:teamId
   * Delete support team
   */
  static async deleteTeam(req: AuthRequest, res: Response) {
    try {
      if (!(await getTicketAccess(req)).canManageTeams) {
        return forbidTicket(res, 'manage support teams');
      }
      const teamId = getParam(req.params.teamId);
      // Every new ticket is routed to the built-in technical team; it cannot be deleted.
      if (teamId === 'tech-team') {
        return res.status(400).json({ success: false, error: 'The built-in Technical Team cannot be deleted.' });
      }
      const success = await TicketModel.deleteSupportTeam(teamId);

      if (!success) {
        return res.status(404).json({ success: false, error: 'Team not found' });
      }

      logger.information('Support team deleted: {TeamId}', { TeamId: teamId });
      res.status(200).json({ success: true });
    } catch (error: any) {
      logger.error('Failed to delete support team: {Error}', { Error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete support team'
      });
    }
  }

  /**
   * POST /api/tickets/teams/:teamId/members
   * Add member to support team
   */
  static async assignUserToTeam(req: AuthRequest, res: Response) {
    try {
      if (!(await getTicketAccess(req)).canManageTeams) {
        return forbidTicket(res, 'manage support teams');
      }
      const teamId = getParam(req.params.teamId);
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID is required' });
      }

      const success = await TicketModel.assignUserToTeam(teamId, userId);
      res.status(200).json({ success });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/tickets/teams/:teamId/members/:userId
   * Remove member from support team
   */
  static async removeUserFromTeam(req: AuthRequest, res: Response) {
    try {
      if (!(await getTicketAccess(req)).canManageTeams) {
        return forbidTicket(res, 'manage support teams');
      }
      const teamId = getParam(req.params.teamId);
      const userId = getParam(req.params.userId);
      const success = await TicketModel.removeUserFromTeam(teamId, userId);
      res.status(200).json({ success });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/tickets/settings
   * Retrieve system SLA and attachment settings
   */
  static async getSettings(req: AuthRequest, res: Response) {
    try {
      const settings: any = await TicketModel.getSystemSettings();
      const access = await getTicketAccess(req);
      // The external log collector key is a secret: only admins receive it.
      if (!access.isAdmin) {
        const { serilogApiKey, ...rest } = settings;
        return res.status(200).json({ success: true, data: { ...rest, hasSerilogApiKey: Boolean(serilogApiKey) } });
      }
      res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to load settings',
      });
    }
  }

  /**
   * PUT /api/tickets/settings
   * Update system SLA and attachment settings
   */
  static async updateSettings(req: AuthRequest, res: Response) {
    try {
      if (!(await getTicketAccess(req)).isAdmin) {
        return forbidTicket(res, 'change system settings');
      }
      const updated = await TicketModel.updateSystemSettings(req.body);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update settings',
      });
    }
  }
}
