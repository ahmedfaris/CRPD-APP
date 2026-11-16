// Letters Archive System — inbox, search / archive browser, dashboard and reports, administration, audit.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Download, Printer, RefreshCw, Folder, Trash2, ShieldCheck } from 'lucide-react';
import {
  useLas, las, Field, Btn, Notice, UnitSelect, Section, StatusBadge, Flags, inputCls, typeLabel, pick, downloadCsv, printHtml, escapeHtml,
  STATUS_LABELS, URGENCY, INSTRUCTION, ROLE, REPORT_KIND, CONTACT_TYPE, UNIT_TYPE,
} from './ui';

const th = 'text-start py-2 px-2 font-bold';
const td = 'py-2 px-2 align-top';
function LetterLink({ id, number, subject }: { id: number; number?: string | null; subject?: string }) {
  const { openLetter, tr } = useLas();
  return (
    <button type="button" onClick={() => openLetter(id)} className="text-start text-blue-800 underline font-semibold min-h-[32px] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">
      <span dir="ltr">{number || tr('مسودة', 'Draft')}</span>{subject ? <span className="text-slate-900 no-underline font-normal"> — {subject}</span> : null}
    </button>
  );
}

// =======================================================================================
// Inbox (4.4)
// =======================================================================================
export function InboxView({ refreshKey }: { refreshKey: number }) {
  const { tr, ar, fmtDate, fmtTime, unitName, userName } = useLas();
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => { const r = await las('/inbox'); if (r.ok) { setD(r.data); setErr(''); } else setErr(r.error || ''); }, []);
  useEffect(() => { load(); }, [load, refreshKey]);
  if (err) return <Notice kind="error">{err}</Notice>;
  if (!d) return <p role="status">{tr('جارٍ التحميل…', 'Loading…')}</p>;
  const empty = <p className="text-sm text-slate-700">{tr('لا يوجد شيء هنا.', 'Nothing here.')}</p>;
  const c = d.counts;
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 md:grid-cols-5 gap-2" aria-label={tr('ملخص البريد', 'Inbox summary')}>
        {[[tr('إحالات', 'Referrals'), c.referrals], [tr('بانتظار قراري', 'Awaiting my decision'), c.approvals], [tr('بانتظار الاستلام', 'Awaiting receipt'), c.deliveries], [tr('قريبة الموعد', 'Due soon'), c.dueSoon], [tr('متأخرة', 'Overdue'), c.overdue]].map(([label, n]) => (
          <li key={label as string} className="las-card bg-white border border-slate-300 rounded-xl p-3"><div className="text-sm text-slate-700">{label}</div><div className="text-2xl font-black">{n}</div></li>
        ))}
      </ul>

      <Section title={tr(`الإحالات الواردة إليّ (${d.referrals.length})`, `Referrals to me (${d.referrals.length})`)}>
        {d.referrals.length === 0 ? empty : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">{tr('الإحالات المفتوحة', 'Open referrals')}</caption>
            <thead><tr className="border-b border-slate-300"><th scope="col" className={th}>{tr('الكتاب', 'Letter')}</th><th scope="col" className={th}>{tr('من', 'From')}</th><th scope="col" className={th}>{tr('التوجيه', 'Instruction')}</th><th scope="col" className={th}>{tr('الموعد', 'Due')}</th></tr></thead>
            <tbody>{d.referrals.map((r: any) => (
              <tr key={r.id} className="border-b border-slate-200">
                <td className={td}><LetterLink id={r.letterId} number={r.number} subject={r.subject} /><div className="flex flex-wrap gap-1 mt-1"><Flags l={{ urgency: r.urgency, confidentiality: r.confidentiality, overdue: r.overdue }} />{r.dueSoon && <span className="px-2 py-0.5 rounded-md border border-amber-700 bg-amber-50 text-amber-900 text-xs font-bold">{tr('قريب الموعد', 'Due soon')}</span>}</div></td>
                <td className={td}>{r.fromName}<div className="text-slate-700">{fmtTime(r.sentAt)}</div></td>
                <td className={td}>{pick(INSTRUCTION[r.instruction], ar)}{r.status === 'Pending' ? tr(' — لم تُستلم', ' — not accepted yet') : ''}</td>
                <td className={td}>{fmtDate(r.dueDate) || '—'}</td>
              </tr>))}</tbody></table></div>
        )}
      </Section>

      {(d.approvals.length > 0 || d.mutalaat.length > 0) && (
        <Section title={tr('بانتظار موافقتي أو رأيي', 'Awaiting my approval or opinion')}>
          <ul className="space-y-1">
            {d.approvals.map((a: any) => <li key={`a${a.id}`}><LetterLink id={a.letterId} number={a.number} subject={a.subject} /> <span className="text-sm text-slate-700">({tr('مسودة من', 'draft by')} {a.createdByName})</span></li>)}
            {d.mutalaat.map((m: any) => <li key={`m${m.letterId}`}><LetterLink id={m.letterId} number={m.number} subject={m.subject} /> <span className="text-sm text-slate-700">({m.currentLevelUnitId === m.addressedUnitId ? tr('بانتظار توجيهكم', 'awaiting your directive') : tr('بانتظار رأيكم', 'awaiting your opinion')})</span></li>)}
          </ul>
        </Section>
      )}
      {d.deliveries.length > 0 && (
        <Section title={tr('كتب داخلية بانتظار تأكيد الاستلام', 'Internal letters awaiting receipt')}>
          <ul className="space-y-1">{d.deliveries.map((x: any) => <li key={x.id}><LetterLink id={x.letterId} number={x.number} subject={x.subject} /> <span className="text-sm text-slate-700">({tr('من', 'from')} <span dir="ltr">{x.fromUnitCode}</span>{x.isCc ? tr('، نسخة', ', copy') : ''})</span></li>)}</ul>
        </Section>
      )}
      {d.drafts.length > 0 && (
        <Section title={tr('مسوداتي', 'My drafts')}>
          <ul className="space-y-1">{d.drafts.map((x: any) => <li key={x.letterId} className="flex flex-wrap items-center gap-2"><LetterLink id={x.letterId} number={x.number} subject={x.subject} /><StatusBadge status={x.letterStatus} /></li>)}</ul>
        </Section>
      )}
      {d.escalated.length > 0 && (
        <Section title={tr('إحالات متأخرة في وحداتي (تصعيد)', 'Overdue referrals in my units (escalated)')}>
          <ul className="space-y-1">{d.escalated.map((x: any) => <li key={x.id}><LetterLink id={x.letterId} number={x.number} subject={x.subject} /> <span className="text-sm text-slate-700">— {x.toUid ? userName(x.toUid) : unitName(x.toUnitId)} — {tr('الموعد', 'due')} {fmtDate(x.dueDate)}</span></li>)}</ul>
        </Section>
      )}
      <Section title={tr(`الإشعارات (${c.unread} غير مقروء)`, `Notifications (${c.unread} unread)`)} actions={c.unread > 0 ? <Btn onClick={async () => { await las('/notifications/read', 'POST', {}); load(); }}>{tr('تعليم الكل كمقروء', 'Mark all as read')}</Btn> : undefined}>
        {d.notifications.length === 0 ? empty : (
          <ul className="space-y-1">{d.notifications.slice(0, 20).map((n: any) => (
            <li key={n.id} className={`text-sm border-s-4 ps-2 py-1 ${n.readAt ? 'border-slate-300' : 'border-blue-700 font-bold'}`}>
              {n.letterId ? <LetterLinkText id={n.letterId} text={ar ? n.textAr : n.textEn} /> : (ar ? n.textAr : n.textEn)} <span className="text-slate-700 font-normal">— {fmtTime(n.sentAt)}{n.readAt ? '' : tr(' (جديد)', ' (new)')}</span>
            </li>))}</ul>
        )}
      </Section>
    </div>
  );
}
function LetterLinkText({ id, text }: { id: number; text: string }) {
  const { openLetter } = useLas();
  return <button type="button" onClick={() => openLetter(id)} className="text-start text-blue-800 underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">{text}</button>;
}

