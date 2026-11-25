// Report of user-account requests (create / suspend / change permissions …) in a date range:
// totals, breakdowns and the list of requests with username, department, request, date and status.
import React, { useCallback, useEffect, useState } from 'react';
import { FileBarChart, Search, Download, Printer } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../utils/api';
import { USER_REQUEST_ACTION_LIST, userRequestActionLabel } from '../utils/userRequests';

interface Row {
  id: string; ticketNo: string; username: string; fullName: string; department: string; action: string;
  requestNumber: string; requestDate: string; date: string; status: string; stage: string; requesterName: string;
}
interface Report {
  from: string | null; to: string | null; total: number; completed: number; open: number;
  byAction: { name: string; count: number }[]; byStatus: { name: string; count: number }[]; byDepartment: { name: string; count: number }[];
  rows: Row[];
}

const STATUS_AR: Record<string, string> = {
  New: 'جديد', Open: 'مفتوح', 'In Progress': 'قيد التنفيذ', 'Pending Customer': 'بانتظار مقدم الطلب', Resolved: 'منجز', Closed: 'مغلق',
};
const STATUS_LIST = ['Open', 'In Progress', 'Pending Customer', 'Resolved', 'Closed'];
const STATUS_CLS: Record<string, string> = {
  Resolved: 'bg-emerald-100 text-emerald-900 border-emerald-400',
  Closed: 'bg-slate-200 text-slate-900 border-slate-400',
  'In Progress': 'bg-blue-100 text-blue-900 border-blue-400',
  'Pending Customer': 'bg-amber-100 text-amber-950 border-amber-500',
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function UserRequestReportView({ onSelectTicket }: { onSelectTicket: (id: string) => void }) {
  const { language, dir } = useLanguage();
  const ar = language === 'ar';
  const tr = (a: string, e: string) => (ar ? a : e);
  const today = new Date();
  const [from, setFrom] = useState(ymd(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(ymd(today));
  const [action, setAction] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const statusLabel = (s: string) => (ar ? STATUS_AR[s] || s : s);
  const actionLabel = (a: string) => userRequestActionLabel(a, ar ? 'ar' : 'en');

  const load = useCallback(async () => {
    if (from && to && from > to) { setError(tr('تاريخ البداية بعد تاريخ النهاية.', 'The start date is after the end date.')); return; }
    setLoading(true); setError('');
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (action) p.set('action', action);
    if (status) p.set('status', status);
    if (department.trim()) p.set('department', department.trim());
    try {
      const res = await apiFetch('/api/tickets/reports/user-requests?' + p.toString());
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
      setReport(j.data);
    } catch (e: any) {
      setError(tr('تعذر تحميل التقرير.', 'Could not load the report.') + (e?.message ? ` (${e.message})` : ''));
    } finally { setLoading(false); }
  }, [from, to, action, status, department, ar]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const period = report ? `${report.from || tr('البداية', 'start')} — ${report.to || tr('اليوم', 'today')}` : '';

  const exportCsv = () => {
    if (!report) return;
    const head = [tr('اسم المستخدم', 'Username'), tr('الاسم الكامل', 'Full name'), tr('القسم', 'Department'), tr('الطلب', 'Request'),
      tr('رقم الطلب', 'Request number'), tr('التاريخ', 'Date'), tr('حالة الطلب', 'Status'), tr('رقم التذكرة', 'Ticket')];
    const lines = [head, ...report.rows.map(r => [r.username, r.fullName, r.department, actionLabel(r.action), r.requestNumber, r.date, statusLabel(r.status), r.ticketNo])]
      .map(cols => cols.map(c => {
        let v = String(c ?? '');
        if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; // keep spreadsheet formulas from running
        return `"${v.replace(/"/g, '""')}"`;
      }).join(','));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `user-requests_${report.from || 'start'}_${report.to || 'today'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const print = () => {
    if (!report) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const table = (title: string, items: { name: string; count: number }[], fmt: (s: string) => string) =>
      `<h2>${esc(title)}</h2><table><thead><tr><th>${esc(tr('البند', 'Item'))}</th><th>${esc(tr('العدد', 'Count'))}</th></tr></thead><tbody>${
        items.map(i => `<tr><td>${esc(fmt(i.name) || '—')}</td><td>${i.count}</td></tr>`).join('')}</tbody></table>`;
    w.document.write(`<!doctype html><html lang="${ar ? 'ar' : 'en'}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(tr('تقرير طلبات المستخدمين', 'User requests report'))}</title>
      <style>body{font-family:Tahoma,Arial,sans-serif;font-size:12px;margin:24px;color:#000}table{border-collapse:collapse;width:100%;margin-bottom:16px}th,td{border:1px solid #000;padding:4px 6px;text-align:start}th{background:#eee}h1{font-size:18px}h2{font-size:14px;margin-top:18px}</style></head><body>
      <h1>${esc(tr('تقرير طلبات المستخدمين', 'User requests report'))}</h1>
      <p>${esc(tr('الفترة', 'Period'))}: <span dir="ltr">${esc(period)}</span> — ${esc(tr('العدد الكلي', 'Total'))}: ${report.total} — ${esc(tr('منجزة', 'Completed'))}: ${report.completed} — ${esc(tr('قيد المعالجة', 'Open'))}: ${report.open}</p>
      ${table(tr('حسب نوع الطلب', 'By request'), report.byAction, actionLabel)}
      ${table(tr('حسب الحالة', 'By status'), report.byStatus, statusLabel)}
      ${table(tr('حسب القسم', 'By department'), report.byDepartment, s => s)}
      <h2>${esc(tr('ملخص الطلبات', 'Requests'))}</h2>
      <table><thead><tr><th>${esc(tr('اسم المستخدم', 'Username'))}</th><th>${esc(tr('القسم', 'Department'))}</th><th>${esc(tr('الطلب', 'Request'))}</th><th>${esc(tr('رقم الطلب', 'Request no.'))}</th><th>${esc(tr('التاريخ', 'Date'))}</th><th>${esc(tr('حالة الطلب', 'Status'))}</th></tr></thead><tbody>
      ${report.rows.map(r => `<tr><td dir="ltr">${esc(r.username || '—')}</td><td>${esc(r.department || '—')}</td><td>${esc(actionLabel(r.action))}</td><td>${esc(r.requestNumber || '—')}</td><td dir="ltr">${esc(r.date)}</td><td>${esc(statusLabel(r.status))}</td></tr>`).join('')}
      </tbody></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-400 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600';
  const label = 'block text-xs font-bold text-slate-800 mb-1';
  const Breakdown = ({ title, items, fmt }: { title: string; items: { name: string; count: number }[]; fmt: (s: string) => string }) => (
    <section className="bg-white border border-slate-300 rounded-xl p-4" aria-label={title}>
      <h3 className="text-sm font-bold text-slate-900 mb-2">{title}</h3>
      {items.length === 0 ? <p className="text-sm text-slate-600">—</p> : (
        <ul className="space-y-1.5">
          {items.map(i => {
            const pct = report && report.total ? Math.round((i.count / report.total) * 100) : 0;
            return (
              <li key={i.name} className="text-sm">
                <div className="flex justify-between gap-2"><span className="text-slate-900">{fmt(i.name) || '—'}</span><strong className="text-slate-900">{i.count}</strong></div>
                <div className="h-1.5 bg-slate-100 rounded" aria-hidden="true"><div className="h-1.5 bg-blue-700 rounded" style={{ width: `${pct}%` }} /></div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  return (
    <div className="space-y-4" dir={dir} data-testid="user-request-report">
      <div className="flex items-center gap-2">
        <FileBarChart className="w-6 h-6 text-blue-700" aria-hidden="true" />
        <h2 className="text-xl font-black text-slate-900">{tr('تقرير طلبات المستخدمين', 'User requests report')}</h2>
      </div>

      <form className="bg-white border border-slate-300 rounded-xl p-4 space-y-3" onSubmit={e => { e.preventDefault(); load(); }} aria-label={tr('خيارات التقرير', 'Report options')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div><label htmlFor="urr-from" className={label}>{tr('من تاريخ', 'From')}</label><input id="urr-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} /></div>
          <div><label htmlFor="urr-to" className={label}>{tr('إلى تاريخ', 'To')}</label><input id="urr-to" type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} /></div>
          <div>
            <label htmlFor="urr-action" className={label}>{tr('نوع الطلب', 'Request')}</label>
            <select id="urr-action" value={action} onChange={e => setAction(e.target.value)} className={inputCls}>
              <option value="">{tr('الكل', 'All')}</option>
              {USER_REQUEST_ACTION_LIST.map(a => <option key={a} value={a}>{actionLabel(a)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="urr-status" className={label}>{tr('حالة الطلب', 'Status')}</label>
            <select id="urr-status" value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
              <option value="">{tr('الكل', 'All')}</option>
              {STATUS_LIST.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </div>
          <div><label htmlFor="urr-dept" className={label}>{tr('القسم', 'Department')}</label><input id="urr-dept" type="search" value={department} onChange={e => setDepartment(e.target.value)} className={inputCls} /></div>
        </div>
        <p className="text-xs text-slate-700">{tr('تُحسب الطلبات حسب تاريخ الطلب الرسمي، أو تاريخ إنشاء التذكرة إن لم يُدخل.', 'Requests are counted by the official request date, or the ticket date when none was entered.')}</p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={loading} className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-lg bg-blue-800 text-white text-sm font-bold hover:bg-blue-900 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-700">
            <Search className="w-4 h-4" aria-hidden="true" />{tr('عرض التقرير', 'Show report')}
          </button>
          <button type="button" onClick={exportCsv} disabled={!report?.rows.length} className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-lg border border-slate-400 bg-white text-slate-900 text-sm font-bold hover:bg-slate-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">
            <Download className="w-4 h-4" aria-hidden="true" />{tr('تصدير Excel (CSV)', 'Export to Excel (CSV)')}
          </button>
          <button type="button" onClick={print} disabled={!report} className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-lg border border-slate-400 bg-white text-slate-900 text-sm font-bold hover:bg-slate-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">
            <Printer className="w-4 h-4" aria-hidden="true" />{tr('طباعة', 'Print')}
          </button>
        </div>
      </form>

      {error && <div role="alert" className="border border-rose-600 bg-rose-50 text-rose-900 rounded-lg p-3 text-sm font-semibold">{error}</div>}
      <p role="status" aria-live="polite" className="sr-only">{loading ? tr('جارٍ التحميل…', 'Loading…') : report ? tr(`${report.total} طلب`, `${report.total} requests`) : ''}</p>

      {report && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { k: 'total', label: tr('عدد طلبات المستخدمين', 'User requests'), v: report.total, cls: 'text-slate-900' },
              { k: 'done', label: tr('منجزة / مغلقة', 'Completed / closed'), v: report.completed, cls: 'text-emerald-800' },
              { k: 'open', label: tr('قيد المعالجة', 'Still open'), v: report.open, cls: 'text-blue-800' },
            ].map(c => (
              <div key={c.k} className="bg-white border border-slate-300 rounded-xl p-4" data-stat={c.k}>
                <div className="text-sm font-semibold text-slate-700">{c.label}</div>
                <div className={`text-3xl font-black ${c.cls}`}>{c.v}</div>
                <div className="text-xs text-slate-600" dir="ltr">{period}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Breakdown title={tr('حسب نوع الطلب', 'By request')} items={report.byAction} fmt={actionLabel} />
            <Breakdown title={tr('حسب الحالة', 'By status')} items={report.byStatus} fmt={statusLabel} />
            <Breakdown title={tr('حسب القسم', 'By department')} items={report.byDepartment} fmt={s => s} />
          </div>

          <section className="bg-white border border-slate-300 rounded-xl overflow-hidden" aria-labelledby="urr-list-title">
            <h3 id="urr-list-title" className="text-sm font-bold text-slate-900 px-4 pt-4 pb-2">{tr('ملخص الطلبات', 'Requests')} ({report.rows.length})</h3>
            {report.rows.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-slate-700">{tr('لا توجد طلبات مستخدمين في هذه الفترة.', 'No user requests in this period.')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">{tr('قائمة طلبات المستخدمين', 'List of user requests')}</caption>
                  <thead className="bg-slate-100 border-y border-slate-300">
                    <tr>
                      {[tr('اسم المستخدم', 'Username'), tr('القسم', 'Department'), tr('الطلب', 'Request'), tr('التاريخ', 'Date'), tr('حالة الطلب', 'Status'), tr('التذكرة', 'Ticket')].map(h =>
                        <th key={h} scope="col" className="text-start px-3 py-2 font-bold text-slate-900 whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map(r => (
                      <tr key={r.id} className="border-b border-slate-200 align-top">
                        <td className="px-3 py-2"><span dir="ltr" className="font-semibold text-slate-900 break-all">{r.username || '—'}</span>{r.fullName && <div className="text-xs text-slate-700">{r.fullName}</div>}</td>
                        <td className="px-3 py-2 text-slate-900">{r.department || '—'}</td>
                        <td className="px-3 py-2 text-slate-900">{actionLabel(r.action)}{r.requestNumber && <div className="text-xs text-slate-700">{tr('رقم الطلب', 'Request no.')}: {r.requestNumber}</div>}</td>
                        <td className="px-3 py-2 text-slate-900 whitespace-nowrap" dir="ltr">{r.date || '—'}</td>
                        <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold ${STATUS_CLS[r.status] || 'bg-white text-slate-900 border-slate-400'}`}>{statusLabel(r.status)}</span></td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => onSelectTicket(r.id)} className="font-mono text-blue-800 underline font-bold hover:text-blue-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded">{r.ticketNo}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
