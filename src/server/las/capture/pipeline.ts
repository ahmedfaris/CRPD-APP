// Capture pipeline for one batch of scanned pages:
//   1. normalize the input (PDF / TIFF / JPEG / PNG) into one PDF
//   2. render each page and read its barcodes / QR codes (zbar)
//   3. split the batch into documents at separator sheets; read metadata from the codes
//   4. per document: OCR in Arabic + English with automatic rotation, deskew and despeckle,
//      keeping the scanned image with an aligned invisible text layer (layout preserved),
//      written as PDF/A-2b (ISO 19005-2) and checked afterwards.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { run, BIN, pythonForPikepdf } from './tools.ts';

export interface Barcode { page: number; type: string; data: string }
export interface SeparatorMeta { [k: string]: string }
export interface DocPlan { pageFrom: number; pageTo: number; pages: number[]; meta: SeparatorMeta; barcodes: Barcode[]; attachToNumber: string | null }
export interface DocResult extends DocPlan { pdfaPath: string; ocrText: string; conformance: string | null; sha256: string; size: number }

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.tif', '.tiff'];
export const ACCEPTED_EXT = ['.pdf', ...IMAGE_EXT];

async function must(cmd: string, args: string[], what: string, timeoutMs?: number) {
  const r = await run(cmd, args, { timeoutMs });
  if (r.code !== 0) throw new Error(`${what} failed (${r.code}): ${(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' | ').slice(0, 500)}`);
  return r;
}

/** Turn the batch files into a single PDF, in order. */
export async function normalize(files: string[], workDir: string): Promise<string> {
  const parts: string[] = [];
  for (const [i, f] of files.entries()) {
    const ext = path.extname(f).toLowerCase();
    if (ext === '.pdf') parts.push(f);
    else if (IMAGE_EXT.includes(ext)) {
      const out = path.join(workDir, `img-${i}.pdf`);
      await must(BIN.img2pdf, ['--output', out, f], 'Image to PDF');
      parts.push(out);
    } else throw new Error(`Unsupported file type: ${path.basename(f)}`);
  }
  const merged = path.join(workDir, 'batch.pdf');
  if (parts.length === 1) fs.copyFileSync(parts[0], merged);
  else await must(BIN.qpdf, ['--empty', '--pages', ...parts, '--', merged], 'Merging files');
  return merged;
}

export async function pageCount(pdf: string): Promise<number> {
  const r = await must(BIN.qpdf, ['--show-npages', pdf], 'Counting pages');
  return Number(r.stdout.trim());
}

