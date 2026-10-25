export type ApplicationRole = 'Admin' | 'Agent' | 'Employee' | (string & {});

export type UserType = 
  | 'Technical' 
  | 'Operator' 
  | 'Technical User' 
  | 'Operational User' 
  | 'System Admin' 
  | (string & {});

/**
 * Helper to determine if a user has Technical privileges:
 * Can join ticket support teams and solve tickets.
 */
export const isUserTechnical = (user?: { userType?: string; role?: string; email?: string } | null): boolean => {
  if (!user) return false;
  const t = (user.userType || '').toLowerCase().trim();
  const r = (user.role || '').toLowerCase().trim();
  const e = (user.email || '').toLowerCase().trim();
  if (e === 'admin@system.local') return true;
  if (t === 'technical' || t === 'technical user' || t.includes('tech') || t.includes('فني')) return true;
  if (r === 'admin' || r === 'administrator' || t === 'system admin' || t.includes('admin') || r.includes('admin')) return true;
  if (r === 'agent' || r === 'helpdesk agent' || r.includes('tech') || r.includes('support')) return true;
  return false;
};

/**
 * Helper to determine if a user has Operator privileges:
 * Can only create tickets and view tickets created by the user or belonging to their department.
 */
export const isUserOperator = (user?: { userType?: string; role?: string } | null): boolean => {
  if (!user) return false;
  const t = (user.userType || '').toLowerCase().trim();
  if (t === 'operator' || t === 'operational user') return true;
  if (!isUserTechnical(user)) return true;
  return false;
};

export type PriorityStars = 1 | 2 | 3; // 1 = Low (★☆☆), 2 = Medium (★★☆), 3 = High/Urgent (★★★)

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type TicketStage = 'New' | 'Triaged' | 'In Progress' | 'Pending Review' | 'Resolved' | 'Closed';

export type TicketStatus = 'New' | 'Open' | 'In Progress' | 'Pending Customer' | 'Resolved' | 'Closed';

export type TicketType = 
  | 'Hardware Maintenance' 
  | 'Systems Troubleshoot' 
  | 'User Request';

export type DeviceCategory = 'electronic' | 'network';

export type ElectronicDeviceType = 
  | 'Computer'
  | 'Printer'
  | 'Screen'
  | 'Fingerprint device'
  | 'Scanner';

export type NetworkDeviceType = 
  | 'router'
  | 'switch'
  | 'access point';

export type DeviceType = ElectronicDeviceType | NetworkDeviceType | string;

export interface DeviceDepartmentHistoryItem {
  id: string;
  department: string;
  departmentAr?: string;
  assignedDate: string; // YYYY-MM-DD
  transferredDate?: string; // YYYY-MM-DD
  transferredBy?: string;
  reason?: string;
}

export interface DeviceMaintenanceItem {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'Routine' | 'Repair' | 'Upgrade' | 'Inspection' | 'Replacement';
  description: string;
  performedBy: string;
  cost?: number;
  status: 'Completed' | 'In Progress' | 'Scheduled';
  notes?: string;
}

