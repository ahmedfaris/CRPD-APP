// Letters Archive System (LAS) — database tables and a small query helper.
// Units come from the existing organizational structure (departments table); every other
// LAS table is prefixed las_.
import { createPool } from '../../db/index.ts';

export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await createPool().query(text, params);
  return (res?.rows || []) as T[];
}
export async function q1<T = any>(text: string, params: any[] = []): Promise<T | null> {
  return (await q<T>(text, params))[0] || null;
}

const DDL = `
CREATE TABLE IF NOT EXISTS las_unit_codes (
  unit_id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS las_user_roles (
  id SERIAL PRIMARY KEY,
  user_uid TEXT NOT NULL,
  role TEXT NOT NULL,
  unit_id INTEGER NOT NULL,
  scope TEXT NOT NULL DEFAULT 'tree',
  valid_from DATE,
  valid_to DATE,
  delegated_by_uid TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_las_roles_user ON las_user_roles(user_uid);

CREATE TABLE IF NOT EXISTS las_categories (
  id SERIAL PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  default_due_days INTEGER,
  retention_years INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS las_contacts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  org_type TEXT NOT NULL DEFAULT 'other',
  address TEXT,
  phone TEXT,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS las_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS las_sequences (
  type TEXT NOT NULL,
  unit_code TEXT NOT NULL,
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (type, unit_code, year)
);

CREATE TABLE IF NOT EXISTS las_cases (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Open',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS las_letters (
  id SERIAL PRIMARY KEY,
  number TEXT UNIQUE,
  seq_type TEXT,
  archive_type TEXT NOT NULL,
  direction TEXT,
  scope TEXT,
  is_memo BOOLEAN NOT NULL DEFAULT FALSE,
  unit_id INTEGER NOT NULL,
  unit_code TEXT NOT NULL,
  head_office BOOLEAN NOT NULL DEFAULT FALSE,
  drafting_unit_id INTEGER,
  subject TEXT NOT NULL,
  summary TEXT,
  body TEXT,
  category_id INTEGER,
  urgency TEXT NOT NULL DEFAULT 'Normal',
  confidentiality TEXT NOT NULL DEFAULT 'Normal',
  status TEXT NOT NULL,
  letter_date DATE,
  received_or_sent_date DATE,
  external_ref_no TEXT,
  external_ref_date DATE,
  contact_id INTEGER,
  due_date DATE,
  followup_closed_at TIMESTAMPTZ,
  physical_location JSONB,
  retention_until DATE,
  case_id INTEGER,
  pages_count INTEGER,
  attachments_count INTEGER,
  source TEXT NOT NULL DEFAULT 'upload',
  source_letter_id INTEGER,
  reply_to_letter_id INTEGER,
  to_unit_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  cc_unit_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  cc_contact_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  named_user_uids JSONB NOT NULL DEFAULT '[]'::jsonb,
  reference_text TEXT,
  dispatch JSONB,
  folder_path TEXT,
  archived_by_uid TEXT,
  archived_by_name TEXT,
  archived_on_behalf_of TEXT,
  archived_at TIMESTAMPTZ,
  archived_from_ip TEXT,
  created_by_uid TEXT NOT NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified_by TEXT,
  last_modified_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  closed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_las_letters_unit ON las_letters(unit_id);
CREATE INDEX IF NOT EXISTS idx_las_letters_status ON las_letters(status);
CREATE INDEX IF NOT EXISTS idx_las_letters_archived ON las_letters(archived_at);
CREATE INDEX IF NOT EXISTS idx_las_letters_contact ON las_letters(contact_id, external_ref_no);

CREATE TABLE IF NOT EXISTS las_attachments (
  id SERIAL PRIMARY KEY,
  letter_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  is_original_scan BOOLEAN NOT NULL DEFAULT FALSE,
  kind TEXT NOT NULL DEFAULT 'attachment',
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_las_att_letter ON las_attachments(letter_id);

CREATE TABLE IF NOT EXISTS las_referrals (
  id SERIAL PRIMARY KEY,
  letter_id INTEGER NOT NULL,
  parent_referral_id INTEGER,
  from_uid TEXT NOT NULL,
  from_name TEXT,
  from_unit_id INTEGER,
  on_behalf_of TEXT,
  to_uid TEXT,
  to_unit_id INTEGER,
  instruction TEXT NOT NULL,
  note TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'Pending',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  acted_by_uid TEXT,
  acted_by_name TEXT,
  response_text TEXT
);
CREATE INDEX IF NOT EXISTS idx_las_ref_letter ON las_referrals(letter_id);
CREATE INDEX IF NOT EXISTS idx_las_ref_to ON las_referrals(to_uid, to_unit_id);

CREATE TABLE IF NOT EXISTS las_approvals (
  id SERIAL PRIMARY KEY,
  letter_id INTEGER NOT NULL,
  round INTEGER NOT NULL DEFAULT 1,
  step_no INTEGER NOT NULL,
  approver_unit_id INTEGER NOT NULL,
  approver_uid TEXT,
  approver_name TEXT,
  on_behalf_of TEXT,
  decision TEXT NOT NULL DEFAULT 'Pending',
  comment TEXT,
  decided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_las_appr_letter ON las_approvals(letter_id);

CREATE TABLE IF NOT EXISTS las_links (
  id SERIAL PRIMARY KEY,
  letter_id INTEGER NOT NULL,
  related_letter_id INTEGER NOT NULL,
  relation TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS las_internal_deliveries (
  id SERIAL PRIMARY KEY,
  out_letter_id INTEGER NOT NULL,
  in_letter_id INTEGER NOT NULL,
  receiving_unit_id INTEGER NOT NULL,
  is_cc BOOLEAN NOT NULL DEFAULT FALSE,
  received_by_uid TEXT,
  received_by_name TEXT,
  received_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS las_mutalaa_details (
  letter_id INTEGER PRIMARY KEY,
  addressed_unit_id INTEGER NOT NULL,
  current_level_unit_id INTEGER,
  background TEXT,
  analysis TEXT,
  recommendation TEXT,
  decision TEXT,
  directive_text TEXT,
  decided_by_uid TEXT,
  decided_by_name TEXT,
  decided_at TIMESTAMPTZ,
  execution_due DATE,
  execution_done_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS las_mutalaa_opinions (
  id SERIAL PRIMARY KEY,
  letter_id INTEGER NOT NULL,
  level_unit_id INTEGER NOT NULL,
  user_uid TEXT NOT NULL,
  user_name TEXT,
  opinion TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS las_report_details (
  letter_id INTEGER PRIMARY KEY,
  report_kind TEXT NOT NULL,
  period_from DATE,
  period_to DATE,
  version INTEGER NOT NULL DEFAULT 1,
  approval_status TEXT NOT NULL DEFAULT 'draft',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  authors TEXT,
  recipients TEXT,
  keywords TEXT
);

CREATE TABLE IF NOT EXISTS las_report_versions (
  id SERIAL PRIMARY KEY,
  letter_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  by_uid TEXT,
  by_name TEXT,
  at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS las_notifications (
  id SERIAL PRIMARY KEY,
  user_uid TEXT NOT NULL,
  letter_id INTEGER,
  kind TEXT NOT NULL,
  text_ar TEXT NOT NULL,
  text_en TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'app',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_las_notif_user ON las_notifications(user_uid, read_at);

-- Arabic-aware text normalization for search: case, diacritics, and أ/إ/آ→ا, ة→ه, ى→ي.
CREATE OR REPLACE FUNCTION las_norm(t TEXT) RETURNS TEXT AS $$
  SELECT translate(regexp_replace(lower(coalesce(t, '')), '[\u064B-\u0652\u0640]', '', 'g'), 'أإآةى', 'اااهي');
$$ LANGUAGE sql IMMUTABLE;

-- Audit log: append-only, hash-chained (each row stores the previous row's hash).
CREATE TABLE IF NOT EXISTS las_audit (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL,
  user_uid TEXT,
  user_name TEXT,
  unit_code TEXT,
  role TEXT,
  on_behalf_of TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  record_number TEXT,
  client_ip TEXT,
  correlation_id TEXT,
  session_id TEXT,
  details JSONB,
  prev_hash TEXT NOT NULL,
  row_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_las_audit_record ON las_audit(record_number);
CREATE INDEX IF NOT EXISTS idx_las_audit_ts ON las_audit(ts);

CREATE OR REPLACE FUNCTION las_audit_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'las_audit is append-only: rows cannot be changed or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS las_audit_no_change ON las_audit;
CREATE TRIGGER las_audit_no_change BEFORE UPDATE OR DELETE ON las_audit
  FOR EACH ROW EXECUTE FUNCTION las_audit_immutable();
DROP TRIGGER IF EXISTS las_audit_no_truncate ON las_audit;
CREATE TRIGGER las_audit_no_truncate BEFORE TRUNCATE ON las_audit
  FOR EACH STATEMENT EXECUTE FUNCTION las_audit_immutable();
`;

export async function initLasTables(): Promise<void> {
  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query(DDL);
    // Starter letter categories (lookup list the administrator can edit). Added once.
    const existing = await client.query('SELECT count(*)::int AS n FROM las_categories');
    if ((existing.rows?.[0]?.n ?? 0) === 0) {
      await client.query(`
        INSERT INTO las_categories (name_ar, name_en, default_due_days, retention_years) VALUES
          ('شكاوى', 'Complaints', 15, 10),
          ('تشريعات', 'Legislation', 30, 25),
          ('وزارات وجهات حكومية', 'Ministries', 14, 10),
          ('مشاريع', 'Projects', 30, 10),
          ('موارد بشرية', 'HR', 14, 10),
          ('مالية', 'Finance', 14, 10),
          ('عام', 'General', NULL, 5)
      `);
    }
  } finally {
    client.release();
  }
}
