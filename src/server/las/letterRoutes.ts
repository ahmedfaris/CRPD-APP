// Letters Archive System — records and their workflows: incoming registration, outgoing
// drafts with an approval chain, internal delivery, referrals, mutala'at and reports.
import { Router } from 'express';
import {
  Ctx, audit, issueNumber, saveAttachment, relocateLetterFiles, readAttachment, recordFolder, baghdadToday,
  ancestors, descendants, registryUnits, memberUnits, headUnits, exactHeadUnits, viewUnits, actingFor, canView,
  usersWithRoleAt, notify, accessPrefilter, HEAD_ROLES,
} from './core.ts';
import { q, q1 } from './db.ts';
import {
  h, bad, forbidden, notFound, HttpError, str, day, int, oneOf, idList, uidList, paramId, camel,
  LETTER_SELECT, loadLetter, READ_ONLY_STATUSES, URGENCIES, CONFIDENTIALITIES, isConfidential,
} from './http.ts';
import { fileCapturedDoc } from './capture/routes.ts';

const router = Router();

const INSTRUCTIONS = ['For action', 'For opinion', 'For information', 'For filing'] as const;
const DISPATCH_METHODS = ['Hand delivery', 'Mail', 'Email', 'Courier'] as const;
const MUT_DECISIONS = ['Approved', 'Approved with amendments', 'Rejected', 'Returned for further study', 'Noted'] as const;
const REPORT_KINDS = ['periodic', 'field_visit', 'committee', 'statistical', 'external'] as const;
const OPEN_FOLLOWUP = ['Registered', 'Referred', 'In progress'];

const failClosed = (l: any) => ({ failClosed: isConfidential(l) });
const unitOf = (ctx: Ctx, id: number, label = 'Unit') => {
  const u = ctx.units.get(id);
  if (!u) throw bad(`${label} does not exist.`);
  return u;
};
const activeUnit = (ctx: Ctx, id: number, label = 'Unit') => {
  const u = unitOf(ctx, id, label);
  if (!u.active) throw bad(`${label} ${u.code} is deactivated and cannot receive new records.`);
  return u;
};

async function categoryDefaults(categoryId: number | null, fromDay: string) {
  if (!categoryId) return { due: null as string | null, retention: null as string | null };
  const c = await q1<any>('SELECT * FROM las_categories WHERE id = $1 AND active', [categoryId]);
  if (!c) throw bad('The category does not exist.');
  const add = (days: number) => { const d = new Date(fromDay + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  return {
    due: c.default_due_days ? add(c.default_due_days) : null,
    retention: c.retention_years ? `${Number(fromDay.slice(0, 4)) + c.retention_years}${fromDay.slice(4)}` : null,
  };
}

function location(v: any) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'object') throw bad('Physical location is not valid.');
  const out: any = {};
  for (const k of ['building', 'room', 'cabinet', 'shelf', 'box']) out[k] = str(v[k], k, 60) || '';
  return Object.values(out).some(Boolean) ? out : null;
}

async function saveFiles(ctx: Ctx, letter: any, files: any, reportKind?: string, version = 1) {
  if (files === undefined || files === null) return [];
  if (!Array.isArray(files) || files.length > 20) throw bad('Attach at most 20 files at a time.');
  const saved = [];
  for (const f of files) {
    const row = await saveAttachment(ctx, letter, f, reportKind, version);
    saved.push(row);
    await audit(ctx, 'UploadAttachment', 'Letter', letter.id, letter.number, { attachmentId: row.id, fileName: row.file_name, size: row.size, sha256: row.sha256, isOriginalScan: row.is_original_scan }, failClosed(letter));
  }
  return saved;
}

/** Stamp who archived the record, when and from where. Set by the server, never by the user. */
async function stampArchived(ctx: Ctx, id: number, onBehalfOf: string | null, source: string) {
  await q(`UPDATE las_letters SET archived_by_uid = $1, archived_by_name = $2, archived_on_behalf_of = $3, archived_at = now(),
             archived_from_ip = $4, source = $5 WHERE id = $6`, [ctx.uid, ctx.name, onBehalfOf, ctx.ip, source, id]);
}

// =======================================================================================
// Incoming external letters (4.1)
// =======================================================================================
router.post('/letters/incoming', h(async (ctx, req, res) => {
  const b = req.body || {};
  const unit = activeUnit(ctx, int(b.unitId, 'Receiving unit', true)!, 'Receiving unit');
  if (!registryUnits(ctx).has(unit.id)) throw forbidden('You are not the correspondence clerk or head of this unit.');
  const subject = str(b.subject, 'Subject', 500, true)!;
  const contactId = int(b.contactId, 'Sender', true)!;
  if (!(await q1('SELECT id FROM las_contacts WHERE id = $1 AND active', [contactId]))) throw bad('Choose the sender from the contacts list.');
  const externalRefNo = str(b.externalRefNo, "Sender's reference number", 100);
  const received = day(b.receivedDate, 'Date received') || baghdadToday();
  const confidentiality = oneOf(b.confidentiality, 'Confidentiality', CONFIDENTIALITIES, 'Normal');
  const categoryId = int(b.categoryId, 'Category');
  // Registering a scanned document from the capture queue: check it before anything is created.
  let captureDoc: any = null;
  if (b.captureDocId) {
    captureDoc = await q1<any>('SELECT id, unit_id, status FROM las_capture_docs WHERE id = $1', [int(b.captureDocId, 'Scanned document', true)]);
    if (!captureDoc) throw notFound('Scanned document');
    if (!(captureDoc.unit_id && registryUnits(ctx).has(captureDoc.unit_id))) throw forbidden('This scanned document belongs to another registry desk.');
    if (captureDoc.status !== 'ready') throw bad('This scanned document was already filed or discarded.');
  }

  // FR-1.5: warn about a possible duplicate (same sender + sender reference number)
  if (externalRefNo && !b.confirmDuplicate) {
    const dup = await q<any>(`SELECT number FROM las_letters WHERE contact_id = $1 AND external_ref_no = $2 AND status <> 'Cancelled' AND archive_type = 'letter' AND direction = 'IN'`, [contactId, externalRefNo]);
    if (dup.length) throw new HttpError(409, `A letter from this sender with reference ${externalRefNo} is already registered (${dup.map(d => d.number).join(', ')}).`, { code: 'DUPLICATE', existing: dup.map(d => d.number) });
  }
  const defaults = await categoryDefaults(categoryId, received);
  const onBehalf = actingFor(ctx, unit.id, r => r.role === 'clerk' || HEAD_ROLES.includes(r.role));
  const row = await q1<any>(
    `INSERT INTO las_letters (archive_type, direction, scope, unit_id, unit_code, head_office, subject, summary, category_id, urgency,
       confidentiality, status, letter_date, received_or_sent_date, external_ref_no, external_ref_date, contact_id, due_date,
       physical_location, retention_until, case_id, pages_count, attachments_count, named_user_uids, created_by_uid, created_by_name)
     VALUES ('letter','IN','external',$1,$2,$3,$4,$5,$6,$7,$8,'Registered',$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,$19,$20::jsonb,$21,$22)
     RETURNING id`,
    [unit.id, unit.code, !!b.headOffice, subject, str(b.summary, 'Summary', 4000), categoryId, oneOf(b.urgency, 'Urgency', URGENCIES, 'Normal'),
      confidentiality, day(b.letterDate, 'Letter date'), received, externalRefNo, day(b.externalRefDate, "Sender's reference date"), contactId,
      day(b.dueDate, 'Due date') || defaults.due, JSON.stringify(location(b.physicalLocation)), defaults.retention, int(b.caseId, 'Case'),
      int(b.pagesCount, 'Number of pages'), int(b.attachmentsCount, 'Number of attachments'), JSON.stringify(uidList(b.namedUserUids, 'Named recipients')), ctx.uid, ctx.name]);
  await stampArchived(ctx, row.id, onBehalf, 'upload');
  const number = await issueNumber(ctx, row.id, 'IN', unit.id, !!b.headOffice);
  let letter = await q1<any>(`${LETTER_SELECT} WHERE l.id = $1`, [row.id]);
  await q('UPDATE las_letters SET folder_path = $1 WHERE id = $2', [recordFolder(ctx, letter), row.id]);
  try {
    await audit(ctx, 'Archive', 'IncomingExternalLetter', row.id, number, { unitCode: unit.code, contactId, externalRefNo, confidentiality, urgency: letter.urgency }, { onBehalfOf: onBehalf, unitCode: unit.code, ...failClosed(letter) });
  } catch (e) {
    await q(`UPDATE las_letters SET status = 'Cancelled' WHERE id = $1`, [row.id]); // the number stays used, as the rules require
    throw e;
  }
  // Registered from the capture queue: the scanned, OCR'd PDF/A becomes the original scan (no re-upload).
  if (captureDoc) await fileCapturedDoc(ctx, captureDoc.id, letter, true);
  await saveFiles(ctx, letter, b.files);
  if (confidentiality === 'Normal') {
    await notify(await usersWithRoleAt(unit.id, HEAD_ROLES), row.id, 'incoming', `كتاب وارد جديد ${number}`, `New incoming letter ${number}`);
  }
  letter = await q1<any>(`${LETTER_SELECT} WHERE l.id = $1`, [row.id]);
  res.status(201).json({ success: true, data: camel(letter) });
}));

