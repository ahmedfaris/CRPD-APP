import { db } from '../../db/index.ts';
import { userNotifications, users, tickets } from '../../db/schema.ts';
import { eq, desc, and, or } from 'drizzle-orm';
import { UserNotification, NotificationType, isUserTechnical } from '../../types.ts';

export class NotificationService {
  /**
   * Get notifications for a user by their user ID or email
   */
  static async getUserNotifications(userId: string, email?: string): Promise<UserNotification[]> {
    try {
      if (!userId && !email) return [];

      let rows: any[] = [];
      const cleanUserId = userId ? String(userId).trim() : '';
      const cleanEmail = email ? email.trim().toLowerCase() : '';

      if (cleanUserId && cleanEmail) {
        rows = await db
          .select()
          .from(userNotifications)
          .where(or(eq(userNotifications.userId, cleanUserId), eq(userNotifications.userEmail, cleanEmail)))
          .orderBy(desc(userNotifications.createdAt))
          .limit(100);
      } else if (cleanUserId) {
        rows = await db
          .select()
          .from(userNotifications)
          .where(eq(userNotifications.userId, cleanUserId))
          .orderBy(desc(userNotifications.createdAt))
          .limit(100);
      } else if (cleanEmail) {
        rows = await db
          .select()
          .from(userNotifications)
          .where(eq(userNotifications.userEmail, cleanEmail))
          .orderBy(desc(userNotifications.createdAt))
          .limit(100);
      }

      return rows.map((r: any) => ({
        id: r.id,
        userId: r.userId,
        userEmail: r.userEmail || undefined,
        type: r.type as NotificationType,
        titleAr: r.titleAr,
        titleEn: r.titleEn,
        messageAr: r.messageAr,
        messageEn: r.messageEn,
        ticketId: r.ticketId || undefined,
        ticketTitle: r.ticketTitle || undefined,
        isRead: Boolean(r.isRead),
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString()
      }));
    } catch (err: any) {
      console.warn('Error fetching user notifications:', err?.message || err);
      return [];
    }
  }

  /**
   * Create a notification record for a specific user
   */
  static async createNotification(data: {
    userId: string;
    userEmail?: string;
    type: NotificationType;
    titleAr: string;
    titleEn: string;
    messageAr: string;
    messageEn: string;
    ticketId?: string;
    ticketTitle?: string;
  }): Promise<UserNotification | null> {
    try {
      const [inserted] = await db.insert(userNotifications).values({
        userId: data.userId,
        userEmail: data.userEmail || null,
        type: data.type,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        messageAr: data.messageAr,
        messageEn: data.messageEn,
        ticketId: data.ticketId || null,
        ticketTitle: data.ticketTitle || null,
        isRead: false
      }).returning();

      return {
        id: inserted.id,
        userId: inserted.userId,
        userEmail: inserted.userEmail || undefined,
        type: inserted.type as NotificationType,
        titleAr: inserted.titleAr,
        titleEn: inserted.titleEn,
        messageAr: inserted.messageAr,
        messageEn: inserted.messageEn,
        ticketId: inserted.ticketId || undefined,
        ticketTitle: inserted.ticketTitle || undefined,
        isRead: Boolean(inserted.isRead),
        createdAt: inserted.createdAt ? new Date(inserted.createdAt).toISOString() : new Date().toISOString()
      };
    } catch (err: any) {
      console.warn('Error creating notification:', err?.message || err);
      return null;
    }
  }

  /**
   * Trigger notifications when a NEW TICKET is submitted
   * 1- تنبيه في حال تنزيل بلاغ جديد
   * Notifies all relevant users (agents, admins, team members) and confirms to creator
   */
  static async notifyNewTicket(ticket: {
    id: string | number;
    ticketNo: string;
    title: string;
    requesterId?: string;
    requesterName?: string;
    requesterDept?: string;
    creatorActor?: any;
  }) {
    try {
      const allUsers = await db.select().from(users);
      const requesterId = ticket.requesterId || ticket.creatorActor?.uid || ticket.creatorActor?.id;
      const requesterName = ticket.requesterName || ticket.creatorActor?.fullName || 'مستخدم';
      const deptName = ticket.requesterDept || ticket.creatorActor?.department || 'القسم الفني';

      for (const u of allUsers) {
        const uId = u.uid || String(u.id);
        const isCreator = (u.uid && u.uid === requesterId) || (String(u.id) === String(requesterId)) || (u.email && ticket.creatorActor?.email === u.email);

        if (isCreator) {
          // Notification to the requester / creator: Confirmation of ticket submission
          await this.createNotification({
            userId: uId,
            userEmail: u.email,
            type: 'NEW_TICKET',
            titleAr: `تم استلام البلاغ: ${ticket.ticketNo}`,
            titleEn: `Ticket Received: ${ticket.ticketNo}`,
            messageAr: `تم تقديم بلاغك "${ticket.title}" بنجاح وجارٍ مراجعته من قبل الفريق المختص.`,
            messageEn: `Your ticket "${ticket.title}" was submitted successfully and is being reviewed by the team.`,
            ticketId: ticket.ticketNo,
            ticketTitle: ticket.title
          });
        } else {
          const isTech = isUserTechnical(u);

          await this.createNotification({
            userId: uId,
            userEmail: u.email,
            type: 'NEW_TICKET',
            titleAr: isTech ? `بلاغ فني جديد: ${ticket.ticketNo}` : `بلاغ جديد: ${ticket.ticketNo}`,
            titleEn: isTech ? `New Technical Ticket: ${ticket.ticketNo}` : `New Ticket: ${ticket.ticketNo}`,
            messageAr: isTech 
              ? `تم تقديم بلاغ جديد "${ticket.title}" بواسطة ${requesterName} (${deptName}) ومُحال إلى الفريق الفني.`
              : `تم إنشاء بلاغ جديد "${ticket.title}" بواسطة ${requesterName} (${deptName}).`,
            messageEn: isTech 
              ? `A new ticket "${ticket.title}" was submitted by ${requesterName} (${deptName}) and dispatched to the Technical Team.`
              : `A new ticket "${ticket.title}" was created by ${requesterName} (${deptName}).`,
            ticketId: ticket.ticketNo,
            ticketTitle: ticket.title
          });
        }
      }
    } catch (err: any) {
      console.warn('Error sending new ticket notifications:', err?.message || err);
    }
  }

