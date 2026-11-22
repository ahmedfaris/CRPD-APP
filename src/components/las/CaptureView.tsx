// Letters Archive System — document capture: scan through the local agent or upload scans,
// the indexing queue (review the PDF/A, its OCR text and the metadata read from barcodes, then
// register or attach), batches, separator sheets, and the administrator's capture settings.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { ScanLine, Upload, RefreshCw, Printer, Paperclip, Trash2, FilePlus2, CheckCircle2, AlertTriangle, Plus } from 'lucide-react';
import { useLas, las, Field, Btn, Notice, Modal, Section, UnitSelect, FilePicker, PickedFile, inputCls, pick, URGENCY, CONF, printHtml, escapeHtml } from './ui';
import { IncomingForm } from './Forms';

const AGENT = 'http://127.0.0.1:47115';
type Tab = 'queue' | 'scan' | 'batches' | 'separators' | 'settings';
const BATCH_STATUS: Record<string, [string, string]> = {
  receiving: ['قيد الاستلام', 'Receiving'], queued: ['في الانتظار', 'Queued'], processing: ['قيد المعالجة', 'Processing'],
  done: ['اكتملت', 'Done'], error: ['فشلت', 'Failed'], waiting_tools: ['بانتظار أدوات المعالجة', 'Waiting for OCR tools'],
};
const SOURCE: Record<string, [string, string]> = { hotfolder: ['مجلد مراقَب', 'Hot folder'], upload: ['رفع ملف', 'Upload'], agent: ['الماسح الضوئي', 'Scanner'] };

async function openCaptureFile(id: number) {
  const token = localStorage.getItem('auth_token');
  const r = await fetch(`/api/las/capture/docs/${id}/file`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) return null;
  return URL.createObjectURL(await r.blob());
}