// =======================================================================================
// Search and archive browser (4.6, 2.4)
// =======================================================================================
export function ArchiveView({ refreshKey, focusSearch }: { refreshKey: number; focusSearch: number }) {
  const { tr, ar, categories, contacts, fmtDate, me } = useLas();
  const [f, setF] = useState<any>({ q: '', type: '', direction: '', scope: '', unitId: '', categoryId: '', status: '', urgency: '', from: '', to: '', contactId: '', reportKind: '', overdue: false });
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  const [view, setView] = useState<'list' | 'folders'>('list');
  const set = (patch: any) => setF((x: any) => ({ ...x, ...patch }));
  const searchRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusSearch) searchRef.current?.focus(); }, [focusSearch]);

  const run = useCallback(async (filters = f) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v === true ? '1' : String(v));
    const r = await las('/letters?' + p.toString());
    if (!r.ok) { setErr(r.error || ''); return; }
    setErr(''); setRows(r.data);
  }, [f]);
  useEffect(() => { run(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = () => rows && downloadCsv(`archive-${me.today}.csv`,
    ['Number', 'Type', 'Unit', 'Subject', 'Party', 'Sender ref', 'Letter date', 'Status', 'Urgency', 'Confidentiality', 'Due', 'Archived by', 'Archived at', 'Folder'],
    rows.map(l => [l.number, typeLabel(l, false), l.unitCode, l.subject, l.contactName, l.externalRefNo, l.letterDate, l.status, l.urgency, l.confidentiality, l.dueDate, l.archivedByName, l.archivedAt, l.folderPath]));

  // Folder view: the same records grouped by their archive folder (unit / year / type / direction / month).
  const folders = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const l of rows || []) { const key = l.folderPath ? l.folderPath.split('/').slice(0, -1).join(' / ') : tr('مسودات', 'Drafts'); map.set(key, [...(map.get(key) || []), l]); }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <div className="space-y-4">
      <form role="search" aria-label={tr('البحث في الأرشيف', 'Search the archive')} onSubmit={e => { e.preventDefault(); run(); }} className="las-card bg-white border border-slate-300 rounded-xl p-4 space-y-3">
        <Field label={tr('بحث سريع', 'Quick search')} hint={tr('الرقم، الموضوع، الجهة، أو امسح رمز QR من الملصق. البحث لا يفرّق بين أ/ا و ة/ه و ى/ي.', 'Number, subject, party, or scan the label QR code. Arabic spelling variants are matched.')}>
          {(p) => <input {...p} ref={searchRef} type="search" value={f.q} onChange={e => set({ q: e.target.value })} className={inputCls} />}
        </Field>
        <details>
          <summary className="cursor-pointer font-bold text-sm min-h-[36px] flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded">{tr('بحث متقدم', 'Advanced search')}</summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <Field label={tr('نوع الأرشيف', 'Archive type')}>{(p) => <select {...p} value={f.type} onChange={e => set({ type: e.target.value })} className={inputCls}><option value="">{tr('الكل', 'All')}</option><option value="letter">{tr('الكتب الرسمية', 'Official letters')}</option><option value="mutalaa">{tr('المطالعات', "Mutala'at")}</option><option value="report">{tr('التقارير', 'Reports')}</option></select>}</Field>
            <Field label={tr('الاتجاه', 'Direction')}>{(p) => <select {...p} value={f.direction} onChange={e => set({ direction: e.target.value })} className={inputCls}><option value="">{tr('الكل', 'All')}</option><option value="IN">{tr('وارد', 'Incoming')}</option><option value="OUT">{tr('صادر', 'Outgoing')}</option></select>}</Field>
            <Field label={tr('داخلي / خارجي', 'Internal / external')}>{(p) => <select {...p} value={f.scope} onChange={e => set({ scope: e.target.value })} className={inputCls}><option value="">{tr('الكل', 'All')}</option><option value="internal">{tr('داخلي', 'Internal')}</option><option value="external">{tr('خارجي', 'External')}</option></select>}</Field>
            <Field label={tr('الوحدة (وما تحتها)', 'Unit (and below)')}>{(p) => <UnitSelect {...p} value={f.unitId} onChange={x => set({ unitId: x })} placeholder={tr('الكل', 'All')} />}</Field>
            <Field label={tr('التصنيف', 'Category')}>{(p) => <select {...p} value={f.categoryId} onChange={e => set({ categoryId: e.target.value })} className={inputCls}><option value="">{tr('الكل', 'All')}</option>{categories.map(c => <option key={c.id} value={c.id}>{ar ? c.nameAr : c.nameEn}</option>)}</select>}</Field>
            <Field label={tr('الحالة', 'Status')}>{(p) => <select {...p} value={f.status} onChange={e => set({ status: e.target.value })} className={inputCls}><option value="">{tr('الكل', 'All')}</option>{Object.entries(STATUS_LABELS).map(([k, s]) => <option key={k} value={k}>{pick(s.label, ar)}</option>)}</select>}</Field>
            <Field label={tr('الاستعجال', 'Urgency')}>{(p) => <select {...p} value={f.urgency} onChange={e => set({ urgency: e.target.value })} className={inputCls}><option value="">{tr('الكل', 'All')}</option>{Object.entries(URGENCY).map(([k, s]) => <option key={k} value={k}>{pick(s, ar)}</option>)}</select>}</Field>
            <Field label={tr('الجهة', 'Party')}>{(p) => <select {...p} value={f.contactId} onChange={e => set({ contactId: e.target.value })} className={inputCls}><option value="">{tr('الكل', 'All')}</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}</Field>
            <Field label={tr('من تاريخ', 'From date')}>{(p) => <input {...p} type="date" value={f.from} onChange={e => set({ from: e.target.value })} className={inputCls} />}</Field>
            <Field label={tr('إلى تاريخ', 'To date')}>{(p) => <input {...p} type="date" value={f.to} onChange={e => set({ to: e.target.value })} className={inputCls} />}</Field>
            <Field label={tr('نوع التقرير', 'Report kind')}>{(p) => <select {...p} value={f.reportKind} onChange={e => set({ reportKind: e.target.value })} className={inputCls}><option value="">{tr('الكل', 'All')}</option>{Object.entries(REPORT_KIND).map(([k, s]) => <option key={k} value={k}>{pick(s, ar)}</option>)}</select>}</Field>
            <label className="flex items-center gap-2 min-h-[42px] self-end text-sm font-semibold cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-blue-800" checked={f.overdue} onChange={e => set({ overdue: e.target.checked })} />{tr('المتأخرة فقط', 'Overdue only')}</label>
          </div>
        </details>
        <div className="flex flex-wrap gap-2">
          <Btn type="submit" variant="primary"><Search className="w-4 h-4" aria-hidden="true" />{tr('بحث', 'Search')}</Btn>
          <Btn onClick={() => { const empty = Object.fromEntries(Object.keys(f).map(k => [k, k === 'overdue' ? false : ''])); setF(empty); run(empty); }}>{tr('مسح', 'Clear')}</Btn>
          <Btn onClick={exportCsv} disabled={!rows?.length}><Download className="w-4 h-4" aria-hidden="true" />{tr('تصدير Excel (CSV)', 'Export to Excel (CSV)')}</Btn>
          <Btn onClick={() => setView(view === 'list' ? 'folders' : 'list')} aria-pressed={view === 'folders'}><Folder className="w-4 h-4" aria-hidden="true" />{view === 'list' ? tr('عرض حسب المجلدات', 'Show by folder') : tr('عرض كقائمة', 'Show as list')}</Btn>
        </div>
      </form>
      {err && <Notice kind="error">{err}</Notice>}
      <p role="status" aria-live="polite" className="text-sm font-semibold">{rows === null ? tr('جارٍ البحث…', 'Searching…') : tr(`${rows.length} سجل`, `${rows.length} records`)}</p>
      {rows && rows.length > 0 && view === 'list' && (
        <div className="las-card bg-white border border-slate-300 rounded-xl overflow-x-auto">
          <table className="w-full text-sm"><caption className="sr-only">{tr('نتائج البحث', 'Search results')}</caption>
            <thead><tr className="border-b border-slate-400 bg-slate-100"><th scope="col" className={th}>{tr('الرقم والموضوع', 'Number and subject')}</th><th scope="col" className={th}>{tr('النوع', 'Type')}</th><th scope="col" className={th}>{tr('الجهة', 'Party')}</th><th scope="col" className={th}>{tr('التاريخ', 'Date')}</th><th scope="col" className={th}>{tr('الحالة', 'Status')}</th></tr></thead>
            <tbody>{rows.map(l => (
              <tr key={l.id} className="border-b border-slate-200">
                <td className={td}><LetterLink id={l.id} number={l.number} subject={l.subject} /></td>
                <td className={td}>{typeLabel(l, ar)}<div className="text-slate-700" dir="ltr">{l.unitCode}</div></td>
                <td className={td}>{l.contactName || l.externalRefNo || '—'}</td>
                <td className={td}>{fmtDate(l.letterDate || (l.archivedAt || l.createdAt || '').slice(0, 10))}{l.dueDate ? <div className="text-slate-700">{tr('الموعد', 'Due')}: {fmtDate(l.dueDate)}</div> : null}</td>
                <td className={td}><div className="flex flex-wrap gap-1"><StatusBadge status={l.status} /><Flags l={l} /></div></td>
              </tr>))}</tbody></table>
        </div>
      )}
      {rows && rows.length > 0 && view === 'folders' && (
        <div className="space-y-2">{folders.map(([path, items]) => (
          <details key={path} className="las-card bg-white border border-slate-300 rounded-xl p-3">
            <summary className="cursor-pointer font-bold text-sm min-h-[36px] flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded"><Folder className="w-4 h-4 shrink-0" aria-hidden="true" /><span className="break-all">{path}</span><span className="text-slate-700 font-normal">({items.length})</span></summary>
            <ul className="mt-2 space-y-1 ps-6">{items.map(l => <li key={l.id}><LetterLink id={l.id} number={l.number} subject={l.subject} /></li>)}</ul>
          </details>))}</div>
      )}
    </div>
  );
}

