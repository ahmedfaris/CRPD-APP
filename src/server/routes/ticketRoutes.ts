// src/server/routes/ticketRoutes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { TicketController } from '../controllers/ticketController.ts';

const router = Router();

// ==========================================
// Ticket Management Routes
// ==========================================

// Metric & Settings Endpoints (Must precede parameterized /:id)
router.get('/metrics', requireAuth, TicketController.getMetrics);
router.get('/settings', requireAuth, TicketController.getSettings);
router.put('/settings', requireAuth, TicketController.updateSettings);

// Support Team Endpoints
router.get('/teams', requireAuth, TicketController.getTeams);
router.post('/teams', requireAuth, TicketController.createTeam);
router.put('/teams/:teamId', requireAuth, TicketController.updateTeam);
router.delete('/teams/:teamId', requireAuth, TicketController.deleteTeam);
router.post('/teams/:teamId/members', requireAuth, TicketController.assignUserToTeam);
router.delete('/teams/:teamId/members/:userId', requireAuth, TicketController.removeUserFromTeam);

// Core Ticket CRUD Endpoints
router.get('/', requireAuth, TicketController.getAllTickets);
router.post('/', requireAuth, TicketController.createTicket);
router.get('/:id', requireAuth, TicketController.getTicketById);
router.put('/:id', requireAuth, TicketController.updateTicket);
router.delete('/:id', requireAuth, TicketController.deleteTicket);

// Comment & Attachment Endpoints
router.post('/:id/comments', requireAuth, TicketController.addComment);
router.post('/:id/attachments', requireAuth, TicketController.addAttachment);

export default router;
