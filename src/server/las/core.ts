// Letters Archive System — core rules: unit tree and codes, user context and roles,
// visibility and confidentiality, tamper-evident audit log, numbering and folder paths.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { AuthRequest, getEffectivePermissions } from '../../middleware/auth.ts';
import { logger } from '../utils/logger.ts';
import { q, q1 } from './db.ts';

// ---------------------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------------------
export type UnitType = 'org' | 'directorate' | 'department' | 'division';
export interface Unit {
  id: number;
  parentId: number | null;
  nameEn: string;
  nameAr: string;
  type: UnitType;
  code: string;
  active: boolean;
  managerId: string | null;
}

function parseUnitMeta(description: string | null): { nameAr: string; orgType: UnitType } {
  let meta: any = {};
  if (description && description.trim().startsWith('{')) {
    try { meta = JSON.parse(description); } catch { meta = {}; }
  }
  const t = ['org', 'directorate', 'department', 'division'].includes(meta.orgType) ? meta.orgType : 'department';
  return { nameAr: typeof meta.nameAr === 'string' ? meta.nameAr : '', orgType: t };
}

/**
 * Load the unit tree from the organizational structure and make sure every unit has a
 * permanent archive code (INS, D1, D1-02, D1-02-03 ...). Codes are assigned once and kept,
 * so renaming or moving a unit never changes numbers that were already issued.
 */
export async function loadUnits(): Promise<Map<number, Unit>> {
  const rows = await q<any>('SELECT id, name, description, parent_id, manager_id FROM departments ORDER BY id');
  const codes = await q<any>('SELECT unit_id, code, active FROM las_unit_codes');
  const codeOf = new Map<number, { code: string; active: boolean }>(codes.map(c => [c.unit_id, { code: c.code, active: c.active }]));
  const used = new Set<string>(codes.map(c => c.code));
  const byId = new Map<number, any>(rows.map(r => [r.id, r]));

  const depth = (r: any): number => {
    let d = 0; let cur = r; const seen = new Set<number>();
    while (cur?.parent_id && byId.has(cur.parent_id) && !seen.has(cur.id)) { seen.add(cur.id); cur = byId.get(cur.parent_id); d++; }
    return d;
  };
  const nextFree = (make: (n: number) => string): string => {
    for (let n = 1; n < 10000; n++) { const c = make(n); if (!used.has(c)) return c; }
    return make(Date.now());
  };

  for (const r of [...rows].sort((a, b) => depth(a) - depth(b) || a.id - b.id)) {
    if (codeOf.has(r.id)) continue;
    const meta = parseUnitMeta(r.description);
    const parentCode = r.parent_id ? codeOf.get(r.parent_id)?.code : undefined;
    let code: string;
    if (meta.orgType === 'org' && !parentCode) code = used.has('INS') ? nextFree(n => `INS${n + 1}`) : 'INS';
    else if (meta.orgType === 'directorate') code = nextFree(n => `D${n}`);
    else if (parentCode && parentCode !== 'INS' && !/^INS\d+$/.test(parentCode)) code = nextFree(n => `${parentCode}-${String(n).padStart(2, '0')}`);
    else if (parentCode) code = nextFree(n => `U${n}`); // a department placed directly under the institution
    else code = nextFree(n => `U${n}`);
    await q('INSERT INTO las_unit_codes (unit_id, code) VALUES ($1, $2) ON CONFLICT (unit_id) DO NOTHING', [r.id, code]);
    codeOf.set(r.id, { code, active: true });
    used.add(code);
  }

  const units = new Map<number, Unit>();
  for (const r of rows) {
    const meta = parseUnitMeta(r.description);
    const c = codeOf.get(r.id)!;
    units.set(r.id, {
      id: r.id, parentId: r.parent_id && byId.has(r.parent_id) ? r.parent_id : null, nameEn: r.name,
      nameAr: meta.nameAr || r.name, type: meta.orgType, code: c.code, active: c.active, managerId: r.manager_id || null,
    });
  }
  return units;
}

