import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  dir: 'ltr' | 'rtl';
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Top Bar & Branding
    'app.title': 'CRPD APP Enterprise Portal',
    'app.subtitle': 'Unified Organization Operating Platform',
    'metro.hub': 'Metro Hub',
    'metro.welcome': 'Welcome back,',
    'metro.orgOverview': 'Select an enterprise application from your organization suite:',
    'nav.allApps': 'All Applications',
    'nav.tickets': 'Ticket Management',
    'nav.archiving': 'Archiving & Records',
    'nav.employees': 'Employee Management',
    'nav.userAdmin': 'User Administration',
    'nav.metrics': 'SLA & Metrics',
    'nav.logs': 'Seq / Serilog Logs',
    'nav.logout': 'Sign Out',
    'nav.profile': 'Profile & Identity',
    'nav.language': 'Language',
    'nav.currentRole': 'Current Role',

    // Metro Tiles
    'tile.tickets.title': 'Ticket Management',
    'tile.tickets.desc': 'Enterprise service desk, IT incidents, SLAs, and technical support requests.',
    'tile.tickets.badge': 'Service Desk DB',
    'tile.tickets.stat': 'Active Incidents & SLAs',

    'tile.archiving.title': 'Archiving & Records',
    'tile.archiving.desc': 'Digital document archives, classification, retention rules, and electronic barcodes.',
    'tile.archiving.badge': 'Records Vault',
    'tile.archiving.stat': 'Secure Documents & Contracts',

    'tile.employees.title': 'Employee Management',
    'tile.employees.desc': 'Personnel directory, department structure, security clearances, and 2FA statuses.',
    'tile.employees.badge': 'Human Capital',
    'tile.employees.stat': 'Active Personnel & Staff',

    // System Status Tile
    'metro.status.title': 'User Management',
    'metro.status.operational': 'All Microservices Operational',
    'metro.status.2faEnforced': '2FA Server Policy: Active (±1m tolerance)',
    'metro.quickSwitch': 'Quick Identity Switcher',

    // Authentication & 2FA
    'auth.loginTitle': 'Authority Portal Sign-in',
    'auth.loginSubtitle': '',
    'auth.emailOrUser': 'Email or Username',
    'auth.password': 'Password',
    'auth.signInBtn': 'Verify Credentials & Proceed',
    'auth.testAccounts': 'Quick Test Accounts:',
    'auth.2faTitle': 'Two-Factor Authentication (2FA)',
    'auth.2faSubtitle': 'Time-based One-Time Password (RFC 6238 TOTP)',
    'auth.2faFirstTimeTitle': 'Register Two-Factor Authentication',
    'auth.2faFirstTimeDesc': 'This is your first time logging in with 2FA. Scan the QR code / barcode below using your authenticator app (Google Authenticator, Microsoft Authenticator):',
    'auth.2faToleranceNote': 'Server Time Difference Tolerance: ±1 minute allowed',
    'auth.2faManualKey': 'Manual Secret Key:',
    'auth.2faEnterCode': 'Enter 6-digit Authenticator Code',
    'auth.2faVerifyBtn': 'Verify 2FA & Access Apps',
    'auth.2faBack': 'Back to Credential Login',
    'auth.2faSimulate': 'Current Server TOTP (Test Helper):',
    'auth.2faCopy': 'Copy Code',
    'auth.2faCopied': 'Copied!',
    'auth.2faAppInstructions': 'Open your Authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, or Apple Keychain) to retrieve your current 6-digit verification code.',
    'auth.2faInvalidError': 'Invalid verification code. Please make sure your authenticator app time is synced and enter the active 6-digit code.',
    'auth.2faShowQr': 'Show Authenticator setup QR code',
    'auth.2faHideQr': 'Hide QR code',
    'auth.2faStep1': '1. Scan the QR code or enter the key manually into your authenticator app.',
    'auth.2faStep2': '2. Your app will generate a 6-digit time-based code every 30 seconds.',
    'auth.2faStep3': '3. Enter the 6-digit code below to confirm and complete login.',
    'auth.lockoutWarning': 'Security lockout policy: 6 failed attempts lock account progressively (1st: 5m, 2nd: 10m, 3rd: 15m).',
    'auth.lockoutAlertTitle': 'Account Locked',
    'auth.lockoutAlertSubtitle': 'Account temporarily locked due to failed password attempts.',
    'auth.lockoutNoticeEn': 'You are locked out for {period}',
    'auth.lockoutNoticeAr': 'تم قفل حسابك لمدة {period}',
    'auth.sessionActive': 'Authenticated Session',

    // Ticket Management
    'tickets.title': 'Service Requests & Incidents',
    'tickets.new': 'New Ticket',
    'tickets.filterAll': 'All Tickets',
    'tickets.filterMy': 'My Tickets',
    'tickets.filterAssigned': 'Assigned to Me',
    'tickets.searchPlaceholder': 'Search tickets, ID, requester, or tags...',
    'tickets.status': 'Status',
    'tickets.priority': 'Priority',
    'tickets.department': 'Department',
    'tickets.category': 'Category',
    'tickets.assignee': 'Assignee',
    'tickets.created': 'Created',
    'tickets.sla': 'SLA Target',

    // Archiving App
    'arch.title': 'Electronic Document Archiving & Records',
    'arch.subtitle': 'Centralized regulatory records repository, retention policies, and cryptographic verification',
    'arch.uploadNew': 'Archive New Document',
    'arch.searchPlaceholder': 'Search title, document number, or barcode...',
    'arch.totalDocs': 'Archived Documents',
    'arch.topSecret': 'Confidential / Classified',
    'arch.retentionActive': 'Active Retention',
    'arch.docNumber': 'Document #',
    'arch.classification': 'Classification',
    'arch.retention': 'Retention Period',
    'arch.barcode': 'Archive Barcode',
    'arch.integrity': 'SHA-256 Checksum',
    'arch.location': 'Physical / Digital Rack',
    'arch.download': 'Retrieve Document',
    'arch.preview': 'View Record Metadata',

    // User Policy & 2FA Control
    'nav.policy': 'User Policy & 2FA',
    'tile.policy.title': 'User Policy & 2FA Control',
    'tile.policy.desc': 'Activate or deactivate two-factor authentication, set server tolerance, and manage lockout policies.',
    'tile.policy.badge': 'IAM Policy Engine',
    'tile.policy.stat': '2FA Activation & Access Controls',
    'policy.title': 'User Policy & 2FA Control Center',
    'policy.subtitle': 'Activate or deactivate two-factor authentication per account or organization-wide, and manage security rules',
    'policy.totalUsers': 'Total Accounts',
    'policy.twoFactorActive': '2FA Enforced',
    'policy.twoFactorDisabled': '2FA Deactivated (Direct Login)',
    'policy.lockedAccounts': 'Locked Accounts',
    'policy.globalMode': 'Global 2FA Policy Mode',
    'policy.globalModeActive': 'Organization-Wide (All users must use 2FA)',
    'policy.globalModeSelective': 'Per-User Policy Control (Configured per account)',
    'policy.tolerance': 'Server Time Tolerance Window',
    'policy.activate': 'Activate 2FA',
    'policy.deactivate': 'Deactivate 2FA',
    'policy.resetSecret': 'Reset Secret (Barcode next login)',
    'policy.secretSet': 'TOTP Secret Configured',
    'policy.noSecret': 'No Secret (Will show Barcode on next login)',
    'policy.unlock': 'Unlock Account',
    'policy.forcePassword': 'Force Password Change',
    'policy.adminNotice': 'Default Admin is configured without 2FA for direct password access. You can activate or deactivate 2FA for any account below at any time.',

    // Employee Management App
    'emp.title': 'Enterprise Employee Directory & HRIS',
    'emp.subtitle': 'Organization hierarchy, security clearance registry, and access provisioning',
    'emp.newEmployee': 'Onboard Employee',
    'emp.searchPlaceholder': 'Search staff by name, employee ID, or role...',
    'emp.totalStaff': 'Total Employees',
    'emp.twoFactorActive': '2FA Enrolled',
    'emp.departments': 'Operating Departments',
    'emp.empId': 'Employee ID',
    'emp.name': 'Name',
    'emp.dept': 'Department',
    'emp.titleCol': 'Job Title',
    'emp.clearance': 'Clearance Level',
    'emp.twoFactorCol': '2FA Status',
    'emp.statusCol': 'Employment Status',
    'emp.actions': 'Actions',

    // General Actions
    'common.cancel': 'Cancel',
    'common.save': 'Save Changes',
    'common.close': 'Close',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.export': 'Export',
    'common.active': 'Active',
    'common.back': 'Back',
    'common.open': 'Open',
    'common.delete': 'Delete',
    'common.edit': 'Edit',

    // Detailed Ticket Management
    'tickets.createTitle': 'Create New Support Ticket',
    'tickets.createTypePrompt': 'What type of ticket would you like to create?',
    'tickets.step1Badge': 'Step 1 of 2: Classification Prompt',
    'tickets.step1Desc': 'Select the category that best matches your situation. The ticket will be automatically routed and assigned to the dedicated support team.',
    'ticketType.hardware.title': 'Hardware Maintenance',
    'ticketType.hardware.desc': 'Physical devices, barcode thermal printers, handheld scanners, packing stations, workstation monitors, and warehouse hardware faults.',
    'ticketType.troubleshoot.title': 'Systems Troubleshoot',
    'ticketType.troubleshoot.desc': 'Software faults, database errors, interface crashes, and business app incidents (Old IMS, New IMS, Active Directory, ERP, Archiving, Email).',
    'ticketType.userRequest.title': 'User Request (IAM)',
    'ticketType.userRequest.desc': 'Create new user, modify account & permissions, unlock locked account, password reset, or role elevation.',
    'tickets.assignedToTeam': 'Auto-assigned to:',
    'team.hardware': 'Hardware Engineering & Facilities Support Team',
    'team.systems': 'Enterprise Systems & Core Applications Team',
    'team.iam': 'Identity & Access Management (IAM) & Directory Team',
    'tickets.titleLabel': 'Ticket Summary / Title',
    'tickets.titlePlaceholder': 'e.g., Thermal barcode printer head fault at warehouse packing dock #3...',
    'tickets.systemSelect': 'Target Information System',
    'tickets.userActionSelect': 'User Request Action',
    'tickets.targetFullName': 'Target Employee Full Name',
    'tickets.targetUsername': 'Username / Account',
    'tickets.targetDept': 'Target Department',
    'tickets.rolePerms': 'Requested Role or Permissions',
    'tickets.businessJustification': 'Business Justification',
    'tickets.assetType': 'Asset / Device Type',
    'tickets.serialBarcode': 'Serial Number or Barcode Tag',
    'tickets.physicalLocation': 'Physical Location / Station',
    'tickets.description': 'Detailed Description',
    'tickets.prioritySelector': 'Ticket Priority (3 Yellow Stars)',
    'tickets.attachments': 'Picture Attachments (Max 4 JPEG/PNG)',
    'tickets.initialComment': 'Initial Handover Note (Optional)',
    'tickets.submitBtn': 'Submit & Route Ticket',
    'tickets.restrictedAdminTitle': 'Access Restricted to Operational Users',
    'tickets.restrictedAdminDesc': 'In accordance with corporate governance rules, System Admins manage infrastructure, 2FA policies, and staff directories. Only Operational Users may initiate service tickets.',
    'tickets.switchToOperational': 'Switch to Operational User Account',
    'tickets.stages.New': 'New',
    'tickets.stages.Triaged': 'Triaged',
    'tickets.stages.InProgress': 'In Progress',
    'tickets.stages.PendingReview': 'Pending Review',
    'tickets.stages.Resolved': 'Resolved',
    'tickets.stages.Closed': 'Closed',
    'tickets.commentsTitle': 'Activity & Comments Timeline',
    'tickets.addComment': 'Post Response or Update',
    'tickets.internalNote': 'Internal Team Note Only',
    'tickets.postComment': 'Send Response',
    'tickets.timeline': 'Stage Progression',
    'tickets.assignedAgent': 'Assigned Agent',
    'tickets.slaTarget': 'SLA Target',
    'tickets.creationDate': 'Created At',
    'tickets.requester': 'Requester',

    // Star Priorities
    'star.1.title': '1 Star — Standard / Low Priority',
    'star.1.subtitle': 'General inquiry, routine task (SLA: 4h Response / 24h Resolution)',
    'star.2.title': '2 Stars — Medium / Elevated Priority',
    'star.2.subtitle': 'Normal operational issue affecting single user (SLA: 2h Response / 8h Resolution)',
    'star.3.title': '3 Stars — Urgent / Critical Priority',
    'star.3.subtitle': 'Critical business disruption or high severity (SLA: 15m Response / 2h Resolution)',

    // Editor & Uploader
    'editor.toolbar.bold': 'Bold (Ctrl+B)',
    'editor.toolbar.italic': 'Italic (Ctrl+I)',
    'editor.toolbar.underline': 'Underline (Ctrl+U)',
    'editor.toolbar.h1': 'Heading 1',
    'editor.toolbar.h2': 'Heading 2',
    'editor.toolbar.p': 'Paragraph',
    'editor.toolbar.ul': 'Bullet List',
    'editor.toolbar.ol': 'Numbered List',
    'editor.toolbar.quote': 'Blockquote',
    'editor.toolbar.code': 'Code Block',
    'editor.toolbar.clear': 'Clear Formatting',
    'editor.toolbar.preview': 'Live Preview',
    'editor.toolbar.edit': 'Edit Mode',
    'editor.words': 'words',
    'editor.chars': 'chars',
    'uploader.dragDrop': 'Drag and drop pictures here, or click to browse',
    'uploader.hint': 'Only JPEG and PNG images up to 10MB each (max 4 pictures)',
    'uploader.remove': 'Remove picture',
    'uploader.maxReached': 'Maximum pictures reached',

    // Export & Logs
    'export.title': 'Export ASP.NET Core MVC Project',
    'export.subtitle': 'Visual Studio Solution (.sln, .csproj, Controllers, EF Core Models, Serilog, TOTP RFC 6238)',
    'export.downloadBtn': 'Download Full Solution (.ZIP)',
    'export.packaging': 'Packaging Solution Files...',
    'export.downloaded': 'Downloaded Successfully!',
    'export.cliRun': 'Run in CLI: dotnet restore && dotnet run',
    'serilog.title': 'Seq & Serilog Diagnostic Stream',
    'serilog.download': 'Export JSON Logs',
    'serilog.clear': 'Clear Buffer',
    'serilog.searchPlaceholder': 'Search message templates, levels, properties...',

    // Teams & Roles
    'role.systemAdmin': 'System Admin',
    'role.operationalUser': 'Operational User',
    'role.technicalUser': 'Technical User',
    'team.technicalTeam': 'Technical Team (Hardware)',
    'team.dbSysAdmin': 'Database and Systems Admins (System Problems)',
    'team.securityTeam': 'Security Team (User Requests)',
    'team.filterByTeam': 'Filter by Team',
    'team.allTeams': 'All Teams',
    'team.manageTeams': 'Support Teams Management',
    'team.lead': 'Team Lead',
    'team.members': 'Members',
    'team.specialization': 'Specialization',
    
    // Ticket Creation & Department Request
    'ticket.deptRequestTitle': 'Official Department Request (Mandatory PDF)',
    'ticket.deptRequestDesc': 'Every ticket requires an authorized department request memo with an official number and date.',
    'ticket.deptRequestNo': 'Request Document Number',
    'ticket.deptRequestDate': 'Authorization Date',
    'ticket.deptRequestUpload': 'Upload Official Request (PDF only)',
    'ticket.deptRequestRequired': 'An official Department Request PDF is mandatory before submitting.',
    'ticket.hardwareDeviceType': 'Hardware Device Type',
    'ticket.confirmationTitle': 'Review & Confirmation',
    'ticket.confirmationSubtitle': 'Please review ticket specifications and attached documents prior to submission.',
    'ticket.filteredByRequester': 'My Created Tickets',
    'ticket.filterByCreator': 'Filter by Requester',
    'ticket.deleteTicket': 'Delete Ticket',
    'ticket.deleteConfirm': 'Are you sure you want to delete this ticket? This action is irreversible.',
    'ticket.cannotModify': 'Operational users cannot modify or delete tickets, but can add comments and attachments.',
    'ticket.step1': '1. Select Ticket Type',
    'ticket.step2': '2. Detailed Specifications',
    'ticket.step3': '3. Department Request (PDF)',
    'ticket.step4': '4. Final Confirmation',
    
    // System Settings in Metro Dashboard
    'settings.title': 'System Settings & Attachment Quotas',
    'settings.subtitle': 'Admin controls for attachment limits, allowed file formats, and SLA thresholds',
    'settings.maxAttachments': 'Max Picture Attachments Per Ticket',
    'settings.maxSizeMB': 'Max Picture File Size (MB)',
    'settings.allowedFormats': 'Allowed Picture Formats (JPEG / PNG)',
    'settings.saveSuccess': 'System settings saved successfully.',
    'settings.metroTileTitle': 'System Settings & Teams',
    'settings.metroTileDesc': 'Configure picture quotas, file size limits (default 5MB), and technical team rosters.',
  },
  ar: {
    // Top Bar & Branding
    'app.title': 'بوابة  الهيئة الموحدة (CRPD APP)',
    'app.subtitle': 'منصة العمليات والأنظمة المؤسسية المتكاملة',
    'metro.hub': 'واجهة ميترو الرئيسية',
    'metro.welcome': 'مرحباً بعودتك،',
    'metro.orgOverview': 'اختر أحد الأنظمة المؤسسية للمتابعة والعمل:',
    'nav.allApps': 'جميع التطبيقات',
    'nav.tickets': 'إدارة التذاكر والدعم الفني',
    'nav.archiving': 'الأرشفة والوثائق الإلكترونية',
    'nav.employees': 'إدارة الموظفين والكوادر',
    'nav.userAdmin': 'إدارة المستخدمين والصلاحيات',
    'nav.metrics': 'مؤشرات الأداء واتفاقيات SLA',
    'nav.logs': 'سجلات سيريلوج (Seq Logs)',
    'nav.logout': 'تسجيل الخروج',
    'nav.profile': 'الملف الشخصي والهوية',
    'nav.language': 'اللغة',
    'nav.currentRole': 'الدور الحالي',

    // Metro Tiles
    'tile.tickets.title': 'إدارة التذاكر والطلبات',
    'tile.tickets.desc': 'مكتب المساعدة الفنية، معالجة حوادث تقنية المعلومات، متابعة مستويات الخدمة (SLA).',
    'tile.tickets.badge': 'قاعدة بيانات التذاكر',
    'tile.tickets.stat': 'البلاغات النشطة ومستويات الخدمة',

    'tile.archiving.title': 'الأرشفة والوثائق الإلكترونية',
    'tile.archiving.desc': 'الأرشيف الرقمي المعتمد، تصنيف الوثائق، مدد الحفظ ونظام الباركود الرقمي الموحد.',
    'tile.archiving.badge': 'خزينة الوثائق',
    'tile.archiving.stat': 'وثائق وعقود رسمية محمية',

    'tile.employees.title': 'إدارة الموظفين والموارد',
    'tile.employees.desc': 'دليل الموظفين، الهيكل الإداري، مستويات التصريح الأمني وحالات التحقق الثنائي (2FA).',
    'tile.employees.badge': 'الموارد البشرية',
    'tile.employees.stat': 'الكوادر النشطة على رأس العمل',

    // System Status Tile
    'metro.status.title': 'إدارة المستخدمين',
    'metro.status.operational': 'جميع الخدمات السحابية تعمل بكفاءة تامة',
    'metro.status.2faEnforced': 'سياسة التحقق الثنائي: مفعّلة (سماحية التوقيت ±1 دقيقة)',
    'metro.quickSwitch': 'التبديل السريع للهوية (للاختبار)',

    // Authentication & 2FA
    'auth.loginTitle': 'تسجيل الدخول إلى بوابة الهيئة',
    'auth.loginSubtitle': '',
    'auth.emailOrUser': 'البريد الإلكتروني أو اسم المستخدم',
    'auth.password': 'كلمة المرور',
    'auth.signInBtn': 'التحقق من البيانات والمتابعة',
    'auth.testAccounts': 'حسابات الاختبار الجاهزة:',
    'auth.2faTitle': 'التحقق بخطوتين (2FA)',
    'auth.2faSubtitle': 'رمز التوثيق المؤقت القائم على الوقت (RFC 6238 TOTP)',
    'auth.2faFirstTimeTitle': 'تهيئة التحقق بخطوتين لأول مرة',
    'auth.2faFirstTimeDesc': 'هذا أول دخول لك بنظام التحقق الثنائي. يرجى مسح رمز الاستجابة السريعة (الباركود / QR) باستخدام تطبيق المصادقة لديك (مثل Google Authenticator أو Microsoft Authenticator):',
    'auth.2faToleranceNote': 'فارق التوقيت المسموح به مع الخادم: ±1 دقيقة (تسامح دقيقة كاملة)',
    'auth.2faManualKey': 'مفتاح الإدخال اليدوي السري:',
    'auth.2faEnterCode': 'أدخل الرمز المكون من 6 أرقام من تطبيق المصادقة',
    'auth.2faVerifyBtn': 'تأكيد الرمز والدخول إلى الأنظمة',
    'auth.2faBack': 'العودة لبيانات الدخول',
    'auth.2faSimulate': 'رمز الخادم الحالي (أداة مساعدة للاختبار):',
    'auth.2faCopy': 'نسخ الرمز',
    'auth.2faCopied': 'تم النسخ!',
    'auth.2faAppInstructions': 'افتح تطبيق المصادقة لديك (مثل Google Authenticator أو Microsoft Authenticator أو 1Password) للحصول على رمز التحقق الحالي المكون من 6 أرقام.',
    'auth.2faInvalidError': 'رمز التحقق غير صحيح. يرجى التأكد من مزامنة وقت جهازك وإدخال الرمز المكون من 6 أرقام النشط حالياً.',
    'auth.2faShowQr': 'إظهار رمز QR لتهيئة تطبيق المصادقة',
    'auth.2faHideQr': 'إخفاء رمز QR',
    'auth.2faStep1': '١. امسح رمز الاستجابة السريعة (QR) أو أدخل المفتاح السري يدوياً في تطبيق المصادقة.',
    'auth.2faStep2': '٢. سيقوم التطبيق بإنشاء رمز مكون من 6 أرقام يتجدد كل 30 ثانية تلقائياً.',
    'auth.2faStep3': '٣. أدخل الرمز المكون من 6 أرقام أدناه للتأكيد وإتمام تسجيل الدخول.',
    'auth.lockoutWarning': 'سياسة الأمان: الإخفاق في 6 محاولات يؤدي لحظر تصاعدي (الأول: 5 د، الثاني: 10 د، الثالث: 15 د).',
    'auth.lockoutAlertTitle': 'تم قفل الحساب',
    'auth.lockoutAlertSubtitle': 'تم قفل الحساب مؤقتاً بسبب الإخفاق في محاولات كلمة المرور.',
    'auth.lockoutNoticeEn': 'You are locked out for {period}',
    'auth.lockoutNoticeAr': 'تم قفل حسابك لمدة {period}',
    'auth.sessionActive': 'جلسة دخول موثقة',

    // Ticket Management
    'tickets.title': 'طلبات الخدمة والبلاغات الفنية',
    'tickets.new': 'تذكرة جديدة',
    'tickets.filterAll': 'جميع التذاكر',
    'tickets.filterMy': 'تذاكري الخاصة',
    'tickets.filterAssigned': 'المسندة إليّ',
    'tickets.searchPlaceholder': 'بحث برقم التذكرة أو العنوان أو المرسل أو الوسوم...',
    'tickets.status': 'الحالة',
    'tickets.priority': 'الأولوية',
    'tickets.department': 'القسم',
    'tickets.category': 'التصنيف',
    'tickets.assignee': 'المسؤول',
    'tickets.created': 'تاريخ الإنشاء',
    'tickets.sla': 'هدف SLA',

    // Archiving App
    'arch.title': 'نظام الأرشفة وإدارة الوثائق الإلكترونية',
    'arch.subtitle': 'المستودع الرقمي المركزي للوثائق والعقود وسياسات الحفظ والتحقق الرقمي المشفر',
    'arch.uploadNew': 'أرشفة وثيقة جديدة',
    'arch.searchPlaceholder': 'بحث بعنوان الوثيقة أو رقم القيد أو الباركود...',
    'arch.totalDocs': 'إجمالي الوثائق المؤرشفة',
    'arch.topSecret': 'وثائق سرية ومحمية',
    'arch.retentionActive': 'حفظ نظامي سارٍ',
    'arch.docNumber': 'رقم الوثيقة / القيد',
    'arch.classification': 'مستوى التصنيف',
    'arch.retention': 'فترة الحفظ القانوني',
    'arch.barcode': 'باركود الأرشيف',
    'arch.integrity': 'بصمة التحقق SHA-256',
    'arch.location': 'الموقع الرقمي / الرف الفيزيائي',
    'arch.download': 'استرجاع الوثيقة',
    'arch.preview': 'معاينة البيانات الوصفية',

    // User Policy & 2FA Control
    'nav.policy': 'سياسات المستخدمين و 2FA',
    'tile.policy.title': 'سياسات المستخدمين والتحكم في 2FA',
    'tile.policy.desc': 'تفعيل أو إلغاء التحقق الثنائي للمستخدمين، وتحديد فترات التسامح الزمني وإدارة الأمان.',
    'tile.policy.badge': 'محرك سياسات الهوية IAM',
    'tile.policy.stat': 'التحكم في تفعيل 2FA وقواعد الوصول',
    'policy.title': 'مركز سياسات المستخدمين والتحكم في 2FA',
    'policy.subtitle': 'تفعيل أو تعطيل المصادقة الثنائية لكل حساب أو على مستوى المنظمة، وضبط قواعد الحماية',
    'policy.totalUsers': 'إجمالي الحسابات',
    'policy.twoFactorActive': '2FA مفعّل',
    'policy.twoFactorDisabled': '2FA معطّل (دخول مباشر)',
    'policy.lockedAccounts': 'حسابات محظورة',
    'policy.globalMode': 'نمط سياسة 2FA العامة',
    'policy.globalModeActive': 'إلزامي للجميع (يتطلب 2FA لكافة الحسابات)',
    'policy.globalModeSelective': 'سياسة مرنة لكل مستخدم (تُحدد لكل حساب بشكل مستقل)',
    'policy.tolerance': 'فترة تسامح توقيت الخادم',
    'policy.activate': 'تفعيل 2FA',
    'policy.deactivate': 'تعطيل 2FA',
    'policy.resetSecret': 'إعادة ضبط الرمز (باركود في الدخول القادم)',
    'policy.secretSet': 'الرمز السري مُهيأ ومسجل',
    'policy.noSecret': 'بدون رمز (سيظهر الباركود عند الدخول القادم)',
    'policy.unlock': 'إلغاء حظر الحساب',
    'policy.forcePassword': 'إلزام بتغيير كلمة المرور',
    'policy.adminNotice': 'المسؤول الافتراضي (Admin) بدون 2FA لتسجيل الدخول الفوري بكلمة المرور. يمكنك تفعيل أو تعطيل 2FA لأي حساب في أي وقت أدناه.',

    // Employee Management App
    'emp.title': 'دليل الموظفين ونظام إدارة الكوادر البشرية',
    'emp.subtitle': 'الهيكل التنظيمي للمنظمة، سجل التصاريح الأمنية وإدارة صلاحيات الدخول',
    'emp.newEmployee': 'إضافة موظف جديد',
    'emp.searchPlaceholder': 'بحث بالاسم، الرقم الوظيفي، أو المسمى...',
    'emp.totalStaff': 'إجمالي الكوادر المسجلة',
    'emp.twoFactorActive': 'مفعّل لديهم التحقق الثنائي',
    'emp.departments': 'الإدارات والأقسام',
    'emp.empId': 'الرقم الوظيفي',
    'emp.name': 'اسم الموظف',
    'emp.dept': 'الإدارة / القسم',
    'emp.titleCol': 'المسمى الوظيفي',
    'emp.clearance': 'التصريح الأمني',
    'emp.twoFactorCol': 'التحقق الثنائي (2FA)',
    'emp.statusCol': 'حالة العمل',
    'emp.actions': 'الإجراءات',

    // General Actions
    'common.cancel': 'إلغاء',
    'common.save': 'حفظ التغييرات',
    'common.close': 'إغلاق',
    'common.search': 'بحث',
    'common.filter': 'تصفية',
    'common.export': 'تصدير',
    'common.active': 'نشط',
    'common.back': 'رجوع',
    'common.open': 'فتح',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',

    // Detailed Ticket Management
    'tickets.createTitle': 'إنشاء تذكرة دعم فني جديدة',
    'tickets.createTypePrompt': 'ما نوع التذكرة التي ترغب في إنشائها؟',
    'tickets.step1Badge': 'الخطوة 1 من 2: تحديد التصنيف وتوجيه الدعم',
    'tickets.step1Desc': 'اختر الفئة الأنسب للمشكلة أو الطلب؛ وبناءً على اختيارك سيتم توجيه التذكرة وإسنادها آلياً إلى الفريق المختص.',
    'ticketType.hardware.title': 'صيانة الأجهزة والمعدات',
    'ticketType.hardware.desc': 'الأجهزة الفيزيائية، طابعات الباركود الحرارية، الماسحات الضوئية اليدوية، محطات التعبئة، شاشات المحطات وأعطال أجهزة المستودعات.',
    'ticketType.troubleshoot.title': 'استكشاف أخطاء الأنظمة',
    'ticketType.troubleshoot.desc': 'أعطال البرمجيات، أخطاء قواعد البيانات، تعطل الواجهات، وبلاغات أنظمة (IMS، Active Directory، ERP، الأرشفة، البريد).',
    'ticketType.userRequest.title': 'طلبات المستخدمين والصلاحيات (IAM)',
    'ticketType.userRequest.desc': 'إنشاء مستخدم جديد، تعديل حساب وصلاحيات، فتح الحساب المحظور، إعادة تعيين كلمة المرور، أو ترفيع الصلاحيات.',
    'tickets.assignedToTeam': 'المسند إليه آلياً:',
    'team.hardware': 'فريق هندسة الأجهزة والمرافق التشغيلية',
    'team.systems': 'فريق الأنظمة والتطبيقات المؤسسية',
    'team.iam': 'فريق إدارة الهوية والصلاحيات والوصول (IAM)',
    'tickets.titleLabel': 'عنوان التذكرة أو ملخص البلاغ',
    'tickets.titlePlaceholder': 'مثال: عطل في رأس طابعة الباركود الحرارية في رصيف المستودع رقم 3...',
    'tickets.systemSelect': 'النظام المعلوماتي المعني',
    'tickets.userActionSelect': 'نوع إجراء المستخدم المطلوب',
    'tickets.targetFullName': 'الاسم الكامل للموظف المستهدف',
    'tickets.targetUsername': 'اسم المستخدم / الحساب المستهدف',
    'tickets.targetDept': 'القسم أو الإدارة المستهدفة',
    'tickets.rolePerms': 'الدور أو الصلاحيات المطلوب منحها',
    'tickets.businessJustification': 'المبرر التشغيلي لطلب الصلاحية',
    'tickets.assetType': 'نوع الجهاز أو الأصل',
    'tickets.serialBarcode': 'الرقم التسلسلي أو باركود الجهاز',
    'tickets.physicalLocation': 'الموقع الفيزيائي (المستودع، المبنى، المكتب)',
    'tickets.description': 'الوصف المفصل',
    'tickets.prioritySelector': 'أولوية التذكرة (تحدد بواسطة 3 نجوم صفراء)',
    'tickets.attachments': 'المرفقات المصورة (الحد الأقصى 4 صور بصيغة JPG أو PNG)',
    'tickets.initialComment': 'ملاحظة أو تعليق تسليم أولي (اختياري)',
    'tickets.submitBtn': 'إنشاء وإرسال التذكرة',
    'tickets.restrictedAdminTitle': 'الصلاحية مخصصة للمستخدمين التشغيليين فقط',
    'tickets.restrictedAdminDesc': 'بموجب سياسات الحوكمة المؤسسية، يُعنى مدير النظام بإدارة البنية التحتية وضوابط 2FA ودليل الكوادر. يُسمح فقط للمستخدمين التشغيليين الذين يباشرون أعمال الأنظمة اليومية بإنشاء تذاكر الدعم.',
    'tickets.switchToOperational': 'التبديل إلى حساب مستخدم تشغيلي للمتابعة',
    'tickets.stages.New': 'جديدة (New)',
    'tickets.stages.Triaged': 'تم الفرز (Triaged)',
    'tickets.stages.InProgress': 'قيد المعالجة (In Progress)',
    'tickets.stages.PendingReview': 'بانتظار المراجعة (Pending Review)',
    'tickets.stages.Resolved': 'تم الحل (Resolved)',
    'tickets.stages.Closed': 'مغلقة ومؤرشفة (Closed)',
    'tickets.commentsTitle': 'سجل المتابعات والردود',
    'tickets.addComment': 'إضافة رد أو تحديث جديد',
    'tickets.internalNote': 'ملاحظة داخلية للفريق فقط',
    'tickets.postComment': 'إرسال الرد',
    'tickets.timeline': 'خط سير مراحل التذكرة',
    'tickets.assignedAgent': 'المسؤول المكلف',
    'tickets.slaTarget': 'المدة المستهدفة (SLA)',
    'tickets.creationDate': 'تاريخ الإنشاء',
    'tickets.requester': 'مقدم الطلب',

    // Star Priorities
    'star.1.title': '★☆☆ أولوية عادية / اعتيادية (1 نجمة)',
    'star.1.subtitle': 'استفسار عام أو مهمة روتينية (SLA: استجابة 4 ساعات / حل خلال 24 ساعة)',
    'star.2.title': '★★☆ أولوية متوسطة / مرتفعة (2 نجمتان)',
    'star.2.subtitle': 'مشكلة تشغيلية تؤثر على مستخدم أو سير عمل (SLA: استجابة ساعتين / حل خلال 8 ساعات)',
    'star.3.title': '★★★ أولوية قصوى / حرجة (3 نجوم)',
    'star.3.subtitle': 'تعطل حرج للخدمة أو تأثير تجاري مرتفع (SLA: استجابة 15 دقيقة / حل خلال ساعتين)',

    // Editor & Uploader
    'editor.toolbar.bold': 'خط عريض (Ctrl+B)',
    'editor.toolbar.italic': 'خط مائل (Ctrl+I)',
    'editor.toolbar.underline': 'تسطير (Ctrl+U)',
    'editor.toolbar.h1': 'عنوان رئيسي H1',
    'editor.toolbar.h2': 'عنوان فرعي H2',
    'editor.toolbar.p': 'نص عادي (فقرة)',
    'editor.toolbar.ul': 'قائمة نقطية',
    'editor.toolbar.ol': 'قائمة مرقمة',
    'editor.toolbar.quote': 'اقتباس',
    'editor.toolbar.code': 'كتلة كود برمجية',
    'editor.toolbar.clear': 'مسح التنسيقات',
    'editor.toolbar.preview': 'معاينة مباشرة',
    'editor.toolbar.edit': 'وضع التحرير',
    'editor.words': 'كلمات',
    'editor.chars': 'حروف',
    'uploader.dragDrop': 'اسحب الصور وأفلتها هنا، أو اضغط للاستعراض والاختيار',
    'uploader.hint': 'يُسمح فقط بملفات الصور بصيغتي JPEG و PNG بحجم أقصى 10 ميجابايت (حد أقصى 4 صور)',
    'uploader.remove': 'حذف الصورة',
    'uploader.maxReached': 'تم الوصول للحد الأقصى من الصور (4 صور)',

    // Export & Logs
    'export.title': 'تصدير حل مشروع ASP.NET Core MVC 8.0',
    'export.subtitle': 'حل متكامل لـ Visual Studio (.sln، .csproj، وحدات التحكم، نماذج EF Core، مسجلات Serilog، محرك 2FA TOTP)',
    'export.downloadBtn': 'تحميل الحل البرمجي الكامل (.ZIP)',
    'export.packaging': 'جاري تجميع وحزم ملفات المشروع...',
    'export.downloaded': 'تم تحميل الملف بنجاح!',
    'export.cliRun': 'أمر التشغيل عبر سطر الأوامر: dotnet restore && dotnet run',
    'serilog.title': 'سجلات سيريلوج ومنظومة التشخيص (Seq Log Stream)',
    'serilog.download': 'تصدير سجلات الأحداث (JSON)',
    'serilog.clear': 'مسح السجلات',
    'serilog.searchPlaceholder': 'بحث في نصوص الرسائل ومستويات الخطورة والخصائص...',

    // Teams & Roles
    'role.systemAdmin': 'مسؤول النظام (System Admin)',
    'role.operationalUser': 'مستخدم تشغيلي (Operational User)',
    'role.technicalUser': 'مستخدم فني / مهندس دعم (Technical User)',
    'team.technicalTeam': 'فريق الدعم الفني وصيانة الأجهزة',
    'team.dbSysAdmin': 'فريق إدارة قواعد البيانات والأنظمة',
    'team.securityTeam': 'فريق أمن المعلومات وإدارة الصلاحيات',
    'team.filterByTeam': 'تصفية حسب الفريق المكلف',
    'team.allTeams': 'كافة الفرق الفنية',
    'team.manageTeams': 'إدارة الفرق الفنية والتخصصات',
    'team.lead': 'رئيس الفريق',
    'team.members': 'الأعضاء',
    'team.specialization': 'التخصص ونطاق البلاغات',

    // Ticket Creation & Department Request
    'ticket.deptRequestTitle': 'مذكرة طلب الإدارة الرسمية (ملف PDF إلزامي)',
    'ticket.deptRequestDesc': 'يتطلب تقديم أي بلاغ إرفاق مذكرة طلب الإدارة المعتمدة رسمياً مع تسجيل رقم وتاريخ المعاملة.',
    'ticket.deptRequestNo': 'رقم طلب الإدارة / المعاملة',
    'ticket.deptRequestDate': 'تاريخ اعتماد الطلب',
    'ticket.deptRequestUpload': 'تحميل وثيقة الطلب المعتمدة (ملف PDF فقط)',
    'ticket.deptRequestRequired': 'وثيقة طلب الإدارة الرسمية بصيغة PDF إلزامية لاعتماد وتقديم التذكرة.',
    'ticket.hardwareDeviceType': 'نوع الجهاز / المعدة',
    'ticket.confirmationTitle': 'مراجعة وتأكيد بيانات البلاغ',
    'ticket.confirmationSubtitle': 'يرجى تدقيق تفاصيل البلاغ والوثائق والمرفقات قبل الإرسال النهائي.',
    'ticket.filteredByRequester': 'تذاكري المنشأة فقط',
    'ticket.filterByCreator': 'تصفية حسب منشئ البلاغ',
    'ticket.deleteTicket': 'حذف البلاغ',
    'ticket.deleteConfirm': 'هل أنت متأكد من رغبتك في حذف هذا البلاغ؟ هذا الإجراء نهائي ولا يمكن التراجع عنه.',
    'ticket.cannotModify': 'المستخدم التشغيلي لا يملك صلاحية تعديل أو حذف البلاغات، ولكن يحق له إضافة تعليقات ومرفقات.',
    'ticket.step1': '١. اختيار نوع البلاغ',
    'ticket.step2': '٢. التفاصيل والمواصفات',
    'ticket.step3': '٣. مذكرة طلب الإدارة (PDF)',
    'ticket.step4': '٤. المراجعة والاعتماد',

    // System Settings in Metro Dashboard
    'settings.title': 'إعدادات النظام وسياسات المرفقات والـ SLA',
    'settings.subtitle': 'لوحة تحكم مسؤولي النظام لضبط كوتا الصور وحجم الملفات واتفاقيات مستوى الخدمة',
    'settings.maxAttachments': 'الحد الأقصى لعدد الصور المرفقة لكل تذكرة',
    'settings.maxSizeMB': 'الحد الأقصى لحجم كل صورة (ميجابايت)',
    'settings.allowedFormats': 'صيغ الصور المسموح بها (JPEG / PNG)',
    'settings.saveSuccess': 'تم حفظ وتطبيق إعدادات النظام بنجاح.',
    'settings.metroTileTitle': 'إعدادات النظام والفرق الفنية',
    'settings.metroTileDesc': 'ضبط كوتا المرفقات (افتراضياً 5 ميجابايت / 3 صور) وإدارة الفرق الفنية المكلفة.',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'pwdsnapp_lang_pref_v3';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'ar') return saved;
    } catch {
      // ignore
    }
    // Default site language is Arabic as requested
    return 'ar';
  });

  const dir: 'ltr' | 'rtl' = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore
    }
    // Update document dir and lang attribute
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language, dir]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'en' ? 'ar' : 'en'));
  };

  const t = (key: string): string => {
    const langDict = translations[language];
    if (langDict && langDict[key]) {
      return langDict[key];
    }
    // Fallback to English
    if (translations.en[key]) {
      return translations.en[key];
    }
    return key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        dir,
        t,
      }}
    >
      <div dir={dir} className={dir === 'rtl' ? 'font-sans' : 'font-sans'}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
