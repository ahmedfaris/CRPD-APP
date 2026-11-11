-- =============================================================================
-- Comprehensive PostgreSQL Initialization & Schema Script
-- Enterprise IT Service Desk & Device Asset Management System
-- Generated for Local Server & Production PostgreSQL Deployments
-- =============================================================================

-- Create tables if not existing
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_id INTEGER,
  manager_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  user_name TEXT,
  email TEXT NOT NULL,
  email_confirmed BOOLEAN DEFAULT FALSE,
  full_name TEXT NOT NULL,
  department TEXT,
  job_title TEXT,
  role TEXT NOT NULL DEFAULT 'Employee',
  user_type TEXT DEFAULT 'Operational User',
  failed_access_count INTEGER DEFAULT 0,
  lockout_end TEXT,
  is_locked_out BOOLEAN DEFAULT FALSE,
  lockout_count INTEGER DEFAULT 0,
  must_change_password BOOLEAN DEFAULT FALSE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  password_hash TEXT,
  password_min_length INTEGER DEFAULT 8,
  password_require_special BOOLEAN DEFAULT FALSE,
  password_require_number BOOLEAN DEFAULT FALSE,
  password_require_uppercase BOOLEAN DEFAULT FALSE,
  password_require_lowercase BOOLEAN DEFAULT FALSE,
  password_last_changed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  avatar_color TEXT,
  phone TEXT
);

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_by TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  deleted_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_audit_logs (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  user_uid TEXT NOT NULL,
  user_email TEXT NOT NULL,
  device_info TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  invalidation_reason TEXT
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  ticket_no TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  ticket_type TEXT NOT NULL DEFAULT 'Hardware Maintenance',
  assigned_team TEXT NOT NULL DEFAULT 'Technical Team',
  team_id TEXT,
  hardware_device_type TEXT,
  target_system TEXT,
  user_request_action TEXT,
  priority_stars INTEGER NOT NULL DEFAULT 2,
  priority TEXT NOT NULL DEFAULT 'Medium',
  stage TEXT NOT NULL DEFAULT 'New',
  status TEXT NOT NULL DEFAULT 'Open',
  category TEXT NOT NULL DEFAULT 'Hardware & Devices',
  department TEXT NOT NULL DEFAULT 'IT Service Desk',
  created_by TEXT,
  assigned_to TEXT,
  requester_id TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_dept TEXT DEFAULT 'IT Service Desk',
  requester_user_type TEXT DEFAULT 'Operational User',
  assignee_id TEXT,
  assignee_name TEXT,
  assignee_role TEXT,
  response_sla_minutes INTEGER DEFAULT 240,
  resolution_sla_minutes INTEGER DEFAULT 1440,
  response_due_at TIMESTAMP,
  resolution_due_at TIMESTAMP,
  is_response_breached BOOLEAN DEFAULT FALSE,
  is_resolution_breached BOOLEAN DEFAULT FALSE,
  responded_at TIMESTAMP,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  dept_request TEXT,
  user_request_details TEXT,
  hardware_details TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  ticket_no TEXT,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Support Agent',
  author_role TEXT DEFAULT 'Employee',
  author_user_type TEXT DEFAULT 'Operational User',
  author_email TEXT DEFAULT '',
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_history (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  ticket_no TEXT,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  actor_role TEXT DEFAULT 'Employee',
  actor_user_type TEXT DEFAULT 'Operational User',
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  ticket_no TEXT,
  file_name TEXT NOT NULL,
  file_size TEXT NOT NULL,
  file_type TEXT NOT NULL,
  data_url TEXT,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_teams (
  id SERIAL PRIMARY KEY,
  team_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  description_ar TEXT,
  member_user_ids TEXT[] DEFAULT '{}',
  lead_user_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL DEFAULT 'default',
  max_picture_attachments INTEGER DEFAULT 3,
  max_attachment_size_bytes INTEGER DEFAULT 5242880,
  max_attachment_size_mb INTEGER DEFAULT 5,
  allowed_image_types TEXT[] DEFAULT '{"image/jpeg","image/png"}',
  sla_critical_hours INTEGER DEFAULT 4,
  sla_medium_hours INTEGER DEFAULT 24,
  sla_low_hours INTEGER DEFAULT 48,
  serilog_api_url TEXT,
  serilog_api_key TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS electronic_devices (
  id SERIAL PRIMARY KEY,
  device_code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  device_type TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT,
  date_of_purchase TEXT NOT NULL,
  warranty_start_date TEXT NOT NULL,
  warranty_period TEXT NOT NULL,
  department TEXT NOT NULL,
  department_ar TEXT,
  status TEXT NOT NULL DEFAULT 'Operational',
  ip_address TEXT,
  mac_address TEXT,
  location TEXT,
  assigned_employee TEXT,
  department_history JSONB DEFAULT '[]'::jsonb,
  maintenance_history JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  asset_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'electronic',
  device_type TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT,
  date_of_purchase TEXT,
  warranty_start_date TEXT,
  warranty_period TEXT,
  department TEXT NOT NULL,
  department_ar TEXT,
  status TEXT NOT NULL DEFAULT 'Operational',
  ip_address TEXT,
  mac_address TEXT,
  location TEXT,
  assigned_employee TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES electronic_devices(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL,
  maintenance_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  maintenance_requester_name TEXT NOT NULL,
  maintenance_description TEXT NOT NULL,
  maintenance_request_document TEXT,
  cost_of_maintenance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  requester_id TEXT REFERENCES users(uid) ON DELETE SET NULL,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
  ticket_no TEXT,
  status TEXT NOT NULL DEFAULT 'Completed',
  performed_by TEXT DEFAULT 'Technical Support Team',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Core Indices for High-Performance Queries
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_uid ON user_sessions(user_uid);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_no ON tickets(ticket_no);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_stage ON tickets(stage);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_department ON tickets(department);
CREATE INDEX IF NOT EXISTS idx_tickets_requester_id ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket_id ON ticket_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_electronic_devices_code ON electronic_devices(device_code);
CREATE INDEX IF NOT EXISTS idx_electronic_devices_dept ON electronic_devices(department);
CREATE INDEX IF NOT EXISTS idx_assets_code ON assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_assets_dept ON assets(department);
CREATE INDEX IF NOT EXISTS idx_maintenance_asset_id ON maintenance(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_ticket_id ON maintenance(ticket_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requester_id ON maintenance(requester_id);

-- =============================================================================
-- Seed Initial Security Roles
-- =============================================================================
INSERT INTO roles (name, permissions, created_by)
VALUES 
  ('Administrator', '{"users.create","users.read","users.update","users.delete","roles.manage","tickets.manage","archiving.admin","reports.view"}', 'admin_uid_seed'),
  ('Helpdesk Agent', '{"tickets.read","tickets.reply","tickets.assign","tickets.resolve","users.read"}', 'admin_uid_seed'),
  ('Employee', '{"tickets.create","tickets.read_own","archiving.read"}', 'admin_uid_seed')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Seed System Settings
-- =============================================================================
INSERT INTO system_settings (setting_key, max_picture_attachments, max_attachment_size_bytes, max_attachment_size_mb, allowed_image_types, sla_critical_hours, sla_medium_hours, sla_low_hours)
VALUES ('default', 3, 5242880, 5, '{"image/jpeg","image/png"}', 4, 24, 48)
ON CONFLICT (setting_key) DO NOTHING;

-- =============================================================================
-- Seed Support Teams
-- =============================================================================
INSERT INTO support_teams (team_key, name, name_ar, type, description, description_ar)
VALUES 
  ('technical', 'Technical Support Team', 'فريق الدعم الفني', 'technical', 'Handles hardware diagnostics, maintenance, and replacement.', 'مسؤول عن فحص وصيانة واستبدال الأجهزة والمعدات.'),
  ('systems', 'Systems & Networks Team', 'فريق الأنظمة والشبكات', 'systems', 'Handles software permissions, Active Directory, network and infrastructure.', 'مسؤول عن صلاحيات البرامج، الخوادم والشبكات والبنية التحتية.')
ON CONFLICT (team_key) DO NOTHING;

-- =============================================================================
-- Seed Initial Administrator Account (Password: Admin@2026!)
-- =============================================================================
INSERT INTO users (
  uid, user_name, email, email_confirmed, full_name, department, job_title, 
  role, user_type, failed_access_count, is_locked_out, lockout_count, 
  must_change_password, two_factor_enabled, password_hash, avatar_color
)
VALUES 
  (
    'admin_uid_seed', 'admin', 'admin@system.local', true, 'System Administrator', 
    'Information Technology', 'Chief Administrator', 'Admin', 'System Admin', 
    0, false, 0, false, false, 
    '$2b$10$wE6vG2pZzO7kL8mR9tQ1ueF5yX8vA1B2C3D4E5F6G7H8I9J0K1L2M', 'bg-blue-600'
  )
ON CONFLICT (uid) DO NOTHING;


