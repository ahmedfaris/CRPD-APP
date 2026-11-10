import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";

// Import our MVC Routes
import userRoutes from './src/server/routes/userRoutes.ts';

import authRoutes from './src/server/routes/authRoutes.ts';
import roleRoutes from './src/server/routes/roleRoutes.ts';
import departmentRoutes from './src/server/routes/departmentRoutes.ts';
import databaseRoutes from './src/server/routes/databaseRoutes.ts';
import systemRoutes from './src/server/routes/systemRoutes.ts';
import ticketRoutes from './src/server/routes/ticketRoutes.ts';
import deviceRoutes from './src/server/routes/deviceRoutes.ts';
import maintenanceRoutes from './src/server/routes/maintenanceRoutes.ts';
import assetRoutes from './src/server/routes/assetRoutes.ts';
import ticketRequestRoutes from './src/server/routes/ticketRequestRoutes.ts';
import ticketArchiveRoutes from './src/server/routes/ticketArchiveRoutes.ts';
import notificationRoutes from './src/server/routes/notificationRoutes.ts';
import { requireAuth } from './src/middleware/auth.ts';
import { TicketRequestFileService, TICKET_REQUESTS_DIR } from './src/server/services/ticketRequestFileService.ts';
import { TicketArchiveService, TICKETS_ARCHIVE_DIR } from './src/server/services/ticketArchiveService.ts';
import { NotificationService } from './src/server/services/notificationService.ts';
import { seedDatabaseIfEmpty } from './src/db/seed.ts';
import { initTicketTables } from './src/server/db/initTicketTables.ts';
import { seedTicketsIfEmpty } from './src/server/db/seedTickets.ts';

async function startServer() {
  // Ensure tables exist first, then seed defaults in sequence
  try {
    await initTicketTables();
    await seedDatabaseIfEmpty();
    await seedTicketsIfEmpty();
    await TicketRequestFileService.init();
    await TicketArchiveService.init();
    await NotificationService.seedInitialNotificationsIfEmpty();
  } catch (err) {
    console.warn('Database initialization / seed notice:', err);
  }

  const app = express();
  const server = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Middleware with expanded JSON payload limits for file uploads
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Static disk folder serving for ticket requests and tickets archive
  app.use('/ticket requests', requireAuth, express.static(TICKET_REQUESTS_DIR));
  app.use('/ticket-requests', requireAuth, express.static(TICKET_REQUESTS_DIR));
  app.use('/tickets archive', requireAuth, express.static(TICKETS_ARCHIVE_DIR));
  app.use('/tickets-archive', requireAuth, express.static(TICKETS_ARCHIVE_DIR));

  // ==========================================
  // API Routes (Backend MVC)
  // ==========================================
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", backend: "Node.js MVC Active" });
  });

  // Mount the User routes
  app.use("/api/users", userRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/roles", roleRoutes);
  app.use("/api/departments", departmentRoutes);
  app.use("/api/database", databaseRoutes);
  app.use("/api/system", systemRoutes);
  app.use("/api/tickets", ticketRoutes);
  app.use("/api/devices", deviceRoutes);
  app.use("/api/maintenance", maintenanceRoutes);
  app.use("/api/assets", assetRoutes);
  app.use("/api/ticket-requests", ticketRequestRoutes);
  app.use("/api/tickets-archive", ticketArchiveRoutes);
  app.use("/api/notifications", notificationRoutes);

  // 404 handler for unmatched /api routes - strictly prevents falling through to Vite HTML
  app.use('/api', (req, res) => {
    res.status(404).json({
      error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
      code: 'API_ENDPOINT_NOT_FOUND'
    });
  });

  // Global Error Handler for API routes
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled API Error:', err);
    res.status(500).json({
      error: err?.message || 'An internal server error occurred.',
      code: 'INTERNAL_SERVER_ERROR'
    });
  });

  // ==========================================
  // Vite Middleware (Frontend serving)
  // ==========================================
  
  if (process.env.NODE_ENV !== "production") {
    // In Development, let Vite handle frontend serving, attaching HMR directly to the HTTP server
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In Production, serve the static compiled dist/ directory
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Node.js MVC Backend server running on port ${PORT}`);
  });
}

startServer();