// ---------------------------------------------------------------------------------------
// User context, roles and visibility (sections 2.3 and 3 of the specification)
// ---------------------------------------------------------------------------------------
export const ROLES = ['chair', 'director', 'dept_head', 'division_head', 'clerk', 'employee', 'viewer'] as const;
export type LasRole = typeof ROLES[number];
export const HEAD_ROLES: LasRole[] = ['chair', 'director', 'dept_head', 'division_head'];

export interface RoleRow { id: number | null; role: LasRole; unitId: number; scope: 'unit' | 'tree'; delegatedBy: string | null; implicit?: boolean }
export interface Ctx {
  uid: string; name: string; email: string; isSysAdmin: boolean;
  roles: RoleRow[]; units: Map<number, Unit>; kids: Map<number, number[]>;
  ip: string; correlationId: string; sessionId: string;
}

export function baghdadToday(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export async function getCtx(req: AuthRequest): Promise<Ctx | null> {
  const uid = req.user?.uid;
  const eff = await getEffectivePermissions(uid);
  if (!uid || !eff) return null;
  const user = await q1<any>('SELECT full_name FROM users WHERE uid = $1', [uid]);
  const units = await loadUnits();
  const kids = new Map<number, number[]>();
  for (const u of units.values()) {
    if (u.parentId) kids.set(u.parentId, [...(kids.get(u.parentId) || []), u.id]);
  }
  const today = baghdadToday();
  const rows = await q<any>(
    `SELECT id, role, unit_id, scope, delegated_by_uid FROM las_user_roles
      WHERE user_uid = $1 AND (valid_from IS NULL OR valid_from <= $2::date) AND (valid_to IS NULL OR valid_to >= $2::date)`,
    [uid, today]);
  const roles: RoleRow[] = rows
    .filter(r => units.has(r.unit_id) && (ROLES as readonly string[]).includes(r.role))
    .map(r => ({ id: r.id, role: r.role, unitId: r.unit_id, scope: r.scope === 'unit' ? 'unit' : 'tree', delegatedBy: r.delegated_by_uid || null }));
  // A user with no archive role yet works as an employee of the unit named on their account.
  if (roles.length === 0 && eff.department) {
    const d = eff.department.trim().toLowerCase();
    const match = [...units.values()].find(u => u.nameEn.trim().toLowerCase() === d || u.nameAr.trim().toLowerCase() === d);
    if (match) roles.push({ id: null, role: 'employee', unitId: match.id, scope: 'unit', delegatedBy: null, implicit: true });
  }
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return {
    uid, name: user?.full_name || eff.email, email: eff.email,
    isSysAdmin: eff.permissions.includes('*'),
    roles, units, kids,
    ip: (process.env.TRUST_PROXY === 'true' && fwd) || req.ip || req.socket?.remoteAddress || '',
    correlationId: crypto.randomUUID(),
    sessionId: String((req as any).sessionId || ''),
  };
}

export function descendants(ctx: Ctx, unitId: number): number[] {
  const out: number[] = []; const stack = [unitId]; const seen = new Set<number>();
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id); out.push(id);
    stack.push(...(ctx.kids.get(id) || []));
  }
  return out;
}
/** The unit itself, then its parent, grandparent ... up to the institution. */
export function ancestors(ctx: Ctx, unitId: number): number[] {
  const out: number[] = []; let cur: number | null = unitId; const seen = new Set<number>();
  while (cur && ctx.units.has(cur) && !seen.has(cur)) { seen.add(cur); out.push(cur); cur = ctx.units.get(cur)!.parentId; }
  return out;
}
const covered = (ctx: Ctx, r: RoleRow): number[] => (r.scope === 'tree' ? descendants(ctx, r.unitId) : [r.unitId]);
const unitsFor = (ctx: Ctx, pick: (r: RoleRow) => boolean): Set<number> => {
  const s = new Set<number>();
  for (const r of ctx.roles) if (pick(r)) covered(ctx, r).forEach(id => s.add(id));
  return s;
};
/** Units whose records the user may browse: every role except "employee" (who sees only assigned items). */
export const viewUnits = (ctx: Ctx) => unitsFor(ctx, r => r.role !== 'employee');
/** Units the user heads (including the units below them). */
export const headUnits = (ctx: Ctx) => unitsFor(ctx, r => HEAD_ROLES.includes(r.role));
/** Units where the user is the head of that exact unit (used for approval and mutala'a steps). */
export const exactHeadUnits = (ctx: Ctx) => new Set(ctx.roles.filter(r => HEAD_ROLES.includes(r.role)).map(r => r.unitId));
/** Units the user may register letters for: correspondence clerks and heads. */
export const registryUnits = (ctx: Ctx) => unitsFor(ctx, r => r.role === 'clerk' || HEAD_ROLES.includes(r.role));
/** Units the user belongs to with a working role (can draft there). */
export const memberUnits = (ctx: Ctx) => new Set(ctx.roles.filter(r => r.role !== 'viewer').map(r => r.unitId));