// =======================================================================================
// Outgoing letters and internal memos (4.2, FR-0.1..0.4)
// =======================================================================================
function readOutgoing(ctx: Ctx, b: any, current?: any) {
  const scope = oneOf(b.scope ?? current?.scope, 'Scope', ['internal', 'external'] as const);
  const toUnitIds = b.toUnitIds !== undefined ? idList(b.toUnitIds, 'Receiving units') : (current?.to_unit_ids || []);
  const ccUnitIds = b.ccUnitIds !== undefined ? idList(b.ccUnitIds, 'CC units') : (current?.cc_unit_ids || []);
  const contactId = b.contactId !== undefined ? int(b.contactId, 'Recipient') : (current?.contact_id ?? null);
  const unitId = current?.unit_id ?? int(b.unitId, 'Issuing unit', true)!;
  if (scope === 'internal') {
    if (toUnitIds.length === 0) throw bad('Choose at least one receiving unit.');
    for (const id of [...toUnitIds, ...ccUnitIds]) {
      activeUnit(ctx, id, 'Receiving unit');
      if (id === unitId) throw bad('The issuing unit cannot also be a receiving unit.');
    }
  } else if (!contactId) throw bad('Choose the external recipient from the contacts list.');
  return {
    scope, toUnitIds, ccUnitIds: ccUnitIds.filter((id: number) => !toUnitIds.includes(id)), contactId: scope === 'external' ? contactId : null,
    ccContactIds: b.ccContactIds !== undefined ? idList(b.ccContactIds, 'CC parties') : (current?.cc_contact_ids || []),
    subject: b.subject !== undefined ? str(b.subject, 'Subject', 500, true)! : current?.subject,
    body: b.body !== undefined ? str(b.body, 'Letter text', 50000) : current?.body,
    summary: b.summary !== undefined ? str(b.summary, 'Summary', 4000) : current?.summary,
    categoryId: b.categoryId !== undefined ? int(b.categoryId, 'Category') : (current?.category_id ?? null),
    urgency: oneOf(b.urgency ?? current?.urgency, 'Urgency', URGENCIES, 'Normal'),
    confidentiality: oneOf(b.confidentiality ?? current?.confidentiality, 'Confidentiality', CONFIDENTIALITIES, 'Normal'),
    namedUserUids: b.namedUserUids !== undefined ? uidList(b.namedUserUids, 'Named recipients') : (current?.named_user_uids || []),
    referenceText: b.referenceText !== undefined ? str(b.referenceText, 'Reference', 300) : current?.reference_text,
    isMemo: b.isMemo !== undefined ? !!b.isMemo : !!current?.is_memo,
  };
}

router.post('/letters/outgoing', h(async (ctx, req, res) => {
  const b = req.body || {};
  const unit = activeUnit(ctx, int(b.unitId, 'Issuing unit', true)!, 'Issuing unit');
  const subtree = descendants(ctx, unit.id);
  const mine = [...memberUnits(ctx)].filter(id => subtree.includes(id));
  if (mine.length === 0 && !registryUnits(ctx).has(unit.id)) throw forbidden('You can only draft letters issued by your own unit or a unit above it.');
  // The draft starts at the user's own (deepest) unit and climbs to the issuing unit for approval.
  const draftingUnit = mine.sort((a, c) => ancestors(ctx, c).length - ancestors(ctx, a).length)[0] ?? unit.id;
  const v = readOutgoing(ctx, b);
  let replyTo: any = null;
  if (b.replyToLetterId) replyTo = await loadLetter(ctx, int(b.replyToLetterId, 'Reply-to letter', true)!);
  const row = await q1<any>(
    `INSERT INTO las_letters (archive_type, direction, scope, is_memo, unit_id, unit_code, head_office, drafting_unit_id, subject, summary, body,
       category_id, urgency, confidentiality, status, contact_id, to_unit_ids, cc_unit_ids, cc_contact_ids, named_user_uids, reference_text,
       reply_to_letter_id, case_id, created_by_uid, created_by_name)
     VALUES ('letter','OUT',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Draft',$13,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18,$19,$20,$21,$22) RETURNING id`,
    [v.scope, v.isMemo && v.scope === 'internal', unit.id, unit.code, !!b.headOffice, draftingUnit, v.subject, v.summary, v.body, v.categoryId, v.urgency,
      v.confidentiality, v.contactId, JSON.stringify(v.toUnitIds), JSON.stringify(v.ccUnitIds), JSON.stringify(v.ccContactIds),
      JSON.stringify(v.namedUserUids), v.referenceText, replyTo?.id || null, replyTo?.case_id || int(b.caseId, 'Case'), ctx.uid, ctx.name]);
  const letter = await q1<any>(`${LETTER_SELECT} WHERE l.id = $1`, [row.id]);
  if (b.basedOnLetterId) {
    const base = await loadLetter(ctx, int(b.basedOnLetterId, 'Source record', true)!);
    await q('INSERT INTO las_links (letter_id, related_letter_id, relation, created_by) VALUES ($1,$2,$3,$4)', [row.id, base.id, 'based_on', ctx.uid]);
  }
  await audit(ctx, 'CreateDraft', 'OutgoingLetter', row.id, null, { unitCode: unit.code, scope: v.scope, confidentiality: v.confidentiality }, failClosed(letter));
  await saveFiles(ctx, letter, b.files);
  res.status(201).json({ success: true, data: camel(letter) });
}));

/** Final approval: issue the number, file the record and, for internal letters, deliver it. */
async function finalizeOutgoing(ctx: Ctx, draft: any, onBehalf: string | null) {
  await stampArchived(ctx, draft.id, onBehalf, 'upload');
  const number = await issueNumber(ctx, draft.id, draft.is_memo ? 'MEMO' : 'OUT', draft.unit_id, draft.head_office);
  const today = baghdadToday();
  const defaults = await categoryDefaults(draft.category_id, today);
  await q(`UPDATE las_letters SET status = 'Registered', letter_date = $1, received_or_sent_date = $1, retention_until = $2 WHERE id = $3`, [today, defaults.retention, draft.id]);
  const letter = await q1<any>(`${LETTER_SELECT} WHERE l.id = $1`, [draft.id]);
  await relocateLetterFiles(ctx, draft, letter);
  await audit(ctx, 'IssueNumber', 'OutgoingLetter', letter.id, number, { unitCode: letter.unit_code, scope: letter.scope }, { onBehalfOf: onBehalf, unitCode: letter.unit_code, ...failClosed(letter) });

  // FR-2.5: issuing a reply closes the incoming letter's follow-up
  if (letter.reply_to_letter_id) {
    await q('INSERT INTO las_links (letter_id, related_letter_id, relation, created_by) VALUES ($1,$2,$3,$4)', [letter.id, letter.reply_to_letter_id, 'reply_to', ctx.uid]);
    const incoming = await q1<any>('SELECT id, number, status FROM las_letters WHERE id = $1', [letter.reply_to_letter_id]);
    if (incoming && OPEN_FOLLOWUP.includes(incoming.status)) {
      await q(`UPDATE las_letters SET status = 'Replied', followup_closed_at = now() WHERE id = $1`, [incoming.id]);
      await audit(ctx, 'CloseFollowUp', 'Letter', incoming.id, incoming.number, { repliedBy: number });
    }
  }
  // FR-0.1: register the letter in each receiving unit's incoming register, linked to this record
  if (letter.scope === 'internal') {
    const targets = [...letter.to_unit_ids.map((id: number) => ({ id, cc: false })), ...letter.cc_unit_ids.map((id: number) => ({ id, cc: true }))];
    for (const t of targets) {
      const ru = ctx.units.get(t.id);
      if (!ru) continue;
      const copy = await q1<any>(
        `INSERT INTO las_letters (archive_type, direction, scope, unit_id, unit_code, subject, summary, category_id, urgency, confidentiality, status,
           letter_date, received_or_sent_date, external_ref_no, external_ref_date, due_date, source, source_letter_id, reference_text, named_user_uids,
           case_id, created_by_uid, created_by_name, archived_by_uid, archived_by_name, archived_at, archived_from_ip)
         VALUES ('letter','IN','internal',$1,$2,$3,$4,$5,$6,$7,'Registered',$8,$8,$9,$8,$10,'internal copy',$11,$12,$13::jsonb,$14,$15,$16,$15,$16,now(),$17) RETURNING id`,
        [ru.id, ru.code, letter.subject, letter.summary, letter.category_id, letter.urgency, letter.confidentiality, today, number,
          t.cc ? null : defaults.due, letter.id, letter.reference_text, JSON.stringify(letter.named_user_uids || []), letter.case_id, ctx.uid, ctx.name, ctx.ip]);
      const inNumber = await issueNumber(ctx, copy.id, 'IN', ru.id, false);
      const inLetter = await q1<any>(`${LETTER_SELECT} WHERE l.id = $1`, [copy.id]);
      await q('UPDATE las_letters SET folder_path = $1 WHERE id = $2', [recordFolder(ctx, inLetter), copy.id]);
      await q('INSERT INTO las_internal_deliveries (out_letter_id, in_letter_id, receiving_unit_id, is_cc) VALUES ($1,$2,$3,$4)', [letter.id, copy.id, ru.id, t.cc]);
      await q('INSERT INTO las_links (letter_id, related_letter_id, relation, created_by) VALUES ($1,$2,$3,$4)', [copy.id, letter.id, 'internal_copy_of', ctx.uid]);
      await audit(ctx, 'SendInternal', 'IncomingInternalLetter', copy.id, inNumber, { outNumber: number, receivingUnit: ru.code, cc: t.cc }, { unitCode: ru.code, ...failClosed(letter) });
      await notify(await usersWithRoleAt(ru.id, ['clerk', ...HEAD_ROLES]), copy.id, 'delivery', `كتاب داخلي وارد ${inNumber} بانتظار الاستلام`, `Internal letter ${inNumber} is waiting for receipt`);
    }
  }
  await notify([letter.created_by_uid], letter.id, 'approved', `تمت الموافقة على كتابكم وصدر بالرقم ${number}`, `Your letter was approved and issued as ${number}`);
  return number;
}

