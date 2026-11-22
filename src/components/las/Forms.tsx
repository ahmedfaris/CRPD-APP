// Letters Archive System — registration and drafting forms for the three archive types.
import React, { useMemo, useState } from 'react';
import { Save, Send } from 'lucide-react';
import {
  useLas, las, Field, Btn, Notice, UnitSelect, CheckList, FilePicker, PickedFile, Section, inputCls,
  URGENCY, CONF, REPORT_KIND, CONTACT_TYPE, pick, Modal,
} from './ui';

interface FormProps { onDone: (letterId: number, message: string) => void; preset?: Record<string, any> }

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return { busy, error, setError, run: async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } finally { setBusy(false); } } };
}

/** Urgency, confidentiality, category and named people — shared by every form. */
function CommonFields({ v, set, showUrgency = true }: { v: any; set: (patch: any) => void; showUrgency?: boolean }) {
  const { tr, ar, categories, users } = useLas();
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label={tr('التصنيف', 'Category')} hint={tr('يحدد مدة الإنجاز ومدة الحفظ تلقائياً.', 'Sets the due date and retention period automatically.')}>
          {(p) => (
            <select {...p} value={v.categoryId} onChange={e => set({ categoryId: e.target.value })} className={inputCls}>
              <option value="">{tr('— بدون —', '— None —')}</option>
              {categories.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{ar ? c.nameAr : c.nameEn}{c.defaultDueDays ? ` (${c.defaultDueDays} ${tr('يوم', 'days')})` : ''}</option>)}
            </select>
          )}
        </Field>
        {showUrgency && (
          <Field label={tr('درجة الاستعجال', 'Urgency')}>
            {(p) => <select {...p} value={v.urgency} onChange={e => set({ urgency: e.target.value })} className={inputCls}>{Object.entries(URGENCY).map(([k, l]) => <option key={k} value={k}>{pick(l, ar)}</option>)}</select>}
          </Field>
        )}
        <Field label={tr('درجة السرية', 'Confidentiality')}
          hint={v.confidentiality === 'Confidential' ? tr('يراه رؤساء الوحدة والأشخاص المسمّون فقط.', 'Visible to unit heads and named people only.')
            : v.confidentiality === 'Sensitive' ? tr('يراه الأشخاص المسمّون فقط، ويُسجَّل كل اطلاع.', 'Visible to named people only; every view is logged.') : undefined}>
          {(p) => <select {...p} value={v.confidentiality} onChange={e => set({ confidentiality: e.target.value })} className={inputCls}>{Object.entries(CONF).map(([k, l]) => <option key={k} value={k}>{pick(l, ar)}</option>)}</select>}
        </Field>
      </div>
      {v.confidentiality !== 'Normal' && (
        <CheckList legend={tr('الأشخاص المسموح لهم بالاطلاع', 'People allowed to see this record')} value={v.namedUserUids} onChange={x => set({ namedUserUids: x })}
          options={users.map(u => ({ value: u.uid, label: u.fullName }))} />
      )}
    </>
  );
}

