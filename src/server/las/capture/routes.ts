// Capture API.
//  /api/las/capture/...  (signed-in users): upload batches, review queue, file into records, tickets, settings
//  /api/las-agent/...    (scanning agent): upload pages with a one-time ticket
import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { q, q1 } from '../db.ts';
import { audit, registryUnits, saveAttachmentBuffer, ARCHIVE_ROOT, Ctx } from '../core.ts';
import { h, bad, forbidden, notFound, str, int, oneOf, paramId, camel, loadLetter, READ_ONLY_STATUSES } from '../http.ts';
import { checkTools } from './tools.ts';
import {
  createBatch, addBatchFile, queueBatch, getCaptureSettings, DEFAULT_CAPTURE, HotFolder, newTicketToken, hashTicket, captureFile, kick, CAPTURE_ROOT,
} from './service.ts';
import { ACCEPTED_EXT } from './pipeline.ts';

export const captureRouter = Router();
const SEPARATIONS = ['barcode', 'single'] as const;

const decodeDataUrl = (dataUrl: any): Buffer => {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(String(dataUrl || ''));
  if (!m || !m[2]) throw bad('The file could not be read. Upload it again.');
  return Buffer.from(m[3], 'base64');
};
const mayCapture = (ctx: Ctx, unitId: number) => registryUnits(ctx).has(unitId);

// ---- status -------------------------------------------------------------------------------
captureRouter.get('/capture/status', h(async (ctx, req, res) => {
  if (!ctx.isSysAdmin && registryUnits(ctx).size === 0) throw forbidden();
  const tools = await checkTools(req.query.refresh === '1');
  const counts = await q<any>(`SELECT status, count(*)::int AS n FROM las_capture_batches WHERE kind = 'capture' GROUP BY status`);
  const s = await getCaptureSettings();
  res.json({
    success: true,
    data: {
      tools, counts: Object.fromEntries(counts.map(c => [c.status, c.n])),
      hotFolders: s.hotFolders.map(f => ({ ...f, reachable: (() => { try { fs.accessSync(f.path, fs.constants.R_OK | fs.constants.W_OK); return true; } catch { return false; } })() })),
      settings: { ocrLanguages: s.ocrLanguages, cleanFinal: s.cleanFinal, jobs: s.jobs, pollSeconds: s.pollSeconds },
    },
  });
}));

// ---- upload a batch from the browser --------------------------------------------------------
captureRouter.post('/capture/batches', h(async (ctx, req, res) => {
  const b = req.body || {};
  const unitId = int(b.unitId, 'Registry unit', true)!;
  if (!mayCapture(ctx, unitId)) throw forbidden('Only the correspondence clerk or head of this unit can scan for it.');
  if (!Array.isArray(b.files) || b.files.length === 0 || b.files.length > 50) throw bad('Choose between 1 and 50 files.');
  // Check every file before creating the batch, so a rejected upload leaves nothing behind.
  const files = b.files.map((f: any) => {
    const name = String(f?.name || 'scan.pdf');
    if (!ACCEPTED_EXT.includes(path.extname(name).toLowerCase())) throw bad(`"${name}": only PDF, TIFF, JPEG and PNG scans can be captured.`);
    const buf = decodeDataUrl(f?.dataUrl);
    if (buf.length === 0) throw bad(`"${name}" is empty.`);
    return { name, buf };
  });
  const separation = oneOf(b.separation, 'Separation', SEPARATIONS, 'barcode');
  const batch = await createBatch({ source: 'upload', sourceName: files[0].name, unitId, separation, createdBy: ctx.uid });
  for (const f of files) await addBatchFile(batch.id, f.name, f.buf);
  await queueBatch(batch.id);
  await audit(ctx, 'CaptureReceived', 'CaptureBatch', batch.id, null, { source: 'upload', files: b.files.length, unitCode: ctx.units.get(unitId)?.code });
  res.status(201).json({ success: true, data: { batchId: batch.id } });
}));