router.post('/letters/:id/submit', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  if (l.archive_type !== 'letter' || l.direction !== 'OUT') throw bad('Only outgoing drafts are submitted for approval.');
  if (l.created_by_uid !== ctx.uid) throw forbidden('Only the person who wrote the draft can submit it.');
  if (!['Draft', 'Returned'].includes(l.status)) throw bad('This draft was already submitted.');
  // Approval chain (FR-2.2): the heads from the drafting unit up to the issuing unit.
  const path = ancestors(ctx, l.drafting_unit_id || l.unit_id);
  const upTo = path.indexOf(l.unit_id);
  const chain = upTo >= 0 ? path.slice(0, upTo + 1) : [l.unit_id];
  const round = ((await q1<any>('SELECT coalesce(max(round),0) AS r FROM las_approvals WHERE letter_id = $1', [l.id]))?.r || 0) + 1;
  const mineExact = exactHeadUnits(ctx);
  let pendingUnit: number | null = null;
  for (let i = 0; i < chain.length; i++) {
    // Steps before the first other approver that belong to the drafter are approved by submitting.
    const self = pendingUnit === null && mineExact.has(chain[i]);
    await q(`INSERT INTO las_approvals (letter_id, round, step_no, approver_unit_id, approver_uid, approver_name, decision, comment, decided_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [l.id, round, i + 1, chain[i], self ? ctx.uid : null, self ? ctx.name : null, self ? 'Approved' : 'Pending', self ? 'Submitted by the unit head' : null, self ? new Date() : null]);
    if (!self && pendingUnit === null) pendingUnit = chain[i];
  }
  await audit(ctx, 'SubmitForApproval', 'OutgoingLetter', l.id, null, { round, steps: chain.length }, failClosed(l));
  if (pendingUnit === null) {
    const number = await finalizeOutgoing(ctx, l, actingFor(ctx, l.unit_id, r => HEAD_ROLES.includes(r.role)));
    return res.json({ success: true, data: { status: 'Registered', number } });
  }
  await q(`UPDATE las_letters SET status = 'Awaiting approval', last_modified_by = $1, last_modified_at = now() WHERE id = $2`, [ctx.uid, l.id]);
  await notify(await usersWithRoleAt(pendingUnit, HEAD_ROLES), l.id, 'approval', `مسودة كتاب بانتظار موافقتكم: ${l.subject}`, `A draft letter is waiting for your approval: ${l.subject}`);
  res.json({ success: true, data: { status: 'Awaiting approval' } });
}));

router.post('/letters/:id/approval', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  if (l.status !== 'Awaiting approval' || l.archive_type !== 'letter') throw bad('This record is not waiting for approval.');
  const decision = oneOf(req.body?.decision, 'Decision', ['Approved', 'Returned', 'Rejected'] as const);
  const comment = str(req.body?.comment, 'Comment', 2000, decision !== 'Approved');
  const step = await q1<any>(`SELECT * FROM las_approvals WHERE letter_id = $1 AND decision = 'Pending' ORDER BY round DESC, step_no ASC LIMIT 1`, [l.id]);
  if (!step) throw bad('No approval step is pending.');
  if (!exactHeadUnits(ctx).has(step.approver_unit_id)) throw forbidden('This step belongs to the head of another unit.');
  const onBehalf = actingFor(ctx, step.approver_unit_id, r => HEAD_ROLES.includes(r.role));
  await q(`UPDATE las_approvals SET decision = $1, comment = $2, approver_uid = $3, approver_name = $4, on_behalf_of = $5, decided_at = now() WHERE id = $6`,
    [decision, comment, ctx.uid, ctx.name, onBehalf, step.id]);
  const action = decision === 'Approved' ? 'Approve' : decision === 'Returned' ? 'Return' : 'Reject';
  await audit(ctx, action, 'OutgoingLetter', l.id, null, { step: step.step_no, round: step.round, approverUnit: ctx.units.get(step.approver_unit_id)?.code }, { onBehalfOf: onBehalf, ...failClosed(l) });
  if (decision === 'Approved') {
    const next = await q1<any>(`SELECT * FROM las_approvals WHERE letter_id = $1 AND round = $2 AND decision = 'Pending' ORDER BY step_no ASC LIMIT 1`, [l.id, step.round]);
    if (!next) {
      const number = await finalizeOutgoing(ctx, l, onBehalf);
      return res.json({ success: true, data: { status: 'Registered', number } });
    }
    await notify(await usersWithRoleAt(next.approver_unit_id, HEAD_ROLES), l.id, 'approval', `مسودة كتاب بانتظار موافقتكم: ${l.subject}`, `A draft letter is waiting for your approval: ${l.subject}`);
    return res.json({ success: true, data: { status: 'Awaiting approval' } });
  }
  // Returned or rejected: later steps of this round are no longer needed
  await q(`UPDATE las_approvals SET decision = 'Skipped' WHERE letter_id = $1 AND round = $2 AND decision = 'Pending'`, [l.id, step.round]);
  const status = decision === 'Returned' ? 'Returned' : 'Rejected';
  await q('UPDATE las_letters SET status = $1 WHERE id = $2', [status, l.id]);
  await notify([l.created_by_uid], l.id, decision === 'Returned' ? 'returned' : 'rejected',
    decision === 'Returned' ? `أُعيدت مسودتكم مع ملاحظات: ${l.subject}` : `رُفضت مسودتكم: ${l.subject}`,
    decision === 'Returned' ? `Your draft was returned with comments: ${l.subject}` : `Your draft was rejected: ${l.subject}`);
  res.json({ success: true, data: { status } });
}));

// FR-0.2: the receiving unit confirms receipt of an internal letter
router.post('/deliveries/:id/receive', h(async (ctx, req, res) => {
  const d = await q1<any>('SELECT * FROM las_internal_deliveries WHERE id = $1', [paramId(req.params.id)]);
  if (!d) throw notFound('Delivery');
  if (!registryUnits(ctx).has(d.receiving_unit_id)) throw forbidden('Only the clerk or head of the receiving unit can confirm receipt.');
  if (d.received_at) throw bad('Receipt was already confirmed.');
  const inLetter = await q1<any>('SELECT * FROM las_letters WHERE id = $1', [d.in_letter_id]);
  const out = await q1<any>('SELECT * FROM las_letters WHERE id = $1', [d.out_letter_id]);
  await q('UPDATE las_internal_deliveries SET received_by_uid = $1, received_by_name = $2, received_at = now() WHERE id = $3', [ctx.uid, ctx.name, d.id]);
  await audit(ctx, 'ConfirmReceipt', 'IncomingInternalLetter', inLetter.id, inLetter.number, { outNumber: out?.number }, { unitCode: inLetter.unit_code, ...failClosed(inLetter) });
  if (out) await notify([out.created_by_uid], out.id, 'received', `تم استلام كتابكم ${out.number} في ${ctx.units.get(d.receiving_unit_id)?.nameAr}`, `Your letter ${out.number} was received by ${ctx.units.get(d.receiving_unit_id)?.nameEn}`);
  res.json({ success: true });
}));

// FR-2.6: record how an outgoing external letter was dispatched
router.post('/letters/:id/dispatch', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  if (l.direction !== 'OUT' || l.scope !== 'external' || !l.number) throw bad('Only issued external letters are dispatched.');
  if (READ_ONLY_STATUSES.includes(l.status)) throw bad('This record is closed.');
  if (!registryUnits(ctx).has(l.unit_id)) throw forbidden('Only the correspondence clerk or head of the issuing unit records dispatch.');
  const dispatch = {
    method: oneOf(req.body?.method, 'Dispatch method', DISPATCH_METHODS),
    date: day(req.body?.date, 'Dispatch date') || baghdadToday(),
    acknowledgement: str(req.body?.acknowledgement, 'Acknowledgement', 500) || '',
    recordedBy: ctx.name, recordedAt: new Date().toISOString(),
  };
  await q('UPDATE las_letters SET dispatch = $1::jsonb, last_modified_by = $2, last_modified_at = now() WHERE id = $3', [JSON.stringify(dispatch), ctx.uid, l.id]);
  if (req.body?.file) await saveFiles(ctx, l, [{ ...req.body.file, kind: 'dispatch_ack' }]);
  await audit(ctx, 'Dispatch', 'OutgoingLetter', l.id, l.number, { method: dispatch.method, date: dispatch.date }, failClosed(l));
  res.json({ success: true, data: dispatch });
}));

// =======================================================================================
// Editing, closing, attachments, links
// =======================================================================================
router.put('/letters/:id', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  const b = req.body || {};
  if (READ_ONLY_STATUSES.includes(l.status)) throw bad('Closed records are read-only. An administrator can reopen the record with a reason.');
  const isDraft = ['Draft', 'Returned'].includes(l.status);
  const set: Record<string, any> = {};
  if (isDraft) {
    if (l.created_by_uid !== ctx.uid) throw forbidden('Only the person who wrote the draft can change it.');
    if (l.archive_type === 'letter' && l.direction === 'OUT') {
      const v = readOutgoing(ctx, b, l);
      Object.assign(set, {
        scope: v.scope, to_unit_ids: JSON.stringify(v.toUnitIds), cc_unit_ids: JSON.stringify(v.ccUnitIds), cc_contact_ids: JSON.stringify(v.ccContactIds),
        contact_id: v.contactId, subject: v.subject, body: v.body, summary: v.summary, category_id: v.categoryId, urgency: v.urgency,
        confidentiality: v.confidentiality, named_user_uids: JSON.stringify(v.namedUserUids), reference_text: v.referenceText, is_memo: v.isMemo && v.scope === 'internal',
      });
    } else {
      if (b.subject !== undefined) set.subject = str(b.subject, 'Subject', 500, true);
      if (b.summary !== undefined) set.summary = str(b.summary, 'Summary', 4000);
      if (b.confidentiality !== undefined) set.confidentiality = oneOf(b.confidentiality, 'Confidentiality', CONFIDENTIALITIES);
      if (b.urgency !== undefined) set.urgency = oneOf(b.urgency, 'Urgency', URGENCIES);
      if (b.categoryId !== undefined) set.category_id = int(b.categoryId, 'Category');
    }
  } else {
    if (!registryUnits(ctx).has(l.unit_id)) throw forbidden('Only the correspondence clerk or head of the unit can change a registered record.');
    // Registered records: descriptive metadata only. Number, unit, dates of registration and "archived by" never change.
    if (b.subject !== undefined) set.subject = str(b.subject, 'Subject', 500, true);
    if (b.summary !== undefined) set.summary = str(b.summary, 'Summary', 4000);
    if (b.categoryId !== undefined) set.category_id = int(b.categoryId, 'Category');
    if (b.urgency !== undefined) set.urgency = oneOf(b.urgency, 'Urgency', URGENCIES);
    if (b.confidentiality !== undefined) set.confidentiality = oneOf(b.confidentiality, 'Confidentiality', CONFIDENTIALITIES);
    if (b.dueDate !== undefined) set.due_date = day(b.dueDate, 'Due date');
    if (b.physicalLocation !== undefined) set.physical_location = JSON.stringify(location(b.physicalLocation));
    if (b.caseId !== undefined) set.case_id = int(b.caseId, 'Case');
    if (b.namedUserUids !== undefined) set.named_user_uids = JSON.stringify(uidList(b.namedUserUids, 'Named recipients'));
    if (b.pagesCount !== undefined) set.pages_count = int(b.pagesCount, 'Number of pages');
  }
  const keys = Object.keys(set);
  if (keys.length === 0) throw bad('Nothing to change.');
  const jsonCols = ['to_unit_ids', 'cc_unit_ids', 'cc_contact_ids', 'named_user_uids', 'physical_location'];
  const sql = keys.map((k, i) => `${k} = $${i + 1}${jsonCols.includes(k) ? '::jsonb' : ''}`).join(', ');
  await q(`UPDATE las_letters SET ${sql}, last_modified_by = $${keys.length + 1}, last_modified_at = now() WHERE id = $${keys.length + 2}`, [...keys.map(k => set[k]), ctx.uid, l.id]);
  // Audit: old and new values for metadata; for text fields only the field name (SL-7).
  const TEXT_FIELDS = ['subject', 'summary', 'body', 'reference_text'];
  const changes: Record<string, any> = {};
  for (const k of keys) {
    const before = jsonCols.includes(k) ? JSON.stringify(l[k]) : l[k];
    if (String(before ?? '') === String(set[k] ?? '')) continue;
    changes[k] = TEXT_FIELDS.includes(k) ? 'changed' : { old: l[k] ?? null, new: jsonCols.includes(k) ? JSON.parse(set[k]) : set[k] };
  }
  const sensitiveChange = isConfidential(l) || (set.confidentiality && set.confidentiality !== 'Normal');
  if (changes.confidentiality) await audit(ctx, 'ChangeConfidentiality', 'Letter', l.id, l.number, { old: l.confidentiality, new: set.confidentiality }, { failClosed: true });
  if (changes.physical_location) await audit(ctx, 'ChangePhysicalLocation', 'Letter', l.id, l.number, changes.physical_location, { failClosed: sensitiveChange });
  await audit(ctx, 'EditMetadata', 'Letter', l.id, l.number, { changes }, { failClosed: sensitiveChange });
  res.json({ success: true, data: camel(await q1<any>(`${LETTER_SELECT} WHERE l.id = $1`, [l.id])) });
}));

router.post('/letters/:id/close', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  if (!l.number) throw bad('Only registered records can be closed.');
  if (READ_ONLY_STATUSES.includes(l.status)) throw bad('This record is already closed.');
  if (!registryUnits(ctx).has(l.unit_id)) throw forbidden('Only the correspondence clerk or head of the unit can close a record.');
  await q(`UPDATE las_letters SET status = 'Closed', closed_at = now(), closed_by = $1, followup_closed_at = coalesce(followup_closed_at, now()) WHERE id = $2`, [ctx.uid, l.id]);
  await audit(ctx, 'Close', 'Letter', l.id, l.number, { note: str(req.body?.note, 'Note', 300) ? 'with note' : 'no note' }, failClosed(l));
  res.json({ success: true });
}));

router.post('/letters/:id/archive', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  if (l.status !== 'Closed') throw bad('Close the record before archiving it.');
  if (!registryUnits(ctx).has(l.unit_id)) throw forbidden('Only the correspondence clerk or head of the unit can archive a record.');
  const loc = location(req.body?.physicalLocation);
  await q(`UPDATE las_letters SET status = 'Archived', physical_location = coalesce($1::jsonb, physical_location) WHERE id = $2`, [loc ? JSON.stringify(loc) : null, l.id]);
  await audit(ctx, 'ArchiveFinal', 'Letter', l.id, l.number, loc ? { physicalLocation: loc } : {}, failClosed(l));
  res.json({ success: true });
}));

// FR-5.4: only an administrator can reopen, with a reason
router.post('/letters/:id/reopen', h(async (ctx, req, res) => {
  if (!ctx.isSysAdmin) throw forbidden('Only a system administrator can reopen a closed record.');
  const l = await q1<any>('SELECT * FROM las_letters WHERE id = $1', [paramId(req.params.id)]);
  if (!l) throw notFound('Record');
  if (!['Closed', 'Archived'].includes(l.status)) throw bad('Only closed or archived records can be reopened.');
  const reason = str(req.body?.reason, 'Reason', 500, true)!;
  await q(`UPDATE las_letters SET status = 'In progress', closed_at = NULL, closed_by = NULL WHERE id = $1`, [l.id]);
  await audit(ctx, 'Reopen', 'Letter', l.id, l.number, { reason, previousStatus: l.status }, { failClosed: true });
  res.json({ success: true });
}));

router.post('/letters/:id/cancel', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  if (READ_ONLY_STATUSES.includes(l.status)) throw bad('This record is already closed or cancelled.');
  const isDraft = !l.number;
  if (isDraft ? l.created_by_uid !== ctx.uid : !registryUnits(ctx).has(l.unit_id)) throw forbidden();
  const reason = str(req.body?.reason, 'Reason', 500, !isDraft);
  // A cancelled record keeps its number; numbers are never reused.
  await q(`UPDATE las_letters SET status = 'Cancelled', closed_at = now(), closed_by = $1 WHERE id = $2`, [ctx.uid, l.id]);
  await audit(ctx, 'Cancel', 'Letter', l.id, l.number, { reason: reason ? 'given' : 'none' }, failClosed(l));
  res.json({ success: true });
}));

router.post('/letters/:id/attachments', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  if (READ_ONLY_STATUSES.includes(l.status)) throw bad('Closed records are read-only.');
  const holder = await q1<any>(`SELECT id FROM las_referrals WHERE letter_id = $1 AND status IN ('Pending','Accepted') AND (to_uid = $2 OR to_unit_id = ANY($3::int[]))`, [l.id, ctx.uid, [...registryUnits(ctx)]]);
  if (!(l.created_by_uid === ctx.uid || registryUnits(ctx).has(l.unit_id) || holder)) throw forbidden('You cannot add files to this record.');
  const rd = l.archive_type === 'report' ? await q1<any>('SELECT * FROM las_report_details WHERE letter_id = $1', [l.id]) : null;
  const saved = await saveFiles(ctx, l, req.body?.files, rd?.report_kind, rd?.version || 1);
  if (saved.length === 0) throw bad('Choose at least one file.');
  res.status(201).json({ success: true, data: saved.map(camel) });
}));

router.delete('/attachments/:id', h(async (ctx, req, res) => {
  const a = await q1<any>('SELECT * FROM las_attachments WHERE id = $1 AND deleted_at IS NULL', [paramId(req.params.id)]);
  if (!a) throw notFound('Attachment');
  const l = await loadLetter(ctx, a.letter_id);
  if (READ_ONLY_STATUSES.includes(l.status)) throw bad('Closed records are read-only.');
  const draftOwner = !l.number && l.created_by_uid === ctx.uid;
  if (!draftOwner && !registryUnits(ctx).has(l.unit_id)) throw forbidden('You cannot remove files from this record.');
  // The file stays on disk; the record of who removed it and when is kept.
  await q('UPDATE las_attachments SET deleted_at = now() WHERE id = $1', [a.id]);
  await audit(ctx, 'DeleteAttachment', 'Letter', l.id, l.number, { attachmentId: a.id, fileName: a.file_name, sha256: a.sha256 }, failClosed(l));
  res.json({ success: true });
}));

/** Files are served only here, after the permission check, with the checksum verified. */
router.get('/attachments/:id/download', h(async (ctx, req, res) => {
  const a = await q1<any>('SELECT * FROM las_attachments WHERE id = $1 AND deleted_at IS NULL', [paramId(req.params.id)]);
  if (!a) throw notFound('Attachment');
  // An internal incoming copy shows the sender's files: access is checked on the record the user is reading.
  const viaId = req.query.letter ? paramId(req.query.letter) : a.letter_id;
  const via = await loadLetter(ctx, viaId);
  if (via.id !== a.letter_id && via.source_letter_id !== a.letter_id) throw forbidden('This file does not belong to that record.');
  await audit(ctx, 'Download', 'Letter', via.id, via.number, { attachmentId: a.id, fileName: a.file_name }, failClosed(via));
  const buf = readAttachment(a);
  res.setHeader('Content-Type', a.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `${a.mime === 'application/pdf' || a.mime.startsWith('image/') ? 'inline' : 'attachment'}; filename="${a.file_name}"`);
  res.send(buf);
}));

// FR-9.1: printing a letter or its number label is logged
router.post('/letters/:id/print', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  await audit(ctx, 'Print', 'Letter', l.id, l.number, { what: oneOf(req.body?.what, 'What', ['letter', 'label', 'large_print'] as const) }, failClosed(l));
  res.json({ success: true });
}));

// AR-10: the OCR text of a scan, as an accessible text view for screen-reader users
router.get('/attachments/:id/text', h(async (ctx, req, res) => {
  const a = await q1<any>('SELECT id, letter_id, file_name, ocr_text, ocr_status FROM las_attachments WHERE id = $1 AND deleted_at IS NULL', [paramId(req.params.id)]);
  if (!a) throw notFound('Attachment');
  const viaId = req.query.letter ? paramId(req.query.letter) : a.letter_id;
  const via = await loadLetter(ctx, viaId);
  if (via.id !== a.letter_id && via.source_letter_id !== a.letter_id) throw forbidden('This file does not belong to that record.');
  if (isConfidential(via)) await audit(ctx, 'ViewText', 'Letter', via.id, via.number, { attachmentId: a.id }, { failClosed: true });
  res.json({ success: true, data: { fileName: a.file_name, status: a.ocr_status, text: a.ocr_text || '' } });
}));

router.post('/letters/:id/links', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  const other = await loadLetter(ctx, int(req.body?.relatedLetterId, 'Related record', true)!);
  if (other.id === l.id) throw bad('A record cannot be linked to itself.');
  if (!(l.created_by_uid === ctx.uid || registryUnits(ctx).has(l.unit_id))) throw forbidden();
  const relation = oneOf(req.body?.relation, 'Relation', ['reply_to', 'follow_up_of', 'related'] as const, 'related');
  await q('INSERT INTO las_links (letter_id, related_letter_id, relation, created_by) VALUES ($1,$2,$3,$4)', [l.id, other.id, relation, ctx.uid]);
  await audit(ctx, 'LinkRecords', 'Letter', l.id, l.number, { related: other.number || other.id, relation }, failClosed(l));
  res.json({ success: true });
}));

// =======================================================================================
// Referral and workflow (4.3)
// =======================================================================================
router.post('/letters/:id/referrals', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  const b = req.body || {};
  if (!l.number) throw bad('Only registered records can be referred.');
  if (READ_ONLY_STATUSES.includes(l.status)) throw bad('This record is closed.');
  let parent: any = null;
  if (b.parentReferralId) {
    parent = await q1<any>('SELECT * FROM las_referrals WHERE id = $1 AND letter_id = $2', [int(b.parentReferralId, 'Referral', true), l.id]);
    if (!parent || !['Pending', 'Accepted'].includes(parent.status)) throw bad('That referral is no longer open.');
    if (!(parent.to_uid === ctx.uid || (parent.to_unit_id && registryUnits(ctx).has(parent.to_unit_id)))) throw forbidden('That referral was not sent to you.');
  } else if (!headUnits(ctx).has(l.unit_id)) {
    throw forbidden('Only the head of the unit (or a person the letter was referred to) can refer it.');
  }
  const instruction = oneOf(b.instruction, 'Instruction', INSTRUCTIONS);
  const note = str(b.note, 'Note', 2000);
  if (!Array.isArray(b.targets) || b.targets.length === 0 || b.targets.length > 30) throw bad('Choose who to refer the letter to.');
  const due = day(b.dueDate, 'Due date') || l.due_date || (await categoryDefaults(l.category_id, baghdadToday())).due;
  const fromUnit = parent?.to_unit_id || [...headUnits(ctx)].find(id => id === l.unit_id) || l.unit_id;
  const onBehalf = actingFor(ctx, l.unit_id, r => HEAD_ROLES.includes(r.role));
  const created: number[] = [];
  for (const t of b.targets) {
    const toUnit = t?.unitId ? activeUnit(ctx, int(t.unitId, 'Unit', true)!).id : null;
    const toUid = t?.userUid ? str(t.userUid, 'Person', 100, true) : null;
    if (!toUnit && !toUid) throw bad('Each referral needs a unit or a person.');
    if (toUid && !(await q1('SELECT uid FROM users WHERE uid = $1', [toUid]))) throw bad('That person does not exist.');
    const r = await q1<any>(
      `INSERT INTO las_referrals (letter_id, parent_referral_id, from_uid, from_name, from_unit_id, on_behalf_of, to_uid, to_unit_id, instruction, note, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [l.id, parent?.id || null, ctx.uid, ctx.name, fromUnit, onBehalf, toUid, toUnit, instruction, note, due]);
    created.push(r.id);
    await audit(ctx, parent ? 'ReRefer' : 'Refer', 'Letter', l.id, l.number,
      { referralId: r.id, toUnit: toUnit ? ctx.units.get(toUnit)?.code : null, toUser: toUid, instruction, dueDate: due }, { onBehalfOf: onBehalf, ...failClosed(l) });
    const who = toUid ? [toUid] : await usersWithRoleAt(toUnit!, ['clerk', ...HEAD_ROLES]);
    await notify(who, l.id, 'referral', `إحالة جديدة: ${l.number}`, `New referral: ${l.number}`);
  }
  if (parent) await q(`UPDATE las_referrals SET status = 'Re-referred', acted_by_uid = $1, acted_by_name = $2, read_at = coalesce(read_at, now()) WHERE id = $3`, [ctx.uid, ctx.name, parent.id]);
  if (l.status === 'Registered') await q(`UPDATE las_letters SET status = 'Referred' WHERE id = $1`, [l.id]);
  res.status(201).json({ success: true, data: { referralIds: created } });
}));

