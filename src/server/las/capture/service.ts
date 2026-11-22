// Capture service: hot folders, the processing queue, and conversion of uploaded scans.
// Files live under CAPTURE_ROOT (outside the web root) until a clerk files them into a record.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../../utils/logger.ts';
import { q, q1 } from '../db.ts';
import { ARCHIVE_ROOT, attachmentHooks, getSettings, audit, notify, usersWithRoleAt, HEAD_ROLES } from '../core.ts';
import { checkTools } from './tools.ts';
import { normalize, pageCount, readBarcodes, plan, ocrToPdfa, ACCEPTED_EXT } from './pipeline.ts';

export const CAPTURE_ROOT = path.resolve(process.env.CAPTURE_ROOT || path.join(process.cwd(), 'capture'));
const DIRS = { incoming: path.join(CAPTURE_ROOT, 'incoming'), work: path.join(CAPTURE_ROOT, 'work'), docs: path.join(CAPTURE_ROOT, 'documents'), failed: path.join(CAPTURE_ROOT, 'failed') };
const MAX_ATTEMPTS = 3;

export interface HotFolder { id: string; name: string; path: string; unitId: number; separation: 'barcode' | 'single'; enabled: boolean }
export interface CaptureSettings { hotFolders: HotFolder[]; ocrLanguages: string; cleanFinal: boolean; jobs: number; pollSeconds: number }
export const DEFAULT_CAPTURE: CaptureSettings = { hotFolders: [], ocrLanguages: 'ara+eng', cleanFinal: true, jobs: 2, pollSeconds: 10 };

export async function getCaptureSettings(): Promise<CaptureSettings> {
  const row = await q1<any>(`SELECT value FROM las_settings WHERE key = 'capture'`);
  return { ...DEFAULT_CAPTURE, ...(row?.value || {}) };
}

const rel = (abs: string) => path.relative(CAPTURE_ROOT, abs).split(path.sep).join('/');
const abs = (r: string) => {
  const p = path.resolve(CAPTURE_ROOT, r);
  if (!p.startsWith(CAPTURE_ROOT + path.sep)) throw new Error('PATH_INVALID');
  return p;
};
const safeName = (s: string) => (path.basename(String(s || 'scan')).normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-120)) || 'scan';

/** Move a file, also across disks/shares (rename fails there). */
function moveFile(from: string, to: string) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try { fs.renameSync(from, to); } catch { fs.copyFileSync(from, to); fs.unlinkSync(from); }
}

// ---------------------------------------------------------------------------------------
// Creating batches
// ---------------------------------------------------------------------------------------
export async function createBatch(opts: { source: 'hotfolder' | 'upload' | 'agent'; sourceName: string; unitId: number | null; separation: 'barcode' | 'single'; createdBy: string | null }) {
  const b = await q1<any>(
    `INSERT INTO las_capture_batches (source, source_name, unit_id, separation, status, created_by) VALUES ($1,$2,$3,$4,'receiving',$5) RETURNING *`,
    [opts.source, opts.sourceName.slice(0, 200), opts.unitId, opts.separation, opts.createdBy]);
  fs.mkdirSync(path.join(DIRS.incoming, String(b.id)), { recursive: true });
  return b;
}
/** Add one file (as bytes) to a batch that is still receiving. */
export async function addBatchFile(batchId: number, name: string, buf: Buffer) {
  const b = await q1<any>('SELECT * FROM las_capture_batches WHERE id = $1', [batchId]);
  if (!b || b.status !== 'receiving') throw new Error('BATCH_CLOSED');
  const ext = path.extname(name).toLowerCase();
  if (!ACCEPTED_EXT.includes(ext)) throw new Error('FILE_TYPE_NOT_ALLOWED');
  const files: string[] = b.files || [];
  if (files.length >= 2000) throw new Error('BATCH_TOO_LARGE');
  const target = path.join(DIRS.incoming, String(batchId), `${String(files.length + 1).padStart(4, '0')}_${safeName(name)}`);
  fs.writeFileSync(target, buf, { flag: 'wx' });
  await q(`UPDATE las_capture_batches SET files = files || $1::jsonb WHERE id = $2`, [JSON.stringify([rel(target)]), batchId]);
}
export async function queueBatch(batchId: number) {
  const b = await q1<any>(`UPDATE las_capture_batches SET status = 'queued' WHERE id = $1 AND status = 'receiving' AND jsonb_array_length(files) > 0 RETURNING id`, [batchId]);
  if (!b) throw new Error('BATCH_EMPTY');
  kick();
}