// ---- one-time ticket for the scanning agent ----------------------------------------------------
captureRouter.post('/capture/tickets', h(async (ctx, req, res) => {
  const unitId = int(req.body?.unitId, 'Registry unit', true)!;
  if (!mayCapture(ctx, unitId)) throw forbidden('Only the correspondence clerk or head of this unit can scan for it.');
  const { token, hash } = newTicketToken();
  const separation = oneOf(req.body?.separation, 'Separation', SEPARATIONS, 'barcode');
  await q(`INSERT INTO las_capture_tickets (token_hash, user_uid, unit_id, separation, expires_at) VALUES ($1,$2,$3,$4, now() + interval '30 minutes')`, [hash, ctx.uid, unitId, separation]);
  res.status(201).json({ success: true, data: { ticket: token, expiresInMinutes: 30 } });
}));

// ---- batches and the review queue ------------------------------------------------------------
captureRouter.get('/capture/batches', h(async (ctx, _req, res) => {
  const units = [...registryUnits(ctx)];
  if (!ctx.isSysAdmin && units.length === 0) throw forbidden();
  const rows = await q<any>(`SELECT b.id, b.source, b.source_name, b.unit_id, b.separation, b.status, b.pages, b.attempts, b.error, b.created_at, b.finished_at,
      (SELECT count(*)::int FROM las_capture_docs d WHERE d.batch_id = b.id) AS docs,
      (SELECT count(*)::int FROM las_capture_docs d WHERE d.batch_id = b.id AND d.status = 'ready') AS ready
    FROM las_capture_batches b WHERE b.kind = 'capture' AND ($1 OR b.unit_id = ANY($2::int[])) ORDER BY b.id DESC LIMIT 200`, [ctx.isSysAdmin, units]);
  res.json({ success: true, data: rows.map(camel) });
}));

captureRouter.post('/capture/batches/:id/retry', h(async (ctx, req, res) => {
  const b = await q1<any>('SELECT * FROM las_capture_batches WHERE id = $1', [paramId(req.params.id)]);
  if (!b) throw notFound('Batch');
  if (!ctx.isSysAdmin && !(b.unit_id && mayCapture(ctx, b.unit_id))) throw forbidden();
  if (b.status !== 'error') throw bad('Only failed batches can be retried.');
  // Files of a failed batch were set aside in capture/failed/<id>; put them back.
  const failedDir = path.join(CAPTURE_ROOT, 'failed', String(b.id));
  const files: string[] = [];
  if (fs.existsSync(failedDir)) {
    const inDir = path.join(CAPTURE_ROOT, 'incoming', String(b.id));
    fs.mkdirSync(inDir, { recursive: true });
    for (const f of fs.readdirSync(failedDir).sort()) { fs.renameSync(path.join(failedDir, f), path.join(inDir, f)); files.push(`incoming/${b.id}/${f}`); }
  }
  await q(`UPDATE las_capture_batches SET status = 'queued', attempts = 0, error = NULL, files = CASE WHEN $1::jsonb = '[]'::jsonb THEN files ELSE $1::jsonb END WHERE id = $2`, [JSON.stringify(files), b.id]);
  await audit(ctx, 'CaptureRetry', 'CaptureBatch', b.id, null, {});
  kick();
  res.json({ success: true });
}));

const docScope = (ctx: Ctx) => [...registryUnits(ctx)];
async function loadDoc(ctx: Ctx, id: number) {
  const d = await q1<any>('SELECT * FROM las_capture_docs WHERE id = $1', [id]);
  if (!d) throw notFound('Scanned document');
  // Scanned content is visible only to the registry desk it was scanned for.
  if (!(d.unit_id && mayCapture(ctx, d.unit_id))) throw forbidden('This scanned document belongs to another registry desk.');
  return d;
}

