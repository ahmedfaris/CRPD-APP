import { pgTable, serial, text, timestamp, boolean, integer, jsonb, numeric, type AnyPgColumn } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Stable application user ID
  userName: text('user_name'),
  email: text('email').notNull(),
  emailConfirmed: boolean('email_confirmed').default(false),
  fullName: text('full_name').notNull(),
  department: text('department'),
  jobTitle: text('job_title'),
  role: text('role').notNull().default('Employee'), // 'Admin' | 'Agent' | 'Employee'
  userType: text('user_type').default('Operator'), // 'Technical' | 'Operator' | 'System Admin'
  failedAccessCount: integer('failed_access_count').default(0),
  lockoutEnd: text('lockout_end'),
  isLockedOut: boolean('is_locked_out').default(false),
  lockoutCount: integer('lockout_count').default(0),
  mustChangePassword: boolean('must_change_password').default(false),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  twoFactorSecret: text('two_factor_secret'),
  passwordHash: text('password_hash'),
  passwordMinLength: integer('password_min_length').default(8),
  passwordRequireSpecial: boolean('password_require_special').default(false),
  passwordRequireNumber: boolean('password_require_number').default(false),
  passwordRequireUppercase: boolean('password_require_uppercase').default(false),
  passwordRequireLowercase: boolean('password_require_lowercase').default(false),
  passwordLastChangedAt: timestamp('password_last_changed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  lastActiveAt: timestamp('last_active_at').defaultNow(),
  avatarColor: text('avatar_color'),
  phone: text('phone')
});

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  permissions: text('permissions').array().notNull().default([]), // array of strings
  createdBy: text('created_by').references(() => users.uid),
  isDeleted: boolean('is_deleted').default(false),
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by').references(() => users.uid),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const roleAuditLogs = pgTable('role_audit_logs', {
  id: serial('id').primaryKey(),
  roleId: integer('role_id').references(() => roles.id).notNull(),
  action: text('action').notNull(), // 'CREATE', 'EDIT', 'DELETE'
  performedBy: text('performed_by').references(() => users.uid).notNull(),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  ticketNo: text('ticket_no'), // Formatted ticket number e.g. TCK-2026-1042
  title: text('title').notNull(),
  description: text('description').notNull(),
  ticketType: text('ticket_type').notNull().default('Hardware Maintenance'), // 'Hardware Maintenance' | 'Systems Troubleshoot' | 'User Request'
  assignedTeam: text('assigned_team').notNull().default('Technical Team'),
  teamId: text('team_id'),
  hardwareDeviceType: text('hardware_device_type'),
  targetSystem: text('target_system'),
  userRequestAction: text('user_request_action'),
  priorityStars: integer('priority_stars').notNull().default(2), // 1 | 2 | 3
  priority: text('priority').notNull().default('Medium'), // 'Low', 'Medium', 'High', 'Critical'
  stage: text('stage').notNull().default('New'), // 'New', 'Triaged', 'In Progress', 'Pending Review', 'Resolved', 'Closed'
  status: text('status').notNull().default('Open'), // 'New', 'Open', 'In Progress', 'Pending Customer', 'Resolved', 'Closed'
  category: text('category').notNull().default('Hardware & Devices'),
  department: text('department').notNull().default('IT Service Desk'),
  createdBy: text('created_by'), // Creator user ID / UID
  assignedTo: text('assigned_to'), // Assigned user ID / UID
  requesterId: text('requester_id').notNull(),
  requesterName: text('requester_name').notNull(),
  requesterEmail: text('requester_email').notNull(),
  requesterDept: text('requester_dept').default('IT Service Desk'),
  requesterUserType: text('requester_user_type').default('Operational User'),
  assigneeId: text('assignee_id'),
  assigneeName: text('assignee_name'),
  assigneeRole: text('assignee_role'),
  responseSlaMinutes: integer('response_sla_minutes').default(240),
  resolutionSlaMinutes: integer('resolution_sla_minutes').default(1440),
  responseDueAt: timestamp('response_due_at'),
  resolutionDueAt: timestamp('resolution_due_at'),
  isResponseBreached: boolean('is_response_breached').default(false),
  isResolutionBreached: boolean('is_resolution_breached').default(false),
  respondedAt: timestamp('responded_at'),
  resolvedAt: timestamp('resolved_at'),
  closedAt: timestamp('closed_at'),
  deptRequest: text('dept_request'), // JSON serialized DepartmentRequestDoc
  userRequestDetails: text('user_request_details'), // JSON serialized
  hardwareDetails: text('hardware_details'), // JSON serialized
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const ticketComments = pgTable('ticket_comments', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').references(() => tickets.id).notNull(),
  ticketNo: text('ticket_no'),
  authorId: text('author_id').notNull(),
  authorName: text('author_name').notNull().default('Support Agent'),
  authorRole: text('author_role').default('Employee'),
  authorUserType: text('author_user_type').default('Operational User'),
  authorEmail: text('author_email').default(''),
  content: text('content').notNull(),
  isInternal: boolean('is_internal').default(false), // True if internal note for agents
  createdAt: timestamp('created_at').defaultNow(),
});