/** When the user's only role covering a unit was delegated to them, returns who they act for. */
export function actingFor(ctx: Ctx, unitId: number, pick: (r: RoleRow) => boolean): string | null {
  const covering = ctx.roles.filter(r => pick(r) && covered(ctx, r).includes(unitId));
  if (covering.length === 0 || covering.some(r => !r.delegatedBy)) return null;
  return covering[0].delegatedBy;
}

export interface AccessRow {
  unit_id: number; confidentiality: string; created_by_uid: string; archived_by_uid: string | null;
  named_user_uids: string[] | null; ref_uids: string[] | null; ref_units: number[] | null;
  appr_units: number[] | null; mut_units: number[] | null;
}
/** Columns every query must select so canView() can decide (see AccessRow). */
export const ACCESS_COLS = `
  (SELECT coalesce(array_agg(DISTINCT r.to_uid) FILTER (WHERE r.to_uid IS NOT NULL), '{}') FROM las_referrals r WHERE r.letter_id = l.id AND r.status <> 'Recalled') AS ref_uids,
  (SELECT coalesce(array_agg(DISTINCT r.to_unit_id) FILTER (WHERE r.to_unit_id IS NOT NULL), '{}') FROM las_referrals r WHERE r.letter_id = l.id AND r.status <> 'Recalled') AS ref_units,
  (SELECT coalesce(array_agg(DISTINCT a.approver_unit_id), '{}') FROM las_approvals a WHERE a.letter_id = l.id) AS appr_units,
  (SELECT array_remove(ARRAY[m.current_level_unit_id, m.addressed_unit_id], NULL) FROM las_mutalaa_details m WHERE m.letter_id = l.id) AS mut_units`;

/**
 * May this user see this record?
 *  - Named people always: the creator, the registrar, named recipients, a person it was referred to.
 *  - The head who must approve it or decide on it.
 *  - Normal: the unit visibility rule (own unit and below), or a unit it was referred to.
 *  - Confidential: unit heads only (and named people).
 *  - Sensitive: named people only.
 *  - A system administrator without a business role sees Normal records only.
 */
export function canView(ctx: Ctx, l: AccessRow): boolean {
  const named = (l.named_user_uids || []).includes(ctx.uid) || l.created_by_uid === ctx.uid
    || l.archived_by_uid === ctx.uid || (l.ref_uids || []).includes(ctx.uid);
  if (named) return true;
  const exact = exactHeadUnits(ctx);
  if ((l.appr_units || []).some(u => exact.has(u)) || (l.mut_units || []).some(u => exact.has(u))) return true;
  if (l.confidentiality === 'Sensitive') return false;
  const refUnits = l.ref_units || [];
  if (l.confidentiality === 'Confidential') {
    const heads = headUnits(ctx);
    return heads.has(l.unit_id) || refUnits.some(u => heads.has(u));
  }
  const view = viewUnits(ctx);
  if (view.has(l.unit_id) || refUnits.some(u => view.has(u))) return true;
  return ctx.isSysAdmin;
}

