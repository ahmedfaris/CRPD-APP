// Letters Archive System — small HTTP helpers shared by the route files.
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { logger } from '../utils/logger.ts';
import { Ctx, getCtx, ACCESS_COLS, canView, AccessRow } from './core.ts';
import { q1 } from './db.ts';

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, any> = {}) { super(message); }
}
export const bad = (msg: string, extra?: Record<string, any>) => new HttpError(400, msg, extra);
export const forbidden = (msg = 'You do not have permission for this action.') => new HttpError(403, msg);
export const notFound = (what = 'Record') => new HttpError(404, `${what} not found.`);

const KNOWN: Record<string, [number, string]> = {
  AUDIT_UNAVAILABLE: [503, 'The audit log is unavailable, so this operation on a confidential record was refused. Try again shortly.'],
  FILE_INVALID: [400, 'The file could not be read. Upload it again.'],
  FILE_EMPTY: [400, 'The file is empty.'],
  FILE_TOO_LARGE: [400, 'The file is larger than 25 MB.'],
  FILE_TYPE_NOT_ALLOWED: [400, 'Only PDF, JPG, PNG, Word and Excel files are accepted.'],
  CHECKSUM_MISMATCH: [500, 'The stored file does not match its checksum. It may have been changed outside the system.'],
  NUMBER_NOT_ISSUED: [409, 'The number could not be issued. Try again.'],
};

/** Wrap a handler: builds the user context and turns errors into clear JSON responses. */
export const h = (fn: (ctx: Ctx, req: AuthRequest, res: Response) => Promise<any>) =>
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = await getCtx(req);
      if (!ctx) return res.status(401).json({ success: false, error: 'Sign in again.' });
      await fn(ctx, req, res);
    } catch (e: any) {
      if (e instanceof HttpError) return res.status(e.status).json({ success: false, error: e.message, ...e.extra });
      const known = KNOWN[e?.message];
      if (known) return res.status(known[0]).json({ success: false, error: known[1], code: e.message });
      logger.error('LAS request failed on {Path}: {Error}', { LogType: 'Technical', Path: req.originalUrl?.split('?')[0], Error: e?.message });
      res.status(500).json({ success: false, error: 'The request could not be completed.' });
    }
  };

// ---- input helpers -------------------------------------------------------------------
export function str(v: any, label: string, max: number, required = false): string | null {
  if (v === undefined || v === null || v === '') { if (required) throw bad(`${label} is required.`); return null; }
  if (typeof v !== 'string') throw bad(`${label} is not valid.`);
  const t = v.trim();
  if (!t) { if (required) throw bad(`${label} is required.`); return null; }
  if (t.length > max) throw bad(`${label} must be at most ${max} characters.`);
  return t;
}
export function day(v: any, label: string, required = false): string | null {
  if (v === undefined || v === null || v === '') { if (required) throw bad(`${label} is required.`); return null; }
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(new Date(s + 'T00:00:00Z').getTime())) throw bad(`${label} must be a date (YYYY-MM-DD).`);
  return s;
}
export function int(v: any, label: string, required = false, min = 0, max = 1_000_000): number | null {
  if (v === undefined || v === null || v === '') { if (required) throw bad(`${label} is required.`); return null; }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${label} must be a whole number.`);
  return n;
}
export function oneOf<T extends string>(v: any, label: string, allowed: readonly T[], fallback?: T): T {
  if ((v === undefined || v === null || v === '') && fallback !== undefined) return fallback;
  if (!allowed.includes(v)) throw bad(`${label} must be one of: ${allowed.join(', ')}.`);
  return v;
}
export function idList(v: any, label: string, max = 50): number[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > max || v.some(x => !Number.isInteger(Number(x)))) throw bad(`${label} is not valid.`);
  return [...new Set(v.map(Number))];
}
export function uidList(v: any, label: string, max = 50): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > max || v.some(x => typeof x !== 'string' || x.length > 100)) throw bad(`${label} is not valid.`);
  return [...new Set(v as string[])];
}
export const paramId = (v: any): number => {
  if (!/^\d+$/.test(String(v ?? ''))) throw bad('The record ID is not valid.');
  return Number(v);
};

/** snake_case row -> camelCase object for the client. */
export function camel(row: any): any {
  if (!row || typeof row !== 'object' || Array.isArray(row) || row instanceof Date) return row;
  const out: any = {};
  for (const [k, v] of Object.entries(row)) out[k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())] = v;
  return out;
}

// ---- letters ---------------------------------------------------------------------------
/** Dates are returned as plain YYYY-MM-DD text so time zones never shift them. */
export const LETTER_SELECT = `SELECT l.*, l.letter_date::text AS letter_date, l.received_or_sent_date::text AS received_or_sent_date,
  l.external_ref_date::text AS external_ref_date, l.due_date::text AS due_date, l.retention_until::text AS retention_until, ${ACCESS_COLS}
  FROM las_letters l`;

export async function loadLetter(ctx: Ctx, id: number): Promise<any> {
  const l = await q1<any>(`${LETTER_SELECT} WHERE l.id = $1`, [id]);
  if (!l) throw notFound('Record');
  if (!canView(ctx, l as AccessRow)) throw forbidden('You do not have access to this record.');
  return l;
}
export const READ_ONLY_STATUSES = ['Closed', 'Archived', 'Cancelled', 'Rejected'];
export const URGENCIES = ['Normal', 'Urgent', 'Very urgent'] as const;
export const CONFIDENTIALITIES = ['Normal', 'Confidential', 'Sensitive'] as const;
export const isConfidential = (l: any) => l.confidentiality !== 'Normal';