captureRouter.get('/capture/docs', h(async (ctx, req, res) => {
  const status = oneOf(req.query.status, 'Status', ['ready', 'filed', 'discarded'] as const, 'ready');
  const rows = await q<any>(`SELECT d.id, d.batch_id, d.seq, d.unit_id, d.page_from, d.page_to, d.pages, d.status, d.meta, d.barcodes, d.attach_to_number,
      d.ocr_chars, d.pdfa_conformance, d.size, d.filed_letter_id, d.filed_at, d.created_at, left(d.ocr_text, 300) AS ocr_preview, b.source, b.source_name
    FROM las_capture_docs d JOIN las_capture_batches b ON b.id = d.batch_id
    WHERE d.status = $1 AND d.unit_id = ANY($2::int[]) ORDER BY d.id ${status === 'ready' ? 'ASC' : 'DESC'} LIMIT 300`, [status, docScope(ctx)]);
  // Resolve record labels found on the pages to the records they belong to (when the user may see them).
  const out = [];
  for (const r of rows) {
    let attachTo = null;
    if (r.attach_to_number) {
      const l = await q1<any>('SELECT id, number, subject FROM las_letters WHERE number = $1', [r.attach_to_number]);
      if (l) { try { await loadLetter(ctx, l.id); attachTo = { id: l.id, number: l.number, subject: l.subject }; } catch { attachTo = { id: null, number: l.number, subject: null }; } }
    }
    out.push({ ...camel(r), attachTo });
  }
  res.json({ success: true, data: out });
}));

captureRouter.get('/capture/docs/:id', h(async (ctx, req, res) => {
  const d = await loadDoc(ctx, paramId(req.params.id));
  const batch = await q1<any>('SELECT id, source, source_name, separation, created_at FROM las_capture_batches WHERE id = $1', [d.batch_id]);
  res.json({ success: true, data: { ...camel({ ...d, pdfa_path: undefined }), batch: camel(batch) } });
}));

captureRouter.get('/capture/docs/:id/file', h(async (ctx, req, res) => {
  const d = await loadDoc(ctx, paramId(req.params.id));
  if (!d.pdfa_path) throw notFound('File');
  const file = captureFile(d.pdfa_path);
  if (!fs.existsSync(file)) throw notFound('File');
  await audit(ctx, 'ViewCapturedDocument', 'CaptureDocument', d.id, null, { batchId: d.batch_id });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `inline; filename="capture-${d.id}.pdf"`);
  res.send(fs.readFileSync(file));
}));

captureRouter.post('/capture/docs/:id/discard', h(async (ctx, req, res) => {
  const d = await loadDoc(ctx, paramId(req.params.id));
  if (d.status !== 'ready') throw bad('Only documents waiting for indexing can be discarded.');
  const reason = str(req.body?.reason, 'Reason', 300, true)!;
  await q(`UPDATE las_capture_docs SET status = 'discarded', filed_by = $1, filed_at = now() WHERE id = $2`, [ctx.uid, d.id]);
  await audit(ctx, 'DiscardCapturedDocument', 'CaptureDocument', d.id, null, { batchId: d.batch_id, pages: d.pages, reason });
  res.json({ success: true });
}));

/** Store a captured document in a record (used by registration and by "attach to existing record"). */
export async function fileCapturedDoc(ctx: Ctx, docId: number, letter: any, asOriginal: boolean) {
  const d = await loadDoc(ctx, docId);
  if (d.status !== 'ready') throw bad('This scanned document was already filed or discarded.');
  const buf = fs.readFileSync(captureFile(d.pdfa_path));
  const att = await saveAttachmentBuffer(ctx, letter, buf, {
    name: `scan-${d.batch_id}-${d.seq}.pdf`, isOriginalScan: asOriginal, kind: asOriginal ? 'attachment' : 'attachment',
    ocrText: d.ocr_text, pdfaConformance: d.pdfa_conformance, skipConversion: true,
  });
  await q(`UPDATE las_attachments SET ocr_status = 'done' WHERE id = $1`, [att.id]);
  await q(`UPDATE las_capture_docs SET status = 'filed', filed_letter_id = $1, filed_by = $2, filed_at = now() WHERE id = $3 AND status = 'ready'`, [letter.id, ctx.uid, d.id]);
  await audit(ctx, 'FileCapturedDocument', 'Letter', letter.id, letter.number, { captureDocId: d.id, batchId: d.batch_id, pages: d.pages, attachmentId: att.id, conformance: d.pdfa_conformance, sha256: att.sha256 }, { failClosed: letter.confidentiality !== 'Normal' });
  try { fs.unlinkSync(captureFile(d.pdfa_path)); } catch { /* already moved */ }
  return att;
}

