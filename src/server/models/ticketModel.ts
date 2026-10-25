// src/server/models/ticketModel.ts
import { db } from '../../db/index.ts';
import { 
  tickets, 
  ticketComments, 
  ticketHistory, 
  ticketAttachments,
  supportTeams,
  systemSettings,
  assets,
  maintenance,
  users
} from '../../db/schema.ts';
import { eq, desc, asc, and, ilike, or, sql } from 'drizzle-orm';
import { TicketRequestFileService } from '../services/ticketRequestFileService.ts';
import { TicketArchiveService } from '../services/ticketArchiveService.ts';
import { NotificationService } from '../services/notificationService.ts';
import { 
  Ticket, 
  TicketComment, 
  TicketHistoryItem, 
  TicketAttachment, 
  SupportTeam, 
  SystemSettings,
  TicketPriority,
  TicketStatus,
  TicketStage,
  PriorityStars,
  isUserTechnical
} from '../../types.ts';

export interface TicketFilterOptions {
  status?: string;
  priority?: string;
  department?: string;
  requesterId?: string;
  assigneeId?: string;
  search?: string;
  stage?: string;
  category?: string;
}

export class TicketModel {
  /**
   * Calculate SLA minutes based on Priority
   */
  static getSlaMinutes(priority: string, settings?: SystemSettings): { response: number; resolution: number } {
    const criticalHours = settings?.slaCriticalHours ?? 4;
    const mediumHours = settings?.slaMediumHours ?? 24;
    const lowHours = settings?.slaLowHours ?? 48;

    switch (priority) {
      case 'Critical':
      case 'High':
        return { response: 60, resolution: criticalHours * 60 };
      case 'Medium':
        return { response: 240, resolution: mediumHours * 60 };
      case 'Low':
      default:
        return { response: 480, resolution: lowHours * 60 };
    }
  }

  /**
   * Helper to format a database ticket row into the rich Ticket domain object
   */
  private static formatTicket(
    row: any, 
    comments: TicketComment[] = [], 
    history: TicketHistoryItem[] = [], 
    attachments: TicketAttachment[] = []
  ): Ticket {
    const now = new Date();
    const responseDue = row.responseDueAt ? new Date(row.responseDueAt) : null;
    const resolutionDue = row.resolutionDueAt ? new Date(row.resolutionDueAt) : null;

    // Calculate dynamic SLA breaches
    const isResponseBreached = row.respondedAt 
      ? false 
      : (responseDue ? now > responseDue : Boolean(row.isResponseBreached));

    const isResolutionBreached = (row.status === 'Resolved' || row.status === 'Closed')
      ? false
      : (resolutionDue ? now > resolutionDue : Boolean(row.isResolutionBreached));

    let userReqDetails = undefined;
    if (row.userRequestDetails) {
      try {
        userReqDetails = typeof row.userRequestDetails === 'string' 
          ? JSON.parse(row.userRequestDetails) 
          : row.userRequestDetails;
      } catch (_) {}
    }

    let hwDetails = undefined;
    if (row.hardwareDetails) {
      try {
        hwDetails = typeof row.hardwareDetails === 'string' 
          ? JSON.parse(row.hardwareDetails) 
          : row.hardwareDetails;
      } catch (_) {}
    }

    let deptReq = undefined;
    if (row.deptRequest) {
      try {
        deptReq = typeof row.deptRequest === 'string'
          ? JSON.parse(row.deptRequest)
          : row.deptRequest;
      } catch (_) {}
    }

    const ticketNo = row.ticketNo || `TCK-2026-${String(row.id).padStart(4, '0')}`;

    return {
      id: ticketNo,
      ticketNo: ticketNo,
      title: row.title,
      description: row.description,
      ticketType: row.ticketType || 'Hardware Maintenance',
      assignedTeam: row.assignedTeam || 'Technical Team',
      teamId: row.teamId || undefined,
      hardwareDeviceType: row.hardwareDeviceType || undefined,
      targetSystem: row.targetSystem || undefined,
      userRequestAction: row.userRequestAction || undefined,
      priorityStars: (row.priorityStars || 2) as PriorityStars,
      priority: (row.priority || 'Medium') as TicketPriority,
      stage: (row.stage || 'New') as TicketStage,
      status: (row.status || 'Open') as TicketStatus,
      category: row.category || 'Hardware & Devices',
      department: row.department || 'IT Service Desk',
      createdBy: row.createdBy || row.requesterId || 'USR-EMP-001',
      requesterId: row.requesterId || row.createdBy || 'USR-EMP-001',
      requesterName: row.requesterName || 'Employee',
      requesterEmail: row.requesterEmail || 'employee@company.gov',
      requesterDept: row.requesterDept || 'IT Service Desk',
      requesterUserType: row.requesterUserType || 'Operational User',
      assigneeId: row.assigneeId || null,
      assigneeName: row.assigneeName || null,
      assigneeRole: row.assigneeRole || undefined,
      responseSlaMinutes: row.responseSlaMinutes ?? 240,
      resolutionSlaMinutes: row.resolutionSlaMinutes ?? 1440,
      responseDueAt: row.responseDueAt ? new Date(row.responseDueAt).toISOString() : new Date(Date.now() + 4 * 3600000).toISOString(),
      resolutionDueAt: row.resolutionDueAt ? new Date(row.resolutionDueAt).toISOString() : new Date(Date.now() + 24 * 3600000).toISOString(),
      isResponseBreached,
      isResolutionBreached,
      respondedAt: row.respondedAt ? new Date(row.respondedAt).toISOString() : null,
      resolvedAt: row.resolvedAt ? new Date(row.resolvedAt).toISOString() : null,
      closedAt: row.closedAt ? new Date(row.closedAt).toISOString() : null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
      deptRequest: deptReq,
      userRequestDetails: userReqDetails,
      hardwareDetails: hwDetails,
      tags: Array.isArray(row.tags) ? row.tags : [],
      comments,
      history,
      attachments,
    };
  }