export function CaptureView({ onRegistered }: { onRegistered: (letterId: number, msg: string) => void }) {
  const { tr, me } = useLas();
  const [tab, setTab] = useState<Tab>('queue');
  const tabs: Array<[Tab, string]> = [
    ['queue', tr('قائمة الفهرسة', 'Indexing queue')], ['scan', tr('مسح أو رفع دفعة', 'Scan or upload a batch')],
    ['batches', tr('الدفعات', 'Batches')], ['separators', tr('أوراق الفصل', 'Separator sheets')],
  ];
  if (me.isSysAdmin) tabs.push(['settings', tr('إعدادات الإدخال', 'Capture settings')]);
  if (me.registryUnits.length === 0 && !me.isSysAdmin) return <Notice kind="warn">{tr('المسح والفهرسة متاحان لموظف الصادرة والواردة ورؤساء الوحدات.', 'Scanning and indexing are for correspondence clerks and unit heads.')}</Notice>;
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={tr('أقسام الإدخال', 'Capture sections')} className="flex flex-wrap gap-1 border-b border-slate-300">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" type="button" id={`cap-tab-${k}`} aria-selected={tab === k} aria-controls={`cap-panel-${k}`} onClick={() => setTab(k)} data-cap-tab={k}
            className={`min-h-[42px] px-4 text-sm font-bold rounded-t-lg border border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${tab === k ? 'bg-blue-800 text-white border-blue-900' : 'bg-slate-100 text-slate-900 border-slate-300 hover:bg-slate-200'}`}>{label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`cap-panel-${tab}`} aria-labelledby={`cap-tab-${tab}`}>
        {tab === 'queue' && <QueueTab onRegistered={onRegistered} />}
        {tab === 'scan' && <ScanTab onQueued={() => setTab('batches')} />}
        {tab === 'batches' && <BatchesTab />}
        {tab === 'separators' && <SeparatorsTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

// =======================================================================================
// Indexing queue
// =======================================================================================
function QueueTab({ onRegistered }: { onRegistered: (letterId: number, msg: string) => void }) {
  const { tr, ar, fmtTime, announce } = useLas();
  const [docs, setDocs] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<any>(null);
  const load = useCallback(async () => {
    const r = await las('/capture/docs?status=ready');
    if (!r.ok) return setErr(r.error || '');
    setErr(''); setDocs(r.data);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  if (err) return <Notice kind="error">{err}</Notice>;
  if (!docs) return <p role="status">{tr('جارٍ التحميل…', 'Loading…')}</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" aria-live="polite" className="text-sm font-semibold">{tr(`${docs.length} وثيقة بانتظار الفهرسة`, `${docs.length} documents waiting for indexing`)}</p>
        <Btn onClick={load}><RefreshCw className="w-4 h-4" aria-hidden="true" />{tr('تحديث', 'Refresh')}</Btn>
      </div>
      {docs.length === 0 ? <p className="text-sm text-slate-700">{tr('لا توجد وثائق ممسوحة بانتظار الفهرسة.', 'No scanned documents are waiting.')}</p> : (
        <ul className="space-y-2" aria-label={tr('الوثائق الممسوحة', 'Scanned documents')}>
          {docs.map(d => (
            <li key={d.id} className="las-card bg-white border border-slate-300 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3" data-capture-doc={d.id}>
              <div className="min-w-0 text-sm">
                <div className="font-bold">{tr(`دفعة ${d.batchId} — وثيقة ${d.seq}`, `Batch ${d.batchId} — document ${d.seq}`)} · {tr(`${d.pages} صفحة`, `${d.pages} pages`)}</div>
                <div className="text-slate-700">{pick(SOURCE[d.source], ar, d.source)} — {d.sourceName} — {fmtTime(d.createdAt)}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {d.pdfaConformance ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-emerald-700 bg-emerald-50 text-emerald-900 text-xs font-bold"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />PDF/A-{d.pdfaConformance}</span>
                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-700 bg-amber-50 text-amber-900 text-xs font-bold"><AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />{tr('لم يُتحقق من PDF/A', 'PDF/A not confirmed')}</span>}
                  <span className="px-2 py-0.5 rounded-md border border-slate-400 text-xs font-bold">{tr(`نص مستخرج: ${d.ocrChars} حرف`, `OCR text: ${d.ocrChars} characters`)}</span>
                  {d.meta?.u && <span className="px-2 py-0.5 rounded-md border border-blue-700 bg-blue-50 text-blue-900 text-xs font-bold" dir="ltr">{d.meta.u}</span>}
                  {d.attachTo && <span className="px-2 py-0.5 rounded-md border border-violet-700 bg-violet-50 text-violet-900 text-xs font-bold">{tr('ملصق سجل: ', 'Record label: ')}<span dir="ltr">{d.attachTo.number}</span></span>}
                </div>
                {d.ocrPreview && <p className="text-xs text-slate-700 mt-1 line-clamp-2" lang={/[؀-ۿ]/.test(d.ocrPreview) ? 'ar' : 'en'}>{d.ocrPreview}</p>}
              </div>
              <Btn variant="primary" onClick={() => setSel(d)}>{tr('مراجعة وفهرسة', 'Review and index')}</Btn>
            </li>
          ))}
        </ul>
      )}
      {sel && <ReviewDialog doc={sel} onClose={() => setSel(null)} onDone={(letterId, msg) => { setSel(null); load(); announce(msg); if (letterId) onRegistered(letterId, msg); }} />}
    </div>
  );
}

function ReviewDialog({ doc, onClose, onDone }: { doc: any; onClose: () => void; onDone: (letterId: number | null, msg: string) => void }) {
  const { tr, ar, units, contacts, me } = useLas();
  const [full, setFull] = useState<any>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'register' | 'attach' | 'discard'>('view');
  const [err, setErr] = useState('');
  const [number, setNumber] = useState(doc.attachTo?.number || '');
  const [reason, setReason] = useState('');
  useEffect(() => {
    let u: string | null = null;
    (async () => {
      const r = await las(`/capture/docs/${doc.id}`);
      if (r.ok) setFull(r.data); else setErr(r.error || '');
      u = await openCaptureFile(doc.id);
      setUrl(u);
    })();
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [doc.id]);
  // Metadata from the separator sheet QR becomes the form's starting values.
  const preset = useMemo(() => {
    const m = doc.meta || {};
    const unit = units.find(u => u.code === m.u && me.registryUnits.includes(u.id)) || units.find(u => u.id === doc.unitId);
    const contact = m.contact && contacts.find(c => String(c.id) === String(m.contact));
    return {
      unitId: unit ? String(unit.id) : '', urgency: ['Normal', 'Urgent', 'Very urgent'].includes(m.urg) ? m.urg : 'Normal',
      confidentiality: ['Normal', 'Confidential', 'Sensitive'].includes(m.conf) ? m.conf : 'Normal', categoryId: m.cat || '',
      contactId: contact ? String(contact.id) : '', externalRefNo: m.ref || '', pagesCount: String(doc.pages),
    };
  }, [doc, units, contacts, me]);
  const attach = async () => {
    const r = await las(`/capture/docs/${doc.id}/attach`, 'POST', { number: number.trim() || undefined });
    if (!r.ok) return setErr(r.error || '');
    onDone(r.data.letterId, tr(`أُرفقت الوثيقة الممسوحة بالسجل ${r.data.number}`, `Scan attached to ${r.data.number}`));
  };
  const discard = async () => {
    if (!reason.trim()) return setErr(tr('اكتب سبب الاستبعاد.', 'Give a reason for discarding.'));
    const r = await las(`/capture/docs/${doc.id}/discard`, 'POST', { reason });
    if (!r.ok) return setErr(r.error || '');
    onDone(null, tr('استُبعدت الوثيقة.', 'Document discarded.'));
  };
  return (
    <Modal wide title={tr(`مراجعة الوثيقة الممسوحة — دفعة ${doc.batchId} / ${doc.seq}`, `Review scanned document — batch ${doc.batchId} / ${doc.seq}`)} onClose={onClose}>
      <div className="space-y-3">
        {err && <Notice kind="error" onClose={() => setErr('')}>{err}</Notice>}
        <div className="flex flex-wrap gap-2" role="group" aria-label={tr('الإجراءات', 'Actions')}>
          <Btn variant="primary" aria-pressed={mode === 'register'} onClick={() => setMode('register')}><FilePlus2 className="w-4 h-4" aria-hidden="true" />{tr('تسجيل ككتاب وارد جديد', 'Register as a new incoming letter')}</Btn>
          <Btn aria-pressed={mode === 'attach'} onClick={() => setMode('attach')}><Paperclip className="w-4 h-4" aria-hidden="true" />{tr('إرفاق بسجل موجود', 'Attach to an existing record')}</Btn>
          <Btn variant="danger" aria-pressed={mode === 'discard'} onClick={() => setMode('discard')}><Trash2 className="w-4 h-4" aria-hidden="true" />{tr('استبعاد', 'Discard')}</Btn>
        </div>
        {mode === 'register' && <IncomingForm preset={preset} captureDocId={doc.id} onDone={(id, msg) => onDone(id, msg)} />}
        {mode === 'attach' && (
          <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); attach(); }}>
            <Field label={tr('رقم السجل', 'Record number')} hint={doc.attachTo ? tr('قُرئ من ملصق الرقم الموجود على الصفحة.', 'Read from the number label on the page.') : undefined}>
              {(p) => <input {...p} dir="ltr" value={number} onChange={e => setNumber(e.target.value)} className={inputCls} placeholder="IN/D1-01/2026/0001" />}
            </Field>
            <Btn type="submit" variant="primary">{tr('إرفاق', 'Attach')}</Btn>
          </form>
        )}
        {mode === 'discard' && (
          <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); discard(); }}>
            <Field label={tr('سبب الاستبعاد', 'Reason')} required>{(p) => <input {...p} value={reason} onChange={e => setReason(e.target.value)} className={inputCls} maxLength={300} />}</Field>
            <Btn type="submit" variant="danger">{tr('استبعاد', 'Discard')}</Btn>
          </form>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Section title={tr('الصورة الممسوحة (PDF/A)', 'Scanned image (PDF/A)')}>
            {url ? <iframe src={url} title={tr('معاينة الوثيقة الممسوحة', 'Scanned document preview')} className="w-full h-[60vh] border border-slate-300 rounded-lg bg-slate-100" />
              : <p role="status">{tr('جارٍ تحميل المعاينة…', 'Loading preview…')}</p>}
          </Section>
          <Section title={tr('النص المستخرج (OCR)', 'Extracted text (OCR)')}>
            {/* AR-10: the recognised text as an accessible text view of the image */}
            <textarea readOnly value={full?.ocrText || ''} aria-label={tr('النص المستخرج من الصورة', 'Text extracted from the image')} dir="auto"
              className={`${inputCls} h-[60vh] font-normal leading-7`} />
          </Section>
        </div>
        {full && (
          <Section title={tr('ما قُرئ من الرموز الشريطية', 'Read from barcodes')}>
            {full.barcodes.length === 0 ? <p className="text-sm text-slate-700">{tr('لا توجد رموز على صفحات هذه الوثيقة.', 'No codes on this document\'s pages.')}</p> : (
              <ul className="text-sm space-y-1">{full.barcodes.map((b: any, i: number) => <li key={i}>{tr('صفحة', 'Page')} {b.page} — {b.type}: <span dir="ltr" className="font-mono break-all">{b.data}</span></li>)}</ul>
            )}
            {Object.keys(doc.meta || {}).length > 0 && <p className="text-sm mt-2">{tr('من ورقة الفصل: ', 'From the separator sheet: ')}<span dir="ltr" className="font-mono">{JSON.stringify(doc.meta)}</span></p>}
            <p className="text-sm text-slate-700 mt-2">{tr(`صفحات الدفعة ${doc.pageFrom}–${doc.pageTo} • ${ar ? 'الحجم' : 'size'} ${Math.round(doc.size / 1024)} KB`, `Batch pages ${doc.pageFrom}–${doc.pageTo} • size ${Math.round(doc.size / 1024)} KB`)}</p>
          </Section>
        )}
      </div>
    </Modal>
  );
}

// =======================================================================================
// Scan through the agent, or upload scanned files
// =======================================================================================
function ScanTab({ onQueued }: { onQueued: () => void }) {
  const { tr, me, announce } = useLas();
  const [agent, setAgent] = useState<null | 'checking' | 'missing' | { scanners: string[]; busy: boolean }>('checking');
  const [opts, setOpts] = useState({ unitId: me.registryUnits.length === 1 ? String(me.registryUnits[0]) : '', separation: 'barcode', scanner: '', dpi: '300', color: 'gray', duplex: true, feeder: true });
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const set = (p: any) => setOpts(o => ({ ...o, ...p }));
  const detect = useCallback(async () => {
    setAgent('checking');
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
      const r = await fetch(`${AGENT}/status`, { signal: ctl.signal });
      clearTimeout(t);
      const j = await r.json();
      setAgent({ scanners: j.scanners || [], busy: !!j.busy });
      if (j.scanners?.length) setOpts(o => ({ ...o, scanner: o.scanner || j.scanners[0] }));
    } catch { setAgent('missing'); }
  }, []);
  useEffect(() => { detect(); }, [detect]);
  const done = (text: string, kind: 'success' | 'error' = 'success') => { setMsg({ kind, text }); announce(text); };

  const scan = async () => {
    if (!opts.unitId) return done(tr('اختر مكتب الصادرة والواردة.', 'Choose the registry desk.'), 'error');
    setBusy(true); setMsg(null);
    try {
      const t = await las('/capture/tickets', 'POST', { unitId: Number(opts.unitId), separation: opts.separation });
      if (!t.ok) return done(t.error || '', 'error');
      const r = await fetch(`${AGENT}/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl: window.location.origin, ticket: t.data.ticket, scanner: opts.scanner, dpi: Number(opts.dpi), color: opts.color, duplex: opts.duplex, feeder: opts.feeder }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return done(j.error || tr('تعذر المسح.', 'The scan failed.'), 'error');
      done(tr(`مُسحت ${j.pages} صفحة وأُرسلت للمعالجة (دفعة ${j.batchId}).`, `${j.pages} pages scanned and sent for processing (batch ${j.batchId}).`));
      setTimeout(onQueued, 1500);
    } catch { done(tr('لا يستجيب برنامج المسح على هذا الحاسوب.', 'The scanning agent on this PC is not responding.'), 'error'); }
    finally { setBusy(false); }
  };
  const upload = async () => {
    if (!opts.unitId) return done(tr('اختر مكتب الصادرة والواردة.', 'Choose the registry desk.'), 'error');
    if (files.length === 0) return done(tr('اختر ملفاً واحداً على الأقل.', 'Choose at least one file.'), 'error');
    setBusy(true); setMsg(null);
    const r = await las('/capture/batches', 'POST', { unitId: Number(opts.unitId), separation: opts.separation, files });
    setBusy(false);
    if (!r.ok) return done(r.error || '', 'error');
    setFiles([]);
    done(tr(`أُرسلت الدفعة ${r.data.batchId} للمعالجة. تظهر وثائقها في قائمة الفهرسة بعد التعرف الضوئي.`, `Batch ${r.data.batchId} sent for processing. Its documents appear in the indexing queue after OCR.`));
    setTimeout(onQueued, 1500);
  };
  return (
    <div className="space-y-4">
      {msg && <Notice kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Notice>}
      <Section title={tr('إعدادات الدفعة', 'Batch settings')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={tr('مكتب الصادرة والواردة', 'Registry desk')} required>{(p) => <UnitSelect {...p} value={opts.unitId} onChange={x => set({ unitId: x })} only={u => me.registryUnits.includes(u.id) && u.active} />}</Field>
          <Field label={tr('فصل الوثائق', 'Document separation')} hint={tr('بأوراق الفصل: كل ورقة فصل تبدأ وثيقة جديدة وتُحذف.', 'With separator sheets: each sheet starts a new document and is removed.')}>
            {(p) => <select {...p} value={opts.separation} onChange={e => set({ separation: e.target.value })} className={inputCls}>
              <option value="barcode">{tr('بأوراق الفصل (رمز QR)', 'By separator sheets (QR code)')}</option><option value="single">{tr('كل ملف وثيقة واحدة', 'Each file is one document')}</option></select>}
          </Field>
        </div>
      </Section>
      <Section title={tr('المسح من الماسح الضوئي (TWAIN)', 'Scan from the scanner (TWAIN)')} actions={<Btn onClick={detect}><RefreshCw className="w-4 h-4" aria-hidden="true" />{tr('إعادة الفحص', 'Check again')}</Btn>}>
        {agent === 'checking' && <p role="status">{tr('جارٍ البحث عن برنامج المسح على هذا الحاسوب…', 'Looking for the scanning agent on this PC…')}</p>}
        {agent === 'missing' && <Notice kind="warn">{tr('برنامج المسح غير مثبت أو لا يعمل على هذا الحاسوب. ثبّته (tools/scan-agent) أو ارفع الملفات الممسوحة أدناه. أجهزة MFP ترسل إلى المجلدات المراقَبة مباشرة.', 'The scanning agent is not installed or not running on this PC. Install it (tools/scan-agent) or upload scanned files below. MFPs send straight to hot folders.')}</Notice>}
        {agent && typeof agent === 'object' && (
          agent.scanners.length === 0 ? <Notice kind="warn">{tr('لم يُعثر على ماسح ضوئي بتعريف TWAIN.', 'No TWAIN scanner found.')}</Notice> : (
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); scan(); }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label={tr('الماسح', 'Scanner')}>{(p) => <select {...p} value={opts.scanner} onChange={e => set({ scanner: e.target.value })} className={inputCls}>{agent.scanners.map(s => <option key={s} value={s}>{s}</option>)}</select>}</Field>
                <Field label={tr('الدقة (نقطة/بوصة)', 'Resolution (dpi)')} hint={tr('300 أفضل للتعرف على النص العربي.', '300 gives the best Arabic OCR.')}>{(p) => <select {...p} value={opts.dpi} onChange={e => set({ dpi: e.target.value })} className={inputCls}>{['200', '300', '400', '600'].map(d => <option key={d} value={d}>{d}</option>)}</select>}</Field>
                <Field label={tr('الألوان', 'Colour')}>{(p) => <select {...p} value={opts.color} onChange={e => set({ color: e.target.value })} className={inputCls}><option value="gray">{tr('رمادي', 'Greyscale')}</option><option value="bw">{tr('أبيض وأسود', 'Black and white')}</option><option value="color">{tr('ملوّن', 'Colour')}</option></select>}</Field>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 min-h-[36px] text-sm cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-blue-800" checked={opts.feeder} onChange={e => set({ feeder: e.target.checked })} />{tr('من وحدة التغذية التلقائية', 'From the document feeder')}</label>
                <label className="flex items-center gap-2 min-h-[36px] text-sm cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-blue-800" checked={opts.duplex} onChange={e => set({ duplex: e.target.checked })} />{tr('على الوجهين', 'Both sides (duplex)')}</label>
              </div>
              <Btn type="submit" variant="primary" disabled={busy || agent.busy}><ScanLine className="w-4 h-4" aria-hidden="true" />{busy ? tr('جارٍ المسح…', 'Scanning…') : tr('ابدأ المسح', 'Start scanning')}</Btn>
            </form>
          ))}
      </Section>
      <Section title={tr('رفع ملفات ممسوحة', 'Upload scanned files')}>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); upload(); }}>
          <FilePicker label={tr('الملفات (PDF أو TIFF أو JPEG أو PNG)', 'Files (PDF, TIFF, JPEG or PNG)')} files={files} onChange={setFiles} hint={tr('تُعالج الملفات بالترتيب كدفعة واحدة.', 'Files are processed in order as one batch.')} />
          <Btn type="submit" variant="primary" disabled={busy}><Upload className="w-4 h-4" aria-hidden="true" />{tr('إرسال للمعالجة', 'Send for processing')}</Btn>
        </form>
      </Section>
    </div>
  );
}

// =======================================================================================
// Batches
// =======================================================================================
function BatchesTab() {
  const { tr, ar, unitName, fmtTime, me } = useLas();
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => { const r = await las('/capture/batches'); if (r.ok) { setRows(r.data); setErr(''); } else setErr(r.error || ''); }, []);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  if (err) return <Notice kind="error">{err}</Notice>;
  if (!rows) return <p role="status">{tr('جارٍ التحميل…', 'Loading…')}</p>;
  return (
    <div className="las-card bg-white border border-slate-300 rounded-xl overflow-x-auto">
      <table className="w-full text-sm"><caption className="sr-only">{tr('دفعات المسح', 'Scan batches')}</caption>
        <thead><tr className="border-b border-slate-400 bg-slate-100">
          {[tr('الدفعة', 'Batch'), tr('المصدر', 'Source'), tr('المكتب', 'Desk'), tr('الحالة', 'Status'), tr('الصفحات / الوثائق', 'Pages / documents'), ''].map((h, i) => <th key={i} scope="col" className="text-start py-2 px-2">{h || <span className="sr-only">{tr('إجراء', 'Action')}</span>}</th>)}
        </tr></thead>
        <tbody>{rows.map(b => (
          <tr key={b.id} className="border-b border-slate-200" data-batch={b.id}>
            <td className="py-2 px-2 font-bold">{b.id}<div className="font-normal text-slate-700">{fmtTime(b.createdAt)}</div></td>
            <td className="py-2 px-2">{pick(SOURCE[b.source], ar, b.source)}<div className="text-slate-700 break-all">{b.sourceName}</div></td>
            <td className="py-2 px-2">{unitName(b.unitId)}</td>
            <td className="py-2 px-2"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-bold ${b.status === 'error' ? 'border-red-700 bg-red-50 text-red-900' : b.status === 'done' ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-500 bg-slate-100'}`}>
              {b.status === 'error' ? <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> : b.status === 'done' ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}{pick(BATCH_STATUS[b.status], ar, b.status)}</span>
              {b.error && <div className="text-red-900 text-xs mt-1 break-all">{b.error}</div>}</td>
            <td className="py-2 px-2">{b.pages ?? '—'} / {b.docs}{b.ready ? tr(` (${b.ready} بانتظار الفهرسة)`, ` (${b.ready} waiting)`) : ''}</td>
            <td className="py-2 px-2">{b.status === 'error' && (me.isSysAdmin || me.registryUnits.includes(b.unitId)) && <Btn onClick={async () => { await las(`/capture/batches/${b.id}/retry`, 'POST', {}); load(); }}>{tr('إعادة المحاولة', 'Retry')}</Btn>}</td>
          </tr>))}
          {rows.length === 0 && <tr><td colSpan={6} className="py-3 px-2">{tr('لا توجد دفعات بعد.', 'No batches yet.')}</td></tr>}</tbody></table>
    </div>
  );
}

