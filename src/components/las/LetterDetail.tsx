// Letters Archive System — one record: details, workflow timeline, files, history and every action.
import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, QrCode, Download, Eye, Trash2, Reply, Send, CheckCircle2, CornerUpLeft, XCircle, Lock, Archive, Unlock, Paperclip, FileText } from 'lucide-react';
import {
  useLas, las, openAttachment, Field, Btn, Notice, Modal, UnitSelect, CheckList, FilePicker, PickedFile, Section, StatusBadge, Flags, inputCls,
  typeLabel, pick, URGENCY, CONF, INSTRUCTION, REFERRAL_STATUS, DECISION, MUT_DECISION, REPORT_KIND, REPORT_STATUS, DISPATCH, printHtml, escapeHtml,
} from './ui';
import { OutgoingForm } from './Forms';

type Dialog = null | { kind: string; payload?: any };

export function LetterDetail({ id, onClose, onChanged }: { key?: React.Key; id: number; onClose: () => void; onChanged: () => void }) {
  const S = useLas();
  const { tr, ar, lang, unitName, unitById, userName, categoryName, fmtDate, fmtTime, me, users, units, categories, announce } = S;
  const [l, setL] = useState<any>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<'details' | 'workflow' | 'files' | 'history'>('details');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await las(`/letters/${id}`);
    if (!r.ok) { setError(r.error || ''); return; }
    setL(r.data); setError('');
  }, [id]);
  useEffect(() => { load(); }, [load]);

  /** Run an action, show its result and reload the record. */
  const act = async (path: string, body?: any, okMsg?: string, method = 'POST') => {
    setBusy(true);
    const r = await las(path, method, body ?? {});
    setBusy(false);
    if (!r.ok) { setError(r.error || ''); announce(r.error || ''); return false; }
    setError(''); setDialog(null);
    const text = okMsg || tr('تم الحفظ.', 'Saved.');
    setMsg(text); announce(text);
    await load(); onChanged();
    return true;
  };

  if (error && !l) return <Modal title={tr('السجل', 'Record')} onClose={onClose}><Notice kind="error">{error}</Notice></Modal>;
  if (!l) return <Modal title={tr('السجل', 'Record')} onClose={onClose}><p role="status">{tr('جارٍ التحميل…', 'Loading…')}</p></Modal>;
  const P = l.permissions;
  const filesLetterId = l.id;

  const printLetter = (large = false) => {
    las(`/letters/${l.id}/print`, 'POST', { what: large ? 'large_print' : 'letter' });
    const to = l.scope === 'internal' ? (l.toUnitIds || []).map((u: number) => unitName(u)).join('، ') : (l.contact?.name || '');
    const cc = [...(l.ccUnitIds || []).map((u: number) => unitName(u))].join('، ');
    printHtml(l.number || l.subject, `
      <h1>${escapeHtml(ar ? me.settings.institutionNameAr : me.settings.institutionNameEn)}</h1>
      <p style="text-align:center">${escapeHtml(unitName(l.unitId))}</p><hr>
      <div class="meta"><span>${tr('العدد', 'No.')}: ${escapeHtml(l.number || tr('(مسودة – يصدر الرقم عند الموافقة النهائية)', '(draft – number issued at final approval)'))}</span>
      <span>${tr('التاريخ', 'Date')}: ${escapeHtml(l.letterDate || '')}</span></div>
      <p><strong>${tr('إلى', 'To')}:</strong> ${escapeHtml(to)}</p>
      <p><strong>${tr('الموضوع', 'Subject')}:</strong> ${escapeHtml(l.subject)}</p>
      ${l.referenceText ? `<p>${escapeHtml(l.referenceText)}</p>` : ''}
      <div class="body">${escapeHtml(l.body || '')}</div>
      <div class="sign">${escapeHtml(l.archivedByName || '')}<br>${escapeHtml(unitName(l.unitId))}</div>
      ${cc ? `<p><strong>${tr('نسخة منه إلى', 'Copy to')}:</strong> ${escapeHtml(cc)}</p>` : ''}`, lang, large);
  };
  const printLabel = async () => {
    const qr = await QRCode.toDataURL(l.number, { margin: 1, width: 180 });
    printHtml(l.number, `<div class="label"><div>${escapeHtml(ar ? me.settings.institutionNameAr : me.settings.institutionNameEn)}</div>
      <img src="${qr}" alt="${escapeHtml(tr('رمز الاستجابة السريعة لرقم التسجيل', 'QR code of the registration number'))}">
      <div style="font-size:16pt;font-weight:bold" dir="ltr">${escapeHtml(l.number)}</div><div>${escapeHtml(fmtTime(l.archivedAt))}</div></div>`, lang);
    las(`/letters/${l.id}/print`, 'POST', { what: 'label' });
  };

  const tabs: Array<[typeof tab, string]> = [['details', tr('البيانات', 'Details')], ['workflow', tr('سير المعاملة', 'Workflow')], ['files', tr(`الملفات (${l.attachments.length})`, `Files (${l.attachments.length})`)]];
  if (l.history) tabs.push(['history', tr('سجل العمليات', 'History')]);
  const row = (k: string, v: React.ReactNode) => (v === null || v === undefined || v === '' ? null : (
    <div className="flex flex-col sm:flex-row sm:gap-3 py-1.5 border-b border-slate-200 last:border-0"><dt className="sm:w-48 shrink-0 text-sm text-slate-700">{k}</dt><dd className="text-sm font-semibold break-words">{v}</dd></div>
  ));
  const loc = l.physicalLocation ? [['building', 'المبنى', 'Building'], ['room', 'الغرفة', 'Room'], ['cabinet', 'الخزانة', 'Cabinet'], ['shelf', 'الرف', 'Shelf'], ['box', 'الصندوق', 'Box']]
    .filter(([k]) => l.physicalLocation[k]).map(([k, a, e]) => `${tr(a, e)}: ${l.physicalLocation[k]}`).join(' • ') : '';

  return (
    <Modal wide title={`${typeLabel(l, ar)} — ${l.number || tr('مسودة', 'Draft')}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={l.status} /><Flags l={l} /><span className="text-sm text-slate-700" dir="ltr">{l.unitCode}{l.headOffice ? '-00' : ''}</span></div>
        <h3 className="text-xl font-bold">{l.subject}</h3>
        {msg && <Notice kind="success" onClose={() => setMsg('')}>{msg}</Notice>}
        {error && <Notice kind="error" onClose={() => setError('')}>{error}</Notice>}

        {/* Actions */}
        <div className="flex flex-wrap gap-2" role="group" aria-label={tr('الإجراءات', 'Actions')}>
          {P.submit && l.archiveType === 'letter' && <Btn variant="primary" disabled={busy} onClick={() => act(`/letters/${l.id}/submit`, {}, tr('أُرسلت للموافقة.', 'Sent for approval.'))}><Send className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />{tr('إرسال للموافقة', 'Send for approval')}</Btn>}
          {P.submit && l.archiveType === 'mutalaa' && <Btn variant="primary" disabled={busy} onClick={() => act(`/mutalaa/${l.id}/submit`, {}, tr('رُفعت المطالعة.', "Mutala'a submitted."))}><Send className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />{tr('رفع المطالعة', 'Submit')}</Btn>}
          {P.approve && <>
            <Btn variant="success" disabled={busy} onClick={() => setDialog({ kind: 'approval', payload: 'Approved' })}><CheckCircle2 className="w-4 h-4" aria-hidden="true" />{tr('موافقة', 'Approve')}</Btn>
            <Btn disabled={busy} onClick={() => setDialog({ kind: 'approval', payload: 'Returned' })}><CornerUpLeft className="w-4 h-4" aria-hidden="true" />{tr('إعادة مع ملاحظات', 'Return with comments')}</Btn>
            <Btn variant="danger" disabled={busy} onClick={() => setDialog({ kind: 'approval', payload: 'Rejected' })}><XCircle className="w-4 h-4" aria-hidden="true" />{tr('رفض', 'Reject')}</Btn>
          </>}
          {P.opinion && <Btn variant="primary" onClick={() => setDialog({ kind: 'opinion' })}>{tr('إضافة الرأي والرفع للمستوى الأعلى', 'Add opinion and forward up')}</Btn>}
          {P.directive && <Btn variant="primary" onClick={() => setDialog({ kind: 'directive' })}>{tr('تسجيل التوجيه / الهامش', 'Record the directive')}</Btn>}
          {P.executionDone && <Btn variant="success" onClick={() => act(`/mutalaa/${l.id}/execution-done`, {}, tr('سُجّل تنفيذ التوجيه.', 'Execution recorded.'))}>{tr('تم تنفيذ التوجيه', 'Directive executed')}</Btn>}
          {P.reportReview && <Btn variant="primary" onClick={() => act(`/reports/${l.id}/status`, { to: 'reviewed' }, tr('دُقّق التقرير.', 'Report reviewed.'))}>{tr('تدقيق النسخة', 'Mark reviewed')}</Btn>}
          {P.reportApprove && <Btn variant="success" onClick={() => act(`/reports/${l.id}/status`, { to: 'approved' }, tr('اعتُمدت النسخة.', 'Version approved.'))}>{tr('اعتماد النسخة', 'Approve version')}</Btn>}
          {P.reportNewVersion && <Btn onClick={() => setDialog({ kind: 'newVersion' })}>{tr('نسخة جديدة', 'New version')}</Btn>}
          {P.refer && <Btn variant="primary" onClick={() => setDialog({ kind: 'refer' })}><Send className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />{tr('إحالة', 'Refer')}</Btn>}
          {P.reply && (me.memberUnits.length + me.registryUnits.length > 0) && <Btn onClick={() => setDialog({ kind: 'reply' })}><Reply className="w-4 h-4" aria-hidden="true" />{tr('تحرير جواب', 'Draft a reply')}</Btn>}
          {P.dispatch && <Btn onClick={() => setDialog({ kind: 'dispatch' })}>{tr('تسجيل الإرسال', 'Record dispatch')}</Btn>}
          {P.edit && l.number && <Btn onClick={() => setDialog({ kind: 'edit' })}>{tr('تعديل البيانات', 'Edit details')}</Btn>}
          {l.archiveType === 'letter' && l.direction === 'OUT' && <>
            <Btn onClick={() => printLetter(false)}><Printer className="w-4 h-4" aria-hidden="true" />{tr('طباعة الكتاب', 'Print letter')}</Btn>
            <Btn onClick={() => printLetter(true)}>{tr('طباعة بخط كبير', 'Large print')}</Btn>
          </>}
          {l.number && <Btn onClick={printLabel}><QrCode className="w-4 h-4" aria-hidden="true" />{tr('ملصق الرقم (QR)', 'Number label (QR)')}</Btn>}
          {P.close && <Btn onClick={() => setDialog({ kind: 'close' })}><Lock className="w-4 h-4" aria-hidden="true" />{tr('إغلاق', 'Close')}</Btn>}
          {P.archive && <Btn onClick={() => act(`/letters/${l.id}/archive`, {}, tr('تمت الأرشفة.', 'Archived.'))}><Archive className="w-4 h-4" aria-hidden="true" />{tr('أرشفة نهائية', 'Archive')}</Btn>}
          {P.reopen && <Btn onClick={() => setDialog({ kind: 'reopen' })}><Unlock className="w-4 h-4" aria-hidden="true" />{tr('إعادة فتح', 'Reopen')}</Btn>}
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label={tr('أقسام السجل', 'Record sections')} className="flex flex-wrap gap-1 border-b border-slate-300">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" type="button" id={`las-tab-${k}`} aria-selected={tab === k} aria-controls={`las-panel-${k}`} onClick={() => setTab(k)}
              className={`min-h-[42px] px-4 text-sm font-bold rounded-t-lg border border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${tab === k ? 'bg-blue-800 text-white border-blue-900' : 'bg-slate-100 text-slate-900 border-slate-300 hover:bg-slate-200'}`}>{label}</button>
          ))}
        </div>

        {tab === 'details' && (
          <div role="tabpanel" id="las-panel-details" aria-labelledby="las-tab-details" className="space-y-4">
            <dl>
              {row(tr('رقم التسجيل', 'Registration number'), l.number && <span dir="ltr">{l.number}</span>)}
              {row(tr('النوع', 'Type'), typeLabel(l, ar))}
              {row(tr('الوحدة', 'Unit'), unitName(l.unitId))}
              {row(tr('الجهة', 'Party'), l.contact?.name)}
              {row(tr('الوحدات المستلمة', 'Receiving units'), (l.toUnitIds || []).map((u: number) => unitName(u)).join('، '))}
              {row(tr('نسخة إلى', 'Copy to'), (l.ccUnitIds || []).map((u: number) => unitName(u)).join('، '))}
              {row(tr('رقم كتاب الجهة وتاريخه', "Sender's reference and date"), l.externalRefNo && `${l.externalRefNo}${l.externalRefDate ? ` — ${fmtDate(l.externalRefDate)}` : ''}`)}
              {row(tr('تاريخ الكتاب', 'Letter date'), fmtDate(l.letterDate))}
              {row(l.direction === 'IN' ? tr('تاريخ الاستلام', 'Date received') : tr('تاريخ الإرسال', 'Date sent'), fmtDate(l.receivedOrSentDate))}
              {row(tr('التصنيف', 'Category'), categoryName(l.categoryId))}
              {row(tr('الاستعجال', 'Urgency'), pick(URGENCY[l.urgency], ar))}
              {row(tr('السرية', 'Confidentiality'), pick(CONF[l.confidentiality], ar))}
              {row(tr('موعد الإنجاز', 'Due date'), l.dueDate && fmtDate(l.dueDate))}
              {row(tr('الإشارة', 'Reference'), l.referenceText)}
              {row(tr('الخلاصة', 'Summary'), l.summary)}
              {row(tr('القضية', 'Case'), l.case?.title)}
              {row(tr('مكان الأصل الورقي', 'Paper original'), loc)}
              {row(tr('يُحفظ حتى', 'Keep until'), fmtDate(l.retentionUntil))}
              {row(tr('مجلد الأرشيف', 'Archive folder'), l.folderPath && <span className="font-mono text-xs break-all">{l.folderPath}</span>)}
            </dl>
            {l.body && <Section title={tr('نص الكتاب', 'Text')}><p className="whitespace-pre-wrap text-base leading-8">{l.body}</p></Section>}
            {l.mutalaa && (
              <Section title={tr('المطالعة', "Mutala'a")}>
                <dl>
                  {row(tr('موجّهة إلى', 'Addressed to'), unitName(l.mutalaa.addressedUnitId))}
                  {row(tr('المستوى الحالي', 'Current level'), l.status === 'Awaiting approval' ? unitName(l.mutalaa.currentLevelUnitId) : '')}
                  {row(tr('الخلفية', 'Background'), <span className="whitespace-pre-wrap font-normal">{l.mutalaa.background}</span>)}
                  {row(tr('التحليل', 'Analysis'), <span className="whitespace-pre-wrap font-normal">{l.mutalaa.analysis}</span>)}
                  {row(tr('التوصية', 'Recommendation'), <span className="whitespace-pre-wrap">{l.mutalaa.recommendation}</span>)}
                  {row(tr('القرار', 'Decision'), l.mutalaa.decision && pick(MUT_DECISION[l.mutalaa.decision], ar))}
                  {row(tr('التوجيه / الهامش', 'Directive'), <span className="whitespace-pre-wrap">{l.mutalaa.directiveText}</span>)}
                  {row(tr('صاحب القرار وتاريخه', 'Decided by / at'), l.mutalaa.decidedByName && `${l.mutalaa.decidedByName} — ${fmtTime(l.mutalaa.decidedAt)}`)}
                  {row(tr('موعد التنفيذ', 'Execution due'), fmtDate(l.mutalaa.executionDue))}
                </dl>
              </Section>
            )}
            {l.report && (
              <Section title={tr('التقرير', 'Report')}>
                <dl>
                  {row(tr('النوع', 'Kind'), pick(REPORT_KIND[l.report.reportKind], ar))}
                  {row(tr('الفترة', 'Period'), l.report.periodFrom && `${fmtDate(l.report.periodFrom)} — ${fmtDate(l.report.periodTo)}`)}
                  {row(tr('النسخة والحالة', 'Version and status'), `${l.report.version} — ${pick(REPORT_STATUS[l.report.approvalStatus], ar)}`)}
                  {row(tr('اعتمده', 'Approved by'), l.report.approvedBy && `${l.report.approvedBy} — ${fmtTime(l.report.approvedAt)}`)}
                  {row(tr('المعدّون', 'Authors'), l.report.authors)}
                  {row(tr('الجهات المرسل إليها', 'Recipients'), l.report.recipients)}
                  {row(tr('الكلمات المفتاحية', 'Keywords'), l.report.keywords)}
                </dl>
              </Section>
            )}
            <Section title={tr('من أرشف ومتى', 'Who archived and when')}>
              <dl>
                {row(tr('أنشأه', 'Created by'), `${l.createdByName || ''} — ${fmtTime(l.createdAt)}`)}
                {row(tr('أرشفه', 'Archived by'), l.archivedAt && `${l.archivedByName || ''} — ${fmtTime(l.archivedAt)}`)}
                {row(tr('بالنيابة عن', 'On behalf of'), l.archivedOnBehalfOf && userName(l.archivedOnBehalfOf))}
                {row(tr('عنوان الحاسوب (IP)', 'Workstation (IP)'), l.archivedFromIp && <span dir="ltr">{l.archivedFromIp}</span>)}
                {row(tr('المصدر', 'Source'), l.source === 'internal copy' ? tr('نسخة داخلية تلقائية', 'Automatic internal copy') : l.archivedAt ? tr('رفع ملف', 'Upload') : '')}
              </dl>
              <p className="text-sm text-slate-700 mt-2">{tr('هذه القيم يسجلها الخادم ولا يمكن لأحد تعديلها.', 'These values are set by the server and cannot be edited by anyone.')}</p>
            </Section>
            {l.links.length > 0 && (
              <Section title={tr('سجلات مرتبطة', 'Linked records')}>
                <ul className="space-y-1">
                  {l.links.map((k: any, i: number) => (
                    <li key={i}><button type="button" className="text-blue-800 underline font-semibold min-h-[32px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded" onClick={() => S.openLetter(k.otherId)}>
                      <span dir="ltr">{k.otherNumber || `#${k.otherId}`}</span> — {k.otherSubject}</button>
                      <span className="text-sm text-slate-700"> ({{ reply_to: tr('جواب', 'reply'), internal_copy_of: tr('نسخة داخلية', 'internal copy'), based_on: tr('مبني على', 'based on'), follow_up_of: tr('متابعة', 'follow-up'), related: tr('ذو علاقة', 'related') }[k.relation as string] || k.relation})</span></li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}

        {tab === 'workflow' && (
          <div role="tabpanel" id="las-panel-workflow" aria-labelledby="las-tab-workflow" className="space-y-4">
            {l.deliveries.length > 0 && (
              <Section title={tr('التسليم الداخلي والاستلام', 'Internal delivery and receipt')}>
                <table className="w-full text-sm"><caption className="sr-only">{tr('حالة استلام الكتاب في كل وحدة', 'Receipt status in each unit')}</caption>
                  <thead><tr className="text-start border-b border-slate-300"><th scope="col" className="text-start py-2">{tr('الوحدة', 'Unit')}</th><th scope="col" className="text-start">{tr('رقم الوارد', 'IN number')}</th><th scope="col" className="text-start">{tr('الاستلام', 'Receipt')}</th><th scope="col"><span className="sr-only">{tr('إجراء', 'Action')}</span></th></tr></thead>
                  <tbody>{l.deliveries.map((d: any) => (
                    <tr key={d.id} className="border-b border-slate-200">
                      <td className="py-2">{unitName(d.receivingUnitId)}{d.isCc ? tr(' (نسخة)', ' (copy)') : ''}</td><td dir="ltr" className="text-start">{d.inNumber}</td>
                      <td>{d.receivedAt ? `${tr('استلمه', 'Received by')} ${d.receivedByName} — ${fmtTime(d.receivedAt)}` : tr('لم يُستلم بعد', 'Not received yet')}</td>
                      <td>{d.canReceive && <Btn variant="success" disabled={busy} onClick={() => act(`/deliveries/${d.id}/receive`, {}, tr('تم تأكيد الاستلام.', 'Receipt confirmed.'))}>{tr('تأكيد الاستلام', 'Confirm receipt')}</Btn>}</td>
                    </tr>))}</tbody></table>
              </Section>
            )}
            {l.approvals.length > 0 && (
              <Section title={tr('سلسلة الموافقات', 'Approval chain')}>
                <ol className="space-y-2">{l.approvals.map((a: any) => (
                  <li key={a.id} className="border border-slate-300 rounded-lg p-3 text-sm">
                    <div className="font-bold">{tr('الجولة', 'Round')} {a.round} — {tr('الخطوة', 'Step')} {a.stepNo}: {unitName(a.approverUnitId)} — {pick(DECISION[a.decision], ar, a.decision)}</div>
                    {a.approverName && <div>{a.approverName}{a.onBehalfOf ? ` (${tr('بالنيابة عن', 'on behalf of')} ${userName(a.onBehalfOf)})` : ''} — {fmtTime(a.decidedAt)}</div>}
                    {a.comment && <div className="mt-1 whitespace-pre-wrap">{a.comment}</div>}
                  </li>))}</ol>
              </Section>
            )}
            {l.opinions.length > 0 && (
              <Section title={tr('آراء المستويات', 'Opinions of each level')}>
                <ol className="space-y-2">{l.opinions.map((o: any) => (
                  <li key={o.id} className="border border-slate-300 rounded-lg p-3 text-sm"><div className="font-bold">{unitName(o.levelUnitId)} — {o.userName} — {fmtTime(o.createdAt)}</div><div className="whitespace-pre-wrap mt-1">{o.opinion}</div></li>))}</ol>
              </Section>
            )}
            <Section title={tr('الإحالات', 'Referrals')}>
              {l.referrals.length === 0 ? <p className="text-sm text-slate-700">{tr('لا توجد إحالات.', 'No referrals.')}</p> : (
                <ol className="space-y-2">{l.referrals.map((r: any) => (
                  <li key={r.id} className="border border-slate-300 rounded-lg p-3 text-sm">
                    <div className="font-bold">{r.fromName} ← {r.toUid ? userName(r.toUid) : unitName(r.toUnitId)} — {pick(INSTRUCTION[r.instruction], ar)} — {pick(REFERRAL_STATUS[r.status], ar)}</div>
                    <div>{tr('أُرسلت', 'Sent')}: {fmtTime(r.sentAt)}{r.dueDate ? ` • ${tr('موعد الإنجاز', 'Due')}: ${fmtDate(r.dueDate)}` : ''}{r.readAt ? ` • ${tr('استُلمت', 'Read')}: ${fmtTime(r.readAt)}` : ''}{r.completedAt ? ` • ${tr('انتهت', 'Ended')}: ${fmtTime(r.completedAt)}` : ''}</div>
                    {r.note && <div className="mt-1 whitespace-pre-wrap">{tr('الملاحظة', 'Note')}: {r.note}</div>}
                    {r.responseText && <div className="mt-1 whitespace-pre-wrap">{tr('الرد', 'Response')} ({r.actedByName}): {r.responseText}</div>}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {r.canAct && r.status === 'Pending' && <Btn variant="success" disabled={busy} onClick={() => act(`/referrals/${r.id}/act`, { action: 'accept' }, tr('تم الاستلام.', 'Accepted.'))}>{tr('استلام', 'Accept')}</Btn>}
                      {r.canAct && <Btn variant="primary" onClick={() => setDialog({ kind: 'refAct', payload: { id: r.id, action: 'complete' } })}>{tr('إنجاز مع رد', 'Complete with response')}</Btn>}
                      {r.canAct && <Btn onClick={() => setDialog({ kind: 'refAct', payload: { id: r.id, action: 'return' } })}>{tr('إعادة', 'Return')}</Btn>}
                      {r.canAct && <Btn onClick={() => setDialog({ kind: 'refer', payload: { parentReferralId: r.id } })}>{tr('إحالة لجهة أخرى', 'Re-refer')}</Btn>}
                      {r.canRecall && <Btn onClick={() => act(`/referrals/${r.id}/recall`, {}, tr('سُحبت الإحالة.', 'Referral recalled.'))}>{tr('سحب الإحالة', 'Recall')}</Btn>}
                    </div>
                  </li>))}</ol>
              )}
            </Section>
            {l.dispatch && (
              <Section title={tr('الإرسال', 'Dispatch')}>
                <p className="text-sm">{pick(DISPATCH[l.dispatch.method], ar)} — {fmtDate(l.dispatch.date)} — {l.dispatch.recordedBy}</p>
                {l.dispatch.acknowledgement && <p className="text-sm mt-1">{tr('إقرار الاستلام', 'Acknowledgement')}: {l.dispatch.acknowledgement}</p>}
              </Section>
            )}
            {l.reportVersions.length > 0 && (
              <Section title={tr('نسخ التقرير', 'Report versions')}>
                <ol className="space-y-1 text-sm">{l.reportVersions.map((v: any) => <li key={v.id}>{tr('نسخة', 'Version')} {v.version} — {pick(REPORT_STATUS[v.status], ar)} — {v.byName} — {fmtTime(v.at)}{v.note ? ` — ${v.note}` : ''}</li>)}</ol>
              </Section>
            )}
          </div>
        )}

        {tab === 'files' && (
          <div role="tabpanel" id="las-panel-files" aria-labelledby="las-tab-files" className="space-y-3">
            {l.sourceLetterId && <Notice>{tr('هذه ملفات الكتاب الأصلي لدى الوحدة المرسلة؛ تُعرض هنا كرابط وليست نسخة ثانية.', 'These are the sender\'s original files, shown here as a link, not a second copy.')}</Notice>}
            {l.attachments.length === 0 ? <p className="text-sm text-slate-700">{tr('لا توجد ملفات.', 'No files.')}</p> : (
              <ul className="space-y-2">{l.attachments.map((a: any) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border border-slate-300 rounded-lg p-3">
                  <div className="text-sm min-w-0">
                    <div className="font-bold break-all flex items-center gap-1"><FileText className="w-4 h-4 shrink-0" aria-hidden="true" /><span dir="ltr">{a.fileName}</span></div>
                    <div className="text-slate-700">{a.isOriginalScan ? tr('النسخة الأصلية الممسوحة', 'Original scan') : a.kind === 'dispatch_ack' ? tr('إقرار استلام', 'Acknowledgement') : a.kind === 'directive_scan' ? tr('الهامش الممسوح', 'Scanned directive') : tr('مرفق', 'Attachment')}
                      {l.report ? ` • ${tr('نسخة', 'version')} ${a.version}` : ''} • {(a.size / 1024).toFixed(0)} KB • {fmtTime(a.uploadedAt)}</div>
                    <div className="text-xs text-slate-600 break-all" dir="ltr">SHA-256: {a.sha256}</div>
                  </div>
                  <div className="flex gap-2">
                    <Btn onClick={async () => { if (!(await openAttachment(a.id, filesLetterId, a.fileName))) setError(tr('تعذر فتح الملف.', 'The file could not be opened.')); }} aria-label={tr(`عرض ${a.fileName}`, `View ${a.fileName}`)}><Eye className="w-4 h-4" aria-hidden="true" />{tr('عرض', 'View')}</Btn>
                    <Btn onClick={() => openAttachment(a.id, filesLetterId, a.fileName, true)} aria-label={tr(`تنزيل ${a.fileName}`, `Download ${a.fileName}`)}><Download className="w-4 h-4" aria-hidden="true" />{tr('تنزيل', 'Download')}</Btn>
                    {P.attach && !l.sourceLetterId && <Btn variant="danger" onClick={() => { if (window.confirm(tr('إزالة هذا الملف من السجل؟ تبقى العملية مسجلة.', 'Remove this file from the record? The removal is logged.'))) act(`/attachments/${a.id}`, undefined, tr('أُزيل الملف.', 'File removed.'), 'DELETE'); }} aria-label={tr(`إزالة ${a.fileName}`, `Remove ${a.fileName}`)}><Trash2 className="w-4 h-4" aria-hidden="true" /></Btn>}
                  </div>
                </li>))}</ul>
            )}
            {P.attach && !l.sourceLetterId && <Btn onClick={() => setDialog({ kind: 'attach' })}><Paperclip className="w-4 h-4" aria-hidden="true" />{tr('إضافة ملفات', 'Add files')}</Btn>}
          </div>
        )}

        {tab === 'history' && l.history && (
          <div role="tabpanel" id="las-panel-history" aria-labelledby="las-tab-history">
            <table className="w-full text-sm"><caption className="sr-only">{tr('كل العمليات على هذا السجل', 'All operations on this record')}</caption>
              <thead><tr className="border-b border-slate-300"><th scope="col" className="text-start py-2">{tr('الوقت (بغداد)', 'Time (Baghdad)')}</th><th scope="col" className="text-start">{tr('المستخدم', 'User')}</th><th scope="col" className="text-start">{tr('العملية', 'Operation')}</th><th scope="col" className="text-start">IP</th></tr></thead>
              <tbody>{l.history.map((x: any) => (
                <tr key={x.id} className="border-b border-slate-200"><td className="py-1.5">{fmtTime(x.ts)}</td><td>{x.userName}{x.onBehalfOf ? ` (${tr('عن', 'for')} ${userName(x.onBehalfOf)})` : ''}</td><td dir="ltr" className="text-start">{x.action}</td><td dir="ltr" className="text-start">{x.clientIp}</td></tr>))}</tbody></table>
          </div>
        )}
      </div>

      {/* ---- dialogs ---- */}
      {dialog?.kind === 'approval' && <TextDialog title={{ Approved: tr('موافقة', 'Approve'), Returned: tr('إعادة مع ملاحظات', 'Return with comments'), Rejected: tr('رفض', 'Reject') }[dialog.payload as string]!}
        label={tr('الملاحظات', 'Comments')} required={dialog.payload !== 'Approved'} busy={busy} onClose={() => setDialog(null)}
        onSubmit={(text) => act(`/letters/${l.id}/approval`, { decision: dialog.payload, comment: text }, dialog.payload === 'Approved' ? tr('تمت الموافقة.', 'Approved.') : tr('تم تسجيل القرار.', 'Decision recorded.'))} />}
      {dialog?.kind === 'opinion' && <TextDialog title={tr('رأي المستوى', 'Opinion')} label={tr('الرأي', 'Opinion')} required busy={busy} onClose={() => setDialog(null)} onSubmit={(text) => act(`/mutalaa/${l.id}/opinion`, { opinion: text }, tr('أُضيف الرأي ورُفعت المطالعة.', 'Opinion added and forwarded.'))} />}
      {dialog?.kind === 'refAct' && <TextDialog title={dialog.payload.action === 'complete' ? tr('إنجاز الإحالة', 'Complete the referral') : tr('إعادة الإحالة', 'Return the referral')} label={tr('الرد', 'Response')} required withFiles busy={busy} onClose={() => setDialog(null)}
        onSubmit={(text, files) => act(`/referrals/${dialog.payload.id}/act`, { action: dialog.payload.action, responseText: text, files }, tr('تم تسجيل الرد.', 'Response recorded.'))} />}
      {dialog?.kind === 'close' && <TextDialog title={tr('إغلاق السجل', 'Close the record')} label={tr('ملاحظة (اختياري)', 'Note (optional)')} hint={tr('السجل المغلق للقراءة فقط؛ إعادة فتحه لمدير النظام مع ذكر السبب.', 'A closed record is read-only; only an administrator can reopen it, with a reason.')} busy={busy} onClose={() => setDialog(null)} onSubmit={(text) => act(`/letters/${l.id}/close`, { note: text }, tr('أُغلق السجل.', 'Record closed.'))} />}
      {dialog?.kind === 'reopen' && <TextDialog title={tr('إعادة فتح السجل', 'Reopen the record')} label={tr('السبب', 'Reason')} required busy={busy} onClose={() => setDialog(null)} onSubmit={(text) => act(`/letters/${l.id}/reopen`, { reason: text }, tr('أُعيد فتح السجل.', 'Record reopened.'))} />}
      {dialog?.kind === 'newVersion' && <TextDialog title={tr('نسخة جديدة من التقرير', 'New report version')} label={tr('ما الذي تغيّر؟', 'What changed?')} withFiles busy={busy} onClose={() => setDialog(null)} onSubmit={(text, files) => act(`/reports/${l.id}/new-version`, { note: text, files }, tr('أُنشئت نسخة جديدة (مسودة).', 'New draft version created.'))} />}
      {dialog?.kind === 'attach' && <TextDialog title={tr('إضافة ملفات', 'Add files')} label="" onlyFiles busy={busy} onClose={() => setDialog(null)} onSubmit={(_t, files) => act(`/letters/${l.id}/attachments`, { files }, tr('أُضيفت الملفات.', 'Files added.'))} />}
      {dialog?.kind === 'refer' && <ReferDialog letter={l} parentReferralId={dialog.payload?.parentReferralId} busy={busy} onClose={() => setDialog(null)} onSubmit={(body) => act(`/letters/${l.id}/referrals`, body, tr('تمت الإحالة.', 'Referred.'))} />}
      {dialog?.kind === 'directive' && <DirectiveDialog busy={busy} onClose={() => setDialog(null)} onSubmit={(body) => act(`/mutalaa/${l.id}/directive`, body, tr('سُجّل التوجيه.', 'Directive recorded.'))} />}
      {dialog?.kind === 'dispatch' && <DispatchDialog busy={busy} today={me.today} onClose={() => setDialog(null)} onSubmit={(body) => act(`/letters/${l.id}/dispatch`, body, tr('سُجّل الإرسال.', 'Dispatch recorded.'))} />}
      {dialog?.kind === 'edit' && <EditDialog letter={l} busy={busy} onClose={() => setDialog(null)} onSubmit={(body) => act(`/letters/${l.id}`, body, tr('حُفظت التعديلات.', 'Changes saved.'), 'PUT')} />}
      {dialog?.kind === 'reply' && (
        <Modal wide title={tr(`جواب على ${l.number}`, `Reply to ${l.number}`)} onClose={() => setDialog(null)}>
          <OutgoingForm preset={{ replyToLetterId: l.id, scope: l.scope === 'internal' ? 'internal' : 'external', contactId: l.contactId ? String(l.contactId) : '', subject: tr(`جواب: ${l.subject}`, `Re: ${l.subject}`), referenceText: l.externalRefNo ? tr(`إشارة إلى كتابكم المرقم ${l.externalRefNo}${l.externalRefDate ? ` في ${l.externalRefDate}` : ''}`, `With reference to your letter no. ${l.externalRefNo}${l.externalRefDate ? ` dated ${l.externalRefDate}` : ''}`) : '', categoryId: l.categoryId ? String(l.categoryId) : '', unitId: String(l.unitId) }}
            onDone={(_id, m) => { setDialog(null); setMsg(m); announce(m); load(); onChanged(); }} />
        </Modal>
      )}
    </Modal>
  );
}