export interface AssetRecord {
  id: number;
  assetCode: string;
  name: string;
  category: DeviceCategory | string;
  deviceType: DeviceType;
  brand: string;
  model: string;
  serialNumber?: string;
  dateOfPurchase?: string;
  warrantyStartDate?: string;
  warrantyPeriod?: string;
  department: string;
  departmentAr?: string;
  status: 'Operational' | 'Under Maintenance' | 'Storage' | 'Retired' | string;
  ipAddress?: string;
  macAddress?: string;
  location?: string;
  assignedEmployee?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MaintenanceRecord {
  id: number;
  assetId: number;
  assetName?: string;
  assetCode?: string;
  maintenanceType: string;
  maintenanceDate: string; // ISO date string
  maintenanceRequesterName: string; // Connected to the user who generated the hardware ticket
  maintenanceDescription: string;
  maintenanceRequestDocument?: string | DepartmentRequestDoc | null; // Same document uploaded during ticket creation
  costOfMaintenance: number | string;
  requesterId?: string;
  ticketId?: number;
  ticketNo?: string;
  status?: 'Scheduled' | 'In Progress' | 'Completed' | string;
  performedBy?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeviceReceiptAttachment {
  name: string;
  size?: number;
  type?: string;
  dataUrl?: string; // Base64 data URL or storage URL
  uploadedAt?: string;
}

export interface DeviceFolderHierarchy {
  organization?: string;
  organizationAr?: string;
  directorate: string;
  directorateAr?: string;
  department: string;
  departmentAr?: string;
  division?: string;
  divisionAr?: string;
  deviceFolderName: string;
  relativePath: string;
  fullPath?: string;
}

export interface ElectronicDevice {
  id: string;
  deviceCode: string; // DEV-2026-001
  category: DeviceCategory; // 'electronic' | 'network'
  deviceType: DeviceType; // Computer, Printer, Screen, Fingerprint device, Scanner, router, switch, access point
  brand: string;
  model: string;
  serialNumber?: string;
  dateOfPurchase: string; // YYYY-MM-DD
  warrantyStartDate: string; // YYYY-MM-DD
  warrantyPeriod: string; // e.g. "12 Months", "24 Months", "3 Years"
  warrantyPeriodMonths?: number;
  warrantyExpiryDate?: string;
  isWarrantyActive?: boolean;
  department: string; // current department
  departmentAr?: string;
  organization?: string;
  directorate?: string;
  division?: string;
  folderPath?: string;
  folderHierarchy?: DeviceFolderHierarchy;
  status: 'Operational' | 'Under Maintenance' | 'Storage' | 'Retired';
  ipAddress?: string;
  macAddress?: string;
  location?: string;
  assignedEmployee?: string;
  departmentHistory: DeviceDepartmentHistoryItem[];
  maintenanceHistory: DeviceMaintenanceItem[];
  notes?: string;
  purchaseReceipt?: DeviceReceiptAttachment | string;
  createdAt: string;
  updatedAt: string;
}

export type HardwareDeviceType = 
  | 'Computer'
  | 'Printer'
  | 'FingerPrint Device'
  | 'Scanner'
  | 'Network Device'
  | 'Other Device';

export type SupportedInformationSystem = 
  | 'Old IMS'
  | 'New IMS'
  | '2FA'
  | 'Active Directory'
  | 'Enterprise ERP'
  | 'Document Archiving'
  | 'Corporate Email & 365'
  | 'Organizational Structure'
  | 'Asset Management'
  | 'Other System';

export type UserRequestAction = 
  | 'Create New User'
  | 'Delete User'
  | 'Modify User Account & Permissions'
  | 'Reset Password / Unlock Account'
  | 'Role & Privilege Elevation'
  | 'Other Request';

export type TeamType = 
  | 'Technical Team' 
  | 'Database and Systems Admins' 
  | 'Security Team';

export type AssignedSupportTeam = 
  | 'Technical Team'
  | 'Database and Systems Admins'
  | 'Security Team'
  | string;

export interface SupportTeam {
  id: string;
  name: string;
  nameAr: string;
  type: TeamType;
  description: string;
  descriptionAr: string;
  memberUserIds: string[];
  leadUserId?: string;
  passwordMinLength?: number;
  passwordRequireSpecial?: boolean;
  passwordRequireNumber?: boolean;
  passwordRequireUppercase?: boolean;
  passwordRequireLowercase?: boolean;
  passwordLastChangedAt?: string;
  createdAt: string;
}

export interface DepartmentRequestDoc {
  requestNumber: string;
  requestDate: string;
  fileName: string;
  fileSize: string;
  fileType: 'application/pdf' | string;
  source: 'PC Upload' | 'Hardware Scanner' | string;
  scannedAt?: string;
  uploadedAt?: string;
  filePath?: string; // Relative path on disk inside 'ticket requests'
  fileUrl?: string;  // Endpoint to download/view: /api/ticket-requests/...
  dataUrl?: string;  // URL or fallback Data URL
  storageType?: 'disk' | 'database';
}

export interface SystemSettings {
  maxPictureAttachments: number; // default: 3
  maxAttachmentSizeBytes: number; // default: 5 * 1024 * 1024 (5 MB)
  maxAttachmentSizeMB: number; // default: 5
  allowedImageTypes: string[]; // ['image/jpeg', 'image/png']
  slaCriticalHours: number; // default: 4
  slaMediumHours: number; // default: 24
  slaLowHours: number; // default: 48
  serilogApiUrl?: string; // external serilog API URL
  serilogApiKey?: string; // external serilog API Key
}

export type TicketCategory = 
  | 'Hardware & Devices'
  | 'Software & Applications'
  | 'Network & VPN'
  | 'Access & Identity'
  | 'Cloud & Infrastructure'
  | 'Security Incident'
  | 'Email & Messaging'
  | 'Facilities & General';

export type TicketDepartment = 
  | 'IT Service Desk'
  | 'Network Operations (NOC)'
  | 'Cybersecurity (SOC)'
  | 'Cloud Infrastructure'
  | 'Workplace Tech'
  | 'Operations & Logistics'
  | 'Finance & Compliance'
  | 'Product & Design'
  | 'Human Resources'
  | 'Executive Management'
  | (string & {});

export interface ApplicationUser {
  uid?: string;
  id: string;
  userName: string;
  email: string;
  emailConfirmed: boolean;
  fullName: string;
  department: string;
  jobTitle: string;
  role: ApplicationRole;
  userType: UserType; // System Admin vs Operational User
  failedAccessCount: number;
  lockoutEnd: string | null;
  isLockedOut: boolean;
  lockoutCount?: number;
  mustChangePassword: boolean;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  createdAt: string;
  lastActiveAt: string;
  avatarColor: string;
  phone?: string;
  passwordHash?: string;
  passwordMinLength?: number;
  passwordRequireSpecial?: boolean;
  passwordRequireNumber?: boolean;
  passwordRequireUppercase?: boolean;
  passwordRequireLowercase?: boolean;
  passwordLastChangedAt?: string;
  rolePermissions?: string[];
}

export type DocumentClassification = 'Top Secret' | 'Confidential' | 'Restricted' | 'Public';
export type DocumentCategory = 
  | 'Contracts & Agreements'
  | 'Administrative Decisions'
  | 'Financial & Auditing'
  | 'Security & Compliance'
  | 'Technical Specs & Blueprints';

export interface ArchivedDocument {
  id: string;
  titleEn: string;
  titleAr: string;
  docNumber: string;
  category: DocumentCategory;
  classification: DocumentClassification;
  department: string;
  archivedDate: string;
  retentionYears: number;
  retentionExpiry: string;
  fileSize: string;
  fileFormat: 'PDF' | 'DOCX' | 'XLSX' | 'SCAN';
  sha256Hash: string;
  archivedBy: string;
  barcodeNumber: string;
  physicalLocation: string;
  status: 'Active' | 'Under Review' | 'Permanent Archive';
  tags: string[];
}

export interface EmployeeRecord {
  id: string;
  empNumber: string;
  fullNameEn: string;
  fullNameAr: string;
  email: string;
  department: string;
  jobTitleEn: string;
  jobTitleAr: string;
  hireDate: string;
  status: 'Active' | 'On Leave' | 'Probation';
  clearance: 'Level 1' | 'Level 2' | 'Level 3 - High Security';
  twoFactorStatus: 'Enabled' | 'Pending Setup';
  phone: string;
  avatarColor: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: ApplicationRole;
  authorUserType?: UserType;
  authorEmail: string;
  content: string;
  isInternalNote: boolean;
  createdAt: string;
}

export interface TicketHistoryItem {
  id: string;
  ticketId: string;
  timestamp: string;
  actorName: string;
  actorRole: ApplicationRole;
  actorUserType?: UserType;
  action: string;
  details?: string;
}

export interface TicketAttachment {
  id: string;
  fileName: string;
  fileSize: string;
  fileType: string; // Restricted to image/jpeg, image/png
  dataUrl?: string; // Data URL for live previewing pictures in UI & lightbox
  uploadedAt: string;
  uploadedBy: string;
}

export interface Ticket {
  id: string; // e.g. TCK-2026-1042
  ticketNo: string; // Formatted ticket number
  title: string;
  description: string; // HTML / Rich-text formatted word editor content
  ticketType: TicketType; // Hardware Maintenance | Systems Troubleshoot | User Request
  assignedTeam: AssignedSupportTeam;
  teamId?: string;
  hardwareDeviceType?: HardwareDeviceType;
  targetSystem?: SupportedInformationSystem | string;
  userRequestAction?: UserRequestAction;
  deptRequest?: DepartmentRequestDoc;
  userRequestDetails?: {
    targetFullName?: string;
    targetUsername?: string;
    targetDepartment?: string;
    roleOrPermissions?: string;
    businessJustification?: string;
  };
  hardwareDetails?: {
    deviceId?: string | number;
    deviceCode?: string;
    assetType?: string;
    serialOrBarcode?: string;
    physicalLocation?: string;
    department?: string;
    brand?: string;
    model?: string;
  };
  priorityStars: PriorityStars; // 1 (★☆☆), 2 (★★☆), 3 (★★★)
  priority: TicketPriority;
  stage: TicketStage;
  status: TicketStatus;
  category: TicketCategory;
  department: TicketDepartment;
  createdBy?: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterDept: string;
  requesterUserType: UserType;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeRole?: ApplicationRole;
  responseSlaMinutes: number;
  resolutionSlaMinutes: number;
  responseDueAt: string;
  resolutionDueAt: string;
  isResponseBreached: boolean;
  isResolutionBreached: boolean;
  respondedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  comments: TicketComment[];
  history: TicketHistoryItem[];
  attachments: TicketAttachment[]; // ONLY pictures up to 4 attachments
  tags: string[];
}

export interface SerilogLogEntry {
  id: string;
  timestamp: string;
  level: 'Information' | 'Warning' | 'Error';
  messageTemplate: string;
  renderedMessage: string;
  properties: {
    Application: string;
    RequestMethod?: string;
    RequestPath?: string;
    StatusCode?: number;
    ElapsedMs?: number;
    MachineName?: string;
    EnvironmentName?: string;
    ThreadId?: number;
    UserId?: string;
    UserEmailMasked?: string;
    UserRole?: string;
    Action?: string;
    [key: string]: unknown;
  };
}

export interface PasswordPolicyResult {
  isValid: boolean;
  hasLength: boolean;
  hasDigit: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasSpecial: boolean;
  hasUniqueChars: boolean;
  errors: string[];
}

export type NotificationType = 'NEW_TICKET' | 'NEW_COMMENT';

export interface UserNotification {
  id: number | string;
  userId: string;
  userEmail?: string;
  type: NotificationType;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  ticketId?: string;
  ticketTitle?: string;
  isRead: boolean;
  createdAt: string;
}
