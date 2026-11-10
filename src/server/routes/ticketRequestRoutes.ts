// src/server/routes/ticketRequestRoutes.ts
import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../../middleware/auth.ts';
import { 
  TICKET_REQUESTS_DIR, 
  TICKET_REQUESTS_FOLDER_NAME,
  TicketRequestFileService, 
  sanitizeFileName,
  formatFileSize
} from '../services/ticketRequestFileService.ts';

const router = Router();

// Ticket request files contain internal request details; only signed-in users may access them.
router.use(requireAuth);

/**
 * MIME type lookup based on file extension
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.txt':
      return 'text/plain';
    case '.doc':
      return 'application/msword';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return 'application/octet-stream';
  }
}

/**
 * GET /api/ticket-requests/stats
 * Summary statistics about files saved on disk in 'ticket requests'
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const files = await TicketRequestFileService.listStoredFiles();
    const totalBytes = files.reduce((acc, f) => acc + f.sizeBytes, 0);

    res.json({
      success: true,
      folderName: TICKET_REQUESTS_FOLDER_NAME,
      folderPath: TICKET_REQUESTS_DIR,
      totalFiles: files.length,
      totalSizeBytes: totalBytes,
      totalFormattedSize: formatFileSize(totalBytes),
      files: files.slice(0, 50),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ticket-requests
 * List files stored in the 'ticket requests' directory
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const files = await TicketRequestFileService.listStoredFiles();
    res.json({
      success: true,
      folder: TICKET_REQUESTS_FOLDER_NAME,
      count: files.length,
      files,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/ticket-requests/upload
 * Endpoint to upload a ticket request document directly to disk in 'ticket requests'
 */
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { 
      fileName, 
      fileData, 
      requestNumber, 
      requestDate, 
      source,
      ticketNo 
    } = req.body;

    if (!fileData) {
      return res.status(400).json({
        success: false,
        error: 'No file data provided. Expected base64 string or data URL in fileData field.',
      });
    }

    const originalName = fileName || `request_${Date.now()}.pdf`;
    const prefix = ticketNo || (requestNumber ? `req_${requestNumber}` : 'req');

    const saved = await TicketRequestFileService.saveFileToDisk(fileData, originalName, prefix);

    res.status(201).json({
      success: true,
      message: `File saved successfully on disk in folder "${TICKET_REQUESTS_FOLDER_NAME}"`,
      data: {
        requestNumber: requestNumber || 'REQ-OFFICIAL',
        requestDate: requestDate || new Date().toISOString().split('T')[0],
        fileName: originalName,
        savedFileName: saved.savedFileName,
        fileSize: saved.fileSize,
        fileType: saved.fileType,
        source: source || 'PC Upload',
        filePath: saved.filePath,
        fileUrl: saved.fileUrl,
        dataUrl: saved.fileUrl, // Points to disk download endpoint
        storageType: 'disk',
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Error uploading ticket request document to disk:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to save document to disk',
    });
  }
});

/**
 * GET /api/ticket-requests/:fileName
 * Serve or download a document from the disk folder 'ticket requests'
 */
router.get('/:fileName', (req: Request, res: Response) => {
  try {
    const rawParam = req.params.fileName;
    const rawFileName = Array.isArray(rawParam) ? rawParam[0] : rawParam;
    if (!rawFileName) {
      return res.status(400).json({ error: 'Missing file name' });
    }

    const decodedFileName = decodeURIComponent(rawFileName);
    const sanitized = path.basename(decodedFileName);

    // Resolve full path safely to ensure it stays within TICKET_REQUESTS_DIR
    const targetFilePath = path.resolve(TICKET_REQUESTS_DIR, sanitized);

    if (!targetFilePath.startsWith(path.resolve(TICKET_REQUESTS_DIR))) {
      return res.status(403).json({ error: 'Access denied: Directory traversal prevented' });
    }

    if (!fs.existsSync(targetFilePath)) {
      return res.status(404).json({
        error: `Document "${sanitized}" not found on disk in folder "${TICKET_REQUESTS_FOLDER_NAME}"`,
        code: 'FILE_NOT_FOUND',
      });
    }

    const mime = getMimeType(targetFilePath);
    res.setHeader('Content-Type', mime);

    // If query parameter ?download=1 is present, trigger browser download
    if (req.query.download === '1' || req.query.download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${sanitized}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${sanitized}"`);
    }

    // Stream file from disk to client
    const fileStream = fs.createReadStream(targetFilePath);
    fileStream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to stream file from disk' });
  }
});

export default router;