// =======================================================================================
// Dashboard and reports (4.7)
// =======================================================================================
export function StatsView() {
  const { tr, ar, me, fmtDate, fmtTime, unitName } = useLas();
  const year = me.today.slice(0, 4);
  const [p, setP] = useState({ from: `${year}-01-01`, to: me.today, unitId: '' });
  const [dash, setDash] = useState<any>(null);
  const [perf, setPerf] = useState<any>(null);
  const [reg, setReg] = useState<any>(null);
  const [regQ, setRegQ] = useState({ date: me.today, direction: 'IN', unitId: '' });
  const [err, setErr] = useState('');
  const qs = (o: any) => new URLSearchParams(Object.entries(o).filter(([, v]) => v) as any).toString();
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([las('/stats/dashboard?' + qs(p)), las('/stats/performance?' + qs(p))]);
    if (!a.ok) return setErr(a.error || '');
    setErr(''); setDash(a.data); setPerf(b.data);
  }, [p]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const loadReg = async () => { const r = await las('/stats/register?' + qs(regQ)); if (r.ok) setReg(r.data); else setErr(r.error || ''); };

  const printRegister = () => reg && printHtml(tr('السجل اليومي', 'Daily register'), `
    <h1>${escapeHtml(ar ? me.settings.institutionNameAr : me.settings.institutionNameEn)}</h1>
    <h2 style="text-align:center">${reg.direction === 'IN' ? tr('سجل الوارد', 'Incoming register') : tr('سجل الصادر', 'Outgoing register')} — ${escapeHtml(reg.date)}${regQ.unitId ? ' — ' + escapeHtml(unitName(Number(regQ.unitId))) : ''}</h2>
    <table><thead><tr><th>#</th><th>${tr('رقم التسجيل', 'Number')}</th><th>${tr('الجهة / رقم كتابها', 'Party / reference')}</th><th>${tr('الموضوع', 'Subject')}</th><th>${tr('سجّله', 'Registered by')}</th><th>${tr('التوقيع', 'Signature')}</th></tr></thead>
    <tbody>${reg.rows.map((r: any, i: number) => `<tr><td>${i + 1}</td><td dir="ltr">${escapeHtml(r.number)}</td><td>${escapeHtml(r.party || '')}${r.externalRefNo && r.scope === 'external' ? ' — ' + escapeHtml(r.externalRefNo) : ''}</td><td>${escapeHtml(r.subject)}</td><td>${escapeHtml(r.archivedByName || '')}</td><td></td></tr>`).join('')}</tbody></table>`, ar ? 'ar' : 'en');

  return (
    <div className="space-y-4">
      {err && <Notice kind="error">{err}</Notice>}
      <form onSubmit={e => { e.preventDefault(); load(); }} className="las-card bg-white border border-slate-300 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end" aria-label={tr('فترة التقارير', 'Report period')}>
        <Field label={tr('من', 'From')}>{(x) => <input {...x} type="date" value={p.from} onChange={e => setP({ ...p, from: e.target.value })} className={inputCls} />}</Field>
        <Field label={tr('إلى', 'To')}>{(x) => <input {...x} type="date" value={p.to} onChange={e => setP({ ...p, to: e.target.value })} className={inputCls} />}</Field>
        <Field label={tr('الوحدة', 'Unit')}>{(x) => <UnitSelect {...x} value={p.unitId} onChange={v => setP({ ...p, unitId: v })} placeholder={tr('كل ما أراه', 'Everything I can see')} />}</Field>
        <Btn type="submit" variant="primary"><RefreshCw className="w-4 h-4" aria-hidden="true" />{tr('تحديث', 'Update')}</Btn>
      </form>
      {dash && (
        <>
          <ul className="grid grid-cols-2 md:grid-cols-6 gap-2" aria-label={tr('الأعداد الإجمالية', 'Totals')}>
            {[[tr('وارد', 'Incoming'), dash.totals.incoming], [tr('صادر', 'Outgoing'), dash.totals.outgoing], [tr('مطالعات', "Mutala'at"), dash.totals.mutalaat], [tr('تقارير', 'Reports'), dash.totals.reports], [tr('مفتوحة', 'Open'), dash.totals.open], [tr('متأخرة', 'Overdue'), dash.totals.overdue]].map(([label, n]) => (
              <li key={label as string} className="las-card bg-white border border-slate-300 rounded-xl p-3"><div className="text-sm text-slate-700">{label}</div><div className="text-2xl font-black">{n}</div></li>))}
          </ul>
          <Section title={tr('حسب الوحدة', 'By unit')} actions={<Btn onClick={() => downloadCsv(`by-unit-${me.today}.csv`, ['Unit', 'Incoming', 'Outgoing', "Mutala'at", 'Reports', 'Open', 'Overdue'], dash.byUnit.map((u: any) => [u.unitCode, u.incoming, u.outgoing, u.mutalaat, u.reports, u.open, u.overdue]))}><Download className="w-4 h-4" aria-hidden="true" />CSV</Btn>}>
            <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">{tr('أعداد السجلات لكل وحدة', 'Record counts per unit')}</caption>
              <thead><tr className="border-b border-slate-300"><th scope="col" className={th}>{tr('الوحدة', 'Unit')}</th><th scope="col" className={th}>{tr('وارد', 'In')}</th><th scope="col" className={th}>{tr('صادر', 'Out')}</th><th scope="col" className={th}>{tr('مطالعات', 'Mut.')}</th><th scope="col" className={th}>{tr('تقارير', 'Rep.')}</th><th scope="col" className={th}>{tr('مفتوحة', 'Open')}</th><th scope="col" className={th}>{tr('متأخرة', 'Overdue')}</th></tr></thead>
              <tbody>{dash.byUnit.map((u: any) => <tr key={u.unitCode} className="border-b border-slate-200"><th scope="row" className={`${td} text-start font-semibold`}><span dir="ltr">{u.unitCode}</span> — {unitName(u.unitId)}</th><td className={td}>{u.incoming}</td><td className={td}>{u.outgoing}</td><td className={td}>{u.mutalaat}</td><td className={td}>{u.reports}</td><td className={td}>{u.open}</td><td className={td}>{u.overdue}</td></tr>)}</tbody></table></div>
            {dash.byCategory.length > 0 && <p className="text-sm mt-3"><strong>{tr('حسب التصنيف: ', 'By category: ')}</strong>{dash.byCategory.map((c: any) => `${ar ? c.nameAr : c.nameEn} (${c.count})`).join(' • ')}</p>}
          </Section>
        </>
      )}
      {perf && (
        <Section title={tr('الأداء: معدل زمن الإجابة على الوارد', 'Performance: average response time for incoming letters')} actions={<Btn onClick={() => downloadCsv(`performance-${me.today}.csv`, ['Unit', 'Received', 'Answered', 'Avg days', 'Open', 'Overdue'], perf.units.map((u: any) => [u.unitCode, u.received, u.answered, u.avgDays, u.open, u.overdue]))}><Download className="w-4 h-4" aria-hidden="true" />CSV</Btn>}>
          <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">{tr('الأداء لكل وحدة', 'Performance per unit')}</caption>
            <thead><tr className="border-b border-slate-300"><th scope="col" className={th}>{tr('الوحدة', 'Unit')}</th><th scope="col" className={th}>{tr('الوارد', 'Received')}</th><th scope="col" className={th}>{tr('أُجيب', 'Answered')}</th><th scope="col" className={th}>{tr('معدل الأيام', 'Avg days')}</th><th scope="col" className={th}>{tr('مفتوحة', 'Open')}</th><th scope="col" className={th}>{tr('متأخرة', 'Overdue')}</th></tr></thead>
            <tbody>{perf.units.map((u: any) => <tr key={u.unitId} className="border-b border-slate-200"><th scope="row" className={`${td} text-start font-semibold`}><span dir="ltr">{u.unitCode}</span> — {ar ? u.nameAr : u.nameEn} ({pick(UNIT_TYPE[u.type], ar)})</th><td className={td}>{u.received}</td><td className={td}>{u.answered}</td><td className={td}>{u.avgDays ?? '—'}</td><td className={td}>{u.open}</td><td className={td}>{u.overdue}</td></tr>)}</tbody></table></div>
          {perf.overdue.length > 0 && (<><h3 className="font-bold mt-4 mb-1">{tr('الكتب المتأخرة', 'Overdue letters')}</h3>
            <ul className="space-y-1">{perf.overdue.map((o: any) => <li key={o.id}><LetterLink id={o.id} number={o.number} subject={o.subject} /> <span className="text-sm text-slate-700">— {tr('الموعد', 'due')} {fmtDate(o.dueDate)} ({tr(`متأخر ${o.daysLate} يوم`, `${o.daysLate} days late`)})</span></li>)}</ul></>)}
        </Section>
      )}
      <Section title={tr('السجل اليومي (يُطبع كسجل ورقي رسمي)', 'Daily register (prints as the official paper register)')}>
        <form onSubmit={e => { e.preventDefault(); loadReg(); }} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Field label={tr('التاريخ', 'Date')}>{(x) => <input {...x} type="date" value={regQ.date} onChange={e => setRegQ({ ...regQ, date: e.target.value })} className={inputCls} />}</Field>
          <Field label={tr('السجل', 'Register')}>{(x) => <select {...x} value={regQ.direction} onChange={e => setRegQ({ ...regQ, direction: e.target.value })} className={inputCls}><option value="IN">{tr('الوارد', 'Incoming')}</option><option value="OUT">{tr('الصادر', 'Outgoing')}</option></select>}</Field>
          <Field label={tr('الوحدة', 'Unit')}>{(x) => <UnitSelect {...x} value={regQ.unitId} onChange={v => setRegQ({ ...regQ, unitId: v })} placeholder={tr('كل ما أراه', 'Everything I can see')} />}</Field>
          <Btn type="submit" variant="primary">{tr('عرض السجل', 'Show register')}</Btn>
        </form>
        {reg && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2 mb-2">
              <Btn onClick={printRegister} disabled={!reg.rows.length}><Printer className="w-4 h-4" aria-hidden="true" />{tr('طباعة / PDF', 'Print / PDF')}</Btn>
              <Btn disabled={!reg.rows.length} onClick={() => downloadCsv(`register-${reg.direction}-${reg.date}.csv`, ['Number', 'Unit', 'Party', 'Reference', 'Subject', 'Registered by', 'At'], reg.rows.map((r: any) => [r.number, r.unitCode, r.party, r.externalRefNo, r.subject, r.archivedByName, r.archivedAt]))}><Download className="w-4 h-4" aria-hidden="true" />CSV</Btn>
            </div>
            {reg.rows.length === 0 ? <p className="text-sm text-slate-700">{tr('لا توجد كتب في هذا اليوم.', 'No letters on this day.')}</p> : (
              <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">{tr('السجل اليومي', 'Daily register')}</caption>
                <thead><tr className="border-b border-slate-300"><th scope="col" className={th}>{tr('الرقم', 'Number')}</th><th scope="col" className={th}>{tr('الجهة', 'Party')}</th><th scope="col" className={th}>{tr('الموضوع', 'Subject')}</th><th scope="col" className={th}>{tr('سجّله', 'By')}</th></tr></thead>
                <tbody>{reg.rows.map((r: any) => <tr key={r.id} className="border-b border-slate-200"><td className={td}><LetterLink id={r.id} number={r.number} /></td><td className={td}>{r.party}</td><td className={td}>{r.subject}</td><td className={td}>{r.archivedByName}<div className="text-slate-700">{fmtTime(r.archivedAt)}</div></td></tr>)}</tbody></table></div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

// =======================================================================================
// Administration: roles, delegation, units, lookup lists, settings (3, 4.8, 7.6)
// =======================================================================================
export function AdminView() {
  const { tr, ar, me, units, users, categories, contacts, unitName, userName, reload, fmtDate, announce } = useLas();
  const [roles, setRoles] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [nr, setNr] = useState({ userUid: '', role: 'employee', unitId: '', scope: 'tree', validFrom: '', validTo: '' });
  const [dg, setDg] = useState({ roleId: '', toUid: '', validFrom: me.today, validTo: '' });
  const [cat, setCat] = useState({ nameAr: '', nameEn: '', defaultDueDays: '', retentionYears: '' });
  const [st, setSt] = useState<any>({ ...me.settings, prefixes: { ...me.settings.prefixes } });
  const loadRoles = useCallback(async () => { const r = await las('/roles'); if (r.ok) setRoles(r.data); }, []);
  useEffect(() => { loadRoles(); }, [loadRoles]);
  const done = async (r: any, okMsg: string) => { if (!r.ok) { setErr(r.error || ''); announce(r.error || ''); return false; } setErr(''); announce(okMsg); await Promise.all([reload(), loadRoles()]); return true; };
  const ownHeadRoles = me.roles.filter(r => r.id && !r.delegatedBy && ['chair', 'director', 'dept_head', 'division_head'].includes(r.role));

  return (
    <div className="space-y-4">
      {err && <Notice kind="error" onClose={() => setErr('')}>{err}</Notice>}
      {ownHeadRoles.length > 0 && (
        <Section title={tr('التفويض أثناء الإجازة', 'Delegation (e.g. during leave)')}>
          <form className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end" onSubmit={async e => { e.preventDefault(); await done(await las('/delegations', 'POST', { ...dg, roleId: Number(dg.roleId) }), tr('تم التفويض.', 'Delegated.')); }}>
            <Field label={tr('الصلاحية', 'My role')} required>{(p) => <select {...p} value={dg.roleId} onChange={e => setDg({ ...dg, roleId: e.target.value })} className={inputCls}><option value="">—</option>{ownHeadRoles.map(r => <option key={r.id!} value={r.id!}>{pick(ROLE[r.role], ar)} — {r.unitCode}</option>)}</select>}</Field>
            <Field label={tr('المفوَّض', 'Delegate')} required>{(p) => <select {...p} value={dg.toUid} onChange={e => setDg({ ...dg, toUid: e.target.value })} className={inputCls}><option value="">—</option>{users.filter(u => u.uid !== me.uid).map(u => <option key={u.uid} value={u.uid}>{u.fullName}</option>)}</select>}</Field>
            <Field label={tr('من', 'From')} required>{(p) => <input {...p} type="date" value={dg.validFrom} onChange={e => setDg({ ...dg, validFrom: e.target.value })} className={inputCls} />}</Field>
            <Field label={tr('إلى', 'To')} required>{(p) => <input {...p} type="date" value={dg.validTo} min={dg.validFrom} onChange={e => setDg({ ...dg, validTo: e.target.value })} className={inputCls} />}</Field>
            <Btn type="submit" variant="primary">{tr('تفويض', 'Delegate')}</Btn>
          </form>
          <p className="text-sm text-slate-700 mt-2">{tr('ما ينفذه المفوَّض يُسجَّل «بالنيابة عنك».', 'Actions taken by the delegate are recorded as "on behalf of" you.')}</p>
        </Section>
      )}
      <Section title={tr('الصلاحيات حسب المستخدم والوحدة', 'Roles per user and unit')}>
        {me.isSysAdmin && (
          <form className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-3 items-end mb-4" onSubmit={async e => { e.preventDefault(); if (await done(await las('/roles', 'POST', { ...nr, unitId: Number(nr.unitId) }), tr('أُضيفت الصلاحية.', 'Role granted.'))) setNr({ ...nr, userUid: '' }); }}>
            <Field label={tr('المستخدم', 'User')} required>{(p) => <select {...p} value={nr.userUid} onChange={e => setNr({ ...nr, userUid: e.target.value })} className={inputCls}><option value="">—</option>{users.map(u => <option key={u.uid} value={u.uid}>{u.fullName}</option>)}</select>}</Field>
            <Field label={tr('الدور', 'Role')} required>{(p) => <select {...p} value={nr.role} onChange={e => setNr({ ...nr, role: e.target.value })} className={inputCls}>{Object.entries(ROLE).map(([k, l]) => <option key={k} value={k}>{pick(l, ar)}</option>)}</select>}</Field>
            <Field label={tr('الوحدة', 'Unit')} required>{(p) => <UnitSelect {...p} value={nr.unitId} onChange={v => setNr({ ...nr, unitId: v })} />}</Field>
            <Field label={tr('النطاق', 'Scope')}>{(p) => <select {...p} value={nr.scope} onChange={e => setNr({ ...nr, scope: e.target.value })} className={inputCls}><option value="tree">{tr('الوحدة وما تحتها', 'Unit and below')}</option><option value="unit">{tr('الوحدة فقط', 'Unit only')}</option></select>}</Field>
            <Field label={tr('من (اختياري)', 'From (optional)')}>{(p) => <input {...p} type="date" value={nr.validFrom} onChange={e => setNr({ ...nr, validFrom: e.target.value })} className={inputCls} />}</Field>
            <Field label={tr('إلى (اختياري)', 'To (optional)')}>{(p) => <input {...p} type="date" value={nr.validTo} onChange={e => setNr({ ...nr, validTo: e.target.value })} className={inputCls} />}</Field>
            <Btn type="submit" variant="primary">{tr('إضافة', 'Add')}</Btn>
          </form>
        )}
        <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">{tr('قائمة الصلاحيات', 'List of roles')}</caption>
          <thead><tr className="border-b border-slate-300"><th scope="col" className={th}>{tr('المستخدم', 'User')}</th><th scope="col" className={th}>{tr('الدور', 'Role')}</th><th scope="col" className={th}>{tr('الوحدة', 'Unit')}</th><th scope="col" className={th}>{tr('المدة', 'Period')}</th><th scope="col" className={th}><span className="sr-only">{tr('إجراء', 'Action')}</span></th></tr></thead>
          <tbody>{roles.map(r => (
            <tr key={r.id} className="border-b border-slate-200"><td className={td}>{r.fullName || r.userUid}</td><td className={td}>{pick(ROLE[r.role], ar)}{r.delegatedByUid ? ` — ${tr('تفويض من', 'delegated by')} ${userName(r.delegatedByUid)}` : ''}</td>
              <td className={td}>{unitName(r.unitId)} {r.scope === 'unit' ? tr('(الوحدة فقط)', '(unit only)') : ''}</td><td className={td}>{r.validFrom || r.validTo ? `${fmtDate(r.validFrom) || '…'} — ${fmtDate(r.validTo) || '…'}` : tr('دائم', 'Permanent')}</td>
              <td className={td}>{(me.isSysAdmin || r.delegatedByUid === me.uid) && <Btn variant="danger" aria-label={tr(`إزالة صلاحية ${r.fullName}`, `Remove role of ${r.fullName}`)} onClick={async () => { if (window.confirm(tr('إزالة هذه الصلاحية؟', 'Remove this role?'))) await done(await las(`/roles/${r.id}`, 'DELETE'), tr('أُزيلت.', 'Removed.')); }}><Trash2 className="w-4 h-4" aria-hidden="true" /></Btn>}</td></tr>))}
            {roles.length === 0 && <tr><td colSpan={5} className={td}>{tr('لا توجد صلاحيات بعد.', 'No roles yet.')}</td></tr>}</tbody></table></div>
      </Section>

      {me.isSysAdmin && (
        <>
          <Section title={tr('الوحدات ورموزها', 'Units and their codes')} actions={<Btn onClick={async () => { const r = await las('/folders/sync', 'POST', {}); await done(r, tr(`أُنشئ ${r.data?.created ?? 0} مجلد.`, `${r.data?.created ?? 0} folders created.`)); }}><Folder className="w-4 h-4" aria-hidden="true" />{tr('إنشاء مجلدات الأرشيف', 'Create archive folders')}</Btn>}>
            <p className="text-sm text-slate-700 mb-2">{tr('تُضاف الوحدات وتُسمّى من تطبيق «الهيكل التنظيمي». الرمز يُعطى تلقائياً ولا يتغير بعد صدور أرقام به. الوحدة الموقوفة تحتفظ بسجلاتها ولا تستقبل جديداً.', 'Units are added and named in the Organizational Structure app. A code is assigned automatically and cannot change once numbers were issued with it. A deactivated unit keeps its records but receives nothing new.')}</p>
            <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">{tr('الوحدات', 'Units')}</caption>
              <thead><tr className="border-b border-slate-300"><th scope="col" className={th}>{tr('الرمز', 'Code')}</th><th scope="col" className={th}>{tr('الوحدة', 'Unit')}</th><th scope="col" className={th}>{tr('المستوى', 'Level')}</th><th scope="col" className={th}>{tr('الحالة', 'State')}</th></tr></thead>
              <tbody>{[...units].sort((a, b) => a.code.localeCompare(b.code)).map(u => (
                <tr key={u.id} className="border-b border-slate-200"><td className={td}><UnitCodeEditor unit={u} onSaved={(r) => done(r, tr('حُفظ الرمز.', 'Code saved.'))} /></td><td className={td}>{ar ? u.nameAr : u.nameEn}</td><td className={td}>{pick(UNIT_TYPE[u.type], ar)}</td>
                  <td className={td}><Btn onClick={async () => done(await las(`/units/${u.id}`, 'PUT', { active: !u.active }), tr('تم.', 'Done.'))} aria-pressed={!u.active}>{u.active ? tr('فعّالة — إيقاف', 'Active — deactivate') : tr('موقوفة — تفعيل', 'Deactivated — activate')}</Btn></td></tr>))}</tbody></table></div>
          </Section>
          <Section title={tr('تصنيفات الكتب (مدة الإنجاز والحفظ)', 'Letter categories (due days and retention)')}>
            <form className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end mb-3" onSubmit={async e => { e.preventDefault(); if (await done(await las('/categories', 'POST', { ...cat, defaultDueDays: cat.defaultDueDays || null, retentionYears: cat.retentionYears || null }), tr('أُضيف التصنيف.', 'Category added.'))) setCat({ nameAr: '', nameEn: '', defaultDueDays: '', retentionYears: '' }); }}>
              <Field label={tr('الاسم بالعربية', 'Arabic name')} required>{(p) => <input {...p} value={cat.nameAr} onChange={e => setCat({ ...cat, nameAr: e.target.value })} className={inputCls} />}</Field>
              <Field label={tr('الاسم بالإنجليزية', 'English name')} required>{(p) => <input {...p} dir="ltr" value={cat.nameEn} onChange={e => setCat({ ...cat, nameEn: e.target.value })} className={inputCls} />}</Field>
              <Field label={tr('أيام الإنجاز', 'Due days')}>{(p) => <input {...p} type="number" min={1} value={cat.defaultDueDays} onChange={e => setCat({ ...cat, defaultDueDays: e.target.value })} className={inputCls} />}</Field>
              <Field label={tr('سنوات الحفظ', 'Retention years')}>{(p) => <input {...p} type="number" min={1} value={cat.retentionYears} onChange={e => setCat({ ...cat, retentionYears: e.target.value })} className={inputCls} />}</Field>
              <Btn type="submit" variant="primary">{tr('إضافة', 'Add')}</Btn>
            </form>
            <ul className="space-y-1">{categories.map(c => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
                <span className={c.active ? '' : 'line-through'}>{c.nameAr} / {c.nameEn} — {c.defaultDueDays ? tr(`${c.defaultDueDays} يوم`, `${c.defaultDueDays} days`) : tr('بلا موعد', 'no due date')} — {c.retentionYears ? tr(`حفظ ${c.retentionYears} سنة`, `keep ${c.retentionYears} years`) : '—'}</span>
                <Btn onClick={async () => done(await las(`/categories/${c.id}`, 'PUT', { active: !c.active }), tr('تم.', 'Done.'))}>{c.active ? tr('إيقاف', 'Deactivate') : tr('تفعيل', 'Activate')}</Btn>
              </li>))}</ul>
          </Section>
          <Section title={tr('الترقيم والتنبيهات', 'Numbering and reminders')}>
            <form className="space-y-3" onSubmit={async e => { e.preventDefault(); await done(await las('/settings', 'PUT', { numberFormat: st.numberFormat, prefixes: st.prefixes, seqPad: Number(st.seqPad), seqLevel: st.seqLevel, reminderDays: Number(st.reminderDays), institutionNameAr: st.institutionNameAr, institutionNameEn: st.institutionNameEn }), tr('حُفظت الإعدادات.', 'Settings saved.')); }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={tr('اسم المؤسسة (عربي) — يظهر في ترويسة الكتب', 'Institution name (Arabic) — letterhead')}>{(p) => <input {...p} value={st.institutionNameAr} onChange={e => setSt({ ...st, institutionNameAr: e.target.value })} className={inputCls} />}</Field>
                <Field label={tr('اسم المؤسسة (إنجليزي)', 'Institution name (English)')}>{(p) => <input {...p} dir="ltr" value={st.institutionNameEn} onChange={e => setSt({ ...st, institutionNameEn: e.target.value })} className={inputCls} />}</Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <Field label={tr('صيغة الرقم', 'Number format')} hint="{type} {unit} {year} {seq}">{(p) => <input {...p} dir="ltr" value={st.numberFormat} onChange={e => setSt({ ...st, numberFormat: e.target.value })} className={inputCls} />}</Field>
                <Field label={tr('خانات التسلسل', 'Sequence digits')}>{(p) => <input {...p} type="number" min={1} max={8} value={st.seqPad} onChange={e => setSt({ ...st, seqPad: e.target.value })} className={inputCls} />}</Field>
                <Field label={tr('مستوى التسلسل', 'Sequence kept per')} hint={tr('المستوى الذي يوجد فيه مكتب الصادرة والواردة.', 'The level where the registry desk sits.')}>{(p) => <select {...p} value={st.seqLevel} onChange={e => setSt({ ...st, seqLevel: e.target.value })} className={inputCls}><option value="unit">{tr('كل وحدة', 'Each unit')}</option><option value="department">{tr('القسم', 'Department')}</option><option value="directorate">{tr('الدائرة', 'Directorate')}</option></select>}</Field>
                <Field label={tr('التنبيه قبل الموعد (أيام)', 'Remind before due (days)')}>{(p) => <input {...p} type="number" min={0} max={60} value={st.reminderDays} onChange={e => setSt({ ...st, reminderDays: e.target.value })} className={inputCls} />}</Field>
              </div>
              <fieldset className="border border-slate-400 rounded-lg p-3"><legend className="px-1 text-sm font-semibold">{tr('بادئات الأنواع (يمكن أن تكون بالعربية مثل وارد / صادر)', 'Type prefixes (may be Arabic, e.g. وارد / صادر)')}</legend>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">{Object.keys(st.prefixes).map(k => <Field key={k} label={k}>{(p) => <input {...p} value={st.prefixes[k]} onChange={e => setSt({ ...st, prefixes: { ...st.prefixes, [k]: e.target.value } })} className={inputCls} maxLength={12} />}</Field>)}</div></fieldset>
              <Btn type="submit" variant="primary">{tr('حفظ الإعدادات', 'Save settings')}</Btn>
            </form>
          </Section>
        </>
      )}
      <Section title={tr(`دليل المراسلين (${contacts.length})`, `Address book (${contacts.length})`)}>
        <ul className="space-y-1">{contacts.map(c => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
            <span className={c.active ? '' : 'line-through'}><strong>{c.name}</strong> — {pick(CONTACT_TYPE[c.orgType], ar)}{c.phone ? <> — <span dir="ltr">{c.phone}</span></> : null}{c.email ? <> — <span dir="ltr">{c.email}</span></> : null}{c.address ? ` — ${c.address}` : ''}</span>
            {(me.isSysAdmin || me.registryUnits.length > 0) && <Btn onClick={async () => done(await las(`/contacts/${c.id}`, 'PUT', { active: !c.active }), tr('تم.', 'Done.'))}>{c.active ? tr('إيقاف', 'Deactivate') : tr('تفعيل', 'Activate')}</Btn>}
          </li>))}
          {contacts.length === 0 && <li className="text-sm text-slate-700">{tr('لا توجد جهات بعد. تُضاف من نموذج تسجيل الوارد.', 'No parties yet. Add them from the incoming registration form.')}</li>}</ul>
      </Section>
    </div>
  );
}
function UnitCodeEditor({ unit, onSaved }: { unit: any; onSaved: (r: any) => void }) {
  const { tr } = useLas();
  const [code, setCode] = useState(unit.code);
  useEffect(() => setCode(unit.code), [unit.code]);
  return (
    <form className="flex gap-1 items-center" onSubmit={async e => { e.preventDefault(); if (code !== unit.code) onSaved(await las(`/units/${unit.id}`, 'PUT', { code })); }}>
      <input aria-label={tr(`رمز ${unit.nameAr}`, `Code of ${unit.nameEn}`)} dir="ltr" value={code} onChange={e => setCode(e.target.value.toUpperCase())} className={`${inputCls} !w-32 font-mono`} maxLength={20} />
      {code !== unit.code && <Btn type="submit" variant="primary">{tr('حفظ', 'Save')}</Btn>}
    </form>
  );
}

// =======================================================================================
// Audit screen (SL-9)
// =======================================================================================
export function AuditView() {
  const { tr, me, fmtTime, userName } = useLas();
  const [f, setF] = useState({ user: '', unit: '', record: '', action: '', ip: '', from: '', to: '' });
  const [rows, setRows] = useState<any[] | null>(null);
  const [chain, setChain] = useState<any>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async (filters = f) => {
    const r = await las('/audit?' + new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as any).toString());
    if (!r.ok) return setErr(r.error || '');
    setErr(''); setRows(r.data); setChain(r.raw.chain);
  }, [f]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const header = ['Time (UTC)', 'User', 'On behalf of', 'Unit', 'Role', 'Action', 'Entity', 'Record', 'IP', 'Correlation', 'Details', 'Row hash'];
  const cells = (a: any) => [a.ts, a.userName, a.onBehalfOf, a.unitCode, a.role, a.action, a.entity, a.recordNumber, a.clientIp, a.correlationId, JSON.stringify(a.details), a.rowHash];
  return (
    <div className="space-y-4">
      {err && <Notice kind="error">{err}</Notice>}
      <Notice kind={chain && !chain.ok ? 'error' : 'info'}>
        {tr('سجل التدقيق للقراءة فقط: لا يمكن لأي مستخدم، ولا لمدير النظام، تعديله أو حذفه. كل سطر مربوط بتجزئة السطر الذي قبله.', 'The audit log is read-only: no user, including administrators, can edit or delete it. Every row is chained to the previous row\'s hash.')}
        {chain && <div className="mt-1">{chain.ok ? tr(`آخر فحص للسلسلة: سليمة (${chain.rows} سطر) — ${fmtTime(chain.at)}`, `Last chain check: intact (${chain.rows} rows) — ${fmtTime(chain.at)}`) : tr(`تحذير: السلسلة مكسورة عند السطر ${chain.brokenAtId}`, `Warning: the chain is broken at row ${chain.brokenAtId}`)}</div>}
      </Notice>
      <form onSubmit={e => { e.preventDefault(); load(); }} className="las-card bg-white border border-slate-300 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end" aria-label={tr('تصفية سجل التدقيق', 'Filter the audit log')}>
        <Field label={tr('المستخدم', 'User')}>{(p) => <input {...p} value={f.user} onChange={e => setF({ ...f, user: e.target.value })} className={inputCls} />}</Field>
        <Field label={tr('رمز الوحدة', 'Unit code')}>{(p) => <input {...p} dir="ltr" value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} className={inputCls} />}</Field>
        <Field label={tr('رقم السجل', 'Record number')}>{(p) => <input {...p} dir="ltr" value={f.record} onChange={e => setF({ ...f, record: e.target.value })} className={inputCls} />}</Field>
        <Field label={tr('العملية', 'Action')}>{(p) => <input {...p} dir="ltr" value={f.action} onChange={e => setF({ ...f, action: e.target.value })} className={inputCls} placeholder="Archive, Refer, View…" />}</Field>
        <Field label="IP">{(p) => <input {...p} dir="ltr" value={f.ip} onChange={e => setF({ ...f, ip: e.target.value })} className={inputCls} />}</Field>
        <Field label={tr('من', 'From')}>{(p) => <input {...p} type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} className={inputCls} />}</Field>
        <Field label={tr('إلى', 'To')}>{(p) => <input {...p} type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} className={inputCls} />}</Field>
        <div className="flex flex-wrap gap-2">
          <Btn type="submit" variant="primary"><Search className="w-4 h-4" aria-hidden="true" />{tr('عرض', 'Show')}</Btn>
          <Btn disabled={!rows?.length} onClick={() => rows && downloadCsv(`audit-${me.today}.csv`, header, rows.map(cells))}><Download className="w-4 h-4" aria-hidden="true" />CSV</Btn>
          {me.isSysAdmin && <Btn onClick={async () => { const r = await las('/audit/verify'); if (r.ok) setChain(r.data); }}><ShieldCheck className="w-4 h-4" aria-hidden="true" />{tr('فحص السلسلة الآن', 'Verify chain now')}</Btn>}
        </div>
      </form>
      <p role="status" aria-live="polite" className="text-sm font-semibold">{rows === null ? tr('جارٍ التحميل…', 'Loading…') : tr(`${rows.length} عملية`, `${rows.length} events`)}</p>
      {rows && rows.length > 0 && (
        <div className="las-card bg-white border border-slate-300 rounded-xl overflow-x-auto">
          <table className="w-full text-sm"><caption className="sr-only">{tr('سجل التدقيق', 'Audit log')}</caption>
            <thead><tr className="border-b border-slate-400 bg-slate-100"><th scope="col" className={th}>{tr('الوقت (بغداد)', 'Time (Baghdad)')}</th><th scope="col" className={th}>{tr('المستخدم', 'User')}</th><th scope="col" className={th}>{tr('الوحدة', 'Unit')}</th><th scope="col" className={th}>{tr('العملية', 'Action')}</th><th scope="col" className={th}>{tr('السجل', 'Record')}</th><th scope="col" className={th}>IP</th><th scope="col" className={th}>{tr('التفاصيل', 'Details')}</th></tr></thead>
            <tbody>{rows.map(a => (
              <tr key={a.id} className="border-b border-slate-200"><td className={td}>{fmtTime(a.ts)}</td><td className={td}>{a.userName}{a.onBehalfOf ? ` (${tr('عن', 'for')} ${userName(a.onBehalfOf)})` : ''}</td><td className={td} dir="ltr">{a.unitCode}</td>
                <td className={td} dir="ltr">{a.action}<div className="text-slate-700">{a.entity}</div></td><td className={td} dir="ltr">{a.recordNumber}</td><td className={td} dir="ltr">{a.clientIp}</td>
                <td className={`${td} font-mono text-xs break-all max-w-xs`} dir="ltr">{JSON.stringify(a.details)}</td></tr>))}</tbody></table>
        </div>
      )}
    </div>
  );
}