/** SQL pre-filter matching canView() loosely; canView() is still applied to every row. */
export function accessPrefilter(ctx: Ctx, params: any[]): string {
  if (ctx.isSysAdmin) return 'TRUE';
  const view = [...viewUnits(ctx)];
  const exact = [...exactHeadUnits(ctx)];
  params.push(view); const pv = params.length;
  params.push(ctx.uid); const pu = params.length;
  params.push(exact); const pe = params.length;
  return `(l.unit_id = ANY($${pv}::int[]) OR l.created_by_uid = $${pu} OR l.archived_by_uid = $${pu}
    OR l.named_user_uids ? $${pu}
    OR l.id IN (SELECT letter_id FROM las_referrals WHERE status <> 'Recalled' AND (to_uid = $${pu} OR to_unit_id = ANY($${pv}::int[])))
    OR l.id IN (SELECT letter_id FROM las_approvals WHERE approver_unit_id = ANY($${pe}::int[]))
    OR l.id IN (SELECT letter_id FROM las_mutalaa_details WHERE current_level_unit_id = ANY($${pe}::int[]) OR addressed_unit_id = ANY($${pe}::int[])))`;
}

/** Active users holding one of the given roles at exactly this unit. */
export async function usersWithRoleAt(unitId: number, roles: LasRole[]): Promise<string[]> {
  const rows = await q<any>(
    `SELECT DISTINCT user_uid FROM las_user_roles WHERE unit_id = $1 AND role = ANY($2::text[])
      AND (valid_from IS NULL OR valid_from <= $3::date) AND (valid_to IS NULL OR valid_to >= $3::date)`,
    [unitId, roles, baghdadToday()]);
  return rows.map(r => r.user_uid);
}

export async function notify(uids: string[], letterId: number | null, kind: string, textAr: string, textEn: string) {
  for (const uid of [...new Set(uids)].filter(Boolean)) {
    await q('INSERT INTO las_notifications (user_uid, letter_id, kind, text_ar, text_en) VALUES ($1,$2,$3,$4,$5)', [uid, letterId, kind, textAr, textEn]);
  }
}