// =======================================================================================
// Separator sheets: a QR code that splits the batch and carries indexing metadata
// =======================================================================================
function SeparatorsTab() {
  const { tr, ar, me, units, categories, contacts, lang } = useLas();
  const [v, setV] = useState({ unitId: me.registryUnits.length === 1 ? String(me.registryUnits[0]) : '', categoryId: '', urgency: 'Normal', confidentiality: 'Normal', contactId: '', copies: '5' });
  const set = (p: any) => setV(x => ({ ...x, ...p }));
  const print = async () => {
    const unit = units.find(u => String(u.id) === v.unitId);
    const params = new URLSearchParams({ t: 'IN' });
    if (unit) params.set('u', unit.code);
    if (v.categoryId) params.set('cat', v.categoryId);
    if (v.urgency !== 'Normal') params.set('urg', v.urgency);
    if (v.confidentiality !== 'Normal') params.set('conf', v.confidentiality);
    if (v.contactId) params.set('contact', v.contactId);
    const payload = `LAS1|SEP|${params.toString()}`;
    const qr = await QRCode.toDataURL(payload, { margin: 2, width: 520, errorCorrectionLevel: 'M' });
    const cat = categories.find(c => String(c.id) === v.categoryId);
    const contact = contacts.find(c => String(c.id) === v.contactId);
    const lines = [tr('وارد', 'Incoming'), unit ? `${unit.code} — ${ar ? unit.nameAr : unit.nameEn}` : '', cat ? (ar ? cat.nameAr : cat.nameEn) : '', pick(URGENCY[v.urgency], ar), pick(CONF[v.confidentiality], ar), contact?.name || ''].filter(Boolean);
    const sheet = `<div style="page-break-after:always;height:95vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
      <img src="${qr}" alt="${escapeHtml(tr('رمز ورقة الفصل', 'Separator sheet code'))}" style="width:9cm;height:9cm">
      <h1 style="margin-top:1cm">${escapeHtml(tr('ورقة فاصلة — لا تُؤرشف', 'Separator sheet — not archived'))}</h1>
      <p style="font-size:16pt">${lines.map(escapeHtml).join(' • ')}</p></div>`;
    const n = Math.max(1, Math.min(50, Number(v.copies) || 1));
    printHtml(tr('أوراق الفصل', 'Separator sheets'), Array.from({ length: n }, () => sheet).join(''), lang);
  };
  return (
    <Section title={tr('طباعة أوراق الفصل', 'Print separator sheets')}>
      <p className="text-sm text-slate-700 mb-3">{tr('ضع ورقة فاصلة قبل كل كتاب في رزمة المسح. يبدأ النظام وثيقة جديدة عند كل ورقة، ويحذفها، ويملأ بيانات الفهرسة من رمزها.', 'Put a separator sheet before each letter in the stack. The system starts a new document at each sheet, removes it, and fills in the indexing data from its code.')}</p>
      <form className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end" onSubmit={e => { e.preventDefault(); print(); }}>
        <Field label={tr('مكتب الصادرة والواردة', 'Registry desk')}>{(p) => <UnitSelect {...p} value={v.unitId} onChange={x => set({ unitId: x })} only={u => me.registryUnits.includes(u.id)} />}</Field>
        <Field label={tr('التصنيف', 'Category')}>{(p) => <select {...p} value={v.categoryId} onChange={e => set({ categoryId: e.target.value })} className={inputCls}><option value="">—</option>{categories.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{ar ? c.nameAr : c.nameEn}</option>)}</select>}</Field>
        <Field label={tr('الجهة المرسلة', 'Sender')}>{(p) => <select {...p} value={v.contactId} onChange={e => set({ contactId: e.target.value })} className={inputCls}><option value="">—</option>{contacts.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}</Field>
        <Field label={tr('الاستعجال', 'Urgency')}>{(p) => <select {...p} value={v.urgency} onChange={e => set({ urgency: e.target.value })} className={inputCls}>{Object.entries(URGENCY).map(([k, l]) => <option key={k} value={k}>{pick(l, ar)}</option>)}</select>}</Field>
        <Field label={tr('السرية', 'Confidentiality')}>{(p) => <select {...p} value={v.confidentiality} onChange={e => set({ confidentiality: e.target.value })} className={inputCls}>{Object.entries(CONF).map(([k, l]) => <option key={k} value={k}>{pick(l, ar)}</option>)}</select>}</Field>
        <Field label={tr('عدد النسخ', 'Copies')}>{(p) => <input {...p} type="number" min={1} max={50} value={v.copies} onChange={e => set({ copies: e.target.value })} className={inputCls} />}</Field>
        <Btn type="submit" variant="primary"><Printer className="w-4 h-4" aria-hidden="true" />{tr('طباعة', 'Print')}</Btn>
      </form>
    </Section>
  );
}