captureRouter.post('/capture/docs/:id/attach', h(async (ctx, req, res) => {
  const d = await loadDoc(ctx, paramId(req.params.id));
  let letter: any;
  if (req.body?.letterId) letter = await loadLetter(ctx, int(req.body.letterId, 'Record', true)!);
  else if (req.body?.number || d.attach_to_number) {
    const number = str(req.body?.number, 'Record number', 80) || d.attach_to_number;
    const row = await q1<any>('SELECT id FROM las_letters WHERE number = $1', [number]);
    if (!row) throw bad(`No record has the number ${number}.`);
    letter = await loadLetter(ctx, row.id);
  } else throw bad('Choose the record to attach the scan to.');
  if (READ_ONLY_STATUSES.includes(letter.status)) throw bad('That record is closed. An administrator can reopen it with a reason.');
  if (!registryUnits(ctx).has(letter.unit_id) && letter.created_by_uid !== ctx.uid) throw forbidden('You cannot add files to that record.');
  const hasOriginal = await q1('SELECT 1 FROM las_attachments WHERE letter_id = $1 AND is_original_scan AND deleted_at IS NULL', [letter.id]);
  const att = await fileCapturedDoc(ctx, d.id, letter, !hasOriginal);
  res.json({ success: true, data: { letterId: letter.id, number: letter.number, attachmentId: att.id } });
}));

