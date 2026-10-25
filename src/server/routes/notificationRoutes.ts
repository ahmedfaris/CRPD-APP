// src/server/routes/notificationRoutes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notificationService.ts';
import jwt from 'jsonwebtoken';
import { SESSION_COOKIE_NAME } from '../services/sessionManager.ts';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-fallback-key';

interface AuthRequest extends Request {
  user?: any;
}

const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  } else if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    token = req.cookies[SESSION_COOKIE_NAME];
  }

  if (token) {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (_) {
      const decodedFallback = jwt.decode(token);
      if (decodedFallback && typeof decodedFallback === 'object') {
        req.user = decodedFallback;
      }
    }
  }

  next();
};

/**
 * GET /api/notifications
 * Fetch notifications for current user
 */
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.query.userId as string) || req.user?.uid || req.user?.id || req.user?.sub;
    const email = (req.query.email as string) || req.user?.email;

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
router.patch('/:id/read', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = (req.query.userId as string) || req.user?.uid || req.user?.id;
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
router.post('/mark-all-read', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.body.userId as string) || (req.query.userId as string) || req.user?.uid || req.user?.id;
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
router.delete('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = (req.query.userId as string) || req.user?.uid || req.user?.id;
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
router.post('/clear-all', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.body.userId as string) || (req.query.userId as string) || req.user?.uid || req.user?.id;
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
