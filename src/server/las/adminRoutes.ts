// Letters Archive System — profile, units, roles and delegation, lookup lists, settings,
// inbox and notifications, dashboard and reports, audit screen.
import { Router } from 'express';
import {
  Ctx, ROLES, HEAD_ROLES, audit, getSettings, DEFAULT_SETTINGS, baghdadToday, descendants, ancestors, registryUnits, memberUnits,
  headUnits, exactHeadUnits, viewUnits, canView, accessPrefilter, ensureUnitFolders, verifyAuditChain, lastChainCheck,
} from './core.ts';
import { q, q1 } from './db.ts';
import { h, bad, forbidden, notFound, str, day, int, oneOf, paramId, camel, LETTER_SELECT } from './http.ts';

const router = Router();
const adminOnly = (ctx: Ctx) => { if (!ctx.isSysAdmin) throw forbidden('Only a system administrator can change this.'); };
const OPEN = ['Registered', 'Referred', 'In progress'];

// ---- profile and units ------------------------------------------------------------------
router.get('/me', h(async (ctx, _req, res) => {
  res.json({
    success: true,
    data: {
      uid: ctx.uid, name: ctx.name, isSysAdmin: ctx.isSysAdmin,
      roles: ctx.roles.map(r => ({ ...r, unitCode: ctx.units.get(r.unitId)?.code })),
      registryUnits: [...registryUnits(ctx)], memberUnits: [...memberUnits(ctx)], headUnits: [...headUnits(ctx)],
      exactHeadUnits: [...exactHeadUnits(ctx)], viewUnits: [...viewUnits(ctx)],
      isAuditor: ctx.isSysAdmin || ctx.roles.some(r => r.role === 'viewer'),
      settings: await getSettings(), today: baghdadToday(),
    },
  });
}));

router.get('/units', h(async (ctx, _req, res) => {
  res.json({ success: true, data: [...ctx.units.values()] });
}));

router.put('/units/:id', h(async (ctx, req, res) => {
  adminOnly(ctx);
  const u = ctx.units.get(paramId(req.params.id));
  if (!u) throw notFound('Unit');
  const changes: Record<string, any> = {};
  if (req.body?.code !== undefined && req.body.code !== u.code) {
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{0,5}(-\d{2})*$/.test(code) || code.endsWith('-00')) throw bad('A unit code looks like INS, D2 or D2-03-01. Codes ending in -00 are reserved for the head\'s office.');
    if (await q1('SELECT 1 FROM las_unit_codes WHERE code = $1 AND unit_id <> $2', [code, u.id])) throw bad(`Code ${code} is already used by another unit.`);
    if (await q1('SELECT 1 FROM las_letters WHERE unit_id = $1 AND number IS NOT NULL LIMIT 1', [u.id])) throw bad('This unit already issued numbers with its code, so the code can no longer change.');
    await q('UPDATE las_unit_codes SET code = $1, updated_at = now() WHERE unit_id = $2', [code, u.id]);
    changes.code = { old: u.code, new: code };
  }
  if (req.body?.active !== undefined && !!req.body.active !== u.active) {
    await q('UPDATE las_unit_codes SET active = $1, updated_at = now() WHERE unit_id = $2', [!!req.body.active, u.id]);
    changes.active = { old: u.active, new: !!req.body.active };
  }
  if (Object.keys(changes).length) await audit(ctx, 'ChangeUnit', 'Unit', u.id, null, { unitCode: u.code, changes });
  res.json({ success: true });
}));

router.post('/folders/sync', h(async (ctx, _req, res) => {
  adminOnly(ctx);
  const made = await ensureUnitFolders(ctx);
  await audit(ctx, 'SyncFolders', 'Folder', null, null, { created: made });
  res.json({ success: true, data: { created: made } });
}));

router.get('/users', h(async (_ctx, _req, res) => {
  const rows = await q<any>('SELECT uid, full_name, department, job_title FROM users WHERE coalesce(is_locked_out, false) = false ORDER BY full_name');
  res.json({ success: true, data: rows.map(camel) });
}));

