import { Router } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { logger } from '../utils/logger.ts';
import { SessionManager } from '../services/sessionManager.ts';
import { db } from '../../db/index.ts';
import { userSessions } from '../../db/schema.ts';
import { desc, eq } from 'drizzle-orm';

const router = Router();

// Middleware: Require Admin
const requireAdmin = (req: AuthRequest, res: any, next: any) => {
  if (req.user?.role !== 'Admin' && req.user?.email !== 'admin@system.local') {
    return res.status(403).json({ error: 'Requires Administrator privileges' });
  }
  next();
};

/**
 * GET /api/system/serilog-logs
 * Retrieves real structured Serilog events recorded by the backend
 */
router.get('/serilog-logs', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const filterSubsystem = req.query.subsystem as string;
    const filterAction = req.query.action as string;
    const filterLevel = req.query.level as string;
    const search = (req.query.search as string)?.toLowerCase();

    let logs = logger.getRecentLogs(limit * 2);

    if (filterSubsystem) {
      logs = logs.filter(l => l.Properties?.Subsystem === filterSubsystem);
    }
    if (filterAction) {
      logs = logs.filter(l => l.Properties?.Action === filterAction);
    }
    if (filterLevel) {
      logs = logs.filter(l => l.Level.toLowerCase() === filterLevel.toLowerCase());
    }
    if (search) {
      logs = logs.filter(l => 
        l.RenderedMessage.toLowerCase().includes(search) ||
        l.MessageTemplate.toLowerCase().includes(search) ||
        JSON.stringify(l.Properties).toLowerCase().includes(search)
      );
    }

    res.json({
      success: true,
      data: logs.slice(0, limit),
      totalRetrieved: logs.length
    });
  } catch (error: any) {
    logger.error('Failed to retrieve Serilog logs: {ErrorMessage}', {
      ErrorMessage: error.message,
      Action: 'RetrieveLogsFailed'
    });
    res.status(500).json({ success: false, error: 'Failed to retrieve logs' });
  }
});

/**
 * POST /api/system/serilog-logs/clear
 * Clears the server-side log file
 */
router.post('/serilog-logs/clear', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    logger.clearLogs();
    logger.information('Serilog logs cleared by administrator {AdminUser}', {
      AdminUser: req.user?.email || 'Admin',
      Action: 'LogsCleared',
      Subsystem: 'LoggingService'
    });
    res.json({ success: true, message: 'Logs cleared successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to clear logs' });
  }
});

/**
 * GET /api/system/sessions
 * Retrieves all user sessions with status and metadata
 */
router.get('/sessions', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const sessions = await db
      .select()
      .from(userSessions)
      .orderBy(desc(userSessions.createdAt))
      .limit(100);

    res.json({
      success: true,
      data: sessions
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve sessions' });
  }
});

/**
 * POST /api/system/sessions/terminate
 * Admin explicitly terminates an active user session
 */
router.post('/sessions/terminate', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { sessionId, userUid } = req.body;
    if (!sessionId && !userUid) {
      return res.status(400).json({ success: false, error: 'Session ID or User UID is required' });
    }

    if (sessionId) {
      await SessionManager.destroySession(sessionId, 'ADMIN_REVOKED');
      logger.warning('Session {SessionId} revoked by administrator {AdminUser}', {
        SessionId: sessionId,
        AdminUser: req.user?.email || 'Admin',
        Action: 'AdminRevokedSession',
        Subsystem: 'SessionManagement'
      });
    } else if (userUid) {
      const count = await SessionManager.invalidateAllUserSessions(userUid, 'ADMIN_REVOKED');
      logger.warning('All sessions ({Count}) for user {UserUid} revoked by administrator {AdminUser}', {
        UserUid: userUid,
        Count: count,
        AdminUser: req.user?.email || 'Admin',
        Action: 'AdminRevokedAllUserSessions',
        Subsystem: 'SessionManagement'
      });
    }

    res.json({ success: true, message: 'Session(s) terminated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to terminate session' });
  }
});

export default router;
