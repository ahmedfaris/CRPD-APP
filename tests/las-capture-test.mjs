// End-to-end test of document capture: hot folders, browser upload, scanning-agent tickets,
// barcode separation, OCR, PDF/A, filing into records and OCR search.
// Run after tests/las-api-test.mjs on the same server (it reuses that test's users and units):
//   node tests/las-capture-test.mjs <fixtures-dir> <hot-folder-dir>
// <fixtures-dir>/scans must hold mfp-batch.tif, mfp-batch.pdf, single-letter.jpg and <fixtures-dir>/pages the page PNGs.
import fs from 'fs';
import path from 'path';

const [FIX, HOT] = process.argv.slice(2);
const B = 'http://localhost:3000';
const PW = 'Str0ng!Passw0rd26';
let pass = 0, fail = 0;
const check = (n, c, e = '') => { if (c) { pass++; console.log('PASS', n); } else { fail++; console.log('FAIL', n, typeof e === 'string' ? e : JSON.stringify(e).slice(0, 400)); } };
const api = async (m, p, t, b, headers = {}) => {
  const r = await fetch(B + p, { method: m, headers: { ...(b && !(b instanceof Buffer) ? { 'content-type': 'application/json' } : {}), ...(t ? { authorization: 'Bearer ' + t } : {}), ...headers }, body: b instanceof Buffer ? b : b ? JSON.stringify(b) : undefined });
  const ct = r.headers.get('content-type') || '';
  return { s: r.status, d: ct.includes('json') ? await r.json().catch(() => null) : null, buf: ct.includes('json') ? null : Buffer.from(await r.arrayBuffer()) };
};
const login = async (e) => (await api('POST', '/api/auth/login', null, { email: e, password: PW })).d?.token;
const admin = (await api('POST', '/api/auth/login', null, { email: 'admin@system.local', password: 'Admin@2026!' })).d.token;
const T = { clerk: await login('clerk@las.test'), clerk2: await login('clerk2@las.test'), head: await login('head@las.test'), emp: await login('emp@las.test') };
const L = (m, p, k, b) => api(m, '/api/las' + p, k === 'admin' ? admin : T[k], b);
const dataUrl = (file, mime) => `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitBatch(id, k = 'clerk', ms = 240_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const b = (await L('GET', '/capture/batches', k)).d.data.find(x => x.id === id);
    if (b && ['done', 'error'].includes(b.status)) return b;
    await sleep(2000);
  }
  return null;
}
const units = (await L('GET', '/units', 'admin')).d.data;
const U = code => units.find(u => u.code === code).id;
const contact = (await L('GET', '/contacts', 'clerk')).d.data[0].id;

console.log('\n=== toolchain and settings ===');
const st = (await L('GET', '/capture/status?refresh=1', 'clerk')).d.data;
check('toolchain ready (OCRmyPDF, Tesseract ara+eng, zbar, qpdf, poppler, img2pdf, pikepdf)', st.tools.ready, st.tools.missing);
check('employees cannot see capture status', (await L('GET', '/capture/status', 'emp')).s === 403);
fs.mkdirSync(HOT, { recursive: true });
check('only administrators configure hot folders', (await L('PUT', '/capture/settings', 'clerk', { hotFolders: [] })).s === 403);
check('hot folder at the filesystem root (contains the application) is refused', (await L('PUT', '/capture/settings', 'admin', { hotFolders: [{ name: 'bad', path: path.parse(process.cwd()).root, unitId: U('D1-01') }] })).s === 400);
check('relative path refused', (await L('PUT', '/capture/settings', 'admin', { hotFolders: [{ name: 'bad', path: 'scans', unitId: U('D1-01') }] })).s === 400);
const set = await L('PUT', '/capture/settings', 'admin', { hotFolders: [{ name: 'Registry MFP', path: HOT, unitId: U('D1-01'), separation: 'barcode' }], pollSeconds: 3 });
check('administrator adds a hot folder for the D1-01 registry desk', set.s === 200, set.d);

console.log('\n=== hot folder: MFP batch with separator sheets (multi-page TIFF) ===');
const before = (await L('GET', '/capture/batches', 'clerk')).d.data.map(b => b.id);
fs.copyFileSync(path.join(FIX, 'scans/mfp-batch.tif'), path.join(HOT, 'scan_20261122_0001.tif'));
let batch = null;
for (let i = 0; i < 60 && !batch; i++) { await sleep(2000); batch = (await L('GET', '/capture/batches', 'clerk')).d.data.find(b => !before.includes(b.id)); }
check('hot folder file picked up and removed from the share', !!batch && !fs.existsSync(path.join(HOT, 'scan_20261122_0001.tif')), batch);
batch = await waitBatch(batch.id);
check('batch processed: 5 pages, 2 documents', batch?.status === 'done' && batch.pages === 5 && batch.docs === 2, batch);
let docs = (await L('GET', '/capture/docs', 'clerk')).d.data.filter(d => d.batchId === batch.id);
const [d1, d2] = docs;
check('separator sheets removed; document 1 = pages 2-3, document 2 = page 5', d1?.pageFrom === 2 && d1.pageTo === 3 && d1.pages === 2 && d2?.pageFrom === 5 && d2.pages === 1, docs.map(d => [d.pageFrom, d.pageTo]));
check('metadata read from the separator QR (type, unit, urgency, Arabic reference)', d1.meta.t === 'IN' && d1.meta.u === 'D1-01' && d1.meta.urg === 'Urgent' && d1.meta.ref === 'ع/٤٥٦٧', d1.meta);
check('record label QR on a page links document 2 to IN/D1-01/YYYY/0001', d2.attachTo?.number?.startsWith('IN/D1-01/') && d2.attachTo?.id > 0, d2.attachTo);
check('both documents are PDF/A-2B', d1.pdfaConformance === '2B' && d2.pdfaConformance === '2B', [d1.pdfaConformance, d2.pdfaConformance]);
check('OCR produced Arabic text', d1.ocrChars > 200 && /المستفيدين|الإعاقة/.test(d1.ocrPreview), d1.ocrPreview);
const f = await L('GET', `/capture/docs/${d1.id}/file`, 'clerk');
check('scanned PDF served to the registry desk', f.s === 200 && f.buf.subarray(0, 5).toString() === '%PDF-');
check('another registry desk cannot see or open it', (await L('GET', '/capture/docs', 'clerk2')).d.data.every(d => d.id !== d1.id) && (await L('GET', `/capture/docs/${d1.id}/file`, 'clerk2')).s === 403);
const full = (await L('GET', `/capture/docs/${d1.id}`, 'clerk')).d.data;
check('document detail has full OCR text and barcodes', full.ocrText.length === full.ocrChars && Array.isArray(full.barcodes) && !('pdfaPath' in full && full.pdfaPath));

console.log('\n=== filing: register as a new letter, attach to an existing one ===');
check('another desk cannot register it', (await L('POST', '/letters/incoming', 'clerk2', { unitId: U('D2'), contactId: contact, subject: 'x', captureDocId: d1.id })).s === 403);
const reg = await L('POST', '/letters/incoming', 'clerk', { unitId: U('D1-01'), contactId: contact, subject: 'كتاب وزارة العمل', urgency: 'Urgent', externalRefNo: 'cap-' + Date.now(), captureDocId: d1.id });
check('registered as a new incoming letter', reg.s === 201 && reg.d.data.number?.startsWith('IN/D1-01/'), reg.d);
const rd = (await L('GET', `/letters/${reg.d.data.id}`, 'clerk')).d.data;
const scan = rd.attachments[0];
check('scan stored as the original scan, PDF/A-2B, with OCR text', rd.attachments.length === 1 && scan.isOriginalScan && scan.pdfaConformance === '2B' && scan.hasOcr && scan.fileName === 'original_scan.pdf', rd.attachments);
check('the scanned document is marked filed and cannot be used twice', (await L('POST', '/letters/incoming', 'clerk', { unitId: U('D1-01'), contactId: contact, subject: 'y', captureDocId: d1.id })).s === 400);
const txt = (await L('GET', `/attachments/${scan.id}/text`, 'clerk')).d.data;
check('accessible text view of the scan (OCR text)', txt.text.length > 200);
const hits = (await L('GET', '/letters?q=' + encodeURIComponent('المستفيدين'), 'head')).d.data;
check('full-text search finds the letter by a word that is only in the scan', hits.some(l => l.id === reg.d.data.id), hits.map(h => h.number));
check('OCR search respects permissions (other directorate finds nothing)', !(await L('GET', '/letters?q=' + encodeURIComponent('المستفيدين'), 'clerk2')).d.data.some(l => l.id === reg.d.data.id));
const att = await L('POST', `/capture/docs/${d2.id}/attach`, 'clerk', {});
check('document 2 attached to the record named on its label', att.s === 200 && att.d.data.number === d2.attachTo.number, att.d);
const target = (await L('GET', `/letters/${att.d.data.letterId}`, 'clerk')).d.data;
check('the record now has the scan with its PDF/A conformance', target.attachments.some(a => a.id === att.d.data.attachmentId && a.pdfaConformance === '2B'));

console.log('\n=== browser upload: one document per file (no separation) ===');
const up = await L('POST', '/capture/batches', 'clerk', { unitId: U('D1-01'), separation: 'single', files: [{ name: 'batch.pdf', dataUrl: dataUrl(path.join(FIX, 'scans/mfp-batch.pdf'), 'application/pdf') }] });
check('upload accepted', up.s === 201, up.d);
const ub = await waitBatch(up.d.data.batchId);
const udocs = (await L('GET', '/capture/docs', 'clerk')).d.data.filter(d => d.batchId === up.d.data.batchId);
check('single mode keeps all 5 pages as one document', ub?.status === 'done' && udocs.length === 1 && udocs[0].pages === 5, [ub, udocs.map(d => d.pages)]);
check('discard needs a reason', (await L('POST', `/capture/docs/${udocs[0].id}/discard`, 'clerk', {})).s === 400);
check('discarded with a reason', (await L('POST', `/capture/docs/${udocs[0].id}/discard`, 'clerk', { reason: 'مسح مكرر' })).s === 200);
const nBefore = (await L('GET', '/capture/batches', 'clerk')).d.data.length;
check('wrong file type refused', (await L('POST', '/capture/batches', 'clerk', { unitId: U('D1-01'), files: [{ name: 'x.exe', dataUrl: 'data:application/octet-stream;base64,TVo=' }] })).s === 400);
check('a refused upload leaves no empty batch behind', (await L('GET', '/capture/batches', 'clerk')).d.data.length === nBefore);
check('employee cannot upload scans', (await L('POST', '/capture/batches', 'emp', { unitId: U('D1-01'), files: [{ name: 'a.pdf', dataUrl: 'data:application/pdf;base64,JVBERg==' }] })).s === 403);

console.log('\n=== scanning agent: one-time ticket, page-by-page upload ===');
check('employee cannot get a scan ticket', (await L('POST', '/capture/tickets', 'emp', { unitId: U('D1-01') })).s === 403);
const tk = (await L('POST', '/capture/tickets', 'clerk', { unitId: U('D1-01'), separation: 'barcode' })).d.data.ticket;
const png = (n) => fs.readFileSync(path.join(FIX, 'pages', n));
check('page upload without a ticket refused', (await api('POST', '/api/las-agent/pages', null, png('02-letterA1.png'), { 'content-type': 'image/png' })).s === 401);
const p1 = await api('POST', '/api/las-agent/pages', null, png('02-letterA1.png'), { 'content-type': 'image/png', 'x-capture-ticket': tk, 'x-scanner-name': 'fi-7160' });
const p2 = await api('POST', '/api/las-agent/pages', null, png('03-letterA2.png'), { 'content-type': 'image/png', 'x-capture-ticket': tk });
check('agent uploads pages with the ticket', p1.s === 201 && p2.s === 201 && p1.d.data.batchId === p2.d.data.batchId, [p1.d, p2.d]);
check('non-image page refused', (await api('POST', '/api/las-agent/pages', null, Buffer.from('hello'), { 'content-type': 'text/plain', 'x-capture-ticket': tk })).s === 400);
const done = await api('POST', '/api/las-agent/complete', null, undefined, { 'x-capture-ticket': tk });
check('agent completes the batch', done.s === 200);
check('ticket cannot be reused after completion', (await api('POST', '/api/las-agent/pages', null, png('02-letterA1.png'), { 'content-type': 'image/png', 'x-capture-ticket': tk })).s === 401);
const ab = await waitBatch(p1.d.data.batchId);
const adocs = (await L('GET', '/capture/docs', 'clerk')).d.data.filter(d => d.batchId === p1.d.data.batchId);
check('agent batch processed into one 2-page PDF/A document', ab?.status === 'done' && adocs.length === 1 && adocs[0].pages === 2 && adocs[0].pdfaConformance === '2B', [ab, adocs]);
check('English page OCR found', /rehabilitation|Ministry|Labour/i.test((await L('GET', `/capture/docs/${adocs[0].id}`, 'clerk')).d.data.ocrText));

console.log('\n=== scan uploaded straight into a record is converted to PDF/A automatically ===');
const direct = await L('POST', '/letters/incoming', 'clerk', { unitId: U('D1-01'), contactId: contact, subject: 'رفع مباشر', externalRefNo: 'jpg-' + Date.now(), files: [{ name: 'scan.jpg', dataUrl: dataUrl(path.join(FIX, 'scans/single-letter.jpg'), 'image/jpeg'), isOriginalScan: true }] });
check('letter registered with a JPEG scan', direct.s === 201);
let conv = null;
for (let i = 0; i < 90 && !conv; i++) {
  await sleep(2000);
  const det = (await L('GET', `/letters/${direct.d.data.id}`, 'clerk')).d.data;
  conv = det.attachments.find(a => a.kind === 'pdfa');
  if (conv) check('PDF/A copy added next to the original JPEG, original marked done', conv.pdfaConformance === '2B' && conv.hasOcr && det.attachments.find(a => a.id === conv.sourceAttachmentId)?.ocrStatus === 'done', det.attachments);
}
check('conversion finished', !!conv);

console.log('\n=== failures are kept and can be retried ===');
const before2 = (await L('GET', '/capture/batches', 'clerk')).d.data.map(b => b.id);
fs.writeFileSync(path.join(HOT, 'broken.pdf'), '%PDF-1.4 this is not a real pdf');
let bad = null;
for (let i = 0; i < 60 && !bad; i++) { await sleep(2000); bad = (await L('GET', '/capture/batches', 'clerk')).d.data.find(b => !before2.includes(b.id)); }
bad = bad && await waitBatch(bad.id, 'clerk', 120_000);
check('broken file ends in error after retries, with a plain message (no server paths)', bad?.status === 'error' && bad.attempts === 3 && /damaged/.test(bad.error) && !/\/(tmp|home|app|data|srv)\/|capture\/work/.test(bad.error), bad);
check('employee cannot retry', (await L('POST', `/capture/batches/${bad.id}/retry`, 'emp')).s === 403);
check('clerk can retry (file put back in the queue)', (await L('POST', `/capture/batches/${bad.id}/retry`, 'clerk')).s === 200);

console.log('\n=== audit ===');
const au = (await L('GET', '/audit?limit=1000', 'admin')).d.data;
const acts = new Set(au.map(a => a.action));
check('capture operations audited', ['CaptureReceived', 'ViewCapturedDocument', 'FileCapturedDocument', 'DiscardCapturedDocument', 'ConvertToPdfA', 'CaptureRetry'].every(a => acts.has(a)), [...acts].filter(a => /Capt|Pdf/.test(a)));
check('audit holds no OCR text', !JSON.stringify(au).includes('المستفيدين من برامج'));
check('audit chain still verifies', (await L('GET', '/audit/verify', 'admin')).d.data.ok === true);
console.log(`\n${pass} passed, ${fail} failed`);