// ---------------------------------------------------------------------------------------
// Audit log (sections 4.9 and 7.7): append-only, hash-chained, structured (Serilog-style) events
// ---------------------------------------------------------------------------------------
const sha256 = (s: string | Buffer) => crypto.createHash('sha256').update(s).digest('hex');
/** Stable JSON (sorted keys) so the hash does not depend on how the database orders JSON keys. */
function canonical(v: any): string {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
const GENESIS = 'GENESIS';
let auditQueue: Promise<unknown> = Promise.resolve();
let lastHash: string | null = null;
const BUFFER_FILE = path.join(process.cwd(), 'logs', 'las-audit-buffer.jsonl');

function auditContent(r: any) {
  return {
    ts: new Date(r.ts).toISOString(), user_uid: r.user_uid || null, user_name: r.user_name || null, unit_code: r.unit_code || null,
    role: r.role || null, on_behalf_of: r.on_behalf_of || null, action: r.action, entity: r.entity, entity_id: r.entity_id || null,
    record_number: r.record_number || null, client_ip: r.client_ip || null, correlation_id: r.correlation_id || null, details: r.details || {},
  };
}

async function insertAuditRow(row: any) {
  if (lastHash === null) {
    const last = await q1<any>('SELECT row_hash FROM las_audit ORDER BY id DESC LIMIT 1');
    lastHash = last?.row_hash || GENESIS;
  }
  const rowHash = sha256(lastHash + canonical(auditContent(row)));
  await q(
    `INSERT INTO las_audit (ts, user_uid, user_name, unit_code, role, on_behalf_of, action, entity, entity_id, record_number,
       client_ip, correlation_id, session_id, details, prev_hash, row_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16)`,
    [row.ts, row.user_uid, row.user_name, row.unit_code, row.role, row.on_behalf_of, row.action, row.entity, row.entity_id,
      row.record_number, row.client_ip, row.correlation_id, row.session_id, JSON.stringify(row.details || {}), lastHash, rowHash]);
  lastHash = rowHash;
}

export interface AuditOpts { onBehalfOf?: string | null; failClosed?: boolean; unitCode?: string | null }
/**
 * Record a business operation. Details must hold ids, numbers, field names and metadata only —
 * never passwords, tokens or the text of letters.
 * With failClosed (confidential records) the caller's operation is refused if the event cannot
 * be stored; otherwise the event is buffered durably on disk and an alert is logged.
 */
export async function audit(ctx: Ctx | null, action: string, entity: string, entityId: string | number | null,
  recordNumber: string | null, details: Record<string, any> = {}, opts: AuditOpts = {}): Promise<void> {
  const primary = ctx?.roles[0];
  const row = {
    ts: new Date().toISOString(),
    user_uid: ctx?.uid || null, user_name: ctx?.name || null,
    unit_code: opts.unitCode ?? (primary ? ctx!.units.get(primary.unitId)?.code || null : null),
    role: ctx ? (primary?.role || (ctx.isSysAdmin ? 'sysadmin' : null)) : null,
    on_behalf_of: opts.onBehalfOf || null,
    action, entity, entity_id: entityId === null ? null : String(entityId), record_number: recordNumber,
    client_ip: ctx?.ip || null, correlation_id: ctx?.correlationId || null, session_id: ctx?.sessionId || null, details,
  };
  const run = auditQueue.then(() => insertAuditRow(row));
  auditQueue = run.catch(() => undefined);
  try {
    await run;
  } catch (err: any) {
    logger.error('Audit sink unavailable for {Action} {RecordNumber}: {Error}', { LogType: 'Technical', Action: action, RecordNumber: recordNumber, Error: err?.message });
    if (opts.failClosed) throw new Error('AUDIT_UNAVAILABLE');
    try {
      fs.mkdirSync(path.dirname(BUFFER_FILE), { recursive: true });
      fs.appendFileSync(BUFFER_FILE, JSON.stringify(row) + '\n', 'utf8');
    } catch { /* nothing more can be done here; the technical log above is the alert */ }
  }
  logger.information('{Action} {RecordType} {RecordNumber} in {UnitCode} by {UserName}', {
    LogType: 'Audit', Action: action, RecordType: entity, RecordNumber: recordNumber || String(entityId ?? ''), UnitCode: row.unit_code || '-',
    UserName: row.user_name || 'system', UserId: row.user_uid, Role: row.role, OnBehalfOf: row.on_behalf_of, ClientIp: row.client_ip,
    CorrelationId: row.correlation_id, SessionId: row.session_id,
  });
}

/** Store events that were buffered on disk while the audit table was unavailable. */
export async function flushAuditBuffer(): Promise<number> {
  if (!fs.existsSync(BUFFER_FILE)) return 0;
  const lines = fs.readFileSync(BUFFER_FILE, 'utf8').split('\n').filter(Boolean);
  let done = 0;
  for (const line of lines) {
    const row = JSON.parse(line);
    row.details = { ...(row.details || {}), bufferedAt: row.ts };
    const run = auditQueue.then(() => insertAuditRow(row));
    auditQueue = run.catch(() => undefined);
    await run;
    done++;
  }
  fs.unlinkSync(BUFFER_FILE);
  return done;
}

export let lastChainCheck: { at: string; ok: boolean; rows: number; brokenAtId: number | null } | null = null;
/** Recompute every row's hash from its content and the previous row's hash. */
export async function verifyAuditChain() {
  const rows = await q<any>('SELECT * FROM las_audit ORDER BY id ASC');
  let prev = GENESIS; let brokenAtId: number | null = null;
  for (const r of rows) {
    if (r.prev_hash !== prev || sha256(prev + canonical(auditContent(r))) !== r.row_hash) { brokenAtId = r.id; break; }
    prev = r.row_hash;
  }
  lastChainCheck = { at: new Date().toISOString(), ok: brokenAtId === null, rows: rows.length, brokenAtId };
  if (brokenAtId !== null) {
    logger.error('Audit hash chain is broken at row {RowId}', { LogType: 'Technical', RowId: brokenAtId, Alert: 'AUDIT_TAMPERING' });
  }
  return lastChainCheck;
}

// ---------------------------------------------------------------------------------------
// Settings and numbering (section 2.2)
// ---------------------------------------------------------------------------------------
export interface LasSettings {
  prefixes: Record<string, string>;
  numberFormat: string;
  seqPad: number;
  seqLevel: 'unit' | 'department' | 'directorate';
  reminderDays: number;
  institutionNameAr: string;
  institutionNameEn: string;
}
export const DEFAULT_SETTINGS: LasSettings = {
  prefixes: { IN: 'IN', OUT: 'OUT', MEMO: 'MEMO', MUT: 'MUT', RPT: 'RPT' },
  numberFormat: '{type}/{unit}/{year}/{seq}',
  seqPad: 4,
  seqLevel: 'unit',
  reminderDays: 2,
  institutionNameAr: 'لجنة حقوق الأشخاص ذوي الإعاقة',
  institutionNameEn: 'Committee for the Rights of Persons with Disabilities',
};
export async function getSettings(): Promise<LasSettings> {
  const rows = await q<any>('SELECT key, value FROM las_settings');
  const s: any = { ...DEFAULT_SETTINGS, prefixes: { ...DEFAULT_SETTINGS.prefixes } };
  for (const r of rows) {
    if (r.key === 'prefixes') s.prefixes = { ...s.prefixes, ...(r.value || {}) };
    else if (r.key in s) s[r.key] = r.value;
  }
  return s;
}

/** The unit whose sequence a record uses, per the administrator's numbering level. */
export function sequenceUnit(ctx: Ctx, unitId: number, level: LasSettings['seqLevel']): Unit {
  const chain = ancestors(ctx, unitId).map(id => ctx.units.get(id)!);
  if (level === 'unit') return chain[0];
  return chain.find(u => u.type === level) || chain[0];
}

/**
 * Issue the next number for a record. One SQL statement increments the sequence and writes
 * the number, so two users can never get the same number and a failure leaves no gap.
 */
export async function issueNumber(ctx: Ctx, letterId: number, seqType: 'IN' | 'OUT' | 'MEMO' | 'MUT' | 'RPT', unitId: number, headOffice: boolean): Promise<string> {
  const settings = await getSettings();
  const unit = sequenceUnit(ctx, unitId, settings.seqLevel);
  const unitCode = unit.code + (headOffice ? '-00' : '');
  const year = Number(baghdadToday().slice(0, 4));
  const prefix = settings.prefixes[seqType] || seqType;
  const row = await q1<any>(
    `WITH s AS (
       INSERT INTO las_sequences (type, unit_code, year, last_number) VALUES ($1, $2, $3::int, 1)
       ON CONFLICT (type, unit_code, year) DO UPDATE SET last_number = las_sequences.last_number + 1
       RETURNING last_number)
     UPDATE las_letters l
        SET number = replace(replace(replace(replace($4::text, '{type}', $5::text), '{unit}', $2::text), '{year}', ($3::int)::text),
                             '{seq}', lpad(s.last_number::text, $6::int, '0')),
            seq_type = $1
       FROM s WHERE l.id = $7::int AND l.number IS NULL
     RETURNING l.number`,
    [seqType, unitCode, year, settings.numberFormat, prefix, settings.seqPad, letterId]);
  if (!row?.number) throw new Error('NUMBER_NOT_ISSUED');
  return row.number;
}

// ---------------------------------------------------------------------------------------
// Folder structure and file storage (section 2.4). Files live outside the web root and are
// served only through permission checks.
// ---------------------------------------------------------------------------------------
export const ARCHIVE_ROOT = path.join(process.cwd(), 'letters archive');
const AR_MONTHS = ['كانون_الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين_الأول', 'تشرين_الثاني', 'كانون_الأول'];
const HEAD_OFFICE_NAMES: Record<UnitType, string> = { org: 'مكتب_رئيس_المؤسسة', directorate: 'مكتب_المدير', department: 'مكتب_رئيس_القسم', division: 'مكتب_مسؤول_الشعبة' };
export const TYPE_FOLDERS: Record<string, string> = { letter: '01_الكتب_الرسمية', mutalaa: '02_المطالعات', report: '03_التقارير' };
export const DIRECTION_FOLDERS: Record<string, string> = { 'OUT:internal': 'صادر_داخلي', 'OUT:external': 'صادر_خارجي', 'IN:internal': 'وارد_داخلي', 'IN:external': 'وارد_خارجي' };
export const REPORT_KIND_FOLDERS: Record<string, string> = { periodic: 'دورية', field_visit: 'زيارات_ميدانية', committee: 'لجان', statistical: 'احصائية', external: 'خارجية' };

export const safeSegment = (s: string) => String(s || '').normalize('NFC').trim().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_\-]/gu, '').slice(0, 80) || 'x';