router.post('/referrals/:id/act', h(async (ctx, req, res) => {
  const r = await q1<any>('SELECT * FROM las_referrals WHERE id = $1', [paramId(req.params.id)]);
  if (!r) throw notFound('Referral');
  const l = await loadLetter(ctx, r.letter_id);
  if (!(r.to_uid === ctx.uid || (r.to_unit_id && registryUnits(ctx).has(r.to_unit_id)))) throw forbidden('This referral was not sent to you.');
  const action = oneOf(req.body?.action, 'Action', ['accept', 'return', 'complete'] as const);
  if (!['Pending', 'Accepted'].includes(r.status) || (action === 'accept' && r.status !== 'Pending')) throw bad('This referral is no longer open.');
  if (READ_ONLY_STATUSES.includes(l.status)) throw bad('This record is closed.');
  const response = str(req.body?.responseText, 'Response', 4000, action !== 'accept');
  if (action === 'accept') {
    await q(`UPDATE las_referrals SET status = 'Accepted', read_at = now(), acted_by_uid = $1, acted_by_name = $2 WHERE id = $3`, [ctx.uid, ctx.name, r.id]);
    if (['Registered', 'Referred'].includes(l.status)) await q(`UPDATE las_letters SET status = 'In progress' WHERE id = $1`, [l.id]);
  } else {
    await q(`UPDATE las_referrals SET status = $1, response_text = $2, completed_at = now(), read_at = coalesce(read_at, now()), acted_by_uid = $3, acted_by_name = $4 WHERE id = $5`,
      [action === 'return' ? 'Returned' : 'Completed', response, ctx.uid, ctx.name, r.id]);
    if (req.body?.files) await saveFiles(ctx, l, req.body.files);
    await notify([r.from_uid], l.id, 'referral_done', action === 'return' ? `أُعيدت الإحالة: ${l.number}` : `أُنجزت الإحالة: ${l.number}`, action === 'return' ? `Referral returned: ${l.number}` : `Referral completed: ${l.number}`);
  }
  await audit(ctx, action === 'accept' ? 'AcceptReferral' : action === 'return' ? 'ReturnReferral' : 'CompleteReferral', 'Letter', l.id, l.number, { referralId: r.id }, failClosed(l));
  res.json({ success: true });
}));

