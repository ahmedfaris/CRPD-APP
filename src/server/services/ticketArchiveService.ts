import fs from 'fs';
import path from 'path';

export const TICKETS_ARCHIVE_FOLDER_NAME = 'tickets archive';
export const TICKETS_ARCHIVE_DIR = path.join(process.cwd(), TICKETS_ARCHIVE_FOLDER_NAME);

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function sanitizePathSegment(segment: string): string {
  return segment.replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim() || 'item';
}

export interface ArchiveResult {
  fileName: string;
  originalFileName: string;
  filePath: string;
  fileUrl: string;
  fileSize: string;
  fileType: string;
  byteSize: number;
}

export class TicketArchiveService {
  /**
   * Initializes the main 'tickets archive' directory on disk
   */
  static async init(): Promise<void> {
    try {
      if (!fs.existsSync(TICKETS_ARCHIVE_DIR)) {
        fs.mkdirSync(TICKETS_ARCHIVE_DIR, { recursive: true });
        console.log(`📁 Created disk directory: "${TICKETS_ARCHIVE_FOLDER_NAME}" (${TICKETS_ARCHIVE_DIR})`);
      }
    } catch (err: any) {
      console.warn('Notice during TicketArchiveService.init:', err?.message || err);
    }
  }

  /**
   * Archives a ticket attachment or file inside 'tickets archive/{ticketNo}/'
   * Naming convention: <اسم التذكرة> - <رقم تسلسلي> - <تاريخ الرفع>.<الامتداد>
   */
  static async archiveAttachment(
    attachment: any,
    ticketNo: string,
    ticketTitle: string,
    fileIndex: number = 1
  ): Promise<any> {
    if (!attachment) return attachment;

    const dataUrl = attachment.dataUrl || attachment.fileUrl;
    const originalFileName = attachment.fileName || 'attachment.png';

    // If dataUrl contains Base64 or is a raw buffer/string, save to disk
    if (dataUrl && (dataUrl.startsWith('data:') || Buffer.isBuffer(dataUrl) || dataUrl.length > 500)) {
      const saved = await this.saveFileToArchive({
        ticketNo,
        ticketTitle,
        fileIndex,
        originalFileName,
        fileData: dataUrl,
        uploadDate: attachment.uploadedAt ? attachment.uploadedAt.split('T')[0] : undefined
      });

      return {
        ...attachment,
        fileName: saved.fileName,
        filePath: saved.filePath,
        fileUrl: saved.fileUrl,
        dataUrl: saved.fileUrl,
        fileSize: saved.fileSize || attachment.fileSize,
        fileType: saved.fileType || attachment.fileType,
        storageType: 'disk',
        archivedAt: new Date().toISOString()
      };
    }

    return attachment;
  }

  /**
   * Saves raw data to disk in 'tickets archive/{ticketNo}/{ticketTitle} - {serialNumber} - {uploadDate}.ext'
   */
  static async saveFileToArchive(options: {
    ticketNo: string;
    ticketTitle: string;
    fileIndex: number;
    originalFileName: string;
    fileData: string | Buffer;
    uploadDate?: string;
  }): Promise<ArchiveResult> {
    const { ticketNo, ticketTitle, fileIndex, originalFileName, fileData } = options;

    if (!fs.existsSync(TICKETS_ARCHIVE_DIR)) {
      fs.mkdirSync(TICKETS_ARCHIVE_DIR, { recursive: true });
    }

    // 1. Subfolder named by ticket number
    const cleanTicketNo = sanitizePathSegment(ticketNo || 'TCK-2026-0001');
    const ticketFolder = path.join(TICKETS_ARCHIVE_DIR, cleanTicketNo);
    if (!fs.existsSync(ticketFolder)) {
      fs.mkdirSync(ticketFolder, { recursive: true });
    }

    // 2. Parse file data buffer and mimeType
    let buffer: Buffer;
    let mimeType = 'image/png';

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
      throw new Error('Invalid fileData format provided to TicketArchiveService');
    }

    // 3. Construct file name: اسم التذكرة - رقم تسلسلي - تاريخ الرفع
    const cleanTitle = sanitizePathSegment(ticketTitle || 'تذكرة').slice(0, 50);
    const serialStr = String(fileIndex).padStart(2, '0');
    const dateStr = options.uploadDate || new Date().toISOString().split('T')[0];
    
    let ext = path.extname(originalFileName);
    if (!ext) {
      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
      else if (mimeType.includes('pdf')) ext = '.pdf';
      else if (mimeType.includes('png')) ext = '.png';
      else ext = '.dat';
    }

    const archivedFileName = `${cleanTitle} - ${serialStr} - ${dateStr}${ext}`;
    const destinationPath = path.join(ticketFolder, archivedFileName);

    await fs.promises.writeFile(destinationPath, buffer);

    const relativePath = `${TICKETS_ARCHIVE_FOLDER_NAME}/${cleanTicketNo}/${archivedFileName}`;
    const fileUrl = `/api/tickets-archive/${encodeURIComponent(cleanTicketNo)}/${encodeURIComponent(archivedFileName)}`;

    return {
      fileName: archivedFileName,
      originalFileName,
      filePath: relativePath,
      fileUrl,
      fileSize: formatFileSize(buffer.length),
      fileType: mimeType,
      byteSize: buffer.length
    };
  }
}
