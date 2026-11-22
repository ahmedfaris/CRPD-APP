// Capture toolchain: OCRmyPDF (Tesseract OCR, unpaper, Ghostscript PDF/A), zbar (barcodes),
// qpdf (page split) and poppler (page rendering). All run as separate processes with a time
// limit; file names are passed as arguments, never through a shell.
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface RunResult { code: number; stdout: string; stderr: string }

export function run(cmd: string, args: string[], opts: { timeoutMs?: number; cwd?: string } = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    } catch (e: any) {
      return resolve({ code: -1, stdout: '', stderr: String(e?.message || e) });
    }
    let stdout = ''; let stderr = '';
    const cap = (s: string, add: Buffer) => (s.length > 2_000_000 ? s : s + add.toString('utf8'));
    child.stdout.on('data', (d: Buffer) => { stdout = cap(stdout, d); });
    child.stderr.on('data', (d: Buffer) => { stderr = cap(stderr, d); });
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* already gone */ } }, opts.timeoutMs ?? 10 * 60 * 1000);
    child.on('error', (e: any) => { clearTimeout(timer); resolve({ code: -1, stdout, stderr: stderr + String(e?.message || e) }); });
    child.on('close', (code: number | null) => { clearTimeout(timer); resolve({ code: code ?? -1, stdout, stderr }); });
  });
}

export const BIN = {
  ocrmypdf: process.env.OCRMYPDF_BIN || 'ocrmypdf',
  zbarimg: process.env.ZBARIMG_BIN || 'zbarimg',
  qpdf: process.env.QPDF_BIN || 'qpdf',
  pdftoppm: process.env.PDFTOPPM_BIN || 'pdftoppm',
  img2pdf: process.env.IMG2PDF_BIN || 'img2pdf',
  tesseract: process.env.TESSERACT_BIN || 'tesseract',
};
/** Python that has pikepdf (used to read the PDF/A claim back from the result). Defaults to OCRmyPDF's own. */
export function pythonForPikepdf(): string {
  if (process.env.PIKEPDF_PYTHON) return process.env.PIKEPDF_PYTHON;
  const dir = path.dirname(BIN.ocrmypdf);
  for (const name of ['python3', 'python']) {
    const p = path.join(dir, name);
    if (BIN.ocrmypdf.includes(path.sep) && fs.existsSync(p)) return p;
  }
  return 'python3';
}

export interface ToolStatus { ready: boolean; checkedAt: string; tools: Record<string, { ok: boolean; version: string }>; languages: string[]; missing: string[] }
let cached: ToolStatus | null = null;

/** Check that every tool runs and that the Arabic and English OCR languages are installed. */
export async function checkTools(force = false): Promise<ToolStatus> {
  if (cached && !force && Date.now() - new Date(cached.checkedAt).getTime() < 60_000) return cached;
  const probe = async (name: string, cmd: string, args: string[]) => {
    const r = await run(cmd, args, { timeoutMs: 20_000 });
    const line = (r.stdout || r.stderr).split('\n').find(Boolean) || '';
    return [name, { ok: r.code === 0 || (name === 'pdftoppm' && /pdftoppm version/i.test(r.stderr)), version: line.trim().slice(0, 80) }] as const;
  };
  const results = await Promise.all([
    probe('ocrmypdf', BIN.ocrmypdf, ['--version']),
    probe('tesseract', BIN.tesseract, ['--version']),
    probe('zbarimg', BIN.zbarimg, ['--version']),
    probe('qpdf', BIN.qpdf, ['--version']),
    probe('pdftoppm', BIN.pdftoppm, ['-v']),
    probe('img2pdf', BIN.img2pdf, ['--version']),
    probe('pikepdf', pythonForPikepdf(), ['-I', '-c', 'import pikepdf; print(pikepdf.__version__)']),
  ]);
  const tools = Object.fromEntries(results) as ToolStatus['tools'];
  // Optional independent PDF/A validator (not required to run).
  if (process.env.VERAPDF_BIN) {
    const [, v] = await probe('verapdf', process.env.VERAPDF_BIN, ['--version']);
    (tools as any).verapdf = { ...v, optional: true };
  }
  const langs = await run(BIN.tesseract, ['--list-langs'], { timeoutMs: 20_000 });
  const languages = (langs.stdout + langs.stderr).split('\n').map(s => s.trim()).filter(s => /^[a-z_]{3,}$/.test(s));
  const missing = Object.entries(tools).filter(([, v]) => !v.ok && !(v as any).optional).map(([k]) => k);
  for (const l of ['ara', 'eng', 'osd']) if (!languages.includes(l)) missing.push(`tesseract-${l}`);
  cached = { ready: missing.length === 0, checkedAt: new Date().toISOString(), tools, languages, missing };
  return cached;
}