function AddContact({ onAdded, onClose }: { onAdded: (id: number) => void; onClose: () => void }) {
  const { tr, ar, reload } = useLas();
  const [c, setC] = useState({ name: '', orgType: 'ministry', address: '', phone: '', email: '' });
  const s = useSubmit();
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    s.run(async () => {
      const r = await las('/contacts', 'POST', c);
      if (!r.ok) return s.setError(r.error || '');
      await reload();
      onAdded(r.data.id);
    });
  };
  return (
    <Modal title={tr('إضافة جهة إلى دليل المراسلين', 'Add a party to the address book')} onClose={onClose}>
      <form onSubmit={save} className="space-y-3" noValidate>
        {s.error && <Notice kind="error">{s.error}</Notice>}
        <Field label={tr('الاسم', 'Name')} required>{(p) => <input {...p} value={c.name} onChange={e => setC({ ...c, name: e.target.value })} className={inputCls} maxLength={200} />}</Field>
        <Field label={tr('النوع', 'Type')}>{(p) => <select {...p} value={c.orgType} onChange={e => setC({ ...c, orgType: e.target.value })} className={inputCls}>{Object.entries(CONTACT_TYPE).map(([k, l]) => <option key={k} value={k}>{pick(l, ar)}</option>)}</select>}</Field>
        <Field label={tr('العنوان', 'Address')}>{(p) => <input {...p} value={c.address} onChange={e => setC({ ...c, address: e.target.value })} className={inputCls} />}</Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={tr('الهاتف', 'Phone')}>{(p) => <input {...p} type="tel" dir="ltr" value={c.phone} onChange={e => setC({ ...c, phone: e.target.value })} className={inputCls} />}</Field>
          <Field label={tr('البريد الإلكتروني', 'Email')}>{(p) => <input {...p} type="email" dir="ltr" value={c.email} onChange={e => setC({ ...c, email: e.target.value })} className={inputCls} />}</Field>
        </div>
        <div className="flex justify-end gap-2"><Btn onClick={onClose}>{tr('إلغاء', 'Cancel')}</Btn><Btn type="submit" variant="primary" disabled={s.busy}>{tr('حفظ', 'Save')}</Btn></div>
      </form>
    </Modal>
  );
}

