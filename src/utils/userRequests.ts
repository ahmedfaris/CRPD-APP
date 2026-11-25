// User-account requests (ticket type "User Request"): actions, labels and the official-request
// fields they need. Shared by the ticket form, the report and the server-side validation.

export const USER_REQUEST_ACTION_LIST = [
  'Create New User',
  'Suspend User',
  'Delete User',
  'Modify User Account & Permissions',
  'Role & Privilege Elevation',
  'Reset Password / Unlock Account',
  'Other Request',
] as const;

/**
 * Creating, suspending, deleting or changing the permissions of an account needs the target
 * username, its department, and the number and date of the official request.
 */
export const ACTIONS_NEEDING_REQUEST_INFO = new Set<string>([
  'Create New User',
  'Suspend User',
  'Delete User',
  'Modify User Account & Permissions',
  'Role & Privilege Elevation',
]);

const AR: Record<string, string> = {
  'Create New User': 'إنشاء مستخدم جديد',
  'Suspend User': 'إيقاف مستخدم',
  'Delete User': 'حذف أو إلغاء حساب مستخدم',
  'Modify User Account & Permissions': 'تعديل الصلاحيات',
  'Role & Privilege Elevation': 'ترقية الأدوار والامتيازات',
  'Reset Password / Unlock Account': 'إعادة تعيين كلمة المرور / إلغاء القفل',
  'Other Request': 'طلب آخر',
};
const EN: Record<string, string> = {
  'Create New User': 'Create new user',
  'Suspend User': 'Suspend user',
  'Delete User': 'Delete user',
  'Modify User Account & Permissions': 'Change permissions',
  'Role & Privilege Elevation': 'Role elevation',
  'Reset Password / Unlock Account': 'Reset password / unlock',
  'Other Request': 'Other request',
};
export function userRequestActionLabel(action: string | undefined | null, lang: 'ar' | 'en'): string {
  if (!action) return lang === 'ar' ? 'غير محدد' : 'Not set';
  return (lang === 'ar' ? AR : EN)[action] || action;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function isValidIsoDate(s: unknown): boolean {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export interface UserRequestInfo {
  targetUsername?: string;
  targetDepartment?: string;
  requestNumber?: string;
  requestDate?: string;
}

/** Returns the names of the missing or invalid fields (empty when the request is complete). */
export function missingUserRequestFields(action: string | undefined, d: UserRequestInfo | undefined | null, today?: string): string[] {
  if (!action || !ACTIONS_NEEDING_REQUEST_INFO.has(action)) return [];
  const v = d || {};
  const missing: string[] = [];
  if (!String(v.targetUsername || '').trim()) missing.push('targetUsername');
  if (!String(v.targetDepartment || '').trim()) missing.push('targetDepartment');
  if (!String(v.requestNumber || '').trim()) missing.push('requestNumber');
  if (!isValidIsoDate(v.requestDate) || (today && String(v.requestDate) > today)) missing.push('requestDate');
  return missing;
}
