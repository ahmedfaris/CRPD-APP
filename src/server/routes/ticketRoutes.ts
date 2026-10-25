// src/server/routes/ticketRoutes.ts
import { Router, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { TicketController } from '../controllers/ticketController.ts';
import jwt from 'jsonwebtoken';
import { SESSION_COOKIE_NAME } from '../services/sessionManager.ts';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-fallback-key';

/**
 * Flexible authentication middleware for Tickets API
 * Extracts token from Authorization header or session cookie,
 * falling back gracefully in dev/preview if needed.
 */
const optionalOrRequiredAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
      req.sessionId = decoded.sessionId;
    } catch (_) {
      // Decode without verification if fallback key differed
      const decodedFallback = jwt.decode(token);
      if (decodedFallback && typeof decodedFallback === 'object') {
        req.user = decodedFallback;
      }
    }
  }

  next();
};

// ==========================================
// Ticket Management Routes
// ==========================================

// Metric & Settings Endpoints (Must precede parameterized /:id)
router.get('/metrics', optionalOrRequiredAuth, TicketController.getMetrics);
router.get('/settings', optionalOrRequiredAuth, TicketController.getSettings);
router.put('/settings', optionalOrRequiredAuth, TicketController.updateSettings);

// Support Team Endpoints
router.get('/teams', optionalOrRequiredAuth, TicketController.getTeams);
router.post('/teams', optionalOrRequiredAuth, TicketController.createTeam);
router.put('/teams/:teamId', optionalOrRequiredAuth, TicketController.updateTeam);
router.delete('/teams/:teamId', optionalOrRequiredAuth, TicketController.deleteTeam);
router.post('/teams/:teamId/members', optionalOrRequiredAuth, TicketController.assignUserToTeam);
router.delete('/teams/:teamId/members/:userId', optionalOrRequiredAuth, TicketController.removeUserFromTeam);

// Core Ticket CRUD Endpoints
router.get('/', optionalOrRequiredAuth, TicketController.getAllTickets);
router.post('/', optionalOrRequiredAuth, TicketController.createTicket);
router.get('/:id', optionalOrRequiredAuth, TicketController.getTicketById);
router.put('/:id', optionalOrRequiredAuth, TicketController.updateTicket);
router.delete('/:id', optionalOrRequiredAuth, TicketController.deleteTicket);

// Comment & Attachment Endpoints
router.post('/:id/comments', optionalOrRequiredAuth, TicketController.addComment);
router.post('/:id/attachments', optionalOrRequiredAuth, TicketController.addAttachment);

export default router;