// =======================================================================================
// Administrator: hot folders, OCR options, toolchain status
// =======================================================================================
function SettingsTab() {
  const { tr, ar, me, announce } = useLas();
  const [st, setSt] = useState<any>(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [opts, setOpts] = useState<any>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const load = useCallback(async (refresh = false) => {
    const r = await las(`/capture/status${refresh ? '?refresh=1' : ''}`);
    if (!r.ok) return setErr(r.error || '');
    setSt(r.data); setFolders(r.data.hotFolders.map((f: any) => ({ ...f, unitId: String(f.unitId) }))); setOpts(r.data.settings);
  }, []);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    const r = await las('/capture/settings', 'PUT', { hotFolders: folders.map(f => ({ ...f, unitId: Number(f.unitId) })), ocrLanguages: opts.ocrLanguages, cleanFinal: opts.cleanFinal, jobs: Number(opts.jobs), pollSeconds: Number(opts.pollSeconds) });
    if (!r.ok) { setErr(r.error || ''); setOk(''); return; }
    setErr(''); setOk(tr('حُفظت الإعدادات.', 'Settings saved.')); announce(tr('حُفظت الإعدادات.', 'Settings saved.')); load();
  };
  if (!st || !opts) return err ? <Notice kind="error">{err}</Notice> : <p role="status">{tr('جارٍ التحميل…', 'Loading…')}</p>;
  return (
    <div className="space-y-4">
      {err && <Notice kind="error" onClose={() => setErr('')}>{err}</Notice>}
      {ok && <Notice kind="success" onClose={() => setOk('')}>{ok}</Notice>}
      <Section title={tr('أدوات المعالجة على الخادم', 'Processing tools on the server')} actions={<Btn onClick={() => load(true)}><RefreshCw className="w-4 h-4" aria-hidden="true" />{tr('فحص', 'Check')}</Btn>}>
        <Notice kind={st.tools.ready ? 'success' : 'error'}>{st.tools.ready ? tr('كل الأدوات جاهزة: التعرف الضوئي بالعربية والإنجليزية، تصحيح الميلان، إزالة التشويش، قراءة الرموز، التحويل إلى PDF/A.', 'All tools ready: Arabic + English OCR, deskew, despeckle, barcode reading, PDF/A conversion.') : tr(`أدوات ناقصة: ${st.tools.missing.join('، ')}. تُحفظ الدفعات حتى تُثبَّت.`, `Missing: ${st.tools.missing.join(', ')}. Batches are kept until they are installed.`)}</Notice>
        <ul className="text-sm mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">{Object.entries(st.tools.tools).map(([k, t]: any) => <li key={k}>{t.ok ? '✔' : '✘'} <strong>{k}</strong> <span dir="ltr" className="text-slate-700">{t.version}</span></li>)}</ul>
      </Section>
      <Section title={tr('المجلدات المراقَبة (MFP / برنامج الماسح)', 'Hot folders (MFPs / scanner software)')}
        actions={<Btn onClick={() => setFolders([...folders, { id: `hf${Date.now()}`, name: '', path: '', unitId: me.registryUnits[0] ? String(me.registryUnits[0]) : '', separation: 'barcode', enabled: true }])}><Plus className="w-4 h-4" aria-hidden="true" />{tr('إضافة مجلد', 'Add folder')}</Btn>}>
        <p className="text-sm text-slate-700 mb-3">{tr('يُفحص كل مجلد دورياً؛ كل ملف جديد (PDF أو TIFF أو JPEG أو PNG) يُنقل إلى المعالجة ثم يظهر في قائمة الفهرسة لمكتبه. شارك المجلد على الشبكة مع أجهزة MFP أو برنامج الماسح (يدعم ISIS وTWAIN).', 'Each folder is checked regularly; every new PDF, TIFF, JPEG or PNG file is taken for processing and then appears in its desk\'s indexing queue. Share the folder with the MFPs or the scanner software (ISIS or TWAIN).')}</p>
        <div className="space-y-3">
          {folders.map((f, i) => (
            <fieldset key={f.id} className="border border-slate-400 rounded-lg p-3">
              <legend className="px-1 text-sm font-semibold">{f.name || tr(`مجلد ${i + 1}`, `Folder ${i + 1}`)} {st.hotFolders.find((h: any) => h.id === f.id) && (st.hotFolders.find((h: any) => h.id === f.id).reachable ? tr('— متاح', '— reachable') : tr('— لا يمكن الوصول إليه', '— not reachable'))}</legend>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                <Field label={tr('الاسم', 'Name')}>{(p) => <input {...p} value={f.name} onChange={e => setFolders(folders.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className={inputCls} />}</Field>
                <Field label={tr('المسار على الخادم', 'Path on the server')}>{(p) => <input {...p} dir="ltr" value={f.path} onChange={e => setFolders(folders.map((x, j) => j === i ? { ...x, path: e.target.value } : x))} className={inputCls} placeholder="/hotfolders/registry-d1" />}</Field>
                <Field label={tr('المكتب', 'Desk')}>{(p) => <UnitSelect {...p} value={f.unitId} onChange={x => setFolders(folders.map((y, j) => j === i ? { ...y, unitId: x } : y))} />}</Field>
                <Field label={tr('الفصل', 'Separation')}>{(p) => <select {...p} value={f.separation} onChange={e => setFolders(folders.map((x, j) => j === i ? { ...x, separation: e.target.value } : x))} className={inputCls}><option value="barcode">{tr('أوراق الفصل', 'Separator sheets')}</option><option value="single">{tr('ملف = وثيقة', 'File = document')}</option></select>}</Field>
                <div className="flex gap-2 items-center">
                  <label className="flex items-center gap-2 min-h-[42px] text-sm cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-blue-800" checked={f.enabled} onChange={e => setFolders(folders.map((x, j) => j === i ? { ...x, enabled: e.target.checked } : x))} />{tr('مفعّل', 'Enabled')}</label>
                  <Btn variant="danger" aria-label={tr(`حذف ${f.name}`, `Remove ${f.name}`)} onClick={() => setFolders(folders.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" aria-hidden="true" /></Btn>
                </div>
              </div>
            </fieldset>
          ))}
          {folders.length === 0 && <p className="text-sm text-slate-700">{tr('لا توجد مجلدات بعد.', 'No hot folders yet.')}</p>}
        </div>
      </Section>
      <Section title={tr('خيارات التعرف الضوئي', 'OCR options')}>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Field label={tr('اللغات', 'Languages')} hint="ara+eng">{(p) => <input {...p} dir="ltr" value={opts.ocrLanguages} onChange={e => setOpts({ ...opts, ocrLanguages: e.target.value })} className={inputCls} />}</Field>
          <Field label={tr('معالجات متوازية', 'Parallel jobs')}>{(p) => <input {...p} type="number" min={1} max={8} value={opts.jobs} onChange={e => setOpts({ ...opts, jobs: e.target.value })} className={inputCls} />}</Field>
          <Field label={tr('فحص المجلدات كل (ثانية)', 'Check folders every (s)')}>{(p) => <input {...p} type="number" min={3} max={600} value={opts.pollSeconds} onChange={e => setOpts({ ...opts, pollSeconds: e.target.value })} className={inputCls} />}</Field>
          <label className="flex items-center gap-2 min-h-[42px] text-sm cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-blue-800" checked={opts.cleanFinal} onChange={e => setOpts({ ...opts, cleanFinal: e.target.checked })} />{tr('إزالة التشويش من الصورة المحفوظة', 'Despeckle the stored image')}</label>
        </div>
      </Section>
      <Btn variant="primary" onClick={save}>{tr('حفظ إعدادات الإدخال', 'Save capture settings')}</Btn>
      <p className="text-sm text-slate-700">{tr(`الدفعات: ${Object.entries(st.counts).map(([k, n]) => `${pick(BATCH_STATUS[k], ar, k)} ${n}`).join(' • ') || '—'}`, `Batches: ${Object.entries(st.counts).map(([k, n]) => `${pick(BATCH_STATUS[k], ar, k)} ${n}`).join(' • ') || '—'}`)}</p>
    </div>
  );
}
