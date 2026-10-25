// src/server/services/ticketRequestFileService.ts
import fs from 'fs';
import path from 'path';
import { db } from '../../db/index.ts';
import { tickets, maintenance, ticketAttachments } from '../../db/schema.ts';
import { eq, sql } from 'drizzle-orm';
import { DepartmentRequestDoc } from '../../types.ts';

// Folder path: 'ticket requests' on disk
export const TICKET_REQUESTS_FOLDER_NAME = 'ticket requests';
export const TICKET_REQUESTS_DIR = path.join(process.cwd(), TICKET_REQUESTS_FOLDER_NAME);

/**
 * Creates a minimal valid PDF buffer for placeholder/sample records
 */
function createMinimalPdfBuffer(title: string, subtitle: string): Buffer {
  const sanitizedTitle = title.replace(/[()\\]/g, '');
  const sanitizedSubtitle = subtitle.replace(/[()\\]/g, '');
  const stream = `BT /F1 16 Tf 50 740 Td (${sanitizedTitle}) Tj 0 -30 Td /F1 10 Tf (${sanitizedSubtitle}) Tj 0 -20 Td (Official Stored On Disk: ticket requests/) Tj ET`;
  const streamLength = Buffer.byteLength(stream);
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${streamLength} >> stream
${stream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000234 00000 n 
0000000300 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
370
%%EOF`;
  return Buffer.from(pdf);
}

/**
 * Formats byte size into human readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Sanitizes original filename to prevent path traversal
 */
export function sanitizeFileName(originalName: string): string {
  const base = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base || 'document.pdf';
}

export class TicketRequestFileService {
  /**
   * Initializes the 'ticket requests' directory on disk and seeds sample PDFs if missing
   */
  static async init(): Promise<void> {
    try {
      if (!fs.existsSync(TICKET_REQUESTS_DIR)) {
        fs.mkdirSync(TICKET_REQUESTS_DIR, { recursive: true });
        console.log(`📁 Created disk directory: "${TICKET_REQUESTS_FOLDER_NAME}" (${TICKET_REQUESTS_DIR})`);
      }
      // Check and migrate any legacy Base64 files in the DB to disk
      await this.migrateLegacyDbBase64ToDisk();
    } catch (err: any) {
      console.warn('⚠️ Notice during TicketRequestFileService.init:', err?.message || err);
    }
  }

  /**
   * Saves a Base64 data URL or raw buffer directly to disk in 'ticket requests'
   */
  static async saveFileToDisk(
    fileData: string | Buffer,
    originalFileName: string,
    prefix: string = 'req'
  ): Promise<{
    fileName: string;
    savedFileName: string;
    filePath: string;
    fileUrl: string;
    fileSize: string;
    fileType: string;
    byteSize: number;
  }> {
    if (!fs.existsSync(TICKET_REQUESTS_DIR)) {
      fs.mkdirSync(TICKET_REQUESTS_DIR, { recursive: true });
    }

    let buffer: Buffer;
    let mimeType = 'application/pdf';

    if (Buffer.isBuffer(fileData)) {
      buffer = fileData;
    } else if (typeof fileData === 'string') {
      if (fileData.startsWith('data:')) {
        const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          buffer = Buffer.from(fileData, 'base64');
        }
      } else {
        buffer = Buffer.from(fileData, 'base64');
      }
    } else {
      throw new Error('Invalid fileData format provided to saveFileToDisk');
    }

    const cleanName = sanitizeFileName(originalFileName);
    const timestamp = Date.now();
    const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
    const savedFileName = `${cleanPrefix}_${timestamp}_${cleanName}`;
    const destinationPath = path.join(TICKET_REQUESTS_DIR, savedFileName);

    await fs.promises.writeFile(destinationPath, buffer);

    const relativePath = `${TICKET_REQUESTS_FOLDER_NAME}/${savedFileName}`;
    const fileUrl = `/api/ticket-requests/${encodeURIComponent(savedFileName)}`;

    return {
      fileName: originalFileName || cleanName,
      savedFileName,
      filePath: relativePath,
      fileUrl,
      fileSize: formatFileSize(buffer.length),
      fileType: mimeType,
      byteSize: buffer.length,
    };
  }

  /**
   * Processes a DepartmentRequestDoc object. If it contains a large Base64 dataUrl,
   * saves it to disk inside 'ticket requests' and strips the Base64 out of the database object.
   */
  static async processDeptRequestDoc(
    deptDoc: any,
    ticketNoPrefix: string = 'TCK'
  ): Promise<DepartmentRequestDoc | null> {
    if (!deptDoc) return null;

    try {
      const parsed = typeof deptDoc === 'string' ? JSON.parse(deptDoc) : deptDoc;
      if (!parsed) return null;

      // If it already points to a saved file on disk without base64, return normalized
      if (parsed.filePath && parsed.fileUrl && !parsed.dataUrl?.startsWith('data:')) {
        return {
          ...parsed,
          storageType: 'disk',
          dataUrl: parsed.fileUrl, // Ensure dataUrl matches fileUrl for seamless compatibility
        };
      }

      // If dataUrl contains base64, extract and save to disk
      if (parsed.dataUrl && parsed.dataUrl.startsWith('data:')) {
        const saved = await this.saveFileToDisk(
          parsed.dataUrl,
          parsed.fileName || 'department_request.pdf',
          ticketNoPrefix
        );

        return {
          requestNumber: parsed.requestNumber || 'REQ-OFFICIAL',
          requestDate: parsed.requestDate || new Date().toISOString().split('T')[0],
          fileName: parsed.fileName || saved.fileName,
          fileSize: saved.fileSize || parsed.fileSize,
          fileType: 'application/pdf',
          source: parsed.source || 'PC Upload',
          scannedAt: parsed.scannedAt || undefined,
          uploadedAt: parsed.uploadedAt || new Date().toISOString(),
          filePath: saved.filePath,
          fileUrl: saved.fileUrl,
          dataUrl: saved.fileUrl, // Points to HTTP disk serving endpoint, not Base64!
          storageType: 'disk',
        };
      }

      // If file has fileName but no dataUrl (e.g. sample or metadata), ensure disk reference
      const candidatePath = path.join(TICKET_REQUESTS_DIR, sanitizeFileName(parsed.fileName || 'doc.pdf'));
      const relativePath = `${TICKET_REQUESTS_FOLDER_NAME}/${sanitizeFileName(parsed.fileName || 'doc.pdf')}`;
      const fileUrl = `/api/ticket-requests/${encodeURIComponent(sanitizeFileName(parsed.fileName || 'doc.pdf'))}`;

      return {
        ...parsed,
        filePath: parsed.filePath || relativePath,
        fileUrl: parsed.fileUrl || fileUrl,
        dataUrl: parsed.fileUrl || fileUrl,
        storageType: 'disk',
      };
    } catch (err: any) {
      console.warn('Error processing dept request doc for disk storage:', err?.message || err);
      return deptDoc;
    }
  }

  /**
   * Processes a Maintenance Request Document. If Base64, saves to disk in 'ticket requests'
   */
  static async processMaintenanceDoc(
    doc: any,
    ticketNoPrefix: string = 'MNT'
  ): Promise<string | null> {
    if (!doc) return null;

    try {
      const parsed = typeof doc === 'string' ? JSON.parse(doc) : doc;
      if (!parsed) return null;

      if (typeof parsed === 'object') {
        const processed = await this.processDeptRequestDoc(parsed, ticketNoPrefix);
        return JSON.stringify(processed);
      }

      // If it's a raw base64 string
      if (typeof parsed === 'string' && parsed.startsWith('data:')) {
        const saved = await this.saveFileToDisk(parsed, 'maintenance_doc.pdf', ticketNoPrefix);
        return JSON.stringify({
          fileName: saved.fileName,
          fileSize: saved.fileSize,
          fileType: saved.fileType,
          source: 'PC Upload',
          filePath: saved.filePath,
          fileUrl: saved.fileUrl,
          dataUrl: saved.fileUrl,
          storageType: 'disk',
        });
      }

      return typeof doc === 'string' ? doc : JSON.stringify(doc);
    } catch {
      return typeof doc === 'string' ? doc : JSON.stringify(doc);
    }
  }

  /**
   * Processes picture / file attachments for tickets and saves them to disk
   */
  static async processAttachment(
    att: any,
    ticketNoPrefix: string = 'ATT'
  ): Promise<any> {
    if (!att) return att;

    if (att.dataUrl && att.dataUrl.startsWith('data:')) {
      const saved = await this.saveFileToDisk(
        att.dataUrl,
        att.fileName || 'attachment.png',
        ticketNoPrefix
      );

      return {
        ...att,
        filePath: saved.filePath,
        fileUrl: saved.fileUrl,
        dataUrl: saved.fileUrl, // Points to disk route
        fileSize: saved.fileSize || att.fileSize,
        storageType: 'disk',
      };
    }

    return att;
  }

  /**
   * Scans PostgreSQL tables on startup to migrate any pre-existing Base64 files to disk
   */
  static async migrateLegacyDbBase64ToDisk(): Promise<void> {
    try {
      // 1. Migrate tickets.dept_request
      const ticketsWithDept = await db
        .select({ id: tickets.id, ticketNo: tickets.ticketNo, deptRequest: tickets.deptRequest })
        .from(tickets)
        .where(sql`${tickets.deptRequest} IS NOT NULL`);

      let migratedTickets = 0;
      for (const t of ticketsWithDept) {
        if (!t.deptRequest) continue;
        if (t.deptRequest.includes('data:application/') || t.deptRequest.includes('data:image/')) {
          const processed = await this.processDeptRequestDoc(t.deptRequest, t.ticketNo || `TCK-${t.id}`);
          if (processed) {
            await db
              .update(tickets)
              .set({ deptRequest: JSON.stringify(processed) })
              .where(eq(tickets.id, t.id));
            migratedTickets++;
          }
        }
      }

      // 2. Migrate maintenance.maintenance_request_document
      const maintenanceWithDocs = await db
        .select({ id: maintenance.id, ticketNo: maintenance.ticketNo, doc: maintenance.maintenanceRequestDocument })
        .from(maintenance)
        .where(sql`${maintenance.maintenanceRequestDocument} IS NOT NULL`);

      let migratedMnt = 0;
      for (const m of maintenanceWithDocs) {
        if (!m.doc) continue;
        if (m.doc.includes('data:application/') || m.doc.includes('data:image/')) {
          const processedDoc = await this.processMaintenanceDoc(m.doc, m.ticketNo || `MNT-${m.id}`);
          if (processedDoc) {
            await db
              .update(maintenance)
              .set({ maintenanceRequestDocument: processedDoc })
              .where(eq(maintenance.id, m.id));
            migratedMnt++;
          }
        }
      }

      if (migratedTickets > 0 || migratedMnt > 0) {
        console.log(`✅ [Disk Migration] Successfully migrated ${migratedTickets} ticket requests and ${migratedMnt} maintenance documents to "${TICKET_REQUESTS_FOLDER_NAME}"! Database space optimized.`);
      }
    } catch (err: any) {
      console.warn('Notice during legacy base64 migration:', err?.message || err);
    }
  }

  /**
   * Returns list of all stored files in the 'ticket requests' directory
   */
  static async listStoredFiles(): Promise<Array<{
    fileName: string;
    filePath: string;
    fileUrl: string;
    sizeBytes: number;
    formattedSize: string;
    createdAt: string;
  }>> {
    if (!fs.existsSync(TICKET_REQUESTS_DIR)) {
      return [];
    }

    const fileNames = await fs.promises.readdir(TICKET_REQUESTS_DIR);
    const files = [];

    for (const name of fileNames) {
      if (name.startsWith('.')) continue;
      const fullPath = path.join(TICKET_REQUESTS_DIR, name);
      try {
        const stat = await fs.promises.stat(fullPath);
        if (stat.isFile()) {
          files.push({
            fileName: name,
            filePath: `${TICKET_REQUESTS_FOLDER_NAME}/${name}`,
            fileUrl: `/api/ticket-requests/${encodeURIComponent(name)}`,
            sizeBytes: stat.size,
            formattedSize: formatFileSize(stat.size),
            createdAt: stat.birthtime.toISOString(),
          });
        }
      } catch (_) {}
    }

    return files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