// ---- small dialogs ---------------------------------------------------------------------------
function TextDialog({ title, label, hint, required, withFiles, onlyFiles, busy, onClose, onSubmit }: { title: string; label: string; hint?: string; required?: boolean; withFiles?: boolean; onlyFiles?: boolean; busy: boolean; onClose: () => void; onSubmit: (text: string, files: PickedFile[]) => void }) {
  const { tr } = useLas();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [err, setErr] = useState('');
  return (
    <Modal title={title} onClose={onClose}>
      <form className="space-y-3" noValidate onSubmit={e => {
        e.preventDefault();
        if (required && !text.trim()) return setErr(tr('هذا الحقل مطلوب.', 'This field is required.'));
        if (onlyFiles && files.length === 0) return setErr(tr('اختر ملفاً واحداً على الأقل.', 'Choose at least one file.'));
        onSubmit(text.trim(), files);
      }}>
        {!onlyFiles && <Field label={label} hint={hint} required={required} error={err}>{(p) => <textarea {...p} autoFocus value={text} onChange={e => setText(e.target.value)} rows={4} className={inputCls} />}</Field>}
        {(withFiles || onlyFiles) && <FilePicker label={tr('الملفات', 'Files')} files={files} onChange={setFiles} />}
        {onlyFiles && err && <Notice kind="error">{err}</Notice>}
        <div className="flex justify-end gap-2"><Btn onClick={onClose}>{tr('إلغاء', 'Cancel')}</Btn><Btn type="submit" variant="primary" disabled={busy}>{tr('حفظ', 'Save')}</Btn></div>
      </form>
    </Modal>
  );
}

