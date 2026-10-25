// src/server/controllers/ticketController.ts
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { TicketModel } from '../models/ticketModel.ts';
import { logger } from '../utils/logger.ts';
import { isUserTechnical } from '../../types.ts';

function getParam(val: string | string[] | undefined): string {
  if (!val) return '';
  return Array.isArray(val) ? val[0] : val;
}

export class TicketController {
  /**
   * Helper to extract active actor from AuthRequest or body/headers
   */
  private static getActor(req: AuthRequest) {
    // 1. Check request body for client-provided actor context (e.g. active user in UI)
    if (req.body?.actor && (req.body.actor.id || req.body.actor.uid || req.body.actor.email)) {
      return {
        uid: String(req.body.actor.uid || req.body.actor.id || 'usr_current'),
        id: String(req.body.actor.id || req.body.actor.uid || 'usr_current'),
        fullName: req.body.actor.fullName || req.body.actor.name || 'System User',
        email: req.body.actor.email || 'user@company.gov',
        role: req.body.actor.role || 'Employee',
        userType: req.body.actor.userType || 'Operational User',
        department: req.body.actor.department || 'IT Service Desk',
      };
    }

    // 2. Check custom active user headers
    const headerUserId = req.headers['x-user-id'] as string;
    const headerUserName = req.headers['x-user-name'] as string;
    const headerUserEmail = req.headers['x-user-email'] as string;
    const headerUserRole = req.headers['x-user-role'] as string;
    const headerUserType = req.headers['x-user-type'] as string;
    const headerUserDept = req.headers['x-user-dept'] as string;

    if (headerUserId || headerUserName || headerUserEmail) {
      return {
        uid: headerUserId || 'usr_guest',
        id: headerUserId || 'usr_guest',
        fullName: headerUserName ? decodeURIComponent(headerUserName) : 'System User',
        email: headerUserEmail || 'user@company.gov',
        role: headerUserRole || 'Employee',
        userType: headerUserType || 'Operational User',
        department: headerUserDept ? decodeURIComponent(headerUserDept) : 'IT Service Desk',
      };
    }

    // 3. Fallback to JWT session user
    if (req.user) {
      return {
        uid: String(req.user.uid || req.user.id || 'usr_current'),
        id: String(req.user.id || req.user.uid || 'usr_current'),
        fullName: req.user.fullName || req.user.displayName || req.user.name || 'System User',
        email: req.user.email || 'user@company.gov',
        role: req.user.role || 'Employee',
        userType: req.user.userType || (req.user.role === 'Admin' ? 'System Admin' : req.user.role === 'Agent' ? 'Technical' : 'Operational User'),
        department: req.user.department || 'IT Service Desk',
      };
    }

    return {
      uid: 'USR-OPERATIONAL-001',
      id: 'USR-OPERATIONAL-001',
      fullName: 'System Operator',
      email: 'operator@company.gov',
      role: 'Admin',
      userType: 'System Admin',
      department: 'IT Service Desk',
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

      let ticketsList = await TicketModel.getAllTickets(filters);

      // Technical users, agents, and admins have full visibility across all tickets sent to technical teams
      const isTechnical = isUserTechnical(actor);

      // Only non-technical operator users are restricted to tickets belonging to their departments
      const isOpUser = !isTechnical;

      if (isOpUser && actor.department && actor.department !== 'Unassigned') {
        const uDept = actor.department.toLowerCase().trim();
        const synonymGroups = [
          ['operations', 'operations & logistics', 'العمليات', 'العمليات والتنفيذ'],
          ['information technology', 'it', 'it operations', 'it service desk', 'تكنولوجيا المعلومات', 'تقنية المعلومات'],
          ['customer support & helpdesk', 'customer support', 'helpdesk', 'دعم العملاء ومكتب المساعدة', 'الدعم الفني'],
          ['electronic archiving & records', 'archiving', 'الأرشيف الإلكتروني', 'الأرشفة الإلكترونية والسجلات', 'الأرشفة'],
          ['human resources', 'hr', 'الموارد البشرية']
        ];

        ticketsList = ticketsList.filter((t: any) => {
          // If created by or requested by this user, it's their department ticket
          if (
            (t.requesterId && (t.requesterId === actor.id || t.requesterId === actor.uid)) ||
            (t.requesterEmail && actor.email && t.requesterEmail.toLowerCase() === actor.email.toLowerCase()) ||
            (t.requesterName && actor.fullName && t.requesterName.toLowerCase() === actor.fullName.toLowerCase())
          ) {
            return true;
          }

          const tDepts: string[] = [t.department, t.requesterDept, t.hardwareDetails?.department]
            .filter(Boolean)
            .map((d: any) => String(d).toLowerCase().trim());

          // Direct match or substring
          if (tDepts.some(d => d === uDept || d.includes(uDept) || uDept.includes(d))) {
            return true;
          }

          // Synonym group matching
          for (const group of synonymGroups) {
            const userInGroup = group.some(term => uDept.includes(term) || term.includes(uDept));
            if (userInGroup) {
              const ticketInGroup = tDepts.some(td => group.some(term => td.includes(term) || term.includes(td)));
              if (ticketInGroup) return true;
            }
          }

          return false;
        });
      }

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
   * GET /api/tickets/:id
   * Retrieve single ticket with comments, history, and attachments
   */
  static async getTicketById(req: AuthRequest, res: Response) {
    try {
      const id = getParam(req.params.id);
      const ticket = await TicketModel.getTicketById(id);

      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: `Ticket '${id}' not found`,
        });
      }

      res.status(200).json({
        success: true,
        data: ticket,
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

      // User requirement: Any ticket submitted by any user is sent to technical teams
      const ticketPayload = {
        ...req.body,
        assignedTeam: 'Technical Team',
        teamId: req.body.teamId || 'tech-team',
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
        data: updated,
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
      const teamId = getParam(req.params.teamId);
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
      const settings = await TicketModel.getSystemSettings();
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