// ---------------------------------------------------------------------------------------
// Hot folders (MFP scan-to-folder, or a desk scanner's capture software saving to a share)
// ---------------------------------------------------------------------------------------
const seen = new Map<string, { size: number; mtime: number; since: number }>();
async function pollHotFolders() {
  const s = await getCaptureSettings();
  for (const hf of s.hotFolders.filter(h => h.enabled)) {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(hf.path, { withFileTypes: true }); } catch (e: any) {
      logger.warning('Hot folder {Name} cannot be read: {Error}', { LogType: 'Technical', Name: hf.name, Error: e?.message });
      continue;
    }
    for (const ent of entries) {
      if (!ent.isFile() || ent.name.startsWith('.') || ent.name.startsWith('~')) continue;
      const ext = path.extname(ent.name).toLowerCase();
      const full = path.join(hf.path, ent.name);
      if (!ACCEPTED_EXT.includes(ext)) continue;
      let st: fs.Stats;
      try { st = fs.statSync(full); } catch { continue; }
      // Wait until the MFP has finished writing: same size and time on two polls, at least 5 s apart.
      const prev = seen.get(full);
      if (!prev || prev.size !== st.size || prev.mtime !== st.mtimeMs) { seen.set(full, { size: st.size, mtime: st.mtimeMs, since: Date.now() }); continue; }
      if (Date.now() - prev.since < 5000 || st.size === 0) continue;
      seen.delete(full);
      try {
        const b = await createBatch({ source: 'hotfolder', sourceName: `${hf.name}: ${ent.name}`, unitId: hf.unitId, separation: hf.separation, createdBy: null });
        const target = path.join(DIRS.incoming, String(b.id), `0001_${safeName(ent.name)}`);
        moveFile(full, target);
        await q(`UPDATE las_capture_batches SET files = $1::jsonb, status = 'queued' WHERE id = $2`, [JSON.stringify([rel(target)]), b.id]);
        logger.information('Hot folder {Name} picked up {File} as batch {BatchId}', { LogType: 'Technical', Name: hf.name, File: ent.name, BatchId: b.id });
        await audit(null, 'CaptureReceived', 'CaptureBatch', b.id, null, { source: 'hotfolder', folder: hf.name, file: ent.name, sizeBytes: st.size });
        kick();
      } catch (e: any) {
        logger.error('Hot folder {Name}: {File} could not be taken in: {Error}', { LogType: 'Technical', Name: hf.name, File: ent.name, Error: e?.message });
      }
    }
  }
}

// ---------------------------------------------------------------------------------------
// The processing queue
// ---------------------------------------------------------------------------------------
let running = 0;
let timer: NodeJS.Timeout | null = null;
const CONCURRENCY = Math.max(1, Number(process.env.CAPTURE_CONCURRENCY || 1));

export function kick() { setImmediate(() => { tick().catch(e => logger.error('Capture queue error: {Error}', { LogType: 'Technical', Error: e?.message })); }); }

async function tick() {
  while (running < CONCURRENCY) {
    const tools = await checkTools();
    if (!tools.ready) {
      await q(`UPDATE las_capture_batches SET status = 'waiting_tools' WHERE status = 'queued'`);
      return;
    }
    await q(`UPDATE las_capture_batches SET status = 'queued' WHERE status = 'waiting_tools'`);
    // Claim the oldest queued batch (one statement, so two workers never take the same one).
    const b = await q1<any>(`UPDATE las_capture_batches SET status = 'processing', started_at = now(), attempts = attempts + 1
      WHERE id = (SELECT id FROM las_capture_batches WHERE status = 'queued' ORDER BY id LIMIT 1) RETURNING *`);
    if (!b) return;
    running++;
    processBatch(b).catch(() => undefined).finally(() => { running--; kick(); });
  }
}