/** Read every barcode / QR code on every page (pages rendered at 200 dpi greyscale). */
export async function readBarcodes(pdf: string, workDir: string): Promise<Barcode[]> {
  const dir = path.join(workDir, 'pages');
  fs.mkdirSync(dir, { recursive: true });
  await must(BIN.pdftoppm, ['-r', '200', '-gray', '-png', pdf, path.join(dir, 'p')], 'Rendering pages');
  const pngs = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort((a, b) => Number(a.match(/(\d+)\.png$/)![1]) - Number(b.match(/(\d+)\.png$/)![1]));
  const out: Barcode[] = [];
  for (const png of pngs) {
    const page = Number(png.match(/(\d+)\.png$/)![1]);
    const r = await run(BIN.zbarimg, ['-q', '--xml', path.join(dir, png)], { timeoutMs: 60_000 });
    // exit code 4 = no symbol found on this page
    for (const m of r.stdout.matchAll(/<symbol type=['"]([^'"]+)['"][^>]*>[\s\S]*?<data(?: format=['"][^'"]*['"])?(?: length=['"]\d+['"])?><!\[CDATA\[([\s\S]*?)\]\]><\/data>/g)) {
      out.push({ page, type: m[1], data: m[2].trim() });
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return out;
}

/**
 * What a code on a page means:
 *  - separator sheet:  LAS1|SEP|u=D1-02&t=IN&cat=3&conf=Normal&urg=Normal&contact=5
 *    (also accepted: a 1D barcode reading exactly "LAS-SEP" — a plain separator without metadata)
 *  - record label:     LAS1|REC|IN/D1-02/2026/0145  (printed by the archive) or a bare registration number
 */
export function interpret(data: string): { kind: 'separator'; meta: SeparatorMeta } | { kind: 'record'; number: string } | null {
  const d = data.trim();
  if (d === 'LAS-SEP') return { kind: 'separator', meta: {} };
  if (d.startsWith('LAS1|SEP|') || d === 'LAS1|SEP') {
    const meta: SeparatorMeta = {};
    const qs = d.slice('LAS1|SEP|'.length);
    for (const [k, v] of new URLSearchParams(qs)) if (/^[a-z]{1,12}$/.test(k)) meta[k] = v.slice(0, 200);
    return { kind: 'separator', meta };
  }
  if (d.startsWith('LAS1|REC|')) return { kind: 'record', number: d.slice('LAS1|REC|'.length).slice(0, 80) };
  if (/^[^\s/|]{1,12}\/[A-Z][A-Z0-9-]{0,20}\/\d{4}\/\d{1,8}$/u.test(d)) return { kind: 'record', number: d };
  return null;
}

/** Split the batch into documents. Separator sheets start a new document and are removed. */
export function plan(pageTotal: number, barcodes: Barcode[], separation: 'barcode' | 'single'): DocPlan[] {
  const byPage = new Map<number, Barcode[]>();
  for (const b of barcodes) byPage.set(b.page, [...(byPage.get(b.page) || []), b]);
  const docs: DocPlan[] = [];
  let cur: DocPlan | null = null;
  const start = (meta: SeparatorMeta) => { cur = { pageFrom: 0, pageTo: 0, pages: [], meta, barcodes: [], attachToNumber: null }; docs.push(cur); };
  for (let page = 1; page <= pageTotal; page++) {
    const codes = byPage.get(page) || [];
    const sep = codes.map(c => interpret(c.data)).find(x => x?.kind === 'separator') as { kind: 'separator'; meta: SeparatorMeta } | undefined;
    if (sep && separation === 'barcode') { start(sep.meta); continue; }
    if (!cur) start({});
    const doc = cur!;
    doc.pages.push(page);
    doc.barcodes.push(...codes);
    const rec = codes.map(c => interpret(c.data)).find(x => x?.kind === 'record') as { kind: 'record'; number: string } | undefined;
    if (rec && !doc.attachToNumber) doc.attachToNumber = rec.number;
  }
  return docs.filter(d => d.pages.length > 0).map(d => ({ ...d, pageFrom: d.pages[0], pageTo: d.pages[d.pages.length - 1] }));
}

/** Contiguous page ranges for qpdf, e.g. [1,2,3,5] -> "1-3,5". */
const ranges = (pages: number[]) => {
  const out: string[] = []; let s = pages[0]; let prev = pages[0];
  for (const p of [...pages.slice(1), Infinity]) {
    if (p === prev + 1) { prev = p; continue; }
    out.push(s === prev ? `${s}` : `${s}-${prev}`); s = p; prev = p;
  }
  return out.join(',');
};

export interface OcrOptions { languages: string; cleanFinal: boolean; jobs: number }
/** OCR one document and write it as PDF/A-2b. Returns the text and the confirmed conformance. */
export async function ocrToPdfa(batchPdf: string, docPlan: DocPlan, workDir: string, idx: number, o: OcrOptions): Promise<DocResult> {
  const part = path.join(workDir, `doc-${idx}.pdf`);
  await must(BIN.qpdf, [batchPdf, '--pages', batchPdf, ranges(docPlan.pages), '--', part], 'Splitting the document');
  const out = path.join(workDir, `doc-${idx}.pdfa.pdf`);
  const sidecar = path.join(workDir, `doc-${idx}.txt`);
  const args = [
    '-l', o.languages,
    '--rotate-pages', '--rotate-pages-threshold', '6',
    '--deskew',
    o.cleanFinal ? '--clean-final' : '--clean', // unpaper despeckle / border cleanup
    // Low-resolution scans (150-200 dpi from MFPs) are upsampled for OCR only. Measured on a noisy
    // 150 dpi Arabic letter: 39% of words read correctly without this, 78% with it.
    '--oversample', '300',
    '--output-type', 'pdfa-2',
    '--pdf-renderer', 'sandwich', // image kept as scanned, text layer placed under it at the same positions
    '--optimize', '1',
    '--jobs', String(o.jobs),
    '--sidecar', sidecar,
    '--force-ocr', // scans from MFPs sometimes carry a poor vendor text layer: replace it
    part, out,
  ];
  // Exit code 10 = output written but PDF/A validation failed; anything else non-zero is an error.
  const r = await run(BIN.ocrmypdf, args, { timeoutMs: 20 * 60 * 1000 });
  if (r.code !== 0 && r.code !== 10) throw new Error(`OCR failed (${r.code}): ${(r.stderr).trim().split('\n').slice(-3).join(' | ').slice(0, 500)}`);
  let conformance = await readPdfaClaim(out);
  // Independent check with veraPDF when it is installed (it is in the Docker image).
  if (conformance && process.env.VERAPDF_BIN) {
    const v = await run(process.env.VERAPDF_BIN, ['--flavour', conformance.toLowerCase(), '--format', 'text', out], { timeoutMs: 5 * 60 * 1000 });
    if (!/^PASS\b/m.test(v.stdout)) conformance = null;
  }
  const buf = fs.readFileSync(out);
  const ocrText = fs.existsSync(sidecar) ? fs.readFileSync(sidecar, 'utf8').replace(/\f/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim() : '';
  return { ...docPlan, pdfaPath: out, ocrText, conformance: r.code === 10 ? null : conformance, sha256: crypto.createHash('sha256').update(buf).digest('hex'), size: buf.length };
}

/** Read the PDF/A part and conformance the file declares in its XMP metadata (e.g. "2B"). */
export async function readPdfaClaim(file: string): Promise<string | null> {
  const r = await run(pythonForPikepdf(), ['-I', '-c', 'import sys,pikepdf\nwith pikepdf.open(sys.argv[1]) as p:\n  print(p.open_metadata().pdfa_status or "")', file], { timeoutMs: 60_000 });
  const v = r.stdout.trim();
  return r.code === 0 && /^[1-4][ABU]$/i.test(v) ? v.toUpperCase() : null;
}