/** Folder chain of a unit from the institution down; codes come first so renaming never breaks paths. */
export function unitFolder(ctx: Ctx, unitId: number, headOffice = false): string {
  const chain = ancestors(ctx, unitId).reverse().map(id => ctx.units.get(id)!);
  const parts = chain.map(u => `${u.code}_${safeSegment(u.nameAr)}`);
  if (headOffice) { const u = chain[chain.length - 1]; parts.push(`${u.code}-00_${HEAD_OFFICE_NAMES[u.type]}`); }
  return parts.join('/');
}

export function recordFolder(ctx: Ctx, l: any, reportKind?: string): string {
  const when = baghdadToday(l.archived_at ? new Date(l.archived_at) : new Date());
  const [year, month] = when.split('-');
  const parts = [unitFolder(ctx, l.unit_id, l.head_office), year, TYPE_FOLDERS[l.archive_type]];
  if (l.archive_type === 'letter') parts.push(DIRECTION_FOLDERS[`${l.direction}:${l.scope}`] || 'اخرى');
  if (l.archive_type === 'report') parts.push(REPORT_KIND_FOLDERS[reportKind || 'periodic'] || 'دورية');
  parts.push(`${month}_${AR_MONTHS[Number(month) - 1]}`);
  parts.push(l.number ? l.number.replace(/[^\p{L}\p{N}\-]+/gu, '_') : `DRAFT_${l.id}`);
  return parts.join('/');
}