  /**
   * Trigger notifications when a COMMENT is added to a ticket
   * 2- تنبيه في حال التعليق على بلاغ
   * Notifies the ticket requester, assignee, and relevant stakeholders
   */
  static async notifyNewComment(comment: {
    ticketId: string | number;
    ticketNo: string;
    ticketTitle: string;
    authorId: string;
    authorName: string;
    content: string;
    isInternal?: boolean;
    requesterId?: string;
    requesterName?: string;
    department?: string;
    assignedToId?: string;
  }) {
    try {
      const preview = comment.content.length > 80 
        ? comment.content.slice(0, 80) + '...' 
        : comment.content;

      const allUsers = await db.select().from(users);

      for (const u of allUsers) {
        // Skip notifying the person who posted the comment
        if (
          u.uid === comment.authorId || 
          (comment.authorId && u.uid && u.uid.toString() === comment.authorId.toString()) ||
          (comment.authorName && u.fullName && u.fullName.trim() === comment.authorName.trim())
        ) {
          continue;
        }

        const isRequester = 
          (comment.requesterId && (u.uid === comment.requesterId || u.userName === comment.requesterId || u.email === comment.requesterId)) ||
          (comment.requesterName && u.fullName && u.fullName.trim() === comment.requesterName.trim());

        const isAssignee = comment.assignedToId && (u.uid === comment.assignedToId || u.fullName === comment.assignedToId);
        const isAdminOrAgent = u.role === 'Admin' || u.role === 'Agent';
        const isSameDept = comment.department && u.department && comment.department.toLowerCase() === u.department.toLowerCase();

        // Internal notes should only notify agents/admins, not standard employees
        if (comment.isInternal && !isAdminOrAgent) {
          continue;
        }

        // Send notification to participants, same department members, and admins/agents
        if (isRequester || isAssignee || isAdminOrAgent || isSameDept) {
          const titleAr = isRequester
            ? `تعليق جديد على بلاغك: ${comment.ticketNo}`
            : isAssignee
            ? `تعليق جديد على البلاغ المكلف به: ${comment.ticketNo}`
            : `تعليق جديد على البلاغ: ${comment.ticketNo}`;

          const titleEn = isRequester
            ? `New comment on your ticket: ${comment.ticketNo}`
            : isAssignee
            ? `New comment on assigned ticket: ${comment.ticketNo}`
            : `New comment on ticket: ${comment.ticketNo}`;

          await this.createNotification({
            userId: u.uid,
            userEmail: u.email,
            type: 'NEW_COMMENT',
            titleAr,
            titleEn,
            messageAr: `أضاف ${comment.authorName} تعليقاً على "${comment.ticketTitle}": "${preview}"`,
            messageEn: `${comment.authorName} commented on "${comment.ticketTitle}": "${preview}"`,
            ticketId: comment.ticketNo,
            ticketTitle: comment.ticketTitle
          });
        }
      }
    } catch (err: any) {
      console.warn('Error sending comment notifications:', err?.message || err);
    }
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(notificationId: number | string, userId?: string) {
    try {
      const idNum = Number(notificationId);
      if (isNaN(idNum)) return false;

      let query = db.update(userNotifications).set({ isRead: true });
      if (userId) {
        await query.where(and(eq(userNotifications.id, idNum), eq(userNotifications.userId, userId)));
      } else {
        await query.where(eq(userNotifications.id, idNum));
      }
      return true;
    } catch (err: any) {
      console.warn('Error marking notification as read:', err?.message || err);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string) {
    try {
      if (!userId) return false;
      await db
        .update(userNotifications)
        .set({ isRead: true })
        .where(eq(userNotifications.userId, userId));
      return true;
    } catch (err: any) {
      console.warn('Error marking all notifications read:', err?.message || err);
      return false;
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId: number | string, userId?: string) {
    try {
      const idNum = Number(notificationId);
      if (isNaN(idNum)) return false;

      let query = db.delete(userNotifications);
      if (userId) {
        await query.where(and(eq(userNotifications.id, idNum), eq(userNotifications.userId, userId)));
      } else {
        await query.where(eq(userNotifications.id, idNum));
      }
      return true;
    } catch (err: any) {
      console.warn('Error deleting notification:', err?.message || err);
      return false;
    }
  }

  /**
   * Clear all notifications for a user
   */
  static async clearAll(userId: string) {
    try {
      if (!userId) return false;
      await db.delete(userNotifications).where(eq(userNotifications.userId, userId));
      return true;
    } catch (err: any) {
      console.warn('Error clearing notifications:', err?.message || err);
      return false;
    }
  }

  /**
   * Seed sample notifications if table is completely empty
   */
  static async seedInitialNotificationsIfEmpty() {
    // Clean state for export: no dummy notifications
  }
}