  /**
   * Get all tickets with optional filtering
   */
  static async getAllTickets(filters: TicketFilterOptions = {}): Promise<Ticket[]> {
    const conditions = [];

    if (filters.status && filters.status !== 'All') {
      conditions.push(eq(tickets.status, filters.status));
    }
    if (filters.priority && filters.priority !== 'All') {
      conditions.push(eq(tickets.priority, filters.priority));
    }
    if (filters.department && filters.department !== 'All') {
      conditions.push(eq(tickets.department, filters.department));
    }
    if (filters.stage && filters.stage !== 'All') {
      conditions.push(eq(tickets.stage, filters.stage));
    }
    if (filters.category && filters.category !== 'All') {
      conditions.push(eq(tickets.category, filters.category));
    }
    if (filters.requesterId) {
      conditions.push(eq(tickets.requesterId, filters.requesterId));
    }
    if (filters.assigneeId) {
      conditions.push(eq(tickets.assigneeId, filters.assigneeId));
    }
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(tickets.title, searchPattern),
          ilike(tickets.description, searchPattern),
          ilike(tickets.ticketNo, searchPattern),
          ilike(tickets.requesterName, searchPattern),
          ilike(tickets.assigneeName, searchPattern)
        )
      );
    }

    const query = conditions.length > 0 
      ? db.select().from(tickets).where(and(...conditions)).orderBy(desc(tickets.createdAt))
      : db.select().from(tickets).orderBy(desc(tickets.createdAt));

    const rawRows = await query;
    const exampleTicketNos = new Set(['TCK-2026-1042', 'TCK-2026-1041', 'TCK-2026-1040', 'TCK-2026-1039', 'TCK-2026-1038']);
    const ticketRows = rawRows.filter(r => !exampleTicketNos.has(r.ticketNo || ''));
    if (ticketRows.length === 0) {
      return [];
    }

    const ticketIds = ticketRows.map(r => r.id);

    // Fetch comments, history, attachments in bulk
    const allComments = await db
      .select()
      .from(ticketComments)
      .where(sql`${ticketComments.ticketId} IN ${ticketIds}`)
      .orderBy(asc(ticketComments.createdAt));

    const allHistory = await db
      .select()
      .from(ticketHistory)
      .where(sql`${ticketHistory.ticketId} IN ${ticketIds}`)
      .orderBy(desc(ticketHistory.createdAt));

    const allAttachments = await db
      .select()
      .from(ticketAttachments)
      .where(sql`${ticketAttachments.ticketId} IN ${ticketIds}`)
      .orderBy(desc(ticketAttachments.createdAt));

    // Group relations by ticketId
    const commentsByTicket = new Map<number, TicketComment[]>();
    for (const c of allComments) {
      const list = commentsByTicket.get(c.ticketId) || [];
      list.push({
        id: String(c.id),
        ticketId: c.ticketNo || String(c.ticketId),
        authorId: c.authorId,
        authorName: c.authorName || 'Support Agent',
        authorRole: (c.authorRole as any) || 'Employee',
        authorUserType: (c.authorUserType as any) || 'Operational User',
        authorEmail: c.authorEmail || '',
        content: c.content,
        isInternalNote: Boolean(c.isInternal),
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString()
      });
      commentsByTicket.set(c.ticketId, list);
    }

    const historyByTicket = new Map<number, TicketHistoryItem[]>();
    for (const h of allHistory) {
      const list = historyByTicket.get(h.ticketId) || [];
      list.push({
        id: String(h.id),
        ticketId: h.ticketNo || String(h.ticketId),
        timestamp: h.createdAt ? new Date(h.createdAt).toISOString() : new Date().toISOString(),
        actorName: h.actorName,
        actorRole: (h.actorRole as any) || 'Employee',
        actorUserType: (h.actorUserType as any) || 'Operational User',
        action: h.action,
        details: h.details || undefined
      });
      historyByTicket.set(h.ticketId, list);
    }

    const attachmentsByTicket = new Map<number, TicketAttachment[]>();
    for (const a of allAttachments) {
      const list = attachmentsByTicket.get(a.ticketId) || [];
      list.push({
        id: String(a.id),
        fileName: a.fileName,
        fileSize: a.fileSize,
        fileType: a.fileType,
        dataUrl: a.dataUrl || undefined,
        uploadedAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
        uploadedBy: a.uploadedBy
      });
      attachmentsByTicket.set(a.ticketId, list);
    }

    return ticketRows.map(row => 
      this.formatTicket(
        row, 
        commentsByTicket.get(row.id) || [], 
        historyByTicket.get(row.id) || [], 
        attachmentsByTicket.get(row.id) || []
      )
    );
  }

  /**
   * Helper to retrieve raw database row by numeric ID or ticketNo string
   */
  static async getTicketDbRow(idOrTicketNo: string | number) {
    if (typeof idOrTicketNo === 'number' || /^\d+$/.test(String(idOrTicketNo))) {
      const numId = parseInt(String(idOrTicketNo), 10);
      const res = await db.select().from(tickets).where(eq(tickets.id, numId)).limit(1);
      if (res[0]) return res[0];
    }
    const res = await db.select().from(tickets).where(eq(tickets.ticketNo, String(idOrTicketNo))).limit(1);
    return res[0] || null;
  }

  /**
   * Get single ticket by ID or ticketNo
   */
  static async getTicketById(idOrTicketNo: string | number): Promise<Ticket | null> {
    const row = await this.getTicketDbRow(idOrTicketNo);
    if (!row) {
      return null;
    }

    const comments = await db
      .select()
      .from(ticketComments)
      .where(eq(ticketComments.ticketId, row.id))
      .orderBy(asc(ticketComments.createdAt));

    const history = await db
      .select()
      .from(ticketHistory)
      .where(eq(ticketHistory.ticketId, row.id))
      .orderBy(desc(ticketHistory.createdAt));

    const attachments = await db
      .select()
      .from(ticketAttachments)
      .where(eq(ticketAttachments.ticketId, row.id))
      .orderBy(desc(ticketAttachments.createdAt));

    return this.formatTicket(
      row,
      comments.map(c => ({
        id: String(c.id),
        ticketId: c.ticketNo || row.ticketNo,
        authorId: c.authorId,
        authorName: c.authorName || 'Support Agent',
        authorRole: (c.authorRole as any) || 'Employee',
        authorUserType: (c.authorUserType as any) || 'Operational User',
        authorEmail: c.authorEmail || '',
        content: c.content,
        isInternalNote: Boolean(c.isInternal),
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString()
      })),
      history.map(h => ({
        id: String(h.id),
        ticketId: h.ticketNo || row.ticketNo,
        timestamp: h.createdAt ? new Date(h.createdAt).toISOString() : new Date().toISOString(),
        actorName: h.actorName,
        actorRole: (h.actorRole as any) || 'Employee',
        actorUserType: (h.actorUserType as any) || 'Operational User',
        action: h.action,
        details: h.details || undefined
      })),
      attachments.map(a => ({
        id: String(a.id),
        fileName: a.fileName,
        fileSize: a.fileSize,
        fileType: a.fileType,
        dataUrl: a.dataUrl || undefined,
        uploadedAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
        uploadedBy: a.uploadedBy
      }))
    );
  }

  /**
   * Create a new ticket in PostgreSQL
   */
  static async createTicket(input: any, actor: any): Promise<Ticket> {
    const settings = await this.getSystemSettings();
    const priority = input.priority || 'Medium';
    const sla = this.getSlaMinutes(priority, settings);

    const now = new Date();
    const responseDueAt = new Date(now.getTime() + sla.response * 60 * 1000);
    const resolutionDueAt = new Date(now.getTime() + sla.resolution * 60 * 1000);

    // Calculate priority stars
    let priorityStars = input.priorityStars;
    if (!priorityStars) {
      if (priority === 'Critical' || priority === 'High') priorityStars = 3;
      else if (priority === 'Medium') priorityStars = 2;
      else priorityStars = 1;
    }

    // Determine initial ticket number placeholder
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const tempTicketNo = `TCK-2026-${randomSuffix}`;

    // Process and offload Department Request Document to disk in 'ticket requests' folder
    let processedDeptRequest = null;
    if (input.deptRequest) {
      processedDeptRequest = await TicketRequestFileService.processDeptRequestDoc(input.deptRequest, tempTicketNo);
    }

    const [inserted] = await db.insert(tickets).values({
      ticketNo: tempTicketNo,
      title: input.title.trim(),
      description: input.description,
      ticketType: input.ticketType || 'Hardware Maintenance',
      assignedTeam: 'Technical Team',
      teamId: input.teamId || 'tech-team',
      hardwareDeviceType: input.hardwareDeviceType || null,
      targetSystem: input.targetSystem || null,
      userRequestAction: input.userRequestAction || null,
      priorityStars: priorityStars,
      priority: priority,
      stage: input.stage || 'New',
      status: input.status || 'Open',
      category: input.category || 'Hardware & Devices',
      department: (actor.department && actor.department !== 'Unassigned') ? actor.department : (input.department || 'IT Service Desk'),
      createdBy: String(actor.id || actor.uid || 'usr_emp'),
      requesterId: String(actor.id || actor.uid || 'USR-EMP-001'),
      requesterName: actor.fullName || 'Employee',
      requesterEmail: actor.email || 'employee@company.gov',
      requesterDept: (actor.department && actor.department !== 'Unassigned') ? actor.department : (input.department || 'IT Service Desk'),
      requesterUserType: actor.userType || 'Operator',
      responseSlaMinutes: sla.response,
      resolutionSlaMinutes: sla.resolution,
      responseDueAt: responseDueAt,
      resolutionDueAt: resolutionDueAt,
      deptRequest: processedDeptRequest ? JSON.stringify(processedDeptRequest) : null,
      userRequestDetails: input.userRequestDetails ? JSON.stringify(input.userRequestDetails) : null,
      hardwareDetails: input.hardwareDetails ? JSON.stringify(input.hardwareDetails) : null,
      tags: Array.isArray(input.tags) ? input.tags : [],
    }).returning();

    // Format final canonical ticketNo based on sequential ID
    const formattedTicketNo = `TCK-2026-${String(inserted.id).padStart(4, '0')}`;
    await db.update(tickets)
      .set({ ticketNo: formattedTicketNo })
      .where(eq(tickets.id, inserted.id));
    inserted.ticketNo = formattedTicketNo;

    // 1. Initial History Record
    const initialHistory = await db.insert(ticketHistory).values({
      ticketId: inserted.id,
      ticketNo: formattedTicketNo,
      actorId: actor.uid || actor.id,
      actorName: actor.fullName || 'Employee',
      actorRole: actor.role || 'Employee',
      actorUserType: actor.userType || 'Operational User',
      action: 'Ticket Created',
      details: `Ticket ${formattedTicketNo} created with priority ${priority} (${priorityStars} Stars)`
    }).returning();

    // 2. Attach initial attachments if any (archived to disk in 'tickets archive/{ticketNo}/')
    const createdAttachments: TicketAttachment[] = [];
    if (input.attachments && Array.isArray(input.attachments)) {
      let fileIdx = 1;
      for (const att of input.attachments) {
        const archivedAtt = await TicketArchiveService.archiveAttachment(
          att,
          formattedTicketNo,
          inserted.title,
          fileIdx++
        );
        const [saved] = await db.insert(ticketAttachments).values({
          ticketId: inserted.id,
          ticketNo: formattedTicketNo,
          fileName: archivedAtt.fileName || att.fileName,
          fileSize: archivedAtt.fileSize || att.fileSize,
          fileType: archivedAtt.fileType || att.fileType,
          dataUrl: archivedAtt.dataUrl || archivedAtt.fileUrl || null,
          uploadedBy: actor.fullName || 'Employee'
        }).returning();

        createdAttachments.push({
          id: String(saved.id),
          fileName: saved.fileName,
          fileSize: saved.fileSize,
          fileType: saved.fileType,
          dataUrl: saved.dataUrl || undefined,
          uploadedAt: saved.createdAt ? new Date(saved.createdAt).toISOString() : new Date().toISOString(),
          uploadedBy: saved.uploadedBy
        });
      }
    }

    // 3. Auto-record into Maintenance table if this is a Hardware Maintenance ticket
    if (input.ticketType === 'Hardware Maintenance' || input.hardwareDetails) {
      try {
        let resolvedAssetId: number | null = null;
        const hw = input.hardwareDetails as any;

        // Try to match asset by ID or assetCode/deviceCode
        if (hw?.deviceId && !isNaN(Number(hw.deviceId))) {
          const directAsset = await db.select().from(assets).where(eq(assets.id, Number(hw.deviceId))).limit(1);
          if (directAsset.length > 0) {
            resolvedAssetId = directAsset[0].id;
          }
        }

        if (!resolvedAssetId && hw?.deviceCode) {
          const matchedByCode = await db.select().from(assets).where(eq(assets.assetCode, hw.deviceCode)).limit(1);
          if (matchedByCode.length > 0) {
            resolvedAssetId = matchedByCode[0].id;
          }
        }

        // If no asset found, fallback to first available asset or auto-register new asset
        if (!resolvedAssetId) {
          const firstAsset = await db.select().from(assets).limit(1);
          if (firstAsset.length > 0) {
            resolvedAssetId = firstAsset[0].id;
          } else {
            const [newAsset] = await db.insert(assets).values({
              assetCode: hw?.deviceCode || `AST-${Date.now().toString().slice(-6)}`,
              name: hw?.assetType || hw?.deviceType || 'Hardware Asset',
              category: 'electronic',
              deviceType: hw?.deviceType || 'Computer',
              brand: hw?.brand || 'Generic',
              model: hw?.model || 'Device',
              serialNumber: hw?.serialOrBarcode || null,
              department: hw?.department || actor.department || 'Information Technology',
              status: 'Under Maintenance'
            }).returning();
            resolvedAssetId = newAsset.id;
          }
        }

        if (resolvedAssetId) {
          // Document uploaded during ticket creation (stored on disk in 'ticket requests')
          const docString = processedDeptRequest ? JSON.stringify(processedDeptRequest) : null;

          await db.insert(maintenance).values({
            assetId: resolvedAssetId,
            maintenanceType: input.hardwareDeviceType || 'Hardware Maintenance',
            maintenanceDate: new Date(),
            maintenanceRequesterName: actor.fullName || actor.userName || 'Employee',
            maintenanceDescription: input.description,
            maintenanceRequestDocument: docString,
            costOfMaintenance: String((input as any).costOfMaintenance || '0.00'),
            requesterId: actor.uid || actor.id,
            ticketId: inserted.id,
            ticketNo: formattedTicketNo,
            status: 'Scheduled',
            performedBy: 'Technical Support Team'
          });
        }
      } catch (mErr: any) {
        console.warn('Notice inserting maintenance record for ticket:', mErr?.message || mErr);
      }
    }

    // 4. Trigger notifications for new ticket creation
    // 1- تنبيه في حال تنزيل بلاغ جديد
    try {
      await NotificationService.notifyNewTicket({
        id: inserted.id,
        ticketNo: formattedTicketNo,
        title: inserted.title,
        requesterId: inserted.requesterId || actor.uid || actor.id,
        requesterName: inserted.requesterName || actor.fullName || 'مستخدم',
        requesterDept: inserted.requesterDept || actor.department || 'العمليات',
        creatorActor: actor
      });
    } catch (notifErr: any) {
      console.warn('Notice sending new ticket notification:', notifErr?.message || notifErr);
    }

    return this.formatTicket(
      inserted,
      [],
      [{
        id: String(initialHistory[0].id),
        ticketId: formattedTicketNo,
        timestamp: new Date().toISOString(),
        actorName: actor.fullName || 'Employee',
        actorRole: actor.role || 'Employee',
        actorUserType: actor.userType || 'Operational User',
        action: 'Ticket Created',
        details: `Ticket ${formattedTicketNo} created with priority ${priority} (${priorityStars} Stars)`
      }],
      createdAttachments
    );
  }

  /**
   * Update ticket properties (Status, Stage, Priority, Assignee, etc.)
   */
  static async updateTicket(idOrTicketNo: string | number, updates: any, actor: any): Promise<Ticket | null> {
    const existingRow = await this.getTicketDbRow(idOrTicketNo);
    if (!existingRow) {
      return null;
    }

    const existing = await this.getTicketById(existingRow.id);
    if (!existing) {
      return null;
    }

    const numericId = existingRow.id;
    const ticketNo = existingRow.ticketNo || existing.ticketNo;
    const dbUpdates: any = {
      updatedAt: new Date()
    };

    const historyItemsToAdd: { action: string; details: string }[] = [];

    // Status change
    if (updates.status && updates.status !== existing.status) {
      dbUpdates.status = updates.status;
      historyItemsToAdd.push({
        action: 'Status Changed',
        details: `Status updated from '${existing.status}' to '${updates.status}'`
      });

      if (updates.status === 'In Progress' && !existing.respondedAt) {
        dbUpdates.respondedAt = new Date();
      }
      if (updates.status === 'Resolved' && !existing.resolvedAt) {
        dbUpdates.resolvedAt = new Date();
        dbUpdates.stage = 'Resolved';
      }
      if (updates.status === 'Closed' && !existing.closedAt) {
        dbUpdates.closedAt = new Date();
        dbUpdates.stage = 'Closed';
      }
    }

    // Stage change
    if (updates.stage && updates.stage !== existing.stage) {
      dbUpdates.stage = updates.stage;
      historyItemsToAdd.push({
        action: 'Stage Changed',
        details: `Stage advanced to '${updates.stage}'`
      });
    }

    // Priority change
    if (updates.priority && updates.priority !== existing.priority) {
      dbUpdates.priority = updates.priority;
      const settings = await this.getSystemSettings();
      const sla = this.getSlaMinutes(updates.priority, settings);
      dbUpdates.responseSlaMinutes = sla.response;
      dbUpdates.resolutionSlaMinutes = sla.resolution;

      let stars = updates.priorityStars;
      if (!stars) {
        if (updates.priority === 'Critical' || updates.priority === 'High') stars = 3;
        else if (updates.priority === 'Medium') stars = 2;
        else stars = 1;
      }
      dbUpdates.priorityStars = stars;

      historyItemsToAdd.push({
        action: 'Priority Updated',
        details: `Priority changed from '${existing.priority}' to '${updates.priority}' (${stars} Stars)`
      });
    }

    // Assignee change
    if (updates.assigneeId !== undefined) {
      dbUpdates.assigneeId = updates.assigneeId || null;
      dbUpdates.assigneeName = updates.assigneeName || null;
      dbUpdates.assigneeRole = updates.assigneeRole || null;

      if (updates.assigneeId) {
        historyItemsToAdd.push({
          action: 'Ticket Assigned',
          details: `Ticket assigned to ${updates.assigneeName || updates.assigneeId}`
        });
        if (existing.status === 'New' || existing.status === 'Open') {
          dbUpdates.status = 'In Progress';
          dbUpdates.stage = 'In Progress';
        }
      } else {
        historyItemsToAdd.push({
          action: 'Ticket Unassigned',
          details: `Ticket was unassigned`
        });
      }
    }

    // Team change
    if (updates.assignedTeam && updates.assignedTeam !== existing.assignedTeam) {
      dbUpdates.assignedTeam = updates.assignedTeam;
      historyItemsToAdd.push({
        action: 'Team Reassigned',
        details: `Assigned support team updated to '${updates.assignedTeam}'`
      });
    }

    // Title / Description
    if (updates.title) dbUpdates.title = updates.title.trim();
    if (updates.description) dbUpdates.description = updates.description;
    if (updates.category) dbUpdates.category = updates.category;
    if (updates.department) dbUpdates.department = updates.department;

    // Department Request Document (offload to disk in 'ticket requests')
    if (updates.deptRequest !== undefined) {
      const processedDeptRequest = await TicketRequestFileService.processDeptRequestDoc(updates.deptRequest, ticketNo);
      dbUpdates.deptRequest = processedDeptRequest ? JSON.stringify(processedDeptRequest) : null;
    }

    // Apply updates to tickets table
    await db.update(tickets)
      .set(dbUpdates)
      .where(eq(tickets.id, numericId));

    // Insert history entries
    for (const h of historyItemsToAdd) {
      await db.insert(ticketHistory).values({
        ticketId: numericId,
        ticketNo: ticketNo,
        actorId: actor.uid || actor.id,
        actorName: actor.fullName || 'Support Agent',
        actorRole: actor.role || 'Agent',
        actorUserType: actor.userType || 'Operational User',
        action: h.action,
        details: h.details
      });
    }

    return this.getTicketById(numericId);
  }

  /**
   * Delete ticket and all child relations
   */
  static async deleteTicket(idOrTicketNo: string | number): Promise<boolean> {
    const existingRow = await this.getTicketDbRow(idOrTicketNo);
    if (!existingRow) return false;

    await db.delete(ticketComments).where(eq(ticketComments.ticketId, existingRow.id));
    await db.delete(ticketHistory).where(eq(ticketHistory.ticketId, existingRow.id));
    await db.delete(ticketAttachments).where(eq(ticketAttachments.ticketId, existingRow.id));
    await db.delete(tickets).where(eq(tickets.id, existingRow.id));
    return true;
  }

  /**
   * Add comment to ticket
   */
  static async addComment(
    idOrTicketNo: string | number, 
    content: string, 
    isInternal: boolean, 
    actor: any
  ): Promise<TicketComment | null> {
    const row = await this.getTicketDbRow(idOrTicketNo);
    if (!row) return null;

    const numericId = row.id;
    const ticketNo = row.ticketNo || `TCK-2026-${String(numericId).padStart(4, '0')}`;

    const [comment] = await db.insert(ticketComments).values({
      ticketId: numericId,
      ticketNo: ticketNo,
      authorId: actor.uid || actor.id || 'USR-AGENT-001',
      authorName: actor.fullName || 'Support Agent',
      authorRole: actor.role || 'Agent',
      authorUserType: actor.userType || 'Operational User',
      authorEmail: actor.email || '',
      content: content.trim(),
      isInternal: Boolean(isInternal)
    }).returning();

    // Add history record
    await db.insert(ticketHistory).values({
      ticketId: numericId,
      ticketNo: ticketNo,
      actorId: actor.uid || actor.id,
      actorName: actor.fullName || 'Support Agent',
      actorRole: actor.role || 'Agent',
      actorUserType: actor.userType || 'Operational User',
      action: isInternal ? 'Internal Note Added' : 'Public Reply Sent',
      details: content.length > 80 ? content.slice(0, 80) + '...' : content
    });

    // If ticket was Open and agent responded, record respondedAt
    if (!row.respondedAt && actor.role !== 'Employee') {
      await db.update(tickets)
        .set({ respondedAt: new Date() })
        .where(eq(tickets.id, numericId));
    }

    // Trigger notification for new comment
    // 2- تنبيه في حال التعليق على بلاغ
    try {
      await NotificationService.notifyNewComment({
        ticketId: numericId,
        ticketNo: ticketNo,
        ticketTitle: row.title,
        authorId: comment.authorId,
        authorName: comment.authorName,
        content: comment.content,
        isInternal: Boolean(comment.isInternal),
        requesterId: row.requesterId || undefined,
        requesterName: row.requesterName || undefined,
        department: row.department || undefined,
        assignedToId: row.assignedTo || undefined
      });
    } catch (notifErr: any) {
      console.warn('Notice sending comment notification:', notifErr?.message || notifErr);
    }

    return {
      id: String(comment.id),
      ticketId: ticketNo,
      authorId: comment.authorId,
      authorName: comment.authorName,
      authorRole: comment.authorRole as any,
      authorUserType: comment.authorUserType as any,
      authorEmail: comment.authorEmail,
      content: comment.content,
      isInternalNote: Boolean(comment.isInternal),
      createdAt: comment.createdAt ? new Date(comment.createdAt).toISOString() : new Date().toISOString()
    };
  }

  /**
   * Add attachment to ticket
   */
  static async addAttachment(
    idOrTicketNo: string | number,
    attachment: { fileName: string; fileSize: string; fileType: string; dataUrl?: string },
    actor: any
  ): Promise<TicketAttachment | null> {
    const row = await this.getTicketDbRow(idOrTicketNo);
    if (!row) return null;

    const numericId = row.id;
    const ticketNo = row.ticketNo || `TCK-2026-${String(numericId).padStart(4, '0')}`;

    // Count existing attachments to determine next serial number
    const existingAtts = await db.select().from(ticketAttachments).where(eq(ticketAttachments.ticketId, numericId));
    const nextSeq = existingAtts.length + 1;

    const archivedAtt = await TicketArchiveService.archiveAttachment(
      attachment,
      ticketNo,
      row.title,
      nextSeq
    );

    const [saved] = await db.insert(ticketAttachments).values({
      ticketId: numericId,
      ticketNo: ticketNo,
      fileName: archivedAtt.fileName || attachment.fileName,
      fileSize: archivedAtt.fileSize || attachment.fileSize,
      fileType: archivedAtt.fileType || attachment.fileType,
      dataUrl: archivedAtt.dataUrl || archivedAtt.fileUrl || null,
      uploadedBy: actor.fullName || 'Support Agent'
    }).returning();

    await db.insert(ticketHistory).values({
      ticketId: numericId,
      ticketNo: ticketNo,
      actorId: actor.uid || actor.id,
      actorName: actor.fullName || 'Support Agent',
      actorRole: actor.role || 'Agent',
      actorUserType: actor.userType || 'Operational User',
      action: 'Attachment Uploaded',
      details: `File '${attachment.fileName}' (${attachment.fileSize}) attached`
    });

    return {
      id: String(saved.id),
      fileName: saved.fileName,
      fileSize: saved.fileSize,
      fileType: saved.fileType,
      dataUrl: saved.dataUrl || undefined,
      uploadedAt: saved.createdAt ? new Date(saved.createdAt).toISOString() : new Date().toISOString(),
      uploadedBy: saved.uploadedBy
    };
  }

  /**
   * Aggregate Metrics
   */
  static async getMetrics(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    critical: number;
    pendingCustomer: number;
    resolved: number;
    closed: number;
    slaBreached: number;
    slaComplianceRate: number;
    avgResolutionTimeHours: number;
  }> {
    const all = await this.getAllTickets();
    const total = all.length;
    const open = all.filter(t => t.status === 'Open' || t.status === 'New').length;
    const inProgress = all.filter(t => t.status === 'In Progress').length;
    const critical = all.filter(t => t.priority === 'Critical').length;
    const pendingCustomer = all.filter(t => t.status === 'Pending Customer').length;
    const resolved = all.filter(t => t.status === 'Resolved').length;
    const closed = all.filter(t => t.status === 'Closed').length;
    const slaBreached = all.filter(t => t.isResponseBreached || t.isResolutionBreached).length;

    const resolvedTickets = all.filter(t => (t.status === 'Resolved' || t.status === 'Closed') && t.resolvedAt);
    let avgHours = 4.2;
    if (resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((acc, t) => {
        const diff = (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / 3600000;
        return acc + Math.max(0.1, diff);
      }, 0);
      avgHours = Math.round((totalHours / resolvedTickets.length) * 10) / 10;
    }

    const complianceRate = total > 0 ? Math.round(((total - slaBreached) / total) * 100) : 100;

    return {
      total,
      open,
      inProgress,
      critical,
      pendingCustomer,
      resolved,
      closed,
      slaBreached,
      slaComplianceRate: complianceRate,
      avgResolutionTimeHours: avgHours
    };
  }

  /**
   * Support Teams Management
   */
  static async getSupportTeams(): Promise<SupportTeam[]> {
    const teams = await db.select().from(supportTeams).orderBy(asc(supportTeams.id));
    let techUserIds: string[] = [];
    try {
      const allUsers = await db.select().from(users);
      techUserIds = allUsers
        .filter(u => isUserTechnical(u))
        .flatMap(u => [String(u.id), u.uid].filter(Boolean) as string[]);
    } catch (_) {}

    return teams.map(t => {
      const isTechTeam = t.teamKey === 'tech-team' || t.type === 'Technical Team' || t.name.toLowerCase().includes('technical');
      const existingMembers = t.memberUserIds || [];
      const combinedMembers = isTechTeam
        ? Array.from(new Set([...existingMembers, ...techUserIds]))
        : existingMembers;

      return {
        id: t.teamKey,
        name: t.name,
        nameAr: t.nameAr,
        type: t.type as any,
        description: t.description || '',
        descriptionAr: t.descriptionAr || '',
        memberUserIds: combinedMembers,
        leadUserId: t.leadUserId || undefined,
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString()
      };
    });
  }

  static async assignUserToTeam(teamId: string, userId: string): Promise<boolean> {
    const [team] = await db.select().from(supportTeams).where(eq(supportTeams.teamKey, teamId)).limit(1);
    if (!team) return false;

    const currentMembers = team.memberUserIds || [];
    if (!currentMembers.includes(userId)) {
      await db.update(supportTeams)
        .set({ memberUserIds: [...currentMembers, userId], updatedAt: new Date() })
        .where(eq(supportTeams.id, team.id));
    }
    return true;
  }

  static async createSupportTeam(data: {
    teamKey?: string;
    name: string;
    nameAr: string;
    type?: string;
    description?: string;
    descriptionAr?: string;
    memberUserIds?: string[];
    leadUserId?: string;
  }): Promise<SupportTeam> {
    const key = data.teamKey || `team_${data.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const [inserted] = await db.insert(supportTeams).values({
      teamKey: key,
      name: data.name,
      nameAr: data.nameAr,
      type: data.type || data.name,
      description: data.description || '',
      descriptionAr: data.descriptionAr || '',
      memberUserIds: data.memberUserIds || [],
      leadUserId: data.leadUserId || null,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    return {
      id: inserted.teamKey,
      name: inserted.name,
      nameAr: inserted.nameAr,
      type: inserted.type as any,
      description: inserted.description || '',
      descriptionAr: inserted.descriptionAr || '',
      memberUserIds: inserted.memberUserIds || [],
      leadUserId: inserted.leadUserId || undefined,
      createdAt: inserted.createdAt ? new Date(inserted.createdAt).toISOString() : new Date().toISOString()
    };
  }

  static async updateSupportTeam(teamId: string, updates: {
    name?: string;
    nameAr?: string;
    type?: string;
    description?: string;
    descriptionAr?: string;
    memberUserIds?: string[];
    leadUserId?: string;
  }): Promise<SupportTeam | null> {
    const [team] = await db.select().from(supportTeams).where(eq(supportTeams.teamKey, teamId)).limit(1);
    if (!team) return null;

    const [updated] = await db.update(supportTeams)
      .set({
        ...(updates.name ? { name: updates.name } : {}),
        ...(updates.nameAr ? { nameAr: updates.nameAr } : {}),
        ...(updates.type ? { type: updates.type } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.descriptionAr !== undefined ? { descriptionAr: updates.descriptionAr } : {}),
        ...(updates.memberUserIds ? { memberUserIds: updates.memberUserIds } : {}),
        ...(updates.leadUserId !== undefined ? { leadUserId: updates.leadUserId } : {}),
        updatedAt: new Date()
      })
      .where(eq(supportTeams.id, team.id))
      .returning();

    return {
      id: updated.teamKey,
      name: updated.name,
      nameAr: updated.nameAr,
      type: updated.type as any,
      description: updated.description || '',
      descriptionAr: updated.descriptionAr || '',
      memberUserIds: updated.memberUserIds || [],
      leadUserId: updated.leadUserId || undefined,
      createdAt: updated.createdAt ? new Date(updated.createdAt).toISOString() : new Date().toISOString()
    };
  }

  static async deleteSupportTeam(teamId: string): Promise<boolean> {
    const [team] = await db.select().from(supportTeams).where(eq(supportTeams.teamKey, teamId)).limit(1);
    if (!team) return false;

    await db.delete(supportTeams).where(eq(supportTeams.id, team.id));
    return true;
  }

  static async removeUserFromTeam(teamId: string, userId: string): Promise<boolean> {
    const [team] = await db.select().from(supportTeams).where(eq(supportTeams.teamKey, teamId)).limit(1);
    if (!team) return false;

    const currentMembers = (team.memberUserIds || []).filter(id => id !== userId);
    await db.update(supportTeams)
      .set({ memberUserIds: currentMembers, updatedAt: new Date() })
      .where(eq(supportTeams.id, team.id));
    return true;
  }

  /**
   * System Settings Management
   */
  static async getSystemSettings(): Promise<SystemSettings> {
    const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, 'default')).limit(1);
    if (!settings) {
      return {
        maxPictureAttachments: 3,
        maxAttachmentSizeBytes: 5 * 1024 * 1024,
        maxAttachmentSizeMB: 5,
        allowedImageTypes: ['image/jpeg', 'image/png'],
        slaCriticalHours: 4,
        slaMediumHours: 24,
        slaLowHours: 48,
        serilogApiUrl: '',
        serilogApiKey: ''
      };
    }

    return {
      maxPictureAttachments: settings.maxPictureAttachments ?? 3,
      maxAttachmentSizeBytes: settings.maxAttachmentSizeBytes ?? 5242880,
      maxAttachmentSizeMB: settings.maxAttachmentSizeMB ?? 5,
      allowedImageTypes: settings.allowedImageTypes || ['image/jpeg', 'image/png'],
      slaCriticalHours: settings.slaCriticalHours ?? 4,
      slaMediumHours: settings.slaMediumHours ?? 24,
      slaLowHours: settings.slaLowHours ?? 48,
      serilogApiUrl: settings.serilogApiUrl || undefined,
      serilogApiKey: settings.serilogApiKey || undefined
    };
  }

  static async updateSystemSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    const dbUpdates: any = { updatedAt: new Date() };
    if (updates.maxPictureAttachments !== undefined) dbUpdates.maxPictureAttachments = updates.maxPictureAttachments;
    if (updates.maxAttachmentSizeBytes !== undefined) dbUpdates.maxAttachmentSizeBytes = updates.maxAttachmentSizeBytes;
    if (updates.maxAttachmentSizeMB !== undefined) dbUpdates.maxAttachmentSizeMB = updates.maxAttachmentSizeMB;
    if (updates.allowedImageTypes !== undefined) dbUpdates.allowedImageTypes = updates.allowedImageTypes;
    if (updates.slaCriticalHours !== undefined) dbUpdates.slaCriticalHours = updates.slaCriticalHours;
    if (updates.slaMediumHours !== undefined) dbUpdates.slaMediumHours = updates.slaMediumHours;
    if (updates.slaLowHours !== undefined) dbUpdates.slaLowHours = updates.slaLowHours;
    if (updates.serilogApiUrl !== undefined) dbUpdates.serilogApiUrl = updates.serilogApiUrl;
    if (updates.serilogApiKey !== undefined) dbUpdates.serilogApiKey = updates.serilogApiKey;

    await db.update(systemSettings)
      .set(dbUpdates)
      .where(eq(systemSettings.settingKey, 'default'));

    return this.getSystemSettings();
  }
}