/** Create the standard folders of every active unit for the current year. */
export async function ensureUnitFolders(ctx: Ctx): Promise<number> {
  const year = baghdadToday().slice(0, 4);
  let made = 0;
  for (const u of ctx.units.values()) {
    if (!u.active) continue;
    for (const headOffice of [false, true]) {
      if (headOffice && u.type === 'division') continue;
      const base = path.join(ARCHIVE_ROOT, unitFolder(ctx, u.id, headOffice), year);
      const dirs = [
        ...Object.values(DIRECTION_FOLDERS).map(d => path.join(base, TYPE_FOLDERS.letter, d)),
        path.join(base, TYPE_FOLDERS.mutalaa),
        ...Object.values(REPORT_KIND_FOLDERS).map(d => path.join(base, TYPE_FOLDERS.report, d)),
      ];
      for (const d of dirs) if (!fs.existsSync(d)) { fs.mkdirSync(d, { recursive: true }); made++; }
    }
  }
  return made;
}

const FILE_TYPES: Array<{ ext: string; mime: string; magic: (b: Buffer) => boolean }> = [
  { ext: 'pdf', mime: 'application/pdf', magic: b => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { ext: 'png', mime: 'image/png', magic: b => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'jpg', mime: 'image/jpeg', magic: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: b => b[0] === 0x50 && b[1] === 0x4b },
  { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: b => b[0] === 0x50 && b[1] === 0x4b },
  { ext: 'doc', mime: 'application/msword', magic: b => b.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])) },
];
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * Save an uploaded file (data URL) in the record's folder. The type is taken from the file's
 * real content, not its name; a SHA-256 checksum is stored to detect later tampering.
 */
