// src/server/db/initTicketTables.ts
import { createPool } from '../../db/index.ts';

export async function initTicketTables(): Promise<void> {
  const pool = createPool();

  try {
    const client = await pool.connect();
    try {
      // 1. Ensure core tables exist
      await client.query(`
        -- Departments Table
        CREATE TABLE IF NOT EXISTS departments (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          parent_id INTEGER,
          manager_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Users Table
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

        -- Roles Table
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

        -- Role Audit Logs Table
        CREATE TABLE IF NOT EXISTS role_audit_logs (
          id SERIAL PRIMARY KEY,
          role_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          performed_by TEXT NOT NULL,
          details TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- User Sessions Table
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

        -- Tickets Table
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
          requester_id TEXT NOT NULL DEFAULT 'USR-EMP-001',
          requester_name TEXT NOT NULL DEFAULT 'Employee',
          requester_email TEXT NOT NULL DEFAULT 'employee@company.gov',
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
          tags TEXT[] DEFAULT ARRAY[]::TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Add columns to tickets if they don't exist
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_no TEXT;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_type TEXT DEFAULT 'Hardware Maintenance';
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_team TEXT DEFAULT 'Technical Team';
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS team_id TEXT;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS hardware_device_type TEXT;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS target_system TEXT;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS user_request_action TEXT;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority_stars INTEGER DEFAULT 2;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'New';
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Hardware & Devices';
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requester_id TEXT DEFAULT 'USR-EMP-001';
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requester_name TEXT DEFAULT 'Employee';
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requester_email TEXT DEFAULT 'employee@company.gov';
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requester_dept TEXT DEFAULT 'IT Service Desk';
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requester_user_type TEXT DEFAULT 'Operational User';
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assignee_id TEXT;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assignee_name TEXT;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assignee_role TEXT;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS response_sla_minutes INTEGER DEFAULT 240;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_sla_minutes INTEGER DEFAULT 1440;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS response_due_at TIMESTAMP;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMP;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_response_breached BOOLEAN DEFAULT FALSE;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_resolution_breached BOOLEAN DEFAULT FALSE;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS dept_request TEXT;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS user_request_details TEXT;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS hardware_details TEXT;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];

        -- Ticket Comments
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

        ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS ticket_no TEXT;
        ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS author_name TEXT DEFAULT 'Support Agent';
        ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS author_role TEXT DEFAULT 'Employee';
        ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS author_user_type TEXT DEFAULT 'Operational User';
        ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS author_email TEXT DEFAULT '';
        ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT FALSE;

        -- Ticket History
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

        -- Ticket Attachments
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

        -- Support Teams
        CREATE TABLE IF NOT EXISTS support_teams (
          id SERIAL PRIMARY KEY,
          team_key TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          name_ar TEXT NOT NULL,
          type TEXT NOT NULL,
          description TEXT,
          description_ar TEXT,
          member_user_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
          lead_user_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- System Settings
        CREATE TABLE IF NOT EXISTS system_settings (
          id SERIAL PRIMARY KEY,
          setting_key TEXT UNIQUE NOT NULL DEFAULT 'default',
          max_picture_attachments INTEGER DEFAULT 3,
          max_attachment_size_bytes INTEGER DEFAULT 5242880,
          max_attachment_size_mb INTEGER DEFAULT 5,
          allowed_image_types TEXT[] DEFAULT ARRAY['image/jpeg', 'image/png']::TEXT[],
          sla_critical_hours INTEGER DEFAULT 4,
          sla_medium_hours INTEGER DEFAULT 24,
          sla_low_hours INTEGER DEFAULT 48,
          serilog_api_url TEXT,
          serilog_api_key TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Electronic Devices Table
        CREATE TABLE IF NOT EXISTS electronic_devices (
          id SERIAL PRIMARY KEY,
          device_code TEXT UNIQUE NOT NULL,
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
          purchase_receipt JSONB,
          organization TEXT,
          directorate TEXT,
          division TEXT,
          folder_path TEXT,
          folder_hierarchy JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Safe column migrations for electronic_devices
        ALTER TABLE electronic_devices ADD COLUMN IF NOT EXISTS purchase_receipt JSONB;
        ALTER TABLE electronic_devices ADD COLUMN IF NOT EXISTS organization TEXT;
        ALTER TABLE electronic_devices ADD COLUMN IF NOT EXISTS directorate TEXT;
        ALTER TABLE electronic_devices ADD COLUMN IF NOT EXISTS division TEXT;
        ALTER TABLE electronic_devices ADD COLUMN IF NOT EXISTS folder_path TEXT;
        ALTER TABLE electronic_devices ADD COLUMN IF NOT EXISTS folder_hierarchy JSONB;

        -- Assets Table
        CREATE TABLE IF NOT EXISTS assets (
          id SERIAL PRIMARY KEY,
          asset_code TEXT UNIQUE NOT NULL,
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

        -- Maintenance Table
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

        -- Maintenance & Assets Indices
        CREATE INDEX IF NOT EXISTS idx_assets_code ON assets(asset_code);
        CREATE INDEX IF NOT EXISTS idx_assets_dept ON assets(department);
        CREATE INDEX IF NOT EXISTS idx_maintenance_asset_id ON maintenance(asset_id);

        -- Migration: older databases linked maintenance.asset_id to the legacy assets table, but
        -- the app records maintenance against electronic_devices. Re-point the foreign key.
        -- NOT VALID keeps any historic rows; new rows are checked against electronic_devices.
        DO $$
        DECLARE c RECORD;
        BEGIN
          FOR c IN
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'maintenance'::regclass AND contype = 'f'
              AND confrelid = 'assets'::regclass
          LOOP
            EXECUTE format('ALTER TABLE maintenance DROP CONSTRAINT %I', c.conname);
          END LOOP;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'maintenance'::regclass AND contype = 'f'
              AND confrelid = 'electronic_devices'::regclass
          ) THEN
            ALTER TABLE maintenance ADD CONSTRAINT maintenance_asset_id_device_fkey
              FOREIGN KEY (asset_id) REFERENCES electronic_devices(id) ON DELETE CASCADE NOT VALID;
          END IF;
        END $$;
        CREATE INDEX IF NOT EXISTS idx_maintenance_ticket_id ON maintenance(ticket_id);
        CREATE INDEX IF NOT EXISTS idx_maintenance_requester_id ON maintenance(requester_id);

        -- User Notifications Table
        CREATE TABLE IF NOT EXISTS user_notifications (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          user_email TEXT,
          type TEXT NOT NULL,
          title_ar TEXT NOT NULL,
          title_en TEXT NOT NULL,
          message_ar TEXT NOT NULL,
          message_en TEXT NOT NULL,
          ticket_id TEXT,
          ticket_title TEXT,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
      `);

      // Try grants if user exists
      try {
        await client.query(`
          GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ai_studio_app_user;
          GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ai_studio_app_user;
        `);
      } catch (_) {}

      // 2. Seed initial default support teams if empty
      const teamsCount = await client.query('SELECT COUNT(*) FROM support_teams');
      if (parseInt(teamsCount.rows[0].count, 10) === 0) {
        await client.query(`
          INSERT INTO support_teams (team_key, name, name_ar, type, description, description_ar, member_user_ids, lead_user_id)
          VALUES 
            ('tech-team', 'Technical Team', 'الفريق الفني للعتاد والأجهزة', 'Technical Team', 'Specialized team for physical machines, barcode scanners, printers and hardware maintenance.', 'فريق الصيانة الميدانية للأجهزة، الطابعات، أجهزة البصمة والماسحات الضوئية.', ARRAY['admin_uid_seed'], 'admin_uid_seed'),
            ('db-admin-team', 'Database and Systems Admins', 'إدارة قواعد البيانات والأنظمة', 'Database and Systems Admins', 'Core systems administration, database migrations, backups and application servers.', 'إدارة قواعد البيانات ونظام IMS والأرشفة والصلاحيات المركزية.', ARRAY['admin_uid_seed'], 'admin_uid_seed'),
            ('security-team', 'Security Team', 'فريق أمن المعلومات والامتثال', 'Security Team', 'SOC / Cybersecurity monitoring, audit tracking, policy enforcement and account lockouts.', 'فريق أمن المعلومات، تدقيق الصلاحيات ومكافحة التهديدات السيبرانية.', ARRAY['admin_uid_seed'], 'admin_uid_seed');
        `);
      }

      // 3. Seed default system settings if empty
      const settingsCount = await client.query('SELECT COUNT(*) FROM system_settings');
      if (parseInt(settingsCount.rows[0].count, 10) === 0) {
        await client.query(`
          INSERT INTO system_settings (setting_key, max_picture_attachments, max_attachment_size_bytes, max_attachment_size_mb, allowed_image_types, sla_critical_hours, sla_medium_hours, sla_low_hours)
          VALUES ('default', 3, 5242880, 5, ARRAY['image/jpeg', 'image/png'], 4, 24, 48);
        `);
      }

      console.log('✅ Ticket tables initialized and verified successfully in PostgreSQL database');
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('⚠️ Ticket tables initialization error:', err.message);
    if (err.message?.includes('failed to initialize properly') || err.message?.includes('could not open file "base/')) {
      console.log('🔄 Attempting recovery and retry for ticket tables initialization...');
      try {
        const { resetPgliteInstance } = await import('../../db/index.ts');
        resetPgliteInstance();
        const retryPool = createPool();
        const retryClient = await retryPool.connect();
        try {
          await initTicketTables();
        } finally {
          retryClient.release();
        }
      } catch (retryErr: any) {
        console.error('Ticket tables recovery retry failed:', retryErr.message);
      }
    }
  }
}