function ReferDialog({ letter, parentReferralId, busy, onClose, onSubmit }: { letter: any; parentReferralId?: number; busy: boolean; onClose: () => void; onSubmit: (body: any) => void }) {
  const { tr, ar, units, users } = useLas();
  const [instruction, setInstruction] = useState('For action');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState(letter.dueDate || '');
  const [toUnits, setToUnits] = useState<string[]>([]);
  const [toUsers, setToUsers] = useState<string[]>([]);
  const [err, setErr] = useState('');
  return (
    <Modal title={parentReferralId ? tr('إحالة لجهة أخرى', 'Re-refer') : tr('إحالة الكتاب', 'Refer the letter')} onClose={onClose}>
      <form className="space-y-3" noValidate onSubmit={e => {
        e.preventDefault();
        if (toUnits.length + toUsers.length === 0) return setErr(tr('اختر وحدة أو شخصاً واحداً على الأقل.', 'Choose at least one unit or person.'));
        onSubmit({ instruction, note, dueDate: dueDate || null, parentReferralId, targets: [...toUnits.map(u => ({ unitId: Number(u) })), ...toUsers.map(u => ({ userUid: u }))] });
      }}>
        {err && <Notice kind="error">{err}</Notice>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={tr('التوجيه', 'Instruction')} required>{(p) => <select {...p} value={instruction} onChange={e => setInstruction(e.target.value)} className={inputCls}>{Object.entries(INSTRUCTION).map(([k, l]) => <option key={k} value={k}>{pick(l, ar)}</option>)}</select>}</Field>
          <Field label={tr('موعد الإنجاز', 'Due date')} hint={tr('إن تُرك فارغاً يُحسب من تصنيف الكتاب.', 'If empty, it is taken from the letter category.')}>{(p) => <input {...p} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />}</Field>
        </div>
        <CheckList legend={tr('إلى وحدات', 'To units')} value={toUnits} onChange={setToUnits} options={units.filter(u => u.active).sort((a, b) => a.code.localeCompare(b.code)).map(u => ({ value: String(u.id), label: `${u.code} — ${ar ? u.nameAr : u.nameEn}` }))} />
        <CheckList legend={tr('إلى أشخاص', 'To people')} value={toUsers} onChange={setToUsers} options={users.map(u => ({ value: u.uid, label: u.fullName }))} />
        <Field label={tr('ملاحظة', 'Note')}>{(p) => <textarea {...p} value={note} onChange={e => setNote(e.target.value)} rows={3} className={inputCls} />}</Field>
        <div className="flex justify-end gap-2"><Btn onClick={onClose}>{tr('إلغاء', 'Cancel')}</Btn><Btn type="submit" variant="primary" disabled={busy}>{tr('إحالة', 'Refer')}</Btn></div>
      </form>
    </Modal>
  );
}

function DirectiveDialog({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (body: any) => void }) {
  const { tr, ar } = useLas();
  const [decision, setDecision] = useState('Approved');
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [err, setErr] = useState('');
  return (
    <Modal title={tr('تسجيل التوجيه / الهامش', 'Record the directive')} onClose={onClose}>
      <form className="space-y-3" noValidate onSubmit={e => {
        e.preventDefault();
        if (!text.trim() && files.length === 0) return setErr(tr('اكتب نص التوجيه أو أرفق صورة الهامش الموقّع.', 'Enter the directive text or attach the scanned signed note.'));
        onSubmit({ decision, directiveText: text.trim(), executionDue: due || null, file: files[0] });
      }}>
        {err && <Notice kind="error">{err}</Notice>}
        <Field label={tr('القرار', 'Decision')} required>{(p) => <select {...p} value={decision} onChange={e => setDecision(e.target.value)} className={inputCls}>{Object.entries(MUT_DECISION).map(([k, l]) => <option key={k} value={k}>{pick(l, ar)}</option>)}</select>}</Field>
        <Field label={tr('نص التوجيه / الهامش', 'Directive text')}>{(p) => <textarea {...p} value={text} onChange={e => setText(e.target.value)} rows={4} className={inputCls} />}</Field>
        <Field label={tr('موعد تنفيذ التوجيه', 'Execution due date')} hint={tr('إن حُدّد يُتابَع التنفيذ حتى يُسجَّل إنجازه.', 'If set, execution is followed up until marked done.')}>{(p) => <input {...p} type="date" value={due} onChange={e => setDue(e.target.value)} className={inputCls} />}</Field>
        <FilePicker label={tr('صورة الهامش الموقّع (اختياري)', 'Scan of the signed note (optional)')} files={files} onChange={f => setFiles(f.slice(-1))} />
        <div className="flex justify-end gap-2"><Btn onClick={onClose}>{tr('إلغاء', 'Cancel')}</Btn><Btn type="submit" variant="primary" disabled={busy}>{tr('حفظ التوجيه', 'Save directive')}</Btn></div>
      </form>
    </Modal>
  );
}

function DispatchDialog({ busy, today, onClose, onSubmit }: { busy: boolean; today: string; onClose: () => void; onSubmit: (body: any) => void }) {
  const { tr, ar } = useLas();
  const [method, setMethod] = useState('Hand delivery');
  const [date, setDate] = useState(today);
  const [ack, setAck] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  return (
    <Modal title={tr('تسجيل إرسال الكتاب', 'Record dispatch')} onClose={onClose}>
      <form className="space-y-3" noValidate onSubmit={e => { e.preventDefault(); onSubmit({ method, date, acknowledgement: ack, file: files[0] }); }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={tr('طريقة الإرسال', 'Method')} required>{(p) => <select {...p} value={method} onChange={e => setMethod(e.target.value)} className={inputCls}>{Object.entries(DISPATCH).map(([k, l]) => <option key={k} value={k}>{pick(l, ar)}</option>)}</select>}</Field>
          <Field label={tr('تاريخ الإرسال', 'Date')} required>{(p) => <input {...p} type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />}</Field>
        </div>
        <Field label={tr('إقرار المستلم', "Recipient's acknowledgement")}>{(p) => <input {...p} value={ack} onChange={e => setAck(e.target.value)} className={inputCls} maxLength={500} />}</Field>
        <FilePicker label={tr('النسخة الموقّعة بالاستلام (اختياري)', 'Signed acknowledgement copy (optional)')} files={files} onChange={f => setFiles(f.slice(-1))} />
        <div className="flex justify-end gap-2"><Btn onClick={onClose}>{tr('إلغاء', 'Cancel')}</Btn><Btn type="submit" variant="primary" disabled={busy}>{tr('حفظ', 'Save')}</Btn></div>
      </form>
    </Modal>
  );
}

function EditDialog({ letter: l, busy, onClose, onSubmit }: { letter: any; busy: boolean; onClose: () => void; onSubmit: (body: any) => void }) {
  const { tr, ar, categories } = useLas();
  const loc = l.physicalLocation || {};
  const [v, setV] = useState<any>({ subject: l.subject, summary: l.summary || '', categoryId: l.categoryId ? String(l.categoryId) : '', urgency: l.urgency, confidentiality: l.confidentiality, dueDate: l.dueDate || '', building: loc.building || '', room: loc.room || '', cabinet: loc.cabinet || '', shelf: loc.shelf || '', box: loc.box || '' });
  const set = (patch: any) => setV((x: any) => ({ ...x, ...patch }));
  return (
    <Modal title={tr('تعديل بيانات السجل', 'Edit record details')} onClose={onClose}>
      <form className="space-y-3" noValidate onSubmit={e => {
        e.preventDefault();
        onSubmit({ subject: v.subject, summary: v.summary, categoryId: v.categoryId || null, urgency: v.urgency, confidentiality: v.confidentiality, dueDate: v.dueDate || null, physicalLocation: { building: v.building, room: v.room, cabinet: v.cabinet, shelf: v.shelf, box: v.box } });
      }}>
        <Notice>{tr('الرقم والوحدة وبيانات الأرشفة لا تتغير. كل تعديل يُسجَّل بالقيمة القديمة والجديدة.', 'Number, unit and archiving data never change. Every edit is logged with old and new values.')}</Notice>
        <Field label={tr('الموضوع', 'Subject')} required>{(p) => <input {...p} value={v.subject} onChange={e => set({ subject: e.target.value })} className={inputCls} />}</Field>
        <Field label={tr('الخلاصة', 'Summary')}>{(p) => <textarea {...p} value={v.summary} onChange={e => set({ summary: e.target.value })} rows={3} className={inputCls} />}</Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={tr('التصنيف', 'Category')}>{(p) => <select {...p} value={v.categoryId} onChange={e => set({ categoryId: e.target.value })} className={inputCls}><option value="">—</option>{categories.map(c => <option key={c.id} value={c.id}>{ar ? c.nameAr : c.nameEn}</option>)}</select>}</Field>
          <Field label={tr('موعد الإنجاز', 'Due date')}>{(p) => <input {...p} type="date" value={v.dueDate} onChange={e => set({ dueDate: e.target.value })} className={inputCls} />}</Field>
          <Field label={tr('الاستعجال', 'Urgency')}>{(p) => <select {...p} value={v.urgency} onChange={e => set({ urgency: e.target.value })} className={inputCls}>{Object.entries(URGENCY).map(([k, x]) => <option key={k} value={k}>{pick(x, ar)}</option>)}</select>}</Field>
          <Field label={tr('السرية', 'Confidentiality')}>{(p) => <select {...p} value={v.confidentiality} onChange={e => set({ confidentiality: e.target.value })} className={inputCls}>{Object.entries(CONF).map(([k, x]) => <option key={k} value={k}>{pick(x, ar)}</option>)}</select>}</Field>
        </div>
        <fieldset className="border border-slate-400 rounded-lg p-3"><legend className="px-1 text-sm font-semibold">{tr('مكان الأصل الورقي', 'Paper original location')}</legend>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[['building', 'المبنى', 'Building'], ['room', 'الغرفة', 'Room'], ['cabinet', 'الخزانة', 'Cabinet'], ['shelf', 'الرف', 'Shelf'], ['box', 'الصندوق', 'Box']].map(([k, a, e]) => (
              <Field key={k} label={tr(a, e)}>{(p) => <input {...p} value={v[k]} onChange={ev => set({ [k]: ev.target.value })} className={inputCls} />}</Field>))}
          </div></fieldset>
        <div className="flex justify-end gap-2"><Btn onClick={onClose}>{tr('إلغاء', 'Cancel')}</Btn><Btn type="submit" variant="primary" disabled={busy}>{tr('حفظ التعديلات', 'Save changes')}</Btn></div>
      </form>
    </Modal>
  );
}
