import React, { useState, useEffect } from 'react';

/** Random temporary password that satisfies the password policy (12+ chars, upper, lower, digit, symbol). */
function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ', lower = 'abcdefghijkmnpqrstuvwxyz', digits = '23456789', symbols = '!@#$%&*?';
  const all = upper + lower + digits + symbols;
  const pick = (chars: string) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return chars[buf[0] % chars.length];
  };
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < 14) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { ApplicationRole, UserType } from '../types';
import { X, Shield, RefreshCw, Wrench, Send, ShieldCheck, UserCheck } from 'lucide-react';

interface CreateUserModalProps {
  onClose: () => void;
}

interface RoleOption {
  id: number;
  name: string;
  isDeleted?: boolean;
  permissions?: string[];
}

export function CreateUserModal({ onClose }: CreateUserModalProps) {
  const { t, language, dir } = useLanguage();
  const { adminCreateUser } = useAuth();
  const { getAllDepartments } = useOrg();
  
  const [newName, setNewName] = useState('');
  const [newUserName, setNewUserName] = useState(''); // account name
  const [newEmail, setNewEmail] = useState(''); // optional
  const [newPhone, setNewPhone] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newRole, setNewRole] = useState<ApplicationRole>('Employee');
  const [newUserType, setNewUserType] = useState<UserType>('Operator');
  // A fresh random temporary password for every new account (users must change it at first login).
  const [newPass, setNewPass] = useState<string>(() => generateTemporaryPassword());
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic roles fetched from User Roles Management page (/api/roles)
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const departments = getAllDepartments();

  // Validate English characters only and valid email format
  const isEnglishEmail = (val: string): boolean => {
    const englishEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return englishEmailRegex.test(val);
  };

  // Helper to sync userType with selected role if not manually customized
  const handleRoleChange = (selectedRole: ApplicationRole) => {
    setNewRole(selectedRole);
    const r = selectedRole.toLowerCase();
    if (r === 'administrator' || r === 'admin' || r === 'system admin') {
      setNewUserType('System Admin');
    } else if (r.includes('agent') || r.includes('tech') || r.includes('support')) {
      setNewUserType('Technical');
    } else {
      setNewUserType('Operator');
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchRoles = async () => {
      try {
        setLoadingRoles(true);
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/roles', {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-App-Action': 'strict-client-action'
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data && Array.isArray(data.data) && isMounted) {
            // Filter out soft-deleted roles
            const activeRoles = data.data.filter((r: RoleOption) => !r.isDeleted);
            setAvailableRoles(activeRoles);
            
            // If the current role isn't in activeRoles, select the first active role or default to 'Employee'
            if (activeRoles.length > 0) {
              const hasCurrentRole = activeRoles.some((r: RoleOption) => r.name === newRole);
              if (!hasCurrentRole) {
                const employeeRole = activeRoles.find((r: RoleOption) => r.name === 'Employee' || r.name.toLowerCase().includes('employee') || r.name.toLowerCase().includes('agent'));
                const chosenRole = employeeRole ? employeeRole.name : activeRoles[0].name;
                setNewRole(chosenRole);
                if (chosenRole.toLowerCase().includes('agent') || chosenRole.toLowerCase().includes('tech')) {
                  setNewUserType('Technical');
                } else if (chosenRole.toLowerCase() === 'administrator' || chosenRole.toLowerCase() === 'admin' || chosenRole.toLowerCase() === 'system admin') {
                  setNewUserType('System Admin');
                } else {
                  setNewUserType('Operator');
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load roles for user creation:', err);
      } finally {
        if (isMounted) setLoadingRoles(false);
      }
    };

    fetchRoles();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const trimmedUserName = newUserName.trim();
    if (!trimmedUserName) {
      setCreateError(language === 'ar' ? 'يرجى إدخال اسم الحساب' : 'Account Name is required');
      return;
    }

    if (!isEnglishEmail(trimmedUserName)) {
      setCreateError(
        language === 'ar'
          ? 'اسم الحساب يجب أن يكون باللغة الإنكليزية فقط وبصيغة بريد إلكتروني صالح (مثال: user@company.com)'
          : 'Account Name must be in English only and in valid email format (e.g. user@company.com)'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await adminCreateUser({
        userName: trimmedUserName,
        email: newEmail.trim() || trimmedUserName, // Use account name as email if not specified separately
        fullName: newName.trim(),
        department: newDept,
        phone: newPhone.trim(), // Optional
        role: newRole,
        userType: newUserType, // Explicit User Type passed to backend!
        jobTitle: newRole,
        initialPassword: newPass,
        twoFactorEnabled: true, // Default security policy
      });

      if (!res.success) {
        setCreateError(res.error || (language === 'ar' ? 'فشل إنشاء المستخدم' : 'Failed to create user'));
      } else {
        onClose();
      }
    } catch (err: any) {
      setCreateError(err.message || (language === 'ar' ? 'فشل إنشاء المستخدم' : 'Failed to create user'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4" dir={dir}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            {language === 'ar' ? 'تسجيل مستخدم جديد في النظام' : 'Provision ApplicationUser in TicketManagementDB'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'الاسم الكامل' : 'Full Name'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={language === 'ar' ? 'مثال: ريم الأحمد' : 'e.g. Rachel Adams'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'اسم الحساب (بالإنكليزية بصيغة إيميل)' : 'Account Name (English Email)'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                dir="ltr"
                lang="en"
                value={newUserName}
                onChange={(e) => {
                  // Strictly enforce English ASCII letters, digits and email characters
                  const englishOnly = e.target.value.replace(/[^a-zA-Z0-9._%+\-@]/g, '');
                  setNewUserName(englishOnly);
                }}
                placeholder="user@company.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-left focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                {language === 'ar' 
                  ? 'أحرف إنكليزية فقط بصيغة إيميل (مثال: user@company.com)' 
                  : 'English only in email format (e.g. user@company.com)'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'البريد الإلكتروني للتواصل (اختياري)' : 'Contact Email (Optional)'}
              </label>
              <input
                type="email"
                dir="ltr"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={newUserName || "contact@org.local"}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-left focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                {language === 'ar' 
                  ? 'اختياري (يُعتمد اسم الحساب افتراضياً)' 
                  : 'Optional (defaults to account name)'}
              </span>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'رقم الهاتف (اختياري)' : 'Phone Number (Optional)'}
              </label>
              <input
                type="text"
                dir="ltr"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+964 770 123 4567"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-left focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                {language === 'ar' ? 'حقل اختياري' : 'Optional field'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'القسم / الإدارة' : 'Department'}
              </label>
              <select
                required
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg cursor-pointer bg-white"
              >
                <option value="" disabled>{language === 'ar' ? 'اختر القسم...' : 'Select Department...'}</option>
                {departments.map(dept => (
                  <option key={dept.id} value={language === 'ar' ? dept.nameAr : dept.nameEn}>
                    {language === 'ar' ? dept.nameAr : dept.nameEn}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700">
                  {language === 'ar' ? 'دور الهوية والصلاحية' : 'User Role'}
                </label>
                {loadingRoles && (
                  <span className="text-[10px] text-slate-400 flex items-center">
                    <RefreshCw className="w-3 h-3 animate-spin mx-1" />
                    {language === 'ar' ? 'جاري تحميل الأدوار...' : 'Loading roles...'}
                  </span>
                )}
              </div>
              <select
                value={newRole}
                onChange={(e) => handleRoleChange(e.target.value as ApplicationRole)}
                disabled={loadingRoles && availableRoles.length === 0}
                className="w-full py-2 px-2 border border-slate-300 rounded-lg bg-white cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                {availableRoles.length > 0 ? (
                  availableRoles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name} {role.permissions && role.permissions.length > 0 ? `(${role.permissions.length} ${language === 'ar' ? 'صلاحية' : 'perms'})` : ''}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Employee">{language === 'ar' ? 'Employee (موظف)' : 'Employee (Requester)'}</option>
                    <option value="Helpdesk Agent">{language === 'ar' ? 'Helpdesk Agent (وكيل دعم)' : 'Helpdesk Agent (Support Eng)'}</option>
                    <option value="Administrator">{language === 'ar' ? 'Administrator (مسؤول نظام)' : 'Administrator (System Admin)'}</option>
                    <option value="Admin">{language === 'ar' ? 'Admin' : 'Admin'}</option>
                    <option value="Agent">{language === 'ar' ? 'Agent' : 'Agent'}</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* User Type Selection: Technical vs Operator */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-bold text-slate-700">
                {language === 'ar' ? 'نوع المستخدم (User Type)' : 'User Type (Classification)'}
              </label>
              <span className="text-[11px] text-slate-500">
                {language === 'ar' ? 'صلاحيات حل التذاكر أو إنشائها' : 'Ticket solving vs creation scope'}
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Operator */}
              <button
                type="button"
                onClick={() => setNewUserType('Operator')}
                className={`p-3 rounded-xl border text-start transition cursor-pointer flex flex-col justify-between ${
                  newUserType === 'Operator' || newUserType === 'Operational User'
                    ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Send className={`w-3.5 h-3.5 ${newUserType === 'Operator' || newUserType === 'Operational User' ? 'text-amber-600' : 'text-slate-400'}`} />
                    {language === 'ar' ? 'مشغل (Operator)' : 'Operator (User)'}
                  </span>
                  {(newUserType === 'Operator' || newUserType === 'Operational User') && (
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {language === 'ar'
                    ? 'إنشاء التذاكر وعرض تذاكر القسم الخاص به فقط.'
                    : 'Can only create tickets and view tickets created by user or their department.'}
                </p>
              </button>

              {/* Technical */}
              <button
                type="button"
                onClick={() => setNewUserType('Technical')}
                className={`p-3 rounded-xl border text-start transition cursor-pointer flex flex-col justify-between ${
                  newUserType === 'Technical' || newUserType === 'Technical User'
                    ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Wrench className={`w-3.5 h-3.5 ${newUserType === 'Technical' || newUserType === 'Technical User' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    {language === 'ar' ? 'فني (Technical)' : 'Technical (Engineer)'}
                  </span>
                  {(newUserType === 'Technical' || newUserType === 'Technical User') && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {language === 'ar'
                    ? 'الانضمام لفرق الدعم الفني، استلام وحل التذاكر.'
                    : 'Can join ticket support teams, get assigned, and solve tickets.'}
                </p>
              </button>
            </div>

            {/* Optional System Admin classification */}
            <div className="mt-2 flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="font-bold text-slate-800 text-[11px] block">
                  {language === 'ar' ? 'مسؤول نظام (System Admin)' : 'System Administrator Classification'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {language === 'ar' ? 'صلاحيات إدارة شاملة للنظام والمستخدمين' : 'Full access to system, tickets & administrative policies'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setNewUserType(newUserType === 'System Admin' ? 'Operator' : 'System Admin')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  newUserType === 'System Admin'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{newUserType === 'System Admin' ? (language === 'ar' ? 'محدد' : 'Selected') : (language === 'ar' ? 'تحديد' : 'Select')}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {language === 'ar' ? 'كلمة المرور المؤقتة' : 'Temporary Password'}
            </label>
            <input
              type="text"
              required
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-600 bg-slate-50"
            />
          </div>

          <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 flex flex-col space-y-1 mt-2">
            <span className="font-bold text-blue-800 text-[11px] mb-1">
              {language === 'ar' ? 'سياسة الأمان الافتراضية المطبقة:' : 'Default Security Policy Applied:'}
            </span>
            <span className="text-[10px] text-blue-700 flex items-center">
              • {language === 'ar' ? 'المصادقة الثنائية (2FA) مفعلة.' : '2FA is enabled.'}
            </span>
            <span className="text-[10px] text-blue-700 flex items-center">
              • {language === 'ar' ? 'كلمة المرور معقدة ومطلوب تغييرها عند الدخول.' : 'Password must be complex and changed on login.'}
            </span>
            <span className="text-[10px] text-blue-700 flex items-center">
              • {language === 'ar' ? 'تقييد معدل تسجيل الدخول مفعل.' : 'Login rate limiting is enabled.'}
            </span>
          </div>

          {createError && (
            <p className="text-rose-600 font-semibold">{createError}</p>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer mx-1"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer mx-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin mx-1" />}
              <span>{isSubmitting ? (language === 'ar' ? 'جاري الإنشاء...' : 'Provisioning...') : (language === 'ar' ? 'إنشاء وتجهيز المستخدم' : 'Provision User')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
