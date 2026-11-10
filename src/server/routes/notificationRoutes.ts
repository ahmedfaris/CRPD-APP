// src/server/routes/notificationRoutes.ts
import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { NotificationService } from '../services/notificationService.ts';

const router = Router();

/**
 * GET /api/notifications
 * Fetch notifications for current user
 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Always scope to the authenticated user; query parameters cannot select another user's inbox.
    const userId = req.user?.uid || req.user?.id || req.user?.sub;
    const email = req.user?.email;

    if (!userId && !email) {
      return res.json({ notifications: [], unreadCount: 0 });
    }

    const items = await NotificationService.getUserNotifications(userId, email);
    const unreadCount = items.filter((n) => !n.isRead).length;

    res.json({
      notifications: items,
      unreadCount
    });
  } catch (err: any) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
router.patch('/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.uid || req.user?.id;
    const success = await NotificationService.markAsRead(id, userId);
    res.json({ success });
  } catch (err: any) {
    console.error('Error marking notification read:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for user
 */
router.post('/mark-all-read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const success = await NotificationService.markAllAsRead(userId);
    res.json({ success });
  } catch (err: any) {
    console.error('Error marking all notifications read:', err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.uid || req.user?.id;
    const success = await NotificationService.deleteNotification(id, userId);
    res.json({ success });
  } catch (err: any) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * POST /api/notifications/clear-all
 * Clear all notifications for user
 */
router.post('/clear-all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const success = await NotificationService.clearAll(userId);
    res.json({ success });
  } catch (err: any) {
    console.error('Error clearing notifications:', err);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

export default router;