function ContactField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const { tr, contacts, me } = useLas();
  const [adding, setAdding] = useState(false);
  const canAdd = me.isSysAdmin || me.registryUnits.length > 0;
  return (
    <div>
      <Field label={label} required>
        {(p) => (
          <select {...p} value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
            <option value="">{tr('— اختر من دليل المراسلين —', '— Choose from the address book —')}</option>
            {contacts.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </Field>
      {canAdd && <Btn onClick={() => setAdding(true)} className="mt-2">{tr('+ جهة جديدة', '+ New party')}</Btn>}
      {adding && <AddContact onClose={() => setAdding(false)} onAdded={(id) => { onChange(String(id)); setAdding(false); }} />}
    </div>
  );
}

// =======================================================================================
// Incoming external letter (4.1)
// =======================================================================================
/** With captureDocId the letter is registered from the capture queue: the scanned PDF/A is the original scan. */
export function IncomingForm({ onDone, preset, captureDocId }: FormProps & { captureDocId?: number }) {
  const { tr, me } = useLas();
  const [v, setV] = useState<any>({
    unitId: me.registryUnits.length === 1 ? String(me.registryUnits[0]) : '', headOffice: false, contactId: '', externalRefNo: '', externalRefDate: '', receivedDate: me.today,
    letterDate: '', subject: '', summary: '', categoryId: '', urgency: 'Normal', confidentiality: 'Normal', namedUserUids: [], pagesCount: '', attachmentsCount: '',
    building: '', room: '', cabinet: '', shelf: '', box: '', ...preset,
  });
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [duplicate, setDuplicate] = useState<string[] | null>(null);
  const s = useSubmit();
  const set = (patch: any) => setV((x: any) => ({ ...x, ...patch }));

  const submit = (confirmDuplicate = false) => s.run(async () => {
    if (!v.unitId) return s.setError(tr('اختر الوحدة المستلمة.', 'Choose the receiving unit.'));
    if (!v.contactId) return s.setError(tr('اختر الجهة المرسلة من دليل المراسلين.', 'Choose the sender from the address book.'));
    if (!v.subject.trim()) return s.setError(tr('اكتب موضوع الكتاب.', 'Enter the subject of the letter.'));
    const r = await las('/letters/incoming', 'POST', {
      ...v, unitId: Number(v.unitId), contactId: Number(v.contactId), categoryId: v.categoryId || null, pagesCount: v.pagesCount || null, attachmentsCount: v.attachmentsCount || null,
      physicalLocation: { building: v.building, room: v.room, cabinet: v.cabinet, shelf: v.shelf, box: v.box }, files, confirmDuplicate,
      captureDocId: captureDocId || undefined,
    });
    if (r.code === 'DUPLICATE') { setDuplicate(r.raw.existing || []); return; }
    if (!r.ok) return s.setError(r.error || '');
    onDone(r.data.id, tr(`تم تسجيل الكتاب بالرقم ${r.data.number}`, `Letter registered as ${r.data.number}`));
  });

  if (me.registryUnits.length === 0) return <Notice kind="warn">{tr('تسجيل الوارد متاح لموظف الصادرة والواردة ورؤساء الوحدات فقط.', 'Only correspondence clerks and unit heads register incoming letters.')}</Notice>;
  return (
    <form onSubmit={e => { e.preventDefault(); submit(false); }} className="space-y-4" noValidate aria-label={tr('تسجيل كتاب وارد', 'Register an incoming letter')}>
      {s.error && <Notice kind="error">{s.error}</Notice>}
      <Section title={tr('١. المرسل والاستلام', '1. Sender and receipt')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ContactField label={tr('الجهة المرسلة', 'Sender')} value={v.contactId} onChange={x => set({ contactId: x })} />
          <Field label={tr('الوحدة المستلمة', 'Receiving unit')} required>
            {(p) => <UnitSelect {...p} value={v.unitId} onChange={x => set({ unitId: x })} only={u => me.registryUnits.includes(u.id) && u.active} />}
          </Field>
          <Field label={tr('رقم كتاب الجهة المرسلة', "Sender's reference number")}>{(p) => <input {...p} value={v.externalRefNo} onChange={e => set({ externalRefNo: e.target.value })} className={inputCls} maxLength={100} />}</Field>
          <Field label={tr('تاريخ كتاب الجهة المرسلة', "Sender's reference date")}>{(p) => <input {...p} type="date" value={v.externalRefDate} onChange={e => set({ externalRefDate: e.target.value })} className={inputCls} />}</Field>
          <Field label={tr('تاريخ الاستلام', 'Date received')} required>{(p) => <input {...p} type="date" value={v.receivedDate} max={me.today} onChange={e => set({ receivedDate: e.target.value })} className={inputCls} />}</Field>
          <label className="flex items-center gap-2 min-h-[42px] text-sm font-semibold self-end cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-blue-800" checked={v.headOffice} onChange={e => set({ headOffice: e.target.checked })} />
            {tr('موجّه إلى رئيس الوحدة شخصياً (مكتب الرئيس)', "Addressed to the head personally (head's office)")}
          </label>
        </div>
      </Section>
      <Section title={tr('٢. بيانات الكتاب', '2. Letter details')}>
        <div className="space-y-3">
          <Field label={tr('الموضوع', 'Subject')} required>{(p) => <input {...p} value={v.subject} onChange={e => set({ subject: e.target.value })} className={inputCls} maxLength={500} />}</Field>
          <Field label={tr('خلاصة الكتاب', 'Summary')}>{(p) => <textarea {...p} value={v.summary} onChange={e => set({ summary: e.target.value })} rows={3} className={inputCls} />}</Field>
          <CommonFields v={v} set={set} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('عدد الصفحات', 'Number of pages')}>{(p) => <input {...p} type="number" min={0} value={v.pagesCount} onChange={e => set({ pagesCount: e.target.value })} className={inputCls} />}</Field>
            <Field label={tr('عدد المرفقات', 'Number of attachments')}>{(p) => <input {...p} type="number" min={0} value={v.attachmentsCount} onChange={e => set({ attachmentsCount: e.target.value })} className={inputCls} />}</Field>
          </div>
        </div>
      </Section>
      <Section title={tr('٣. النسخة الممسوحة ومكان الأصل الورقي', '3. Scan and location of the paper original')}>
        <div className="space-y-3">
          {captureDocId && <Notice kind="info">{tr('الوثيقة الممسوحة (PDF/A مع النص المستخرج) تُحفظ كنسخة أصلية لهذا الكتاب. يمكنك إضافة مرفقات أخرى أدناه.', 'The scanned document (PDF/A with its OCR text) is stored as this letter\'s original scan. You can add other attachments below.')}</Notice>}
          <FilePicker label={captureDocId ? tr('مرفقات إضافية', 'Additional attachments') : tr('ملف الكتاب الممسوح والمرفقات', 'Scanned letter and attachments')} files={files} onChange={setFiles} markFirstAsScan={!captureDocId}
            hint={captureDocId ? undefined : tr('الملف الأول يُحفظ كنسخة أصلية ويُحوَّل تلقائياً إلى PDF/A قابل للبحث. للمسح الدفعي استخدم «المسح الضوئي والفهرسة».', 'The first file is kept as the original scan and converted to searchable PDF/A automatically. For batch scanning use "Scanning and indexing".')} />
          <fieldset className="border border-slate-400 rounded-lg p-3">
            <legend className="px-1 text-sm font-semibold">{tr('مكان حفظ الأصل الورقي', 'Where the paper original is kept')}</legend>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[['building', 'المبنى', 'Building'], ['room', 'الغرفة', 'Room'], ['cabinet', 'الخزانة', 'Cabinet'], ['shelf', 'الرف', 'Shelf'], ['box', 'الصندوق', 'Box']].map(([k, a, e]) => (
                <Field key={k} label={tr(a, e)}>{(p) => <input {...p} value={v[k]} onChange={ev => set({ [k]: ev.target.value })} className={inputCls} maxLength={60} />}</Field>
              ))}
            </div>
          </fieldset>
        </div>
      </Section>
      <div className="flex justify-end">
        <Btn type="submit" variant="primary" disabled={s.busy}><Save className="w-4 h-4" aria-hidden="true" />{s.busy ? tr('جارٍ التسجيل…', 'Registering…') : tr('تسجيل وإصدار الرقم', 'Register and issue the number')}</Btn>
      </div>
      {duplicate && (
        <Modal title={tr('احتمال تكرار', 'Possible duplicate')} onClose={() => setDuplicate(null)}>
          <Notice kind="warn">{tr(`يوجد كتاب مسجل من الجهة نفسها وبرقم الكتاب نفسه: ${duplicate.join('، ')}.`, `A letter from the same sender with the same reference is already registered: ${duplicate.join(', ')}.`)}</Notice>
          <div className="flex justify-end gap-2 mt-4">
            <Btn onClick={() => setDuplicate(null)}>{tr('رجوع للتعديل', 'Go back')}</Btn>
            <Btn variant="primary" onClick={() => { setDuplicate(null); submit(true); }}>{tr('سجّل على أي حال', 'Register anyway')}</Btn>
          </div>
        </Modal>
      )}
    </form>
  );
}

// =======================================================================================
// Outgoing letter / internal memo (4.2)
// =======================================================================================
export function OutgoingForm({ onDone, preset }: FormProps) {
  const { tr, ar, me, units, unitById } = useLas();
  // A user may draft for their own unit or any unit above it (the letter is issued by that unit).
  const issuingUnits = useMemo(() => {
    const ids = new Set<number>();
    for (const id of [...me.memberUnits, ...me.registryUnits]) { let cur = unitById(id); while (cur) { ids.add(cur.id); cur = cur.parentId ? unitById(cur.parentId) : undefined; } }
    return ids;
  }, [me, units]);
  const [v, setV] = useState<any>({
    unitId: me.memberUnits.length === 1 ? String(me.memberUnits[0]) : '', scope: 'internal', isMemo: false, toUnitIds: [], ccUnitIds: [], contactId: '', subject: '', body: '', summary: '',
    referenceText: '', categoryId: '', urgency: 'Normal', confidentiality: 'Normal', namedUserUids: [], ...preset,
  });
  const [files, setFiles] = useState<PickedFile[]>([]);
  const s = useSubmit();
  const set = (patch: any) => setV((x: any) => ({ ...x, ...patch }));
  const others = units.filter(u => u.active && String(u.id) !== v.unitId).sort((a, b) => a.code.localeCompare(b.code)).map(u => ({ value: String(u.id), label: `${u.code} — ${ar ? u.nameAr : u.nameEn}` }));

  const save = (thenSubmit: boolean) => s.run(async () => {
    if (!v.unitId) return s.setError(tr('اختر الوحدة التي يصدر عنها الكتاب.', 'Choose the unit issuing the letter.'));
    if (!v.subject.trim()) return s.setError(tr('اكتب موضوع الكتاب.', 'Enter the subject.'));
    if (v.scope === 'internal' && v.toUnitIds.length === 0) return s.setError(tr('اختر وحدة مستلمة واحدة على الأقل.', 'Choose at least one receiving unit.'));
    if (v.scope === 'external' && !v.contactId) return s.setError(tr('اختر الجهة المرسل إليها.', 'Choose the recipient.'));
    const r = await las('/letters/outgoing', 'POST', {
      ...v, unitId: Number(v.unitId), toUnitIds: v.toUnitIds.map(Number), ccUnitIds: v.ccUnitIds.map(Number), contactId: v.contactId ? Number(v.contactId) : null,
      categoryId: v.categoryId || null, files,
    });
    if (!r.ok) return s.setError(r.error || '');
    if (!thenSubmit) return onDone(r.data.id, tr('تم حفظ المسودة.', 'Draft saved.'));
    const sub = await las(`/letters/${r.data.id}/submit`, 'POST');
    if (!sub.ok) return onDone(r.data.id, tr('حُفظت المسودة لكن تعذر إرسالها للموافقة: ', 'Draft saved, but it could not be submitted: ') + (sub.error || ''));
    onDone(r.data.id, sub.data.number ? tr(`صدر الكتاب بالرقم ${sub.data.number}`, `Letter issued as ${sub.data.number}`) : tr('أُرسلت المسودة للموافقة. يصدر الرقم عند الموافقة النهائية.', 'Draft sent for approval. The number is issued at final approval.'));
  });

  if (issuingUnits.size === 0) return <Notice kind="warn">{tr('لا توجد لديك صلاحية في أي وحدة لتحرير الكتب. راجع مدير النظام.', 'You have no role in any unit yet. Ask the administrator.')}</Notice>;
  return (
    <form onSubmit={e => { e.preventDefault(); save(true); }} className="space-y-4" noValidate aria-label={tr('تحرير كتاب صادر', 'Draft an outgoing letter')}>
      {s.error && <Notice kind="error">{s.error}</Notice>}
      {preset?.replyToLetterId && <Notice>{tr('هذا الكتاب جواب على كتاب وارد؛ عند صدوره تُغلق متابعة الوارد تلقائياً.', 'This letter replies to an incoming letter; issuing it closes that follow-up automatically.')}</Notice>}
      <Section title={tr('١. الجهة المصدرة والمستلمون', '1. Issuing unit and recipients')}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={tr('يصدر عن', 'Issued by')} required hint={tr('تمر المسودة بسلسلة الموافقات من وحدتك حتى هذه الوحدة.', 'The draft is approved by each head from your unit up to this unit.')}>
              {(p) => <UnitSelect {...p} value={v.unitId} onChange={x => set({ unitId: x, toUnitIds: v.toUnitIds.filter((t: string) => t !== x) })} only={u => issuingUnits.has(u.id) && u.active} />}
            </Field>
            <fieldset>
              <legend className="block text-sm font-semibold mb-1">{tr('نوع الكتاب', 'Kind of letter')}</legend>
              <div className="flex flex-wrap gap-4 min-h-[42px] items-center">
                {[['internal', 'صادر داخلي (إلى وحدات المؤسسة)', 'Internal (to units of the institution)'], ['external', 'صادر خارجي', 'External']].map(([k, a, e]) => (
                  <label key={k} className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="scope" className="w-5 h-5 accent-blue-800" checked={v.scope === k} onChange={() => set({ scope: k })} />{tr(a, e)}</label>
                ))}
              </div>
            </fieldset>
          </div>
          {v.scope === 'internal' ? (
            <>
              <CheckList legend={tr('الوحدات المستلمة *', 'Receiving units *')} options={others} value={v.toUnitIds} onChange={x => set({ toUnitIds: x })}
                hint={tr('عند الصدور يُسجَّل الكتاب تلقائياً في وارد كل وحدة برقم وارد خاص بها.', 'When issued, the letter is registered automatically in each unit\'s incoming register with its own number.')} />
              <CheckList legend={tr('نسخة منه إلى (وحدات)', 'Copy to (units)')} options={others.filter(o => !v.toUnitIds.includes(o.value))} value={v.ccUnitIds} onChange={x => set({ ccUnitIds: x })} />
              <label className="flex items-center gap-2 min-h-[36px] text-sm cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-blue-800" checked={v.isMemo} onChange={e => set({ isMemo: e.target.checked })} />{tr('مذكرة داخلية (تأخذ تسلسل المذكرات)', 'Internal memo (uses the memo sequence)')}</label>
            </>
          ) : (
            <ContactField label={tr('الجهة المرسل إليها', 'Recipient')} value={v.contactId} onChange={x => set({ contactId: x })} />
          )}
        </div>
      </Section>
      <Section title={tr('٢. نص الكتاب', '2. Letter text')}>
        <div className="space-y-3">
          <Field label={tr('الموضوع', 'Subject')} required>{(p) => <input {...p} value={v.subject} onChange={e => set({ subject: e.target.value })} className={inputCls} maxLength={500} />}</Field>
          <Field label={tr('الإشارة', 'Reference')} hint={tr('مثال: إشارة إلى كتابكم المرقم … في …', 'Example: With reference to your letter no. … dated …')}>{(p) => <input {...p} value={v.referenceText} onChange={e => set({ referenceText: e.target.value })} className={inputCls} maxLength={300} />}</Field>
          <Field label={tr('نص الكتاب', 'Text')} hint={tr('يُطبع على قالب الكتاب الرسمي مع الرقم والتاريخ واسم الوحدة تلقائياً.', 'Printed on the official template with number, date and unit name filled in automatically.')}>
            {(p) => <textarea {...p} value={v.body} onChange={e => set({ body: e.target.value })} rows={9} className={inputCls} />}
          </Field>
          <CommonFields v={v} set={set} />
          <FilePicker label={tr('المرفقات', 'Attachments')} files={files} onChange={setFiles} />
        </div>
      </Section>
      <div className="flex flex-wrap justify-end gap-2">
        <Btn onClick={() => save(false)} disabled={s.busy}><Save className="w-4 h-4" aria-hidden="true" />{tr('حفظ كمسودة', 'Save as draft')}</Btn>
        <Btn type="submit" variant="primary" disabled={s.busy}><Send className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />{tr('إرسال للموافقة', 'Send for approval')}</Btn>
      </div>
    </form>
  );
}

// =======================================================================================
// Mutala'a (4.0 B)
// =======================================================================================
export function MutalaaForm({ onDone }: FormProps) {
  const { tr, me, unitById, units } = useLas();
  const mine = [...new Set([...me.memberUnits, ...me.registryUnits])];
  const [v, setV] = useState<any>({ unitId: mine.length === 1 ? String(mine[0]) : '', addressedUnitId: '', subject: '', background: '', analysis: '', recommendation: '', categoryId: '', urgency: 'Normal', confidentiality: 'Normal', namedUserUids: [] });
  const [files, setFiles] = useState<PickedFile[]>([]);
  const s = useSubmit();
  const set = (patch: any) => setV((x: any) => ({ ...x, ...patch }));
  const chain = useMemo(() => { const ids: number[] = []; let cur = unitById(Number(v.unitId)); while (cur) { ids.push(cur.id); cur = cur.parentId ? unitById(cur.parentId) : undefined; } return ids; }, [v.unitId, units]);

  const save = (thenSubmit: boolean) => s.run(async () => {
    if (!v.unitId || !v.addressedUnitId) return s.setError(tr('اختر وحدتك والمسؤول الموجّهة إليه المطالعة.', 'Choose your unit and the official the mutala\'a is addressed to.'));
    if (!v.subject.trim() || !v.recommendation.trim()) return s.setError(tr('الموضوع والتوصية مطلوبان.', 'Subject and recommendation are required.'));
    const r = await las('/mutalaa', 'POST', { ...v, unitId: Number(v.unitId), addressedUnitId: Number(v.addressedUnitId), categoryId: v.categoryId || null, files });
    if (!r.ok) return s.setError(r.error || '');
    if (!thenSubmit) return onDone(r.data.id, tr('تم حفظ المسودة.', 'Draft saved.'));
    const sub = await las(`/mutalaa/${r.data.id}/submit`, 'POST');
    onDone(r.data.id, sub.ok ? tr(`رُفعت المطالعة بالرقم ${sub.data.number}`, `Mutala'a submitted as ${sub.data.number}`) : tr('حُفظت المسودة لكن تعذر رفعها: ', 'Draft saved, but it could not be submitted: ') + (sub.error || ''));
  });

  if (mine.length === 0) return <Notice kind="warn">{tr('لا توجد لديك صلاحية في أي وحدة. راجع مدير النظام.', 'You have no role in any unit yet. Ask the administrator.')}</Notice>;
  return (
    <form onSubmit={e => { e.preventDefault(); save(true); }} className="space-y-4" noValidate aria-label={tr('مطالعة جديدة', "New mutala'a")}>
      {s.error && <Notice kind="error">{s.error}</Notice>}
      <Section title={tr('١. من وإلى', '1. From and to')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={tr('الوحدة مقدمة المطالعة', 'Submitting unit')} required>{(p) => <UnitSelect {...p} value={v.unitId} onChange={x => set({ unitId: x, addressedUnitId: '' })} only={u => mine.includes(u.id) && u.active} />}</Field>
          <Field label={tr('موجّهة إلى (رئيس الوحدة)', 'Addressed to (head of)')} required hint={tr('تمر المطالعة بكل مستوى أعلى ليضيف رأيه قبل وصولها.', 'Each level above adds its opinion before it arrives.')}>
            {(p) => <UnitSelect {...p} value={v.addressedUnitId} onChange={x => set({ addressedUnitId: x })} only={u => chain.includes(u.id)} />}
          </Field>
        </div>
      </Section>
      <Section title={tr('٢. المطالعة', "2. The mutala'a")}>
        <div className="space-y-3">
          <Field label={tr('الموضوع', 'Subject')} required>{(p) => <input {...p} value={v.subject} onChange={e => set({ subject: e.target.value })} className={inputCls} maxLength={500} />}</Field>
          <Field label={tr('الخلفية', 'Background')}>{(p) => <textarea {...p} value={v.background} onChange={e => set({ background: e.target.value })} rows={4} className={inputCls} />}</Field>
          <Field label={tr('التحليل', 'Analysis')}>{(p) => <textarea {...p} value={v.analysis} onChange={e => set({ analysis: e.target.value })} rows={4} className={inputCls} />}</Field>
          <Field label={tr('التوصية', 'Recommendation')} required>{(p) => <textarea {...p} value={v.recommendation} onChange={e => set({ recommendation: e.target.value })} rows={3} className={inputCls} />}</Field>
          <CommonFields v={v} set={set} />
          <FilePicker label={tr('المرفقات', 'Attachments')} files={files} onChange={setFiles} />
        </div>
      </Section>
      <div className="flex flex-wrap justify-end gap-2">
        <Btn onClick={() => save(false)} disabled={s.busy}><Save className="w-4 h-4" aria-hidden="true" />{tr('حفظ كمسودة', 'Save as draft')}</Btn>
        <Btn type="submit" variant="primary" disabled={s.busy}><Send className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />{tr('رفع المطالعة', "Submit the mutala'a")}</Btn>
      </div>
    </form>
  );
}

// =======================================================================================
// Report (4.0 C)
// =======================================================================================
export function ReportForm({ onDone }: FormProps) {
  const { tr, ar, me } = useLas();
  const mine = [...new Set([...me.memberUnits, ...me.registryUnits])];
  const [v, setV] = useState<any>({ unitId: mine.length === 1 ? String(mine[0]) : '', reportKind: 'periodic', title: '', periodFrom: '', periodTo: '', authors: '', recipients: '', keywords: '', summary: '', categoryId: '', confidentiality: 'Normal', namedUserUids: [] });
  const [files, setFiles] = useState<PickedFile[]>([]);
  const s = useSubmit();
  const set = (patch: any) => setV((x: any) => ({ ...x, ...patch }));
  const save = () => s.run(async () => {
    if (!v.unitId) return s.setError(tr('اختر الوحدة المعدّة للتقرير.', 'Choose the preparing unit.'));
    if (!v.title.trim()) return s.setError(tr('اكتب عنوان التقرير.', 'Enter the report title.'));
    if (v.periodFrom && v.periodTo && v.periodTo < v.periodFrom) return s.setError(tr('نهاية الفترة يجب أن تكون بعد بدايتها.', 'The period end must be after its start.'));
    const r = await las('/reports', 'POST', { ...v, unitId: Number(v.unitId), categoryId: v.categoryId || null, files });
    if (!r.ok) return s.setError(r.error || '');
    onDone(r.data.id, tr(`سُجّل التقرير بالرقم ${r.data.number} (نسخة ١ - مسودة)`, `Report registered as ${r.data.number} (version 1, draft)`));
  });
  if (mine.length === 0) return <Notice kind="warn">{tr('لا توجد لديك صلاحية في أي وحدة. راجع مدير النظام.', 'You have no role in any unit yet. Ask the administrator.')}</Notice>;
  return (
    <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-4" noValidate aria-label={tr('تسجيل تقرير', 'Register a report')}>
      {s.error && <Notice kind="error">{s.error}</Notice>}
      <Section title={tr('بيانات التقرير', 'Report details')}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={tr('الوحدة المعدّة', 'Preparing unit')} required>{(p) => <UnitSelect {...p} value={v.unitId} onChange={x => set({ unitId: x })} only={u => mine.includes(u.id) && u.active} />}</Field>
            <Field label={tr('نوع التقرير', 'Report kind')} required>{(p) => <select {...p} value={v.reportKind} onChange={e => set({ reportKind: e.target.value })} className={inputCls}>{Object.entries(REPORT_KIND).map(([k, l]) => <option key={k} value={k}>{pick(l, ar)}</option>)}</select>}</Field>
          </div>
          <Field label={tr('العنوان', 'Title')} required>{(p) => <input {...p} value={v.title} onChange={e => set({ title: e.target.value })} className={inputCls} maxLength={500} />}</Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={tr('الفترة من', 'Period from')}>{(p) => <input {...p} type="date" value={v.periodFrom} onChange={e => set({ periodFrom: e.target.value })} className={inputCls} />}</Field>
            <Field label={tr('الفترة إلى', 'Period to')}>{(p) => <input {...p} type="date" value={v.periodTo} min={v.periodFrom} onChange={e => set({ periodTo: e.target.value })} className={inputCls} />}</Field>
            <Field label={tr('المعدّون', 'Authors')}>{(p) => <input {...p} value={v.authors} onChange={e => set({ authors: e.target.value })} className={inputCls} />}</Field>
            <Field label={tr('الجهات المرسل إليها', 'Recipients')}>{(p) => <input {...p} value={v.recipients} onChange={e => set({ recipients: e.target.value })} className={inputCls} />}</Field>
          </div>
          <Field label={tr('الكلمات المفتاحية', 'Keywords')} hint={tr('تُستخدم في البحث.', 'Used for search.')}>{(p) => <input {...p} value={v.keywords} onChange={e => set({ keywords: e.target.value })} className={inputCls} />}</Field>
          <Field label={tr('الملخص', 'Summary')}>{(p) => <textarea {...p} value={v.summary} onChange={e => set({ summary: e.target.value })} rows={3} className={inputCls} />}</Field>
          <CommonFields v={v} set={set} showUrgency={false} />
          <FilePicker label={tr('ملفات التقرير (PDF، Excel، صور)', 'Report files (PDF, Excel, photos)')} files={files} onChange={setFiles} />
        </div>
      </Section>
      <div className="flex justify-end"><Btn type="submit" variant="primary" disabled={s.busy}><Save className="w-4 h-4" aria-hidden="true" />{tr('تسجيل التقرير', 'Register the report')}</Btn></div>
    </form>
  );
}