export async function saveAttachment(ctx: Ctx, letter: any, file: { name?: string; dataUrl?: string; isOriginalScan?: boolean; kind?: string }, reportKind?: string, version = 1) {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(String(file?.dataUrl || ''));
  if (!m || !m[2]) throw new Error('FILE_INVALID');
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length === 0) throw new Error('FILE_EMPTY');
  if (buf.length > MAX_FILE_BYTES) throw new Error('FILE_TOO_LARGE');
  const wantedExt = String(file.name || '').toLowerCase().split('.').pop() || '';
  const type = FILE_TYPES.find(t => t.magic(buf) && (t.ext === wantedExt || (t.ext === 'jpg' && wantedExt === 'jpeg')))
    || FILE_TYPES.find(t => t.magic(buf));
  if (!type) throw new Error('FILE_TYPE_NOT_ALLOWED');

  const folder = recordFolder(ctx, letter, reportKind);
  const rec = folder.split('/').pop()!;
  const count = await q1<any>('SELECT count(*)::int AS n FROM las_attachments WHERE letter_id = $1 AND is_original_scan = $2', [letter.id, !!file.isOriginalScan]);
  const n = (count?.n || 0) + 1;
  const fileName = file.isOriginalScan
    ? (n === 1 ? `original_scan.${type.ext}` : `original_scan_v${n}.${type.ext}`)
    : `${rec}_att${String(n).padStart(2, '0')}.${type.ext}`;
  const rel = file.isOriginalScan ? `${folder}/${fileName}` : `${folder}/attachments/${fileName}`;
  const abs = path.join(ARCHIVE_ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf, { flag: 'wx' });
  const row = await q1<any>(
    `INSERT INTO las_attachments (letter_id, file_name, original_name, mime, size, storage_path, sha256, is_original_scan, kind, version, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [letter.id, fileName, String(file.name || fileName).slice(0, 200), type.mime, buf.length, rel, sha256(buf), !!file.isOriginalScan, file.kind || 'attachment', version, ctx.uid]);
  return row;
}

/** After a draft receives its number: move its folder to the final place and rename its files. */
export async function relocateLetterFiles(ctx: Ctx, before: any, after: any, reportKind?: string) {
  const atts = await q<any>('SELECT * FROM las_attachments WHERE letter_id = $1', [after.id]);
  const oldFolder = recordFolder(ctx, before, reportKind);
  const newFolder = recordFolder(ctx, after, reportKind);
  await q('UPDATE las_letters SET folder_path = $1 WHERE id = $2', [newFolder, after.id]);
  if (oldFolder === newFolder || atts.length === 0) return;
  const oldRec = oldFolder.split('/').pop()!; const newRec = newFolder.split('/').pop()!;
  for (const a of atts) {
    const newName = a.file_name.replace(oldRec, newRec);
    const rel = a.is_original_scan ? `${newFolder}/${newName}` : `${newFolder}/attachments/${newName}`;
    const from = path.join(ARCHIVE_ROOT, a.storage_path); const to = path.join(ARCHIVE_ROOT, rel);
    if (fs.existsSync(from)) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.renameSync(from, to); }
    await q('UPDATE las_attachments SET file_name = $1, storage_path = $2 WHERE id = $3', [newName, rel, a.id]);
  }
  try { fs.rmSync(path.join(ARCHIVE_ROOT, oldFolder), { recursive: true, force: true }); } catch { /* empty draft folder */ }
}

/** Read a stored file and check it against its checksum. */
export function readAttachment(a: any): Buffer {
  const abs = path.resolve(ARCHIVE_ROOT, a.storage_path);
  if (!abs.startsWith(path.resolve(ARCHIVE_ROOT) + path.sep)) throw new Error('PATH_INVALID');
  const buf = fs.readFileSync(abs);
  if (sha256(buf) !== a.sha256) throw new Error('CHECKSUM_MISMATCH');
  return buf;
}