// FR-3.5: recall a referral nobody acted on yet
router.post('/referrals/:id/recall', h(async (ctx, req, res) => {
  const r = await q1<any>('SELECT * FROM las_referrals WHERE id = $1', [paramId(req.params.id)]);
  if (!r) throw notFound('Referral');
  const l = await q1<any>('SELECT * FROM las_letters WHERE id = $1', [r.letter_id]);
  if (!(r.from_uid === ctx.uid || (r.from_unit_id && exactHeadUnits(ctx).has(r.from_unit_id)))) throw forbidden('Only the person who sent the referral can recall it.');
  if (r.status !== 'Pending') throw bad('This referral was already acted on and cannot be recalled.');
  await q(`UPDATE las_referrals SET status = 'Recalled', completed_at = now() WHERE id = $1`, [r.id]);
  await audit(ctx, 'RecallReferral', 'Letter', l.id, l.number, { referralId: r.id }, failClosed(l));
  res.json({ success: true });
}));

// =======================================================================================
// Mutala'at (FR-0.5..0.8)
// =======================================================================================
router.post('/mutalaa', h(async (ctx, req, res) => {
  const b = req.body || {};
  const unit = activeUnit(ctx, int(b.unitId, 'Submitting unit', true)!, 'Submitting unit');
  if (!memberUnits(ctx).has(unit.id) && !registryUnits(ctx).has(unit.id)) throw forbidden('You can only submit a mutala\'a from your own unit.');
  const addressed = unitOf(ctx, int(b.addressedUnitId, 'Addressed official', true)!, 'Addressed official');
  if (!ancestors(ctx, unit.id).includes(addressed.id)) throw bad('A mutala\'a goes up the chain: address it to the head of your unit or of a unit above it.');
  const row = await q1<any>(
    `INSERT INTO las_letters (archive_type, unit_id, unit_code, subject, summary, category_id, urgency, confidentiality, status, named_user_uids, case_id, created_by_uid, created_by_name)
     VALUES ('mutalaa',$1,$2,$3,$4,$5,$6,$7,'Draft',$8::jsonb,$9,$10,$11) RETURNING id`,
    [unit.id, unit.code, str(b.subject, 'Subject', 500, true), str(b.summary, 'Summary', 4000), int(b.categoryId, 'Category'), oneOf(b.urgency, 'Urgency', URGENCIES, 'Normal'),
      oneOf(b.confidentiality, 'Confidentiality', CONFIDENTIALITIES, 'Normal'), JSON.stringify(uidList(b.namedUserUids, 'Named recipients')), int(b.caseId, 'Case'), ctx.uid, ctx.name]);
  await q(`INSERT INTO las_mutalaa_details (letter_id, addressed_unit_id, background, analysis, recommendation) VALUES ($1,$2,$3,$4,$5)`,
    [row.id, addressed.id, str(b.background, 'Background', 20000), str(b.analysis, 'Analysis', 20000), str(b.recommendation, 'Recommendation', 20000, true)]);
  const letter = await q1<any>(`${LETTER_SELECT} WHERE l.id = $1`, [row.id]);
  await audit(ctx, 'CreateDraft', 'Mutalaa', row.id, null, { unitCode: unit.code, addressedTo: addressed.code }, failClosed(letter));
  await saveFiles(ctx, letter, b.files);
  res.status(201).json({ success: true, data: camel(letter) });
}));