export const ticketHistory = pgTable('ticket_history', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').references(() => tickets.id).notNull(),
  ticketNo: text('ticket_no'),
  actorId: text('actor_id'),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').default('Employee'),
  actorUserType: text('actor_user_type').default('Operational User'),
  action: text('action').notNull(), // 'Ticket Created', 'Status Changed', 'Assigned', etc.
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const ticketAttachments = pgTable('ticket_attachments', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').references(() => tickets.id).notNull(),
  ticketNo: text('ticket_no'),
  fileName: text('file_name').notNull(),
  fileSize: text('file_size').notNull(),
  fileType: text('file_type').notNull(),
  dataUrl: text('data_url'),
  uploadedBy: text('uploaded_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const supportTeams = pgTable('support_teams', {
  id: serial('id').primaryKey(),
  teamKey: text('team_key').unique().notNull(),
  name: text('name').notNull(),
  nameAr: text('name_ar').notNull(),
  type: text('type').notNull(),
  description: text('description'),
  descriptionAr: text('description_ar'),
  memberUserIds: text('member_user_ids').array().default([]),
  leadUserId: text('lead_user_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  settingKey: text('setting_key').unique().notNull().default('default'),
  maxPictureAttachments: integer('max_picture_attachments').default(3),
  maxAttachmentSizeBytes: integer('max_attachment_size_bytes').default(5242880),
  maxAttachmentSizeMB: integer('max_attachment_size_mb').default(5),
  allowedImageTypes: text('allowed_image_types').array().default(['image/jpeg', 'image/png']),
  slaCriticalHours: integer('sla_critical_hours').default(4),
  slaMediumHours: integer('sla_medium_hours').default(24),
  slaLowHours: integer('sla_low_hours').default(48),
  serilogApiUrl: text('serilog_api_url'),
  serilogApiKey: text('serilog_api_key'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  parentId: integer('parent_id').references((): AnyPgColumn => departments.id),
  managerId: text('manager_id').references(() => users.uid),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userSessions = pgTable('user_sessions', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull().unique(),
  userUid: text('user_uid').notNull(),
  userEmail: text('user_email').notNull(),
  deviceInfo: text('device_info'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  isActive: boolean('is_active').default(true),
  invalidationReason: text('invalidation_reason'),
});

export const electronicDevices = pgTable('electronic_devices', {
  id: serial('id').primaryKey(),
  deviceCode: text('device_code').notNull().unique(),
  category: text('category').notNull(), // 'electronic' | 'network'
  deviceType: text('device_type').notNull(), // Computer, Printer, Screen, Fingerprint device, Scanner, router, switch, access point
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  serialNumber: text('serial_number'),
  dateOfPurchase: text('date_of_purchase').notNull(),
  warrantyStartDate: text('warranty_start_date').notNull(),
  warrantyPeriod: text('warranty_period').notNull(),
  department: text('department').notNull(),
  departmentAr: text('department_ar'),
  organization: text('organization'),
  directorate: text('directorate'),
  division: text('division'),
  folderPath: text('folder_path'),
  folderHierarchy: jsonb('folder_hierarchy'),
  status: text('status').notNull().default('Operational'),
  ipAddress: text('ip_address'),
  macAddress: text('mac_address'),
  location: text('location'),
  assignedEmployee: text('assigned_employee'),
  departmentHistory: jsonb('department_history').default([]),
  maintenanceHistory: jsonb('maintenance_history').default([]),
  notes: text('notes'),
  purchaseReceipt: jsonb('purchase_receipt'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Assets Table
 * Represents physical and IT organizational assets (Computers, Printers, Screens, Scanners, etc.)
 */
export const assets = pgTable('assets', {
  id: serial('id').primaryKey(),
  assetCode: text('asset_code').notNull().unique(), // e.g. AST-2026-001 or DEV-2024-001
  name: text('name').notNull(),
  category: text('category').notNull().default('electronic'), // 'electronic' | 'network' | 'hardware'
  deviceType: text('device_type').notNull(), // Computer, Printer, Screen, Fingerprint device, Scanner, router, switch, etc.
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  serialNumber: text('serial_number'),
  dateOfPurchase: text('date_of_purchase'),
  warrantyStartDate: text('warranty_start_date'),
  warrantyPeriod: text('warranty_period'),
  department: text('department').notNull(),
  departmentAr: text('department_ar'),
  status: text('status').notNull().default('Operational'), // 'Operational' | 'Under Maintenance' | 'Storage' | 'Retired'
  ipAddress: text('ip_address'),
  macAddress: text('mac_address'),
  location: text('location'),
  assignedEmployee: text('assigned_employee'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Maintenance Table
 * Records maintenance events, linking:
 * - ID field
 * - Asset ID field connected to assets table (foreign key)
 * - Maintenance Type
 * - Maintenance Date
 * - Maintenance Requester Name connected to the user who generated the hardware ticket
 * - Maintenance Description
 * - Maintenance Request Document (same document uploaded during ticket creation)
 * - Cost of Maintenance
 * - Associated ticket ID and user ID for deep relational integrity
 */
export const maintenance = pgTable('maintenance', {
  id: serial('id').primaryKey(),
  assetId: integer('asset_id').references(() => assets.id).notNull(),
  maintenanceType: text('maintenance_type').notNull(), // Routine, Hardware Repair, Component Replacement, Emergency, Inspection
  maintenanceDate: timestamp('maintenance_date').defaultNow().notNull(),
  maintenanceRequesterName: text('maintenance_requester_name').notNull(), // Requester name connected to user who generated ticket
  maintenanceDescription: text('maintenance_description').notNull(),
  maintenanceRequestDocument: text('maintenance_request_document'), // JSON string or URL of document uploaded during ticket creation
  costOfMaintenance: numeric('cost_of_maintenance', { precision: 12, scale: 2 }).notNull().default('0.00'),

  // Relational connections to hardware ticket and requester user
  requesterId: text('requester_id').references(() => users.uid),
  ticketId: integer('ticket_id').references(() => tickets.id),
  ticketNo: text('ticket_no'),
  status: text('status').notNull().default('Completed'), // 'Scheduled' | 'In Progress' | 'Completed' | 'Pending Parts'
  performedBy: text('performed_by').default('Technical Support Team'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Alias for convenience
export const maintenances = maintenance;

export const userNotifications = pgTable('user_notifications', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  userEmail: text('user_email'),
  type: text('type').notNull(), // 'NEW_TICKET' | 'NEW_COMMENT'
  titleAr: text('title_ar').notNull(),
  titleEn: text('title_en').notNull(),
  messageAr: text('message_ar').notNull(),
  messageEn: text('message_en').notNull(),
  ticketId: text('ticket_id'),
  ticketTitle: text('ticket_title'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});


