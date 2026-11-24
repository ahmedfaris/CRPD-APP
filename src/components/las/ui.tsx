// Letters Archive System — shared state, API helper, labels and accessible UI building blocks.
// Accessibility (section 5): every field has a visible label, status is never colour alone,
// focus is always visible, targets are at least 40px high, and text follows the page language.
import React, { createContext, useContext, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2, Clock, AlertTriangle, FileEdit, Send, Archive, XCircle, CornerUpLeft, Inbox, Lock, ShieldAlert, Flame, X,
} from 'lucide-react';

// ---- API ---------------------------------------------------------------------------------
export interface ApiResult<T = any> { ok: boolean; status: number; data?: T; error?: string; code?: string; raw?: any }
export async function las<T = any>(path: string, method = 'GET', body?: any): Promise<ApiResult<T>> {
  try {
    const token = localStorage.getItem('auth_token');
    const res = await fetch('/api/las' + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && json.success !== false, status: res.status, data: json.data, error: json.error, code: json.code, raw: json };
  } catch (e: any) {
    return { ok: false, status: 0, error: 'تعذر الاتصال بالخادم. تحقق من الشبكة وحاول مرة أخرى. / Could not reach the server.' };
  }
}
/** Files need the login token, so they are fetched and then opened or saved from memory. */
export async function openAttachment(id: number, viaLetterId: number, fileName: string, download = false) {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`/api/las/attachments/${id}/download?letter=${viaLetterId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) return false;
  const url = URL.createObjectURL(await res.blob());
  if (download) { const a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); } else window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

// ---- shared state ----------------------------------------------------------------------------
export interface Unit { id: number; parentId: number | null; nameAr: string; nameEn: string; type: string; code: string; active: boolean }
export interface Me {
  uid: string; name: string; isSysAdmin: boolean; isAuditor: boolean; today: string;
  roles: Array<{ id: number | null; role: string; unitId: number; unitCode: string; scope: string; delegatedBy: string | null }>;
  registryUnits: number[]; memberUnits: number[]; headUnits: number[]; exactHeadUnits: number[]; viewUnits: number[];
  settings: { prefixes: Record<string, string>; numberFormat: string; seqPad: number; seqLevel: string; reminderDays: number; institutionNameAr: string; institutionNameEn: string };
}
export interface LasState {
  lang: 'ar' | 'en'; ar: boolean; westernDigits: boolean; highContrast: boolean;
  tr: (ar: string, en: string) => string;
  me: Me; units: Unit[]; categories: any[]; contacts: any[]; users: any[];
  unitName: (id?: number | null) => string; unitById: (id?: number | null) => Unit | undefined;
  userName: (uid?: string | null) => string; categoryName: (id?: number | null) => string;
  fmtDate: (d?: string | null) => string; fmtTime: (d?: string | null) => string;
  reload: () => Promise<void>;
  openLetter: (id: number) => void;
  announce: (msg: string) => void;
}
export const LasContext = createContext<LasState | null>(null);
export const useLas = () => {
  const c = useContext(LasContext);
  if (!c) throw new Error('LasContext missing');
  return c;
};

// ---- labels -------------------------------------------------------------------------------------
type Pair = [string, string]; // [Arabic, English]
export const STATUS_LABELS: Record<string, { label: Pair; icon: any; cls: string }> = {
  Draft: { label: ['مسودة', 'Draft'], icon: FileEdit, cls: 'bg-slate-100 text-slate-800 border-slate-400' },
  Returned: { label: ['معادة للتعديل', 'Returned'], icon: CornerUpLeft, cls: 'bg-orange-50 text-orange-900 border-orange-500' },
  Rejected: { label: ['مرفوضة', 'Rejected'], icon: XCircle, cls: 'bg-red-50 text-red-900 border-red-600' },
  'Awaiting approval': { label: ['بانتظار الموافقة', 'Awaiting approval'], icon: Clock, cls: 'bg-violet-50 text-violet-900 border-violet-500' },
  Registered: { label: ['مسجّل', 'Registered'], icon: Inbox, cls: 'bg-blue-50 text-blue-900 border-blue-600' },
  Referred: { label: ['محال', 'Referred'], icon: Send, cls: 'bg-cyan-50 text-cyan-900 border-cyan-600' },
  'In progress': { label: ['قيد الإنجاز', 'In progress'], icon: Clock, cls: 'bg-amber-50 text-amber-900 border-amber-600' },
  Replied: { label: ['تمت الإجابة', 'Replied'], icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-900 border-emerald-600' },
  Closed: { label: ['مغلق', 'Closed'], icon: Lock, cls: 'bg-slate-200 text-slate-900 border-slate-600' },
  Archived: { label: ['مؤرشف', 'Archived'], icon: Archive, cls: 'bg-slate-200 text-slate-900 border-slate-700' },
  Cancelled: { label: ['ملغى', 'Cancelled'], icon: XCircle, cls: 'bg-red-50 text-red-900 border-red-600' },
};
export const URGENCY: Record<string, Pair> = { Normal: ['عادي', 'Normal'], Urgent: ['عاجل', 'Urgent'], 'Very urgent': ['عاجل جداً', 'Very urgent'] };
export const CONF: Record<string, Pair> = { Normal: ['اعتيادي', 'Normal'], Confidential: ['سري', 'Confidential'], Sensitive: ['بيانات شخصية / حساسة', 'Personal / sensitive data'] };
export const INSTRUCTION: Record<string, Pair> = { 'For action': ['لإجراء اللازم', 'For action'], 'For opinion': ['لبيان الرأي', 'For opinion'], 'For information': ['للاطلاع', 'For information'], 'For filing': ['للحفظ', 'For filing'] };
export const REFERRAL_STATUS: Record<string, Pair> = { Pending: ['بانتظار الاستلام', 'Pending'], Accepted: ['مستلمة', 'Accepted'], Returned: ['معادة', 'Returned'], Completed: ['منجزة', 'Completed'], Recalled: ['مسحوبة', 'Recalled'], 'Re-referred': ['أُحيلت لجهة أخرى', 'Re-referred'] };
export const ROLE: Record<string, Pair> = {
  chair: ['رئيس المؤسسة / الأمين العام', 'Chair / Secretary-General'], director: ['مدير دائرة', 'Director'], dept_head: ['رئيس قسم', 'Department head'],
  division_head: ['مسؤول شعبة', 'Division head'], clerk: ['موظف الصادرة والواردة', 'Correspondence clerk'], employee: ['موظف', 'Employee'], viewer: ['مطّلع / مدقق', 'Viewer / auditor'],
};
export const DECISION: Record<string, Pair> = { Pending: ['بانتظار القرار', 'Pending'], Approved: ['موافق', 'Approved'], Returned: ['أعيد للتعديل', 'Returned'], Rejected: ['مرفوض', 'Rejected'], Skipped: ['لم يعد مطلوباً', 'No longer needed'] };
export const MUT_DECISION: Record<string, Pair> = {
  Approved: ['موافق', 'Approved'], 'Approved with amendments': ['موافق مع التعديل', 'Approved with amendments'], Rejected: ['مرفوض', 'Rejected'],
  'Returned for further study': ['يعاد لمزيد من الدراسة', 'Returned for further study'], Noted: ['للاطلاع', 'Noted'],
};
export const REPORT_KIND: Record<string, Pair> = { periodic: ['دوري', 'Periodic'], field_visit: ['زيارة ميدانية', 'Field visit'], committee: ['لجنة / تحقيق', 'Committee / investigation'], statistical: ['إحصائي', 'Statistical'], external: ['وارد من جهة خارجية', 'From an outside body'] };
export const REPORT_STATUS: Record<string, Pair> = { draft: ['مسودة', 'Draft'], reviewed: ['مدقق', 'Reviewed'], approved: ['معتمد', 'Approved'] };
export const DISPATCH: Record<string, Pair> = { 'Hand delivery': ['تسليم باليد', 'Hand delivery'], Mail: ['بريد', 'Mail'], Email: ['بريد إلكتروني', 'Email'], Courier: ['شركة توصيل', 'Courier'] };
export const CONTACT_TYPE: Record<string, Pair> = { ministry: ['وزارة', 'Ministry'], governorate: ['محافظة', 'Governorate'], government: ['جهة حكومية', 'Government body'], ngo: ['منظمة غير حكومية', 'NGO'], international: ['منظمة دولية', 'International organization'], individual: ['فرد', 'Individual'], other: ['أخرى', 'Other'] };
export const UNIT_TYPE: Record<string, Pair> = { org: ['المؤسسة', 'Institution'], directorate: ['دائرة', 'Directorate'], department: ['قسم', 'Department'], division: ['شعبة', 'Division'] };
export const pick = (p: Pair | undefined, ar: boolean, fallback = '') => (p ? (ar ? p[0] : p[1]) : fallback);

export function typeLabel(l: any, ar: boolean): string {
  if (l.archiveType === 'mutalaa') return ar ? 'مطالعة' : "Mutala'a";
  if (l.archiveType === 'report') return ar ? 'تقرير' : 'Report';
  const dir = l.direction === 'IN' ? (ar ? 'وارد' : 'Incoming') : (l.isMemo ? (ar ? 'مذكرة داخلية' : 'Internal memo') : (ar ? 'صادر' : 'Outgoing'));
  const scope = l.scope === 'internal' ? (ar ? 'داخلي' : 'internal') : (ar ? 'خارجي' : 'external');
  return l.isMemo ? dir : `${dir} ${scope}`;
}

// ---- building blocks ---------------------------------------------------------------------------------
export const inputCls = 'las-input w-full min-h-[42px] rounded-lg border border-slate-500 bg-white px-3 py-2 text-base text-slate-900 placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1 disabled:bg-slate-100 disabled:text-slate-600';

export function Field({ label, hint, error, required, children }: { key?: React.Key; label: string; hint?: string; error?: string; required?: boolean; children: (p: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; required?: boolean }) => React.ReactNode }) {
  const id = useId();
  const describedBy = [hint ? `${id}-h` : '', error ? `${id}-e` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900 mb-1">
        {label}{required && <span className="text-red-700" aria-hidden="true"> *</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })}
      {hint && <p id={`${id}-h`} className="text-sm text-slate-700 mt-1">{hint}</p>}
      {error && <p id={`${id}-e`} className="text-sm font-semibold text-red-800 mt-1">{error}</p>}
    </div>
  );
}

const BTN: Record<string, string> = {
  primary: 'bg-blue-800 text-white hover:bg-blue-900 border-blue-900',
  secondary: 'bg-white text-slate-900 hover:bg-slate-100 border-slate-500',
  danger: 'bg-red-700 text-white hover:bg-red-800 border-red-900',
  success: 'bg-emerald-800 text-white hover:bg-emerald-900 border-emerald-900',
};
export function Btn({ variant = 'secondary', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'success' }) {
  return (
    <button type="button" {...p}
      className={`las-btn inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-lg border text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${BTN[variant]} ${className}`} />
  );
}

/** Status is always shown with an icon and text, never by colour alone (AR-4). */
export function StatusBadge({ status }: { status: string }) {
  const { ar } = useLas();
  const s = STATUS_LABELS[status] || { label: [status, status] as Pair, icon: Clock, cls: 'bg-slate-100 text-slate-800 border-slate-400' };
  const Icon = s.icon;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-bold whitespace-nowrap ${s.cls}`}><Icon className="w-3.5 h-3.5" aria-hidden="true" />{pick(s.label, ar)}</span>;
}
export function Flags({ l }: { l: any }) {
  const { ar } = useLas();
  return (
    <>
      {l.urgency && l.urgency !== 'Normal' && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-red-700 bg-red-50 text-red-900 text-xs font-bold whitespace-nowrap"><Flame className="w-3.5 h-3.5" aria-hidden="true" />{pick(URGENCY[l.urgency], ar)}</span>
      )}
      {l.confidentiality && l.confidentiality !== 'Normal' && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-purple-700 bg-purple-50 text-purple-900 text-xs font-bold whitespace-nowrap"><ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />{pick(CONF[l.confidentiality], ar)}</span>
      )}
      {l.overdue && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-red-800 bg-red-100 text-red-900 text-xs font-bold whitespace-nowrap"><AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />{ar ? 'متأخر' : 'Overdue'}</span>
      )}
    </>
  );
}