router.put('/mutalaa/:id', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  if (l.archive_type !== 'mutalaa') throw notFound('Mutala\'a');
  if (l.created_by_uid !== ctx.uid || !['Draft', 'Returned'].includes(l.status)) throw forbidden('Only the author can change a mutala\'a, and only before it is submitted.');
  const b = req.body || {};
  await q(`UPDATE las_mutalaa_details SET background = coalesce($1, background), analysis = coalesce($2, analysis), recommendation = coalesce($3, recommendation) WHERE letter_id = $4`,
    [str(b.background, 'Background', 20000), str(b.analysis, 'Analysis', 20000), str(b.recommendation, 'Recommendation', 20000), l.id]);
  if (b.subject !== undefined) await q('UPDATE las_letters SET subject = $1, last_modified_by = $2, last_modified_at = now() WHERE id = $3', [str(b.subject, 'Subject', 500, true), ctx.uid, l.id]);
  await audit(ctx, 'EditMetadata', 'Mutalaa', l.id, l.number, { changes: Object.keys(b).filter(k => ['subject', 'background', 'analysis', 'recommendation'].includes(k)) }, failClosed(l));
  res.json({ success: true });
}));

router.post('/mutalaa/:id/submit', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  if (l.archive_type !== 'mutalaa') throw notFound('Mutala\'a');
  if (l.created_by_uid !== ctx.uid) throw forbidden('Only the author can submit it.');
  if (!['Draft', 'Returned'].includes(l.status)) throw bad('This mutala\'a was already submitted.');
  const d = await q1<any>('SELECT * FROM las_mutalaa_details WHERE letter_id = $1', [l.id]);
  // Path up the chain (FR-0.5). The author's own level is skipped when the author heads it.
  const path = ancestors(ctx, l.unit_id);
  const levels = path.slice(0, path.indexOf(d.addressed_unit_id) + 1);
  const start = exactHeadUnits(ctx).has(levels[0]) ? levels[1] : levels[0];
  if (!start) throw bad('You are the addressed official yourself. Address the mutala\'a to a higher official.');
  let number = l.number;
  if (!number) {
    await stampArchived(ctx, l.id, null, 'upload');
    number = await issueNumber(ctx, l.id, 'MUT', l.unit_id, false);
    const after = await q1<any>(`${LETTER_SELECT} WHERE l.id = $1`, [l.id]);
    await relocateLetterFiles(ctx, l, after);
    await q('UPDATE las_letters SET letter_date = $1 WHERE id = $2', [baghdadToday(), l.id]);
  }
  await q(`UPDATE las_letters SET status = 'Awaiting approval' WHERE id = $1`, [l.id]);
  await q('UPDATE las_mutalaa_details SET current_level_unit_id = $1, decision = NULL WHERE letter_id = $2', [start, l.id]);
  await audit(ctx, 'SubmitMutalaa', 'Mutalaa', l.id, number, { addressedTo: ctx.units.get(d.addressed_unit_id)?.code, currentLevel: ctx.units.get(start)?.code }, { unitCode: l.unit_code, ...failClosed(l) });
  await notify(await usersWithRoleAt(start, HEAD_ROLES), l.id, 'mutalaa', `مطالعة بانتظاركم: ${number}`, `A mutala'a is waiting for you: ${number}`);
  res.json({ success: true, data: { number, status: 'Awaiting approval' } });
}));

router.post('/mutalaa/:id/opinion', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  const d = await q1<any>('SELECT * FROM las_mutalaa_details WHERE letter_id = $1', [l.id]);
  if (!d || l.status !== 'Awaiting approval' || !d.current_level_unit_id) throw bad('This mutala\'a is not waiting for an opinion.');
  if (!exactHeadUnits(ctx).has(d.current_level_unit_id)) throw forbidden('This mutala\'a is at another level now.');
  if (d.current_level_unit_id === d.addressed_unit_id) throw bad('You are the addressed official: record your directive instead of an opinion.');
  const opinion = str(req.body?.opinion, 'Opinion', 10000, true)!;
  const path = ancestors(ctx, l.unit_id);
  const next = path[path.indexOf(d.current_level_unit_id) + 1];
  await q('INSERT INTO las_mutalaa_opinions (letter_id, level_unit_id, user_uid, user_name, opinion) VALUES ($1,$2,$3,$4,$5)', [l.id, d.current_level_unit_id, ctx.uid, ctx.name, opinion]);
  await q('UPDATE las_mutalaa_details SET current_level_unit_id = $1 WHERE letter_id = $2', [next, l.id]);
  await audit(ctx, 'AddOpinion', 'Mutalaa', l.id, l.number, { level: ctx.units.get(d.current_level_unit_id)?.code, forwardedTo: ctx.units.get(next)?.code }, failClosed(l));
  await notify(await usersWithRoleAt(next, HEAD_ROLES), l.id, 'mutalaa', `مطالعة بانتظاركم: ${l.number}`, `A mutala'a is waiting for you: ${l.number}`);
  res.json({ success: true });
}));

router.post('/mutalaa/:id/directive', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  const d = await q1<any>('SELECT * FROM las_mutalaa_details WHERE letter_id = $1', [l.id]);
  if (!d || l.status !== 'Awaiting approval' || d.current_level_unit_id !== d.addressed_unit_id) throw bad('This mutala\'a has not reached the addressed official yet.');
  if (!exactHeadUnits(ctx).has(d.addressed_unit_id)) throw forbidden('Only the addressed official can record the directive.');
  const decision = oneOf(req.body?.decision, 'Decision', MUT_DECISIONS);
  const hasFile = !!req.body?.file;
  const directive = str(req.body?.directiveText, 'Directive', 10000, !hasFile); // FR-0.6: text and/or the scanned marginal note
  const execDue = day(req.body?.executionDue, 'Execution due date');
  const returned = decision === 'Returned for further study';
  const status = returned ? 'Returned' : execDue ? 'In progress' : 'Closed';
  await q(`UPDATE las_mutalaa_details SET decision = $1, directive_text = $2, decided_by_uid = $3, decided_by_name = $4, decided_at = now(),
             execution_due = $5, current_level_unit_id = $6 WHERE letter_id = $7`, [decision, directive, ctx.uid, ctx.name, returned ? null : execDue, returned ? null : d.addressed_unit_id, l.id]);
  await q(`UPDATE las_letters SET status = $1, due_date = $2, closed_at = CASE WHEN $1 = 'Closed' THEN now() ELSE NULL END WHERE id = $3`, [status, returned ? null : execDue, l.id]);
  if (hasFile) await saveFiles(ctx, l, [{ ...req.body.file, kind: 'directive_scan' }]);
  await audit(ctx, 'RecordDirective', 'Mutalaa', l.id, l.number, { decision, executionDue: execDue, scanned: hasFile },
    { onBehalfOf: actingFor(ctx, d.addressed_unit_id, r => HEAD_ROLES.includes(r.role)), ...failClosed(l) });
  await notify([l.created_by_uid], l.id, 'directive', `صدر التوجيه على المطالعة ${l.number}`, `A directive was recorded on mutala'a ${l.number}`);
  res.json({ success: true, data: { status } });
}));