// ---- settings: hot folders and OCR options (administrators) -----------------------------------
captureRouter.put('/capture/settings', h(async (ctx, req, res) => {
  if (!ctx.isSysAdmin) throw forbidden('Only a system administrator can change capture settings.');
  const b = req.body || {};
  const before = await getCaptureSettings();
  const next = { ...before };
  if (b.hotFolders !== undefined) {
    if (!Array.isArray(b.hotFolders) || b.hotFolders.length > 50) throw bad('Hot folders are not valid.');
    const seenPaths = new Set<string>();
    next.hotFolders = b.hotFolders.map((f: any, i: number): HotFolder => {
      const name = str(f?.name, `Hot folder ${i + 1} name`, 80, true)!;
      const p = str(f?.path, `Hot folder ${name} path`, 400, true)!;
      if (!path.isAbsolute(p)) throw bad(`The path of "${name}" must be a full path (for example /srv/scans/registry or \\\\server\\scans).`);
      const resolved = path.resolve(p);
      // Neither inside the application/archive folders nor a parent of them (e.g. "/" or the drive root).
      const within = (parent: string, child: string) => { const r = path.relative(parent, child); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };
      for (const appDir of [ARCHIVE_ROOT, CAPTURE_ROOT, process.cwd()]) {
        if (within(appDir, resolved) || within(resolved, appDir)) throw bad(`"${name}" cannot be inside the application or archive folders, or contain them.`);
      }
      if (seenPaths.has(resolved)) throw bad('Two hot folders cannot use the same path.');
      seenPaths.add(resolved);
      const unitId = int(f?.unitId, `Registry unit of "${name}"`, true)!;
      if (!ctx.units.has(unitId)) throw bad(`The unit of "${name}" does not exist.`);
      return { id: String(f?.id || `hf${Date.now()}${i}`).slice(0, 40), name, path: resolved, unitId, separation: oneOf(f?.separation, 'Separation', SEPARATIONS, 'barcode'), enabled: f?.enabled !== false };
    });
  }
  if (b.ocrLanguages !== undefined) {
    const langs = String(b.ocrLanguages);
    if (!/^[a-z_]{3,}(\+[a-z_]{3,})*$/.test(langs)) throw bad('OCR languages look like ara+eng.');
    next.ocrLanguages = langs;
  }
  if (b.cleanFinal !== undefined) next.cleanFinal = !!b.cleanFinal;
  if (b.jobs !== undefined) next.jobs = int(b.jobs, 'Parallel OCR jobs', true, 1, 8)!;
  if (b.pollSeconds !== undefined) next.pollSeconds = int(b.pollSeconds, 'Poll interval', true, 3, 600)!;
  await q(`INSERT INTO las_settings (key, value, updated_by) VALUES ('capture', $1::jsonb, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(next), ctx.uid]);
  await audit(ctx, 'ChangeSetting', 'Setting', null, null, { key: 'capture', hotFolders: next.hotFolders.map(f => ({ name: f.name, unitId: f.unitId, enabled: f.enabled })), ocrLanguages: next.ocrLanguages, cleanFinal: next.cleanFinal });
  res.json({ success: true, data: next });
}));
void DEFAULT_CAPTURE;

// =======================================================================================
// Scanning agent: uploads pages with a one-time ticket (no user password or session on the PC)
// =======================================================================================
export const agentRouter = Router();
// The agent runs on the user's PC and is called from the archive page in the browser.
agentRouter.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
const RAW = express.raw({ type: ['image/*', 'application/pdf', 'application/octet-stream'], limit: '60mb' });

async function ticketFrom(req: express.Request) {
  const t = String(req.headers['x-capture-ticket'] || '');
  if (t.length < 20) return null;
  return q1<any>(`SELECT * FROM las_capture_tickets WHERE token_hash = $1 AND completed_at IS NULL AND expires_at > now()`, [hashTicket(t)]);
}
const EXT_BY_TYPE: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/tiff': '.tif', 'application/pdf': '.pdf' };

agentRouter.post('/pages', RAW, async (req, res) => {
  try {
    const t = await ticketFrom(req);
    if (!t) return res.status(401).json({ success: false, error: 'The scan ticket is missing, expired or already used. Start the scan again from the archive page.' });
    const type = String(req.headers['content-type'] || '').split(';')[0].trim();
    const ext = EXT_BY_TYPE[type];
    if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ success: false, error: 'Send each page as PNG, JPEG, TIFF or PDF.' });
    let batchId = t.batch_id;
    if (!batchId) {
      const b = await createBatch({ source: 'agent', sourceName: String(req.headers['x-scanner-name'] || 'Scanner').slice(0, 120), unitId: t.unit_id, separation: t.separation, createdBy: t.user_uid });
      batchId = b.id;
      await q('UPDATE las_capture_tickets SET batch_id = $1 WHERE id = $2', [batchId, t.id]);
    }
    await addBatchFile(batchId, `page${ext}`, req.body);
    res.status(201).json({ success: true, data: { batchId } });
  } catch (e: any) {
    res.status(e?.message === 'BATCH_TOO_LARGE' ? 400 : 500).json({ success: false, error: e?.message === 'BATCH_TOO_LARGE' ? 'A batch can hold at most 2000 pages.' : 'The page could not be stored.' });
  }
});

agentRouter.post('/complete', async (req, res) => {
  try {
    const t = await ticketFrom(req);
    if (!t) return res.status(401).json({ success: false, error: 'The scan ticket is missing, expired or already used.' });
    if (!t.batch_id) return res.status(400).json({ success: false, error: 'No pages were received.' });
    await q('UPDATE las_capture_tickets SET completed_at = now() WHERE id = $1', [t.id]);
    await queueBatch(t.batch_id);
    const b = await q1<any>('SELECT jsonb_array_length(files) AS n FROM las_capture_batches WHERE id = $1', [t.batch_id]);
    const user = await q1<any>('SELECT full_name FROM users WHERE uid = $1', [t.user_uid]);
    await audit({ uid: t.user_uid, name: user?.full_name || null, roles: [], units: new Map(), kids: new Map(), ip: req.ip || '', correlationId: '', sessionId: '', isSysAdmin: false, email: '' } as any,
      'CaptureReceived', 'CaptureBatch', t.batch_id, null, { source: 'agent', pages: b?.n, scanner: String(req.headers['x-scanner-name'] || '').slice(0, 120) });
    res.json({ success: true, data: { batchId: t.batch_id } });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e?.message === 'BATCH_EMPTY' ? 'No pages were received.' : 'The batch could not be completed.' });
  }
});