export function Notice({ kind = 'info', children, onClose }: { kind?: 'info' | 'error' | 'success' | 'warn'; children: React.ReactNode; onClose?: () => void }) {
  const { ar } = useLas();
  const cls = { info: 'bg-blue-50 border-blue-700 text-blue-950', error: 'bg-red-50 border-red-700 text-red-950', success: 'bg-emerald-50 border-emerald-700 text-emerald-950', warn: 'bg-amber-50 border-amber-700 text-amber-950' }[kind];
  const Icon = kind === 'error' ? XCircle : kind === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 border-s-4 border rounded-lg px-3 py-2.5 text-sm font-semibold ${cls}`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">{children}</div>
      {onClose && <button type="button" onClick={onClose} aria-label={ar ? 'إغلاق الرسالة' : 'Dismiss message'} className="min-w-[28px] min-h-[28px] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"><X className="w-4 h-4 mx-auto" aria-hidden="true" /></button>}
    </div>
  );
}

/** Native <dialog>: traps focus, closes with Escape and returns focus to the opener. */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { ar, lang, highContrast } = useLas();
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => { if (d?.open) d.close(); };
  }, []);
  // Rendered at the end of <body>, not inside the page: a dialog opened from inside a form (e.g.
  // "add a party" in the registration form) would otherwise put a form inside a form, and saving it
  // made the browser submit the outer page form natively — reloading the app.
  // onSubmit also stops React's submit event from reaching a form in the component tree below.
  return createPortal(
    <dialog ref={ref} aria-labelledby={id} lang={lang} dir={ar ? 'rtl' : 'ltr'} onCancel={(e) => { e.preventDefault(); onClose(); }} onSubmit={(e) => e.stopPropagation()}
      className={`las-root las-dialog ${highContrast ? 'las-hc' : ''} rounded-2xl border border-slate-500 p-0 w-full ${wide ? 'max-w-5xl' : 'max-w-2xl'} max-h-[92vh] backdrop:bg-slate-900/60 text-slate-900 bg-white`}>
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-300 sticky top-0 bg-white z-10">
        <h2 id={id} className="text-lg font-bold">{title}</h2>
        <button type="button" onClick={onClose} aria-label={ar ? 'إغلاق' : 'Close'} className="min-w-[40px] min-h-[40px] rounded-lg border border-slate-400 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"><X className="w-5 h-5 mx-auto" aria-hidden="true" /></button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>,
    document.body,
  );
}

export function UnitSelect({ value, onChange, only, placeholder, ...rest }: { value: string; onChange: (v: string) => void; only?: (u: Unit) => boolean; placeholder?: string } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'>) {
  const { units, ar, tr } = useLas();
  const list = units.filter(u => (only ? only(u) : true)).sort((a, b) => a.code.localeCompare(b.code));
  return (
    <select {...rest} value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
      <option value="">{placeholder || tr('— اختر الوحدة —', '— Choose a unit —')}</option>
      {list.map(u => <option key={u.id} value={u.id}>{u.code} — {ar ? u.nameAr : u.nameEn}{u.active ? '' : tr(' (موقوفة)', ' (deactivated)')}</option>)}
    </select>
  );
}

export function CheckList({ legend, options, value, onChange, hint }: { legend: string; options: Array<{ value: string; label: string }>; value: string[]; onChange: (v: string[]) => void; hint?: string }) {
  return (
    <fieldset className="border border-slate-400 rounded-lg p-3">
      <legend className="px-1 text-sm font-semibold text-slate-900">{legend}</legend>
      {hint && <p className="text-sm text-slate-700 mb-2">{hint}</p>}
      <div className="max-h-44 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        {options.map(o => (
          <label key={o.value} className="flex items-center gap-2 min-h-[36px] text-sm cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-blue-800" checked={value.includes(o.value)}
              onChange={e => onChange(e.target.checked ? [...value, o.value] : value.filter(v => v !== o.value))} />
            <span>{o.label}</span>
          </label>
        ))}
        {options.length === 0 && <span className="text-sm text-slate-700">—</span>}
      </div>
    </fieldset>
  );
}

export interface PickedFile { name: string; dataUrl: string; isOriginalScan?: boolean }
export function FilePicker({ label, files, onChange, markFirstAsScan, hint }: { label: string; files: PickedFile[]; onChange: (f: PickedFile[]) => void; markFirstAsScan?: boolean; hint?: string }) {
  const { tr } = useLas();
  const add = async (list: FileList | null) => {
    if (!list) return;
    const read = (f: File) => new Promise<PickedFile>((resolve) => { const r = new FileReader(); r.onloadend = () => resolve({ name: f.name, dataUrl: String(r.result) }); r.readAsDataURL(f); });
    const next = [...files, ...(await Promise.all([...list].map(read)))];
    onChange(next.map((f, i) => ({ ...f, isOriginalScan: markFirstAsScan ? i === 0 : f.isOriginalScan })));
  };
  return (
    <Field label={label} hint={hint || tr('PDF أو صورة أو Word أو Excel، حتى 25 ميغابايت لكل ملف.', 'PDF, image, Word or Excel, up to 25 MB each.')}>
      {(p) => (
        <>
          <input {...p} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx" onChange={e => { add(e.target.files); e.target.value = ''; }} className={inputCls} />
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm border border-slate-300 rounded-lg px-3 py-1.5">
                  <span>{f.name}{f.isOriginalScan ? tr(' — النسخة الأصلية الممسوحة', ' — original scan') : ''}</span>
                  <Btn onClick={() => onChange(files.filter((_, j) => j !== i).map((x, j) => ({ ...x, isOriginalScan: markFirstAsScan ? j === 0 : x.isOriginalScan })))} aria-label={tr(`إزالة الملف ${f.name}`, `Remove file ${f.name}`)} className="!min-h-[32px] !px-2">
                    <X className="w-4 h-4" aria-hidden="true" />
                  </Btn>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Field>
  );
}

export function Section({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="las-card bg-white border border-slate-300 rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function downloadCsv(fileName: string, header: string[], rows: any[][]) {
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob(['﻿' + [header, ...rows].map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** Open a print window with real text (so "Save as PDF" gives a tagged, readable document — AR-9). */
export function printHtml(title: string, bodyHtml: string, lang: 'ar' | 'en', large = false) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(`<!doctype html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#000;margin:24px;font-size:${large ? '20pt' : '12pt'};line-height:1.7}
h1{font-size:1.3em;text-align:center;margin:0 0 4px}h2{font-size:1.05em;margin:14px 0 6px}table{width:100%;border-collapse:collapse}
th,td{border:1px solid #000;padding:5px 7px;text-align:start;vertical-align:top}th{background:#eee}.meta{display:flex;justify-content:space-between;gap:16px;margin:14px 0}
.body{white-space:pre-wrap;margin:18px 0}.sign{margin-top:48px;text-align:end}.label{border:2px solid #000;padding:10px;width:320px;text-align:center}
@media print{button{display:none}}</style></head><body>${bodyHtml}<p><button onclick="window.print()">🖨</button></p></body></html>`);
  w.document.close();
  w.focus();
  return true;
}
export const escapeHtml = (s: any) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
