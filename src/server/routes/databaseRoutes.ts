import { Router } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { users, roles, roleAuditLogs, tickets, ticketComments, departments } from '../../db/schema.ts';
import { logger } from '../utils/logger.ts';

const router = Router();

// Middleware to check if user is admin
const requireAdmin = async (req: AuthRequest, res: any, next: any) => {
  if (req.user?.role !== 'Admin' && req.user?.email !== 'admin@system.local' && req.user?.userType !== 'System Admin') {
    return res.status(403).json({ error: 'Requires System Admin role to export database' });
  }
  next();
};

// Helper to escape SQL string values
function sqlEscape(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (Array.isArray(val)) {
    // Format postgres text array literal: ARRAY['val1', 'val2']
    const items = val.map(item => `'${String(item).replace(/'/g, "''")}'`).join(', ');
    return `ARRAY[${items}]`;
  }
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

// Generate SQL Dump text
function generateSqlDump(data: {
  departments: any[];
  users: any[];
  roles: any[];
  roleAuditLogs: any[];
  tickets: any[];
  ticketComments: any[];
  systemSettings?: any;
  teams?: any;
  exportedAt: string;
}): string {
  const lines: string[] = [];

  lines.push(`-- ====================================================================`);
  lines.push(`-- CRPD IT Ticketing & Management System - Database Backup`);
  lines.push(`-- Generated At: ${data.exportedAt}`);
  lines.push(`-- Database Engine: PostgreSQL / Cloud SQL`);
  lines.push(`-- ====================================================================`);
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  // 1. Departments table
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`-- Table: departments (${data.departments.length} records)`);
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`CREATE TABLE IF NOT EXISTS departments (`);
  lines.push(`  id SERIAL PRIMARY KEY,`);
  lines.push(`  name TEXT NOT NULL,`);
  lines.push(`  description TEXT,`);
  lines.push(`  parent_id INTEGER,`);
  lines.push(`  manager_id TEXT,`);
  lines.push(`  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,`);
  lines.push(`  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  lines.push(`);`);
  lines.push('');
  for (const dept of data.departments) {
    lines.push(
      `INSERT INTO departments (id, name, description, parent_id, manager_id, created_at, updated_at) VALUES (${dept.id}, ${sqlEscape(dept.name)}, ${sqlEscape(dept.description)}, ${sqlEscape(dept.parentId)}, ${sqlEscape(dept.managerId)}, ${sqlEscape(dept.createdAt)}, ${sqlEscape(dept.updatedAt)}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, parent_id = EXCLUDED.parent_id, manager_id = EXCLUDED.manager_id, updated_at = EXCLUDED.updated_at;`
    );
  }
  if (data.departments.length > 0) {
    lines.push(`SELECT setval(pg_get_serial_sequence('departments', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM departments;`);
  }
  lines.push('');

  // 2. Users table
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`-- Table: users (${data.users.length} records)`);
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`CREATE TABLE IF NOT EXISTS users (`);
  lines.push(`  id SERIAL PRIMARY KEY,`);
  lines.push(`  uid TEXT NOT NULL UNIQUE,`);
  lines.push(`  user_name TEXT,`);
  lines.push(`  email TEXT NOT NULL,`);
  lines.push(`  email_confirmed BOOLEAN DEFAULT FALSE,`);
  lines.push(`  full_name TEXT NOT NULL,`);
  lines.push(`  department TEXT,`);
  lines.push(`  job_title TEXT,`);
  lines.push(`  role TEXT NOT NULL DEFAULT 'Employee',`);
  lines.push(`  user_type TEXT DEFAULT 'Operational User',`);
  lines.push(`  failed_access_count INTEGER DEFAULT 0,`);
  lines.push(`  lockout_end TEXT,`);
  lines.push(`  is_locked_out BOOLEAN DEFAULT FALSE,`);
  lines.push(`  must_change_password BOOLEAN DEFAULT FALSE,`);
  lines.push(`  two_factor_enabled BOOLEAN DEFAULT FALSE,`);
  lines.push(`  two_factor_secret TEXT,`);
  lines.push(`  password_hash TEXT,`);
  lines.push(`  password_min_length INTEGER DEFAULT 8,`);
  lines.push(`  password_require_special BOOLEAN DEFAULT FALSE,`);
  lines.push(`  password_require_number BOOLEAN DEFAULT FALSE,`);
  lines.push(`  password_require_uppercase BOOLEAN DEFAULT FALSE,`);
  lines.push(`  password_require_lowercase BOOLEAN DEFAULT FALSE,`);
  lines.push(`  password_last_changed_at TIMESTAMP,`);
  lines.push(`  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,`);
  lines.push(`  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,`);
  lines.push(`  avatar_color TEXT,`);
  lines.push(`  phone TEXT`);
  lines.push(`);`);
  lines.push('');
  for (const u of data.users) {
    lines.push(
      `INSERT INTO users (id, uid, user_name, email, email_confirmed, full_name, department, job_title, role, user_type, failed_access_count, lockout_end, is_locked_out, must_change_password, two_factor_enabled, two_factor_secret, password_hash, password_min_length, password_require_special, password_require_number, password_require_uppercase, password_require_lowercase, password_last_changed_at, created_at, last_active_at, avatar_color, phone) VALUES (` +
      `${u.id}, ${sqlEscape(u.uid)}, ${sqlEscape(u.userName)}, ${sqlEscape(u.email)}, ${sqlEscape(u.emailConfirmed)}, ${sqlEscape(u.fullName)}, ${sqlEscape(u.department)}, ${sqlEscape(u.jobTitle)}, ${sqlEscape(u.role)}, ${sqlEscape(u.userType)}, ${sqlEscape(u.failedAccessCount)}, ${sqlEscape(u.lockoutEnd)}, ${sqlEscape(u.isLockedOut)}, ${sqlEscape(u.mustChangePassword)}, ${sqlEscape(u.twoFactorEnabled)}, ${sqlEscape(u.twoFactorSecret)}, ${sqlEscape(u.passwordHash)}, ${sqlEscape(u.passwordMinLength)}, ${sqlEscape(u.passwordRequireSpecial)}, ${sqlEscape(u.passwordRequireNumber)}, ${sqlEscape(u.passwordRequireUppercase)}, ${sqlEscape(u.passwordRequireLowercase)}, ${sqlEscape(u.passwordLastChangedAt)}, ${sqlEscape(u.createdAt)}, ${sqlEscape(u.lastActiveAt)}, ${sqlEscape(u.avatarColor)}, ${sqlEscape(u.phone)}) ` +
      `ON CONFLICT (uid) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, role = EXCLUDED.role, department = EXCLUDED.department, job_title = EXCLUDED.job_title;`
    );
  }
  if (data.users.length > 0) {
    lines.push(`SELECT setval(pg_get_serial_sequence('users', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM users;`);
  }
  lines.push('');

  // 3. Roles table
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`-- Table: roles (${data.roles.length} records)`);
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`CREATE TABLE IF NOT EXISTS roles (`);
  lines.push(`  id SERIAL PRIMARY KEY,`);
  lines.push(`  name TEXT NOT NULL UNIQUE,`);
  lines.push(`  permissions TEXT[] NOT NULL DEFAULT '{}',`);
  lines.push(`  created_by TEXT,`);
  lines.push(`  is_deleted BOOLEAN DEFAULT FALSE,`);
  lines.push(`  deleted_at TIMESTAMP,`);
  lines.push(`  deleted_by TEXT,`);
  lines.push(`  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,`);
  lines.push(`  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  lines.push(`);`);
  lines.push('');
  for (const r of data.roles) {
    lines.push(
      `INSERT INTO roles (id, name, permissions, created_by, is_deleted, deleted_at, deleted_by, created_at, updated_at) VALUES (${r.id}, ${sqlEscape(r.name)}, ${sqlEscape(r.permissions)}, ${sqlEscape(r.createdBy)}, ${sqlEscape(r.isDeleted)}, ${sqlEscape(r.deletedAt)}, ${sqlEscape(r.deletedBy)}, ${sqlEscape(r.createdAt)}, ${sqlEscape(r.updatedAt)}) ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions, is_deleted = EXCLUDED.is_deleted, updated_at = EXCLUDED.updated_at;`
    );
  }
  if (data.roles.length > 0) {
    lines.push(`SELECT setval(pg_get_serial_sequence('roles', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM roles;`);
  }
  lines.push('');

  // 4. Role Audit Logs
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`-- Table: role_audit_logs (${data.roleAuditLogs.length} records)`);
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`CREATE TABLE IF NOT EXISTS role_audit_logs (`);
  lines.push(`  id SERIAL PRIMARY KEY,`);
  lines.push(`  role_id INTEGER NOT NULL,`);
  lines.push(`  action TEXT NOT NULL,`);
  lines.push(`  performed_by TEXT NOT NULL,`);
  lines.push(`  details TEXT,`);
  lines.push(`  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  lines.push(`);`);
  lines.push('');
  for (const log of data.roleAuditLogs) {
    lines.push(
      `INSERT INTO role_audit_logs (id, role_id, action, performed_by, details, created_at) VALUES (${log.id}, ${sqlEscape(log.roleId)}, ${sqlEscape(log.action)}, ${sqlEscape(log.performedBy)}, ${sqlEscape(log.details)}, ${sqlEscape(log.createdAt)}) ON CONFLICT (id) DO NOTHING;`
    );
  }
  if (data.roleAuditLogs.length > 0) {
    lines.push(`SELECT setval(pg_get_serial_sequence('role_audit_logs', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM role_audit_logs;`);
  }
  lines.push('');

  // 5. Tickets table
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`-- Table: tickets (${data.tickets.length} records)`);
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`CREATE TABLE IF NOT EXISTS tickets (`);
  lines.push(`  id SERIAL PRIMARY KEY,`);
  lines.push(`  title TEXT NOT NULL,`);
  lines.push(`  description TEXT NOT NULL,`);
  lines.push(`  status TEXT NOT NULL DEFAULT 'Open',`);
  lines.push(`  priority TEXT NOT NULL DEFAULT 'Medium',`);
  lines.push(`  department TEXT,`);
  lines.push(`  created_by TEXT,`);
  lines.push(`  assigned_to TEXT,`);
  lines.push(`  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,`);
  lines.push(`  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  lines.push(`);`);
  lines.push('');
  for (const t of data.tickets) {
    lines.push(
      `INSERT INTO tickets (id, title, description, status, priority, department, created_by, assigned_to, created_at, updated_at) VALUES (${t.id}, ${sqlEscape(t.title)}, ${sqlEscape(t.description)}, ${sqlEscape(t.status)}, ${sqlEscape(t.priority)}, ${sqlEscape(t.department)}, ${sqlEscape(t.createdBy)}, ${sqlEscape(t.assignedTo)}, ${sqlEscape(t.createdAt)}, ${sqlEscape(t.updatedAt)}) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, status = EXCLUDED.status, priority = EXCLUDED.priority, updated_at = EXCLUDED.updated_at;`
    );
  }
  if (data.tickets.length > 0) {
    lines.push(`SELECT setval(pg_get_serial_sequence('tickets', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM tickets;`);
  }
  lines.push('');

  // 6. Ticket Comments
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`-- Table: ticket_comments (${data.ticketComments.length} records)`);
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`CREATE TABLE IF NOT EXISTS ticket_comments (`);
  lines.push(`  id SERIAL PRIMARY KEY,`);
  lines.push(`  ticket_id INTEGER NOT NULL,`);
  lines.push(`  author_id TEXT NOT NULL,`);
  lines.push(`  content TEXT NOT NULL,`);
  lines.push(`  is_internal BOOLEAN DEFAULT FALSE,`);
  lines.push(`  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  lines.push(`);`);
  lines.push('');
  for (const c of data.ticketComments) {
    lines.push(
      `INSERT INTO ticket_comments (id, ticket_id, author_id, content, is_internal, created_at) VALUES (${c.id}, ${sqlEscape(c.ticketId)}, ${sqlEscape(c.authorId)}, ${sqlEscape(c.content)}, ${sqlEscape(c.isInternal)}, ${sqlEscape(c.createdAt)}) ON CONFLICT (id) DO NOTHING;`
    );
  }
  if (data.ticketComments.length > 0) {
    lines.push(`SELECT setval(pg_get_serial_sequence('ticket_comments', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM ticket_comments;`);
  }
  lines.push('');

  lines.push('COMMIT;');
  lines.push('');
  lines.push('-- ====================================================================');
  lines.push(`-- End of Backup (${data.exportedAt})`);
  lines.push('-- ====================================================================');

  return lines.join('\n');
}

// GET /api/database/stats - Quick stats on all database tables
router.get('/stats', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [allUsers, allRoles, allAuditLogs, allTickets, allComments, allDepartments] = await Promise.all([
      db.select().from(users),
      db.select().from(roles),
      db.select().from(roleAuditLogs),
      db.select().from(tickets),
      db.select().from(ticketComments),
      db.select().from(departments),
    ]);

    const counts = {
      departments: allDepartments.length,
      users: allUsers.length,
      roles: allRoles.length,
      roleAuditLogs: allAuditLogs.length,
      tickets: allTickets.length,
      ticketComments: allComments.length,
      totalRecords: allDepartments.length + allUsers.length + allRoles.length + allAuditLogs.length + allTickets.length + allComments.length,
    };

    res.json({
      success: true,
      database: {
        engine: 'PostgreSQL',
        host: process.env.SQL_HOST ? 'Cloud SQL' : 'Local / Connected',
        name: process.env.SQL_DB_NAME || 'crpd_db',
        orm: 'Drizzle ORM',
        status: 'Connected & Ready'
      },
      counts,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Failed to get database stats: {ErrorMessage}', { ErrorMessage: error.message });
    res.status(500).json({ error: 'Failed to retrieve database stats' });
  }
});

// GET or POST /api/database/export - Download full database export (JSON or SQL)
const handleExport = async (req: AuthRequest, res: any) => {
  try {
    const format = (req.query.format as string || req.body?.format || 'json').toLowerCase();
    const clientSettings = req.body?.systemSettings;
    const clientTeams = req.body?.teams;
    const clientTickets = req.body?.tickets;

    const [allUsers, allRoles, allAuditLogs, allTickets, allComments, allDepartments] = await Promise.all([
      db.select().from(users),
      db.select().from(roles),
      db.select().from(roleAuditLogs),
      db.select().from(tickets),
      db.select().from(ticketComments),
      db.select().from(departments),
    ]);

    const exportedAt = new Date().toISOString();
    const dateStr = exportedAt.replace(/[:.]/g, '-').slice(0, 19);

    logger.information('Database export generated ({Format}) by {AdminUser}', {
      Format: format.toUpperCase(),
      AdminUser: req.user?.email || 'System Admin',
      TotalRecords: allDepartments.length + allUsers.length + allRoles.length + allTickets.length
    });

    const exportPackage = {
      metadata: {
        system: 'CRPD IT Support & Management System',
        environment: 'Cloud Run / PostgreSQL (Cloud SQL)',
        exportedAt,
        exportedBy: req.user?.email || 'System Admin',
        databaseEngine: 'PostgreSQL 15+',
        tablesCount: 6,
        recordsSummary: {
          departments: allDepartments.length,
          users: allUsers.length,
          roles: allRoles.length,
          roleAuditLogs: allAuditLogs.length,
          tickets: (allTickets.length > 0 ? allTickets.length : (clientTickets?.length || 0)),
          ticketComments: allComments.length,
        }
      },
      database: {
        departments: allDepartments,
        users: allUsers,
        roles: allRoles,
        roleAuditLogs: allAuditLogs,
        tickets: allTickets.length > 0 ? allTickets : (clientTickets || []),
        ticketComments: allComments,
      },
      applicationConfig: {
        systemSettings: clientSettings || null,
        supportTeams: clientTeams || null,
      }
    };

    if (format === 'sql') {
      const sqlContent = generateSqlDump({
        departments: allDepartments,
        users: allUsers,
        roles: allRoles,
        roleAuditLogs: allAuditLogs,
        tickets: allTickets.length > 0 ? allTickets : (clientTickets || []),
        ticketComments: allComments,
        systemSettings: clientSettings,
        teams: clientTeams,
        exportedAt
      });

      res.setHeader('Content-Type', 'application/sql; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="crpd_db_backup_${dateStr}.sql"`);
      return res.send(sqlContent);
    }

    // Default: JSON format
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="crpd_db_backup_${dateStr}.json"`);
    return res.send(JSON.stringify(exportPackage, null, 2));

  } catch (error: any) {
    logger.error('Failed to export database: {ErrorMessage}', { ErrorMessage: error.message });
    res.status(500).json({ error: 'Failed to generate database export: ' + error.message });
  }
};

router.get('/export', requireAuth, requireAdmin, handleExport);
router.post('/export', requireAuth, requireAdmin, handleExport);

export default router;