// FR-0.7: the directive's execution is a follow-up item with a due date
router.post('/mutalaa/:id/execution-done', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  if (l.archive_type !== 'mutalaa' || l.status !== 'In progress') throw bad('No directive is waiting for execution.');
  if (!(l.created_by_uid === ctx.uid || headUnits(ctx).has(l.unit_id))) throw forbidden();
  await q('UPDATE las_mutalaa_details SET execution_done_at = now() WHERE letter_id = $1', [l.id]);
  await q(`UPDATE las_letters SET status = 'Closed', closed_at = now(), closed_by = $1, followup_closed_at = now() WHERE id = $2`, [ctx.uid, l.id]);
  await audit(ctx, 'CompleteDirective', 'Mutalaa', l.id, l.number, {}, failClosed(l));
  res.json({ success: true });
}));

// =======================================================================================
// Reports (FR-0.9..0.10)
// =======================================================================================
router.post('/reports', h(async (ctx, req, res) => {
  const b = req.body || {};
  const unit = activeUnit(ctx, int(b.unitId, 'Preparing unit', true)!, 'Preparing unit');
  if (!memberUnits(ctx).has(unit.id) && !registryUnits(ctx).has(unit.id)) throw forbidden('You can only register reports for your own unit.');
  const kind = oneOf(b.reportKind, 'Report kind', REPORT_KINDS);
  const from = day(b.periodFrom, 'Period from'); const to = day(b.periodTo, 'Period to');
  if (from && to && to < from) throw bad('The period end must be after its start.');
  const row = await q1<any>(
    `INSERT INTO las_letters (archive_type, unit_id, unit_code, subject, summary, category_id, urgency, confidentiality, status, letter_date, named_user_uids, created_by_uid, created_by_name)
     VALUES ('report',$1,$2,$3,$4,$5,'Normal',$6,'Draft',$7,$8::jsonb,$9,$10) RETURNING id`,
    [unit.id, unit.code, str(b.title, 'Title', 500, true), str(b.summary, 'Summary', 4000), int(b.categoryId, 'Category'),
      oneOf(b.confidentiality, 'Confidentiality', CONFIDENTIALITIES, 'Normal'), baghdadToday(), JSON.stringify(uidList(b.namedUserUids, 'Named recipients')), ctx.uid, ctx.name]);
  await q(`INSERT INTO las_report_details (letter_id, report_kind, period_from, period_to, authors, recipients, keywords) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [row.id, kind, from, to, str(b.authors, 'Authors', 500), str(b.recipients, 'Recipients', 500), str(b.keywords, 'Keywords', 500)]);
  await q('INSERT INTO las_report_versions (letter_id, version, status, by_uid, by_name) VALUES ($1,1,$2,$3,$4)', [row.id, 'draft', ctx.uid, ctx.name]);
  await stampArchived(ctx, row.id, null, 'upload');
  const number = await issueNumber(ctx, row.id, 'RPT', unit.id, false);
  const letter = await q1<any>(`${LETTER_SELECT} WHERE l.id = $1`, [row.id]);
  await q('UPDATE las_letters SET folder_path = $1 WHERE id = $2', [recordFolder(ctx, letter, kind), row.id]);
  await audit(ctx, 'Archive', 'Report', row.id, number, { unitCode: unit.code, kind, version: 1 }, { unitCode: unit.code, ...failClosed(letter) });
  await saveFiles(ctx, letter, b.files, kind, 1);
  res.status(201).json({ success: true, data: camel(letter) });
}));

router.post('/reports/:id/status', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  const d = await q1<any>('SELECT * FROM las_report_details WHERE letter_id = $1', [l.id]);
  if (!d) throw notFound('Report');
  const to = oneOf(req.body?.to, 'Status', ['reviewed', 'approved'] as const);
  if ((to === 'reviewed' && d.approval_status !== 'draft') || (to === 'approved' && d.approval_status !== 'reviewed')) throw bad('A report goes draft → reviewed → approved.');
  if (!headUnits(ctx).has(l.unit_id)) throw forbidden('Only the head of the unit (or a unit above it) reviews and approves reports.');
  await q(`UPDATE las_report_details SET approval_status = $1, approved_by = CASE WHEN $1 = 'approved' THEN $2 ELSE approved_by END,
             approved_at = CASE WHEN $1 = 'approved' THEN now() ELSE approved_at END WHERE letter_id = $3`, [to, ctx.name, l.id]);
  await q('INSERT INTO las_report_versions (letter_id, version, status, note, by_uid, by_name) VALUES ($1,$2,$3,$4,$5,$6)', [l.id, d.version, to, str(req.body?.note, 'Note', 1000), ctx.uid, ctx.name]);
  // Only the approved version is final: the record becomes read-only.
  if (to === 'approved') await q(`UPDATE las_letters SET status = 'Closed', closed_at = now(), closed_by = $1 WHERE id = $2`, [ctx.uid, l.id]);
  await audit(ctx, to === 'approved' ? 'ApproveReportVersion' : 'ReviewReportVersion', 'Report', l.id, l.number, { version: d.version },
    { onBehalfOf: actingFor(ctx, l.unit_id, r => HEAD_ROLES.includes(r.role)), ...failClosed(l) });
  res.json({ success: true });
}));

router.post('/reports/:id/new-version', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  const d = await q1<any>('SELECT * FROM las_report_details WHERE letter_id = $1', [l.id]);
  if (!d) throw notFound('Report');
  if (!(l.created_by_uid === ctx.uid || registryUnits(ctx).has(l.unit_id))) throw forbidden();
  if (d.approval_status === 'draft') throw bad('The current version is still a draft. Add files to it instead.');
  const version = d.version + 1;
  await q(`UPDATE las_report_details SET version = $1, approval_status = 'draft', approved_by = NULL, approved_at = NULL WHERE letter_id = $2`, [version, l.id]);
  await q(`UPDATE las_letters SET status = 'Draft', closed_at = NULL, closed_by = NULL WHERE id = $1`, [l.id]);
  await q('INSERT INTO las_report_versions (letter_id, version, status, note, by_uid, by_name) VALUES ($1,$2,$3,$4,$5,$6)', [l.id, version, 'draft', str(req.body?.note, 'Note', 1000), ctx.uid, ctx.name]);
  await audit(ctx, 'NewReportVersion', 'Report', l.id, l.number, { version }, failClosed(l));
  await saveFiles(ctx, { ...l, status: 'Draft' }, req.body?.files, d.report_kind, version); // earlier versions' files are kept
  res.json({ success: true, data: { version } });
}));

// =======================================================================================
// Reading: detail and search (4.6)
// =======================================================================================
router.get('/letters/:id', h(async (ctx, req, res) => {
  const l = await loadLetter(ctx, paramId(req.params.id));
  // 3.1 / FR-9.1: every view of a confidential or sensitive record is logged; refused if it cannot be.
  if (isConfidential(l)) await audit(ctx, 'View', 'Letter', l.id, l.number, { confidentiality: l.confidentiality }, { failClosed: true });
  const filesOf = l.source_letter_id || l.id;
  const [attachments, referrals, approvals, links, deliveries, contact, category, mut, opinions, rep, versions, kase] = await Promise.all([
    q<any>(`SELECT id, letter_id, file_name, original_name, mime, size, sha256, is_original_scan, kind, version, uploaded_by, uploaded_at,
              ocr_status, pdfa_conformance, source_attachment_id, (ocr_text IS NOT NULL AND ocr_text <> '') AS has_ocr
              FROM las_attachments WHERE letter_id = $1 AND deleted_at IS NULL ORDER BY id`, [filesOf]),
    q<any>('SELECT r.*, r.due_date::text AS due_date FROM las_referrals r WHERE letter_id = $1 ORDER BY id', [l.id]),
    q<any>('SELECT * FROM las_approvals WHERE letter_id = $1 ORDER BY round, step_no', [l.id]),
    q<any>(`SELECT k.relation, k.letter_id, k.related_letter_id, o.id AS other_id, o.number AS other_number, o.subject AS other_subject, o.status AS other_status
              FROM las_links k JOIN las_letters o ON o.id = CASE WHEN k.letter_id = $1 THEN k.related_letter_id ELSE k.letter_id END
             WHERE k.letter_id = $1 OR k.related_letter_id = $1`, [l.id]),
    q<any>(`SELECT d.*, i.number AS in_number FROM las_internal_deliveries d JOIN las_letters i ON i.id = d.in_letter_id WHERE d.out_letter_id = $1 OR d.in_letter_id = $1 ORDER BY d.id`, [l.id]),
    l.contact_id ? q1<any>('SELECT * FROM las_contacts WHERE id = $1', [l.contact_id]) : null,
    l.category_id ? q1<any>('SELECT * FROM las_categories WHERE id = $1', [l.category_id]) : null,
    l.archive_type === 'mutalaa' ? q1<any>('SELECT m.*, m.execution_due::text AS execution_due FROM las_mutalaa_details m WHERE letter_id = $1', [l.id]) : null,
    l.archive_type === 'mutalaa' ? q<any>('SELECT * FROM las_mutalaa_opinions WHERE letter_id = $1 ORDER BY id', [l.id]) : [],
    l.archive_type === 'report' ? q1<any>('SELECT r.*, r.period_from::text AS period_from, r.period_to::text AS period_to FROM las_report_details r WHERE letter_id = $1', [l.id]) : null,
    l.archive_type === 'report' ? q<any>('SELECT * FROM las_report_versions WHERE letter_id = $1 ORDER BY id', [l.id]) : [],
    l.case_id ? q1<any>('SELECT * FROM las_cases WHERE id = $1', [l.case_id]) : null,
  ]);
  // The History tab (سجل العمليات) is for heads, clerks and auditors of the unit and administrators.
  const mayHistory = ctx.isSysAdmin || registryUnits(ctx).has(l.unit_id) || viewUnits(ctx).has(l.unit_id);
  const history = mayHistory
    ? await q<any>(`SELECT id, ts, user_name, on_behalf_of, action, client_ip, details FROM las_audit WHERE entity_id = $1 AND entity <> 'Setting' ORDER BY id`, [String(l.id)])
    : null;
  const mine = registryUnits(ctx); const exact = exactHeadUnits(ctx);
  const pendingStep = approvals.find(a => a.decision === 'Pending');
  const permissions = {
    edit: !READ_ONLY_STATUSES.includes(l.status) && (['Draft', 'Returned'].includes(l.status) ? l.created_by_uid === ctx.uid : mine.has(l.unit_id)),
    submit: ['Draft', 'Returned'].includes(l.status) && l.created_by_uid === ctx.uid,
    approve: l.status === 'Awaiting approval' && l.archive_type === 'letter' && !!pendingStep && exact.has(pendingStep.approver_unit_id),
    refer: !!l.number && !READ_ONLY_STATUSES.includes(l.status) && headUnits(ctx).has(l.unit_id),
    close: !!l.number && !READ_ONLY_STATUSES.includes(l.status) && mine.has(l.unit_id),
    archive: l.status === 'Closed' && mine.has(l.unit_id),
    reopen: ctx.isSysAdmin && ['Closed', 'Archived'].includes(l.status),
    dispatch: l.direction === 'OUT' && l.scope === 'external' && !!l.number && !READ_ONLY_STATUSES.includes(l.status) && mine.has(l.unit_id),
    attach: !READ_ONLY_STATUSES.includes(l.status) && (l.created_by_uid === ctx.uid || mine.has(l.unit_id)),
    reply: l.direction === 'IN' && OPEN_FOLLOWUP.includes(l.status),
    opinion: !!mut && l.status === 'Awaiting approval' && mut.current_level_unit_id !== mut.addressed_unit_id && exact.has(mut.current_level_unit_id),
    directive: !!mut && l.status === 'Awaiting approval' && mut.current_level_unit_id === mut.addressed_unit_id && exact.has(mut.addressed_unit_id),
    executionDone: l.archive_type === 'mutalaa' && l.status === 'In progress' && (l.created_by_uid === ctx.uid || headUnits(ctx).has(l.unit_id)),
    reportReview: !!rep && rep.approval_status === 'draft' && headUnits(ctx).has(l.unit_id),
    reportApprove: !!rep && rep.approval_status === 'reviewed' && headUnits(ctx).has(l.unit_id),
    reportNewVersion: !!rep && rep.approval_status !== 'draft' && (l.created_by_uid === ctx.uid || mine.has(l.unit_id)),
  };
  res.json({
    success: true,
    data: {
      ...camel(l), attachments: attachments.map(camel),
      referrals: referrals.map(r => ({
        ...camel(r),
        canAct: ['Pending', 'Accepted'].includes(r.status) && (r.to_uid === ctx.uid || (r.to_unit_id && mine.has(r.to_unit_id))),
        canRecall: r.status === 'Pending' && (r.from_uid === ctx.uid || (r.from_unit_id && exact.has(r.from_unit_id))),
      })),
      approvals: approvals.map(camel), links: links.map(camel),
      deliveries: deliveries.map(d => ({ ...camel(d), canReceive: !d.received_at && d.in_letter_id === l.id && mine.has(d.receiving_unit_id) })),
      contact: camel(contact), category: camel(category), mutalaa: camel(mut), opinions: opinions.map(camel),
      report: camel(rep), reportVersions: versions.map(camel), case: camel(kase), history: history?.map(camel) ?? null, permissions,
    },
  });
}));

router.get('/letters', h(async (ctx, req, res) => {
  const p = req.query as Record<string, string>;
  const params: any[] = [];
  const where: string[] = [accessPrefilter(ctx, params)];
  const add = (sql: string, value: any) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
  if (p.type) add('l.archive_type = ?', oneOf(p.type, 'Type', ['letter', 'mutalaa', 'report'] as const));
  if (p.direction) add('l.direction = ?', oneOf(p.direction, 'Direction', ['IN', 'OUT'] as const));
  if (p.scope) add('l.scope = ?', oneOf(p.scope, 'Scope', ['internal', 'external'] as const));
  if (p.status) add('l.status = ?', str(p.status, 'Status', 30));
  if (p.urgency) add('l.urgency = ?', oneOf(p.urgency, 'Urgency', URGENCIES));
  if (p.categoryId) add('l.category_id = ?', int(p.categoryId, 'Category'));
  if (p.contactId) add('l.contact_id = ?', int(p.contactId, 'Contact'));
  if (p.caseId) add('l.case_id = ?', int(p.caseId, 'Case'));
  if (p.unitId) add('l.unit_id = ANY(?::int[])', descendants(ctx, int(p.unitId, 'Unit', true)!));
  if (p.from) add(`coalesce(l.archived_at, l.created_at) >= (?::date AT TIME ZONE 'Asia/Baghdad')`, day(p.from, 'From'));
  if (p.to) add(`coalesce(l.archived_at, l.created_at) < ((?::date + 1) AT TIME ZONE 'Asia/Baghdad')`, day(p.to, 'To'));
  if (p.holderUid) add(`l.id IN (SELECT letter_id FROM las_referrals WHERE to_uid = ? AND status IN ('Pending','Accepted'))`, str(p.holderUid, 'Holder', 100));
  if (p.reportKind) add('l.id IN (SELECT letter_id FROM las_report_details WHERE report_kind = ?)', oneOf(p.reportKind, 'Report kind', REPORT_KINDS));
  if (p.overdue === '1') { params.push(baghdadToday()); where.push(`l.due_date < $${params.length}::date AND l.status IN ('Registered','Referred','In progress')`); }
  if (p.number) add('l.number = ?', str(p.number, 'Number', 80));
  // A scanned record label (QR "LAS1|REC|<number>") searches for that number.
  const text = str(p.q, 'Search text', 200)?.replace(/^LAS1\|REC\|/, '') || null;
  if (text) {
    // Arabic-aware (أ/إ/آ, ة/ه, ى/ي) search in number, subject, summary, text, sender, keywords
    // and the OCR text of scanned files (an internal copy searches its sender's files).
    params.push(`%${text}%`);
    const n = `$${params.length}`;
    where.push(`(l.number ILIKE ${n} OR l.external_ref_no ILIKE ${n} OR las_norm(l.subject) LIKE las_norm(${n}) OR las_norm(l.summary) LIKE las_norm(${n}) OR las_norm(l.body) LIKE las_norm(${n})
      OR l.contact_id IN (SELECT id FROM las_contacts WHERE las_norm(name) LIKE las_norm(${n}))
      OR l.id IN (SELECT letter_id FROM las_report_details WHERE las_norm(keywords) LIKE las_norm(${n}))
      OR l.id IN (SELECT letter_id FROM las_mutalaa_details WHERE las_norm(recommendation) LIKE las_norm(${n}) OR las_norm(background) LIKE las_norm(${n}))
      OR coalesce(l.source_letter_id, l.id) IN (SELECT letter_id FROM las_attachments WHERE deleted_at IS NULL AND las_norm(ocr_text) LIKE las_norm(${n})))`);
  }
  const limit = Math.min(int(p.limit, 'Limit') || 100, 500);
  const rows = await q<any>(
    `${LETTER_SELECT} WHERE ${where.join(' AND ')} ORDER BY coalesce(l.archived_at, l.created_at) DESC, l.id DESC LIMIT ${limit * 3}`, params);
  const visible = rows.filter(r => canView(ctx, r)).slice(0, limit); // FR-6.4: results always respect permissions
  const contacts = new Map((await q<any>('SELECT id, name FROM las_contacts')).map(c => [c.id, c.name]));
  res.json({
    success: true,
    count: visible.length,
    data: visible.map(l => ({
      id: l.id, number: l.number, archiveType: l.archive_type, direction: l.direction, scope: l.scope, isMemo: l.is_memo, unitId: l.unit_id, unitCode: l.unit_code,
      subject: l.subject, categoryId: l.category_id, urgency: l.urgency, confidentiality: l.confidentiality, status: l.status, letterDate: l.letter_date,
      receivedOrSentDate: l.received_or_sent_date, externalRefNo: l.external_ref_no, contactId: l.contact_id, contactName: contacts.get(l.contact_id) || null,
      dueDate: l.due_date, archivedAt: l.archived_at, archivedByName: l.archived_by_name, createdByName: l.created_by_name, createdAt: l.created_at,
      folderPath: l.folder_path, caseId: l.case_id, toUnitIds: l.to_unit_ids, sourceLetterId: l.source_letter_id,
      overdue: !!l.due_date && l.due_date < baghdadToday() && OPEN_FOLLOWUP.includes(l.status),
    })),
  });
}));

export default router;