async function processBatch(b: any) {
  const workDir = path.join(DIRS.work, String(b.id));
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });
  const started = Date.now();
  try {
    const s = await getCaptureSettings();
    const opts = { languages: s.ocrLanguages || 'ara+eng', cleanFinal: s.cleanFinal !== false, jobs: Math.max(1, Math.min(8, s.jobs || 2)) };
    if (b.kind === 'attachment') return await convertAttachment(b, workDir, opts);

    const files = (b.files || []).map(abs);
    const pdf = await normalize(files, workDir);
    const total = await pageCount(pdf);
    const codes = await readBarcodes(pdf, workDir);
    const docs = plan(total, codes, b.separation === 'single' ? 'single' : 'barcode');
    const outDir = path.join(DIRS.docs, String(b.id));
    fs.mkdirSync(outDir, { recursive: true });
    let i = 0;
    for (const d of docs) {
      i++;
      const r = await ocrToPdfa(pdf, d, workDir, i, opts);
      const finalPath = path.join(outDir, `doc-${String(i).padStart(3, '0')}.pdf`);
      moveFile(r.pdfaPath, finalPath);
      await q(`INSERT INTO las_capture_docs (batch_id, seq, unit_id, page_from, page_to, pages, status, meta, barcodes, attach_to_number, ocr_text, ocr_chars, pdfa_path, pdfa_conformance, sha256, size)
               VALUES ($1,$2,$3,$4,$5,$6,'ready',$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14,$15)`,
        [b.id, i, b.unit_id, r.pageFrom, r.pageTo, r.pages.length, JSON.stringify(r.meta), JSON.stringify(r.barcodes), r.attachToNumber,
          r.ocrText, r.ocrText.length, rel(finalPath), r.conformance, r.sha256, r.size]);
    }
    await q(`UPDATE las_capture_batches SET status = 'done', pages = $1, finished_at = now(), error = NULL,
             log = log || $2::jsonb WHERE id = $3`, [total, JSON.stringify([{ at: new Date().toISOString(), pages: total, barcodes: codes.length, documents: docs.length, seconds: Math.round((Date.now() - started) / 1000) }]), b.id]);
    // The original scans are no longer needed once every document is stored as PDF/A.
    for (const f of files) { try { fs.unlinkSync(f); } catch { /* already gone */ } }
    logger.information('Capture batch {BatchId}: {Pages} pages, {Docs} documents in {Seconds}s', { LogType: 'Technical', BatchId: b.id, Pages: total, Docs: docs.length, Seconds: Math.round((Date.now() - started) / 1000) });
    if (b.unit_id) await notify(await usersWithRoleAt(b.unit_id, ['clerk', ...HEAD_ROLES]), null, 'capture', `دفعة مسح جديدة جاهزة للفهرسة (${docs.length} وثيقة)`, `A new scanned batch is ready for indexing (${docs.length} documents)`);
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 1000);
    const final = b.attempts >= MAX_ATTEMPTS;
    // Users see a plain explanation; the technical detail (with server paths) stays in the logs.
    await q(`UPDATE las_capture_batches SET status = $1, error = $2, finished_at = now(), log = log || $3::jsonb WHERE id = $4`,
      [final ? 'error' : 'queued', friendlyError(msg), JSON.stringify([{ at: new Date().toISOString(), attempt: b.attempts, error: msg }]), b.id]);
    logger.error('Capture batch {BatchId} failed (attempt {Attempt}): {Error}', { LogType: 'Technical', BatchId: b.id, Attempt: b.attempts, Error: msg });
    if (final && b.kind === 'attachment' && b.attachment_id) await q(`UPDATE las_attachments SET ocr_status = 'failed' WHERE id = $1`, [b.attachment_id]);
    if (final && b.kind !== 'attachment') {
      // Keep the files for the administrator; nothing is lost.
      for (const f of (b.files || [])) { try { moveFile(abs(f), path.join(DIRS.failed, String(b.id), path.basename(f))); } catch { /* keep in place */ } }
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/** A short message a clerk can act on, without server paths or tool output. */
export function friendlyError(technical: string): string {
  if (/^(Counting pages|Merging files|Splitting the document|Rendering pages) failed/.test(technical)) return 'The file is damaged or is not a valid PDF/TIFF/image. Scan it again.';
  if (/^Image to PDF failed/.test(technical)) return 'The image could not be read. Scan it again as PDF, TIFF, JPEG or PNG.';
  if (/^Unsupported file type/.test(technical)) return 'Unsupported file type. Use PDF, TIFF, JPEG or PNG.';
  if (/^OCR failed/.test(technical)) return 'Text recognition failed for this batch. The administrator can find the details in the server log.';
  if (/ENOSPC/.test(technical)) return 'The server is out of disk space.';
  return 'Processing failed. The administrator can find the details in the server log.';
}

// ---------------------------------------------------------------------------------------
// Scans uploaded straight into a record: add a searchable PDF/A copy next to the original
// ---------------------------------------------------------------------------------------
async function convertAttachment(b: any, workDir: string, opts: { languages: string; cleanFinal: boolean; jobs: number }) {
  const a = await q1<any>('SELECT * FROM las_attachments WHERE id = $1', [b.attachment_id]);
  if (!a || a.deleted_at) { await q(`UPDATE las_capture_batches SET status = 'done', finished_at = now() WHERE id = $1`, [b.id]); return; }
  const src = path.resolve(ARCHIVE_ROOT, a.storage_path);
  if (!src.startsWith(path.resolve(ARCHIVE_ROOT) + path.sep)) throw new Error('PATH_INVALID');
  const ext = path.extname(src).toLowerCase() === '.tif' ? '.tif' : path.extname(src).toLowerCase();
  const local = path.join(workDir, `source${ext}`);
  fs.copyFileSync(src, local);
  const pdf = await normalize([local], workDir);
  const total = await pageCount(pdf);
  const r = await ocrToPdfa(pdf, { pageFrom: 1, pageTo: total, pages: Array.from({ length: total }, (_, i) => i + 1), meta: {}, barcodes: [], attachToNumber: null }, workDir, 1, opts);
  const buf = fs.readFileSync(r.pdfaPath);
  const dir = path.dirname(a.storage_path);
  const name = a.file_name.replace(/\.[^.]+$/, '') + '_pdfa.pdf';
  const relPath = `${dir}/${name}`;
  const target = path.join(ARCHIVE_ROOT, relPath);
  fs.writeFileSync(target, buf);
  await q(`INSERT INTO las_attachments (letter_id, file_name, original_name, mime, size, storage_path, sha256, is_original_scan, kind, version, uploaded_by, ocr_text, ocr_status, pdfa_conformance, source_attachment_id)
           VALUES ($1,$2,$3,'application/pdf',$4,$5,$6,$7,'pdfa',$8,'system',$9,'done',$10,$11)`,
    [a.letter_id, name, a.original_name, buf.length, relPath, r.sha256, a.is_original_scan, a.version, r.ocrText, r.conformance, a.id]);
  await q(`UPDATE las_attachments SET ocr_status = 'done', ocr_text = $1 WHERE id = $2`, [r.ocrText, a.id]);
  await q(`UPDATE las_capture_batches SET status = 'done', pages = $1, finished_at = now(), error = NULL WHERE id = $2`, [total, b.id]);
  const l = await q1<any>('SELECT number FROM las_letters WHERE id = $1', [a.letter_id]);
  await audit(null, 'ConvertToPdfA', 'Letter', a.letter_id, l?.number || null, { attachmentId: a.id, fileName: name, conformance: r.conformance, pages: total, sha256: r.sha256 });
}

attachmentHooks.afterOriginalScan = async (attachment: any) => {
  await q(`INSERT INTO las_capture_batches (kind, source, source_name, status, attachment_id, created_by) VALUES ('attachment','upload',$1,'queued',$2,$3)`,
    [attachment.file_name, attachment.id, attachment.uploaded_by]);
  kick();
};

// ---------------------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------------------
export async function initCapture() {
  for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });
  // Batches interrupted by a restart go back to the queue.
  await q(`UPDATE las_capture_batches SET status = 'queued' WHERE status = 'processing'`);
  const status = await checkTools(true);
  if (!status.ready) logger.warning('Capture toolchain incomplete, missing: {Missing}. Scans are kept until it is installed.', { LogType: 'Technical', Missing: status.missing.join(', ') });
  if (timer) clearInterval(timer);
  const s = await getCaptureSettings();
  timer = setInterval(() => { pollHotFolders().catch(() => undefined); kick(); }, Math.max(3, s.pollSeconds || 10) * 1000);
  timer.unref?.();
  kick();
}

export function newTicketToken() {
  const token = crypto.randomBytes(24).toString('base64url');
  return { token, hash: crypto.createHash('sha256').update(token).digest('hex') };
}
export const hashTicket = (t: string) => crypto.createHash('sha256').update(String(t)).digest('hex');
export const captureFile = abs;
