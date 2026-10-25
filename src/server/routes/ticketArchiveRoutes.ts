import express from 'express';
import path from 'path';
import fs from 'fs';
import { TICKETS_ARCHIVE_DIR } from '../services/ticketArchiveService.ts';

const router = express.Router();

/**
 * GET /api/tickets-archive/:ticketNo/:fileName
 * Serves an archived file for a ticket
 */
router.get('/:ticketNo/:fileName', (req, res) => {
  try {
    const { ticketNo, fileName } = req.params;
    if (!ticketNo || !fileName) {
      return res.status(400).json({ error: 'Ticket number and file name are required' });
    }

    const safeTicketNo = ticketNo.replace(/[\\/:*?"<>|\r\n\t]/g, '_');
    const safeFileName = path.basename(fileName);
    const filePath = path.join(TICKETS_ARCHIVE_DIR, safeTicketNo, safeFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archived file not found', path: `${safeTicketNo}/${safeFileName}` });
    }

    const ext = path.extname(safeFileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.json': 'application/json'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to serve archived file' });
  }
});

/**
 * GET /api/tickets-archive/:ticketNo
 * Lists all archived files for a ticket
 */
router.get('/:ticketNo', (req, res) => {
  try {
    const { ticketNo } = req.params;
    const safeTicketNo = ticketNo.replace(/[\\/:*?"<>|\r\n\t]/g, '_');
    const ticketFolder = path.join(TICKETS_ARCHIVE_DIR, safeTicketNo);

    if (!fs.existsSync(ticketFolder)) {
      return res.json({ success: true, data: [] });
    }

    const files = fs.readdirSync(ticketFolder).map(f => {
      const stats = fs.statSync(path.join(ticketFolder, f));
      return {
        fileName: f,
        filePath: `tickets archive/${safeTicketNo}/${f}`,
        fileUrl: `/api/tickets-archive/${encodeURIComponent(safeTicketNo)}/${encodeURIComponent(f)}`,
        sizeBytes: stats.size,
        modifiedAt: stats.mtime.toISOString()
      };
    });

    res.json({ success: true, data: files });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to list archived files' });
  }
});

export default router;