// ---- roles (per user and per unit) and delegation (3, 3.2) --------------------------------
router.get('/roles', h(async (ctx, _req, res) => {
  const rows = await q<any>(
    `SELECT r.*, r.valid_from::text AS valid_from, r.valid_to::text AS valid_to, u.full_name FROM las_user_roles r LEFT JOIN users u ON u.uid = r.user_uid ORDER BY r.id`);
  const mine = (r: any) => r.user_uid === ctx.uid || r.delegated_by_uid === ctx.uid;
  res.json({ success: true, data: rows.filter(r => ctx.isSysAdmin || mine(r)).map(camel) });
}));

router.post('/roles', h(async (ctx, req, res) => {
  adminOnly(ctx);
  const b = req.body || {};
  const userUid = str(b.userUid, 'User', 100, true)!;
  if (!(await q1('SELECT uid FROM users WHERE uid = $1', [userUid]))) throw bad('That user does not exist.');
  const role = oneOf(b.role, 'Role', ROLES);
  const unit = ctx.units.get(int(b.unitId, 'Unit', true)!);
  if (!unit) throw bad('That unit does not exist.');
  const from = day(b.validFrom, 'Valid from'); const to = day(b.validTo, 'Valid to');
  if (from && to && to < from) throw bad('The end date must be after the start date.');
  if (await q1('SELECT 1 FROM las_user_roles WHERE user_uid = $1 AND role = $2 AND unit_id = $3 AND delegated_by_uid IS NULL', [userUid, role, unit.id])) throw bad('This user already has that role in that unit.');
  const row = await q1<any>(`INSERT INTO las_user_roles (user_uid, role, unit_id, scope, valid_from, valid_to, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [userUid, role, unit.id, oneOf(b.scope, 'Scope', ['unit', 'tree'] as const, 'tree'), from, to, ctx.uid]);
  await audit(ctx, 'GrantRole', 'UserRole', row.id, null, { userUid, role, unitCode: unit.code, validFrom: from, validTo: to });
  res.status(201).json({ success: true, data: { id: row.id } });
}));

router.delete('/roles/:id', h(async (ctx, req, res) => {
  const r = await q1<any>('SELECT * FROM las_user_roles WHERE id = $1', [paramId(req.params.id)]);
  if (!r) throw notFound('Role');
  if (!ctx.isSysAdmin && r.delegated_by_uid !== ctx.uid) throw forbidden('Only an administrator, or the person who delegated, can remove this.');
  await q('DELETE FROM las_user_roles WHERE id = $1', [r.id]);
  await audit(ctx, r.delegated_by_uid ? 'EndDelegation' : 'RevokeRole', 'UserRole', r.id, null, { userUid: r.user_uid, role: r.role, unitCode: ctx.units.get(r.unit_id)?.code });
  res.json({ success: true });
}));

router.post('/delegations', h(async (ctx, req, res) => {
  const b = req.body || {};
  const own = ctx.roles.find(r => r.id === int(b.roleId, 'Role', true) && !r.delegatedBy && HEAD_ROLES.includes(r.role));
  if (!own) throw forbidden('You can delegate only a head role that is your own.');
  const toUid = str(b.toUid, 'Delegate', 100, true)!;
  if (toUid === ctx.uid || !(await q1('SELECT uid FROM users WHERE uid = $1', [toUid]))) throw bad('Choose another user as the delegate.');
  const from = day(b.validFrom, 'From', true)!; const to = day(b.validTo, 'To', true)!;
  if (to < from) throw bad('The end date must be after the start date.');
  const row = await q1<any>(`INSERT INTO las_user_roles (user_uid, role, unit_id, scope, valid_from, valid_to, delegated_by_uid, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING id`,
    [toUid, own.role, own.unitId, own.scope, from, to, ctx.uid]);
  await audit(ctx, 'Delegate', 'UserRole', row.id, null, { toUid, role: own.role, unitCode: ctx.units.get(own.unitId)?.code, validFrom: from, validTo: to });
  res.status(201).json({ success: true, data: { id: row.id } });
}));

// ---- lookup lists (4.8) ---------------------------------------------------------------------
router.get('/categories', h(async (_ctx, _req, res) => {
  res.json({ success: true, data: (await q<any>('SELECT * FROM las_categories ORDER BY id')).map(camel) });
}));
const readCategory = (b: any) => ({
  nameAr: str(b.nameAr, 'Arabic name', 100, true), nameEn: str(b.nameEn, 'English name', 100, true),
  due: int(b.defaultDueDays, 'Default due days', false, 1, 3650), retention: int(b.retentionYears, 'Retention years', false, 1, 100),
});
router.post('/categories', h(async (ctx, req, res) => {
  adminOnly(ctx);
  const c = readCategory(req.body || {});
  const row = await q1<any>('INSERT INTO las_categories (name_ar, name_en, default_due_days, retention_years) VALUES ($1,$2,$3,$4) RETURNING id', [c.nameAr, c.nameEn, c.due, c.retention]);
  await audit(ctx, 'ChangeSetting', 'Category', row.id, null, { created: c });
  res.status(201).json({ success: true, data: { id: row.id } });
}));
router.put('/categories/:id', h(async (ctx, req, res) => {
  adminOnly(ctx);
  const id = paramId(req.params.id);
  const before = await q1<any>('SELECT * FROM las_categories WHERE id = $1', [id]);
  if (!before) throw notFound('Category');
  const c = readCategory({ nameAr: before.name_ar, nameEn: before.name_en, defaultDueDays: before.default_due_days, retentionYears: before.retention_years, ...req.body });
  const active = req.body?.active === undefined ? before.active : !!req.body.active;
  await q('UPDATE las_categories SET name_ar=$1, name_en=$2, default_due_days=$3, retention_years=$4, active=$5, updated_at=now() WHERE id=$6', [c.nameAr, c.nameEn, c.due, c.retention, active, id]);
  await audit(ctx, 'ChangeSetting', 'Category', id, null, { old: { due: before.default_due_days, retention: before.retention_years, active: before.active }, new: { due: c.due, retention: c.retention, active } });
  res.json({ success: true });
}));

const CONTACT_TYPES = ['ministry', 'governorate', 'government', 'ngo', 'international', 'individual', 'other'] as const;
router.get('/contacts', h(async (_ctx, _req, res) => {
  res.json({ success: true, data: (await q<any>('SELECT * FROM las_contacts ORDER BY name')).map(camel) });
}));
const readContact = (b: any) => {
  const email = str(b.email, 'Email', 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('The email address is not valid.');
  const phone = str(b.phone, 'Phone', 30);
  if (phone && !/^[0-9+\-\s()]+$/.test(phone)) throw bad('The phone number may contain digits, spaces, + and - only.');
  return { name: str(b.name, 'Name', 200, true), type: oneOf(b.orgType, 'Type', CONTACT_TYPES, 'other'), address: str(b.address, 'Address', 300), phone, email };
};
router.post('/contacts', h(async (ctx, req, res) => {
  if (!ctx.isSysAdmin && registryUnits(ctx).size === 0) throw forbidden('Only correspondence clerks, heads and administrators add contacts.');
  const c = readContact(req.body || {});
  if (await q1('SELECT 1 FROM las_contacts WHERE las_norm(name) = las_norm($1)', [c.name])) throw bad('A contact with this name already exists.');
  const row = await q1<any>('INSERT INTO las_contacts (name, org_type, address, phone, email, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [c.name, c.type, c.address, c.phone, c.email, ctx.uid]);
  await audit(ctx, 'ChangeSetting', 'Contact', row.id, null, { created: { type: c.type } });
  res.status(201).json({ success: true, data: { id: row.id } });
}));
router.put('/contacts/:id', h(async (ctx, req, res) => {
  if (!ctx.isSysAdmin && registryUnits(ctx).size === 0) throw forbidden();
  const id = paramId(req.params.id);
  const before = await q1<any>('SELECT * FROM las_contacts WHERE id = $1', [id]);
  if (!before) throw notFound('Contact');
  const c = readContact({ name: before.name, orgType: before.org_type, address: before.address, phone: before.phone, email: before.email, ...req.body });
  const active = req.body?.active === undefined ? before.active : !!req.body.active;
  await q('UPDATE las_contacts SET name=$1, org_type=$2, address=$3, phone=$4, email=$5, active=$6, updated_at=now() WHERE id=$7', [c.name, c.type, c.address, c.phone, c.email, active, id]);
  await audit(ctx, 'ChangeSetting', 'Contact', id, null, { fields: Object.keys(req.body || {}) });
  res.json({ success: true });
}));

router.get('/cases', h(async (_ctx, _req, res) => {
  res.json({ success: true, data: (await q<any>('SELECT c.*, (SELECT count(*)::int FROM las_letters l WHERE l.case_id = c.id) AS letters FROM las_cases c ORDER BY c.id DESC')).map(camel) });
}));
router.post('/cases', h(async (ctx, req, res) => {
  if (registryUnits(ctx).size === 0) throw forbidden('Only correspondence clerks and heads open cases.');
  const row = await q1<any>('INSERT INTO las_cases (title, description, created_by) VALUES ($1,$2,$3) RETURNING id', [str(req.body?.title, 'Title', 300, true), str(req.body?.description, 'Description', 2000), ctx.uid]);
  await audit(ctx, 'CreateCase', 'Case', row.id, null, {});
  res.status(201).json({ success: true, data: { id: row.id } });
}));

// ---- settings: numbering format and reminders (2.2, 7.6) --------------------------------------
router.put('/settings', h(async (ctx, req, res) => {
  adminOnly(ctx);
  const b = req.body || {};
  const before = await getSettings();
  const next: Record<string, any> = {};
  if (b.numberFormat !== undefined) {
    const f = str(b.numberFormat, 'Number format', 60, true)!;
    for (const part of ['{type}', '{unit}', '{year}', '{seq}']) if (!f.includes(part)) throw bad(`The number format must contain ${part}.`);
    next.numberFormat = f;
  }
  if (b.prefixes !== undefined) {
    const p: Record<string, string> = {};
    for (const k of Object.keys(DEFAULT_SETTINGS.prefixes)) {
      const v = str(b.prefixes?.[k], `Prefix ${k}`, 12, true)!;
      if (/[{}/\\]/.test(v)) throw bad('A prefix cannot contain / \\ { or }.');
      p[k] = v;
    }
    if (new Set(Object.values(p)).size !== Object.keys(p).length) throw bad('Each type needs a different prefix.');
    next.prefixes = p;
  }
  if (b.seqPad !== undefined) next.seqPad = int(b.seqPad, 'Sequence digits', true, 1, 8);
  if (b.seqLevel !== undefined) next.seqLevel = oneOf(b.seqLevel, 'Sequence level', ['unit', 'department', 'directorate'] as const);
  if (b.reminderDays !== undefined) next.reminderDays = int(b.reminderDays, 'Reminder days', true, 0, 60);
  if (b.institutionNameAr !== undefined) next.institutionNameAr = str(b.institutionNameAr, 'Institution name (Arabic)', 200, true);
  if (b.institutionNameEn !== undefined) next.institutionNameEn = str(b.institutionNameEn, 'Institution name (English)', 200, true);
  for (const [k, v] of Object.entries(next)) {
    await q(`INSERT INTO las_settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`, [k, JSON.stringify(v), ctx.uid]);
    await audit(ctx, 'ChangeSetting', 'Setting', null, null, { key: k, old: (before as any)[k], new: v });
  }
  res.json({ success: true, data: await getSettings() });
}));

// ---- inbox and notifications (4.4) --------------------------------------------------------------
router.get('/inbox', h(async (ctx, _req, res) => {
  const reg = [...registryUnits(ctx)]; const exact = [...exactHeadUnits(ctx)]; const heads = [...headUnits(ctx)];
  const today = baghdadToday();
  const settings = await getSettings();
  const soon = new Date(today + 'T00:00:00Z'); soon.setUTCDate(soon.getUTCDate() + settings.reminderDays);
  const soonDay = soon.toISOString().slice(0, 10);
  const L = 'l.id AS letter_id, l.number, l.subject, l.urgency, l.confidentiality, l.status AS letter_status, l.archive_type, l.unit_code';

  const referrals = await q<any>(
    `SELECT r.id, r.instruction, r.note, r.due_date::text AS due_date, r.status, r.sent_at, r.from_name, r.to_uid, r.to_unit_id, ${L}
       FROM las_referrals r JOIN las_letters l ON l.id = r.letter_id
      WHERE r.status IN ('Pending','Accepted') AND (r.to_uid = $1 OR r.to_unit_id = ANY($2::int[])) ORDER BY r.due_date NULLS LAST, r.id`, [ctx.uid, reg]);
  const approvals = await q<any>(
    `SELECT a.id, a.step_no, a.approver_unit_id, l.created_by_name, l.created_at, ${L}
       FROM las_approvals a JOIN las_letters l ON l.id = a.letter_id
      WHERE a.decision = 'Pending' AND l.status = 'Awaiting approval' AND a.approver_unit_id = ANY($1::int[])
        AND a.step_no = (SELECT min(step_no) FROM las_approvals x WHERE x.letter_id = a.letter_id AND x.round = a.round AND x.decision = 'Pending')`, [exact]);
  const mutalaat = await q<any>(
    `SELECT m.current_level_unit_id, m.addressed_unit_id, l.created_by_name, ${L}
       FROM las_mutalaa_details m JOIN las_letters l ON l.id = m.letter_id
      WHERE l.status = 'Awaiting approval' AND m.current_level_unit_id = ANY($1::int[])`, [exact]);
  const deliveries = await q<any>(
    `SELECT d.id, d.is_cc, d.receiving_unit_id, o.number AS out_number, o.unit_code AS from_unit_code, ${L}
       FROM las_internal_deliveries d JOIN las_letters l ON l.id = d.in_letter_id JOIN las_letters o ON o.id = d.out_letter_id
      WHERE d.received_at IS NULL AND d.receiving_unit_id = ANY($1::int[])`, [reg]);
  const drafts = await q<any>(
    `SELECT ${L}, l.created_at FROM las_letters l WHERE l.created_by_uid = $1 AND l.status IN ('Draft','Returned') ORDER BY l.id DESC`, [ctx.uid]);
  // FR-4.4: overdue referrals inside the units the user heads are escalated to them.
  const escalated = await q<any>(
    `SELECT r.id, r.due_date::text AS due_date, r.to_uid, r.to_unit_id, r.from_name, ${L}
       FROM las_referrals r JOIN las_letters l ON l.id = r.letter_id
      WHERE r.status IN ('Pending','Accepted') AND r.due_date < $1::date AND (l.unit_id = ANY($2::int[]) OR r.to_unit_id = ANY($2::int[]))
        AND NOT (r.to_uid IS NOT DISTINCT FROM $3)`, [today, heads, ctx.uid]);
  const notifications = await q<any>('SELECT * FROM las_notifications WHERE user_uid = $1 ORDER BY id DESC LIMIT 50', [ctx.uid]);
  const flag = (r: any) => ({ ...camel(r), overdue: !!r.due_date && r.due_date < today, dueSoon: !!r.due_date && r.due_date >= today && r.due_date <= soonDay });
  res.json({
    success: true,
    data: {
      referrals: referrals.map(flag), approvals: approvals.map(camel), mutalaat: mutalaat.map(camel), deliveries: deliveries.map(camel),
      drafts: drafts.map(camel), escalated: escalated.map(flag), notifications: notifications.map(camel),
      counts: {
        referrals: referrals.length, approvals: approvals.length + mutalaat.length, deliveries: deliveries.length,
        overdue: referrals.filter(r => r.due_date && r.due_date < today).length, dueSoon: referrals.filter(r => r.due_date && r.due_date >= today && r.due_date <= soonDay).length,
        returned: drafts.filter(d => d.letter_status === 'Returned').length, unread: notifications.filter(n => !n.read_at).length,
      },
    },
  });
}));

router.post('/notifications/read', h(async (ctx, req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: any) => Number.isInteger(x)) : null;
  if (ids) await q('UPDATE las_notifications SET read_at = now() WHERE user_uid = $1 AND id = ANY($2::int[]) AND read_at IS NULL', [ctx.uid, ids]);
  else await q('UPDATE las_notifications SET read_at = now() WHERE user_uid = $1 AND read_at IS NULL', [ctx.uid]);
  res.json({ success: true });
}));

// ---- dashboard and reports (4.7) ---------------------------------------------------------------
/** Records in a period that the user may see. */
async function visibleLetters(ctx: Ctx, from: string | null, to: string | null, unitId: number | null) {
  const params: any[] = [];
  const where = [accessPrefilter(ctx, params), 'l.number IS NOT NULL'];
  if (from) { params.push(from); where.push(`l.archived_at >= ($${params.length}::date AT TIME ZONE 'Asia/Baghdad')`); }
  if (to) { params.push(to); where.push(`l.archived_at < (($${params.length}::date + 1) AT TIME ZONE 'Asia/Baghdad')`); }
  if (unitId) { params.push(descendants(ctx, unitId)); where.push(`l.unit_id = ANY($${params.length}::int[])`); }
  const rows = await q<any>(`${LETTER_SELECT} WHERE ${where.join(' AND ')} ORDER BY l.archived_at, l.id`, params);
  return rows.filter(r => canView(ctx, r));
}
const period = (qs: any) => {
  const year = baghdadToday().slice(0, 4);
  return { from: day(qs.from, 'From') || `${year}-01-01`, to: day(qs.to, 'To') || baghdadToday(), unitId: qs.unitId ? int(qs.unitId, 'Unit') : null };
};

router.get('/stats/dashboard', h(async (ctx, req, res) => {
  const p = period(req.query);
  const rows = await visibleLetters(ctx, p.from, p.to, p.unitId);
  const today = baghdadToday();
  const isOpen = (l: any) => OPEN.includes(l.status);
  const isOverdue = (l: any) => isOpen(l) && l.due_date && l.due_date < today;
  const byUnit = new Map<string, any>();
  for (const l of rows) {
    const u = byUnit.get(l.unit_code) || { unitCode: l.unit_code, unitId: l.unit_id, incoming: 0, outgoing: 0, mutalaat: 0, reports: 0, open: 0, overdue: 0 };
    if (l.archive_type === 'letter' && l.direction === 'IN') u.incoming++;
    if (l.archive_type === 'letter' && l.direction === 'OUT') u.outgoing++;
    if (l.archive_type === 'mutalaa') u.mutalaat++;
    if (l.archive_type === 'report') u.reports++;
    if (isOpen(l)) u.open++;
    if (isOverdue(l)) u.overdue++;
    byUnit.set(l.unit_code, u);
  }
  const units = [...byUnit.values()].sort((a, b) => a.unitCode.localeCompare(b.unitCode));
  const sum = (k: string) => units.reduce((s, u) => s + u[k], 0);
  const cats = await q<any>('SELECT id, name_ar, name_en FROM las_categories');
  const byCategory = cats.map(c => ({ id: c.id, nameAr: c.name_ar, nameEn: c.name_en, count: rows.filter(l => l.category_id === c.id).length })).filter(c => c.count > 0);
  res.json({ success: true, data: { ...p, totals: { incoming: sum('incoming'), outgoing: sum('outgoing'), mutalaat: sum('mutalaat'), reports: sum('reports'), open: sum('open'), overdue: sum('overdue') }, byUnit: units, byCategory } });
}));

// FR-7.2: the daily register, printable as the official paper register
router.get('/stats/register', h(async (ctx, req, res) => {
  const date = day(req.query.date, 'Date') || baghdadToday();
  const direction = oneOf(req.query.direction, 'Register', ['IN', 'OUT'] as const, 'IN');
  const unitId = req.query.unitId ? int(req.query.unitId, 'Unit') : null;
  const rows = (await visibleLetters(ctx, date, date, unitId)).filter(l => l.archive_type === 'letter' && l.direction === direction);
  const contacts = new Map((await q<any>('SELECT id, name FROM las_contacts')).map(c => [c.id, c.name]));
  await audit(ctx, 'ExportReport', 'Register', null, null, { date, direction, unitId, rows: rows.length });
  res.json({
    success: true,
    data: {
      date, direction,
      rows: rows.map(l => ({
        id: l.id, number: l.number, unitCode: l.unit_code, subject: l.confidentiality === 'Normal' ? l.subject : '—',
        party: l.scope === 'external' ? contacts.get(l.contact_id) || '' : (l.direction === 'IN' ? l.external_ref_no : (l.to_unit_ids || []).map((id: number) => ctx.units.get(id)?.code).join(', ')),
        externalRefNo: l.external_ref_no, letterDate: l.letter_date, scope: l.scope, urgency: l.urgency, confidentiality: l.confidentiality,
        archivedAt: l.archived_at, archivedByName: l.archived_by_name, status: l.status,
      })),
    },
  });
}));

// FR-7.3: average response time and overdue list per unit
router.get('/stats/performance', h(async (ctx, req, res) => {
  const p = period(req.query);
  const rows = (await visibleLetters(ctx, p.from, p.to, p.unitId)).filter(l => l.archive_type === 'letter' && l.direction === 'IN');
  const today = baghdadToday();
  const groups = new Map<number, any>();
  // Each incoming letter counts for its own unit and for every unit above it (department, directorate ...).
  for (const l of rows) {
    for (const id of ancestors(ctx, l.unit_id)) {
      const u = ctx.units.get(id)!;
      const g = groups.get(id) || { unitId: id, unitCode: u.code, nameAr: u.nameAr, nameEn: u.nameEn, type: u.type, received: 0, answered: 0, totalDays: 0, open: 0, overdue: 0 };
      g.received++;
      const done = l.followup_closed_at || l.closed_at;
      if (done && l.archived_at) { g.answered++; g.totalDays += Math.max(0, (new Date(done).getTime() - new Date(l.archived_at).getTime()) / 86400000); }
      if (OPEN.includes(l.status)) { g.open++; if (l.due_date && l.due_date < today) g.overdue++; }
      groups.set(id, g);
    }
  }
  const units = [...groups.values()].map(g => ({ ...g, avgDays: g.answered ? Math.round((g.totalDays / g.answered) * 10) / 10 : null, totalDays: undefined }))
    .sort((a, b) => a.unitCode.localeCompare(b.unitCode));
  const overdue = rows.filter(l => OPEN.includes(l.status) && l.due_date && l.due_date < today)
    .map(l => ({ id: l.id, number: l.number, unitCode: l.unit_code, subject: l.confidentiality === 'Normal' ? l.subject : '—', dueDate: l.due_date, status: l.status,
      daysLate: Math.round((new Date(today).getTime() - new Date(l.due_date).getTime()) / 86400000) }));
  res.json({ success: true, data: { ...p, units, overdue } });
}));

// ---- audit screen (SL-9): administrators and auditors, read-only -------------------------------
router.get('/audit', h(async (ctx, req, res) => {
  const auditorUnits = unitsOfRole(ctx, 'viewer');
  if (!ctx.isSysAdmin && auditorUnits.length === 0) throw forbidden('Only administrators and auditors can read the audit log.');
  const p = req.query as Record<string, string>;
  const params: any[] = []; const where: string[] = ['TRUE'];
  const add = (sql: string, v: any) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
  if (p.user) add('(user_name ILIKE ? )', `%${str(p.user, 'User', 100)}%`);
  if (p.unit) add('unit_code = ?', str(p.unit, 'Unit', 30));
  if (p.record) add('record_number ILIKE ?', `%${str(p.record, 'Record', 80)}%`);
  if (p.action) add('action = ?', str(p.action, 'Action', 60));
  if (p.ip) add('client_ip = ?', str(p.ip, 'IP', 60));
  if (p.from) add(`ts >= (?::date AT TIME ZONE 'Asia/Baghdad')`, day(p.from, 'From'));
  if (p.to) add(`ts < ((?::date + 1) AT TIME ZONE 'Asia/Baghdad')`, day(p.to, 'To'));
  // An auditor reads the log of the scope assigned to them (their units' codes).
  if (!ctx.isSysAdmin) add('unit_code = ANY(?::text[])', auditorUnits.map(id => ctx.units.get(id)!.code));
  const limit = Math.min(int(p.limit, 'Limit') || 200, 1000);
  const rows = await q<any>(`SELECT * FROM las_audit WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ${limit}`, params);
  res.json({ success: true, data: rows.map(camel), chain: lastChainCheck });
}));
function unitsOfRole(ctx: Ctx, role: string): number[] {
  const out = new Set<number>();
  for (const r of ctx.roles) if (r.role === role) (r.scope === 'tree' ? descendants(ctx, r.unitId) : [r.unitId]).forEach(id => out.add(id));
  return [...out];
}

router.get('/audit/verify', h(async (ctx, _req, res) => {
  adminOnly(ctx);
  res.json({ success: true, data: await verifyAuditChain() });
}));

export default router;
