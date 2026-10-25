import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { ApplicationRole, ApplicationUser, UserType } from '../types';
import { 
  X, 
  Shield, 
  RefreshCw, 
  UserCheck, 
  Lock, 
  Unlock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Check, 
  RotateCcw,
  Sparkles,
  User,
  ShieldCheck,
  ShieldAlert,
  Phone,
  Mail,
  Building2,
  Briefcase
} from 'lucide-react';

interface EditUserModalProps {
  user: ApplicationUser;
  onClose: () => void;
}

interface RoleOption {
  id: number;
  name: string;
  isDeleted?: boolean;
  permissions?: string[];
}

export function EditUserModal({ user, onClose }: EditUserModalProps) {
  const { t, language, dir } = useLanguage();
  const { adminUpdateUser } = useAuth();
  const { getAllDepartments } = useOrg();

  // Basic Profile Info
  const [fullName, setFullName] = useState(user.fullName || '');
  const [userName, setUserName] = useState(user.userName || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [department, setDepartment] = useState(user.department || '');
  const [jobTitle, setJobTitle] = useState(user.jobTitle || '');

  // Role & Classification
  const [role, setRole] = useState<ApplicationRole>(user.role || 'Employee');
  const [userType, setUserType] = useState<UserType>(user.userType || 'Operational User');

  // Security Policies
  const [isLockedOut, setIsLockedOut] = useState<boolean>(!!user.isLockedOut);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(user.twoFactorEnabled !== false);
  const [reset2FA, setReset2FA] = useState<boolean>(false);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(!!user.mustChangePassword);
  
  // Optional Password Update
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Tabs for clean organization
  const [activeTab, setActiveTab] = useState<'profile' | 'access' | 'security'>('profile');

  // Async States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const departments = getAllDepartments();

  // Load available roles from /api/roles
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
            const activeRoles = data.data.filter((r: RoleOption) => !r.isDeleted);
            setAvailableRoles(activeRoles);
          }
        }
      } catch (err) {
        console.error('Failed to load roles for user edit:', err);
      } finally {
        if (isMounted) setLoadingRoles(false);
      }
    };

    fetchRoles();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pass = '';
    for (let i = 0; i < 14; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const updates: Record<string, any> = {
        fullName: fullName.trim(),
        userName: userName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        department: department.trim(),
        jobTitle: jobTitle.trim(),
        role,
        userType,
        isLockedOut,
        twoFactorEnabled,
        mustChangePassword
      };

      if (reset2FA) {
        updates.reset2FASecret = true;
      }

      if (newPassword.trim()) {
        if (newPassword.trim().length < 8) {
          setError(language === 'ar' ? 'كلمة المرور يجب ألا تقل عن 8 أحرف' : 'Password must be at least 8 characters long');
          setIsSubmitting(false);
          return;
        }
        updates.password = newPassword.trim();
      }

      const targetId = user.id !== undefined && user.id !== null && String(user.id).trim() !== '' ? String(user.id) : (user.uid || user.email);
      const res = await adminUpdateUser(targetId, updates);

      if (!res.success) {
        setError(res.error || (language === 'ar' ? 'فشل حفظ التعديلات' : 'Failed to update user'));
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || (language === 'ar' ? 'حدث خطأ أثناء التحديث' : 'An error occurred while updating user'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const userInitials = (fullName || user.fullName || 'U')
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 transition-all"
        dir={dir}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-inner ${user.avatarColor || 'bg-blue-600'}`}>
              {userInitials}
            </div>
            <div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <h3 className="text-base font-bold tracking-tight">
                  {language === 'ar' ? 'تعديل بيانات المستخدم' : 'Edit User Profile & Access'}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-blue-300 border border-slate-700">
                  ID: {user.id}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                {user.email}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title={t('common.cancel')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 flex items-center space-x-4 rtl:space-x-reverse">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-2 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 rtl:space-x-reverse cursor-pointer ${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'المعلومات الشخصية' : 'Profile Details'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('access')}
            className={`py-3 px-2 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 rtl:space-x-reverse cursor-pointer ${
              activeTab === 'access'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'الدور والصلاحيات' : 'Role & Classification'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`py-3 px-2 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 rtl:space-x-reverse cursor-pointer ${
              activeTab === 'security'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'الأمان وسياسة الدخول' : 'Security & Access Policy'}</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {/* TAB 1: Profile Details */}
          {activeTab === 'profile' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'الاسم الكامل' : 'Full Name'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={language === 'ar' ? 'مثال: سارة محمد' : 'e.g. Sarah Jenkins'}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'اسم الحساب (Username)' : 'Account Username'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="sarah.j"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@system.local"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+966 50 123 4567"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'القسم / الإدارة' : 'Department'}
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900"
                  >
                    <option value="">{language === 'ar' ? '-- بدون قسم محدد --' : '-- Unassigned Department --'}</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={language === 'ar' ? dept.nameAr : dept.nameEn}>
                        {language === 'ar' ? dept.nameAr : dept.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'المسمى الوظيفي' : 'Job Title'}
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder={language === 'ar' ? 'أخصائي دعم فني' : 'Technical Support Specialist'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Role & Classification */}
          {activeTab === 'access' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">
                      {language === 'ar' ? 'دور الصلاحيات (Role)' : 'Application Role'}
                    </label>
                    {loadingRoles && (
                      <span className="text-[10px] text-slate-400 flex items-center">
                        <RefreshCw className="w-3 h-3 animate-spin mx-1" />
                        {language === 'ar' ? 'تحميل...' : 'Loading...'}
                      </span>
                    )}
                  </div>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as ApplicationRole)}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg bg-white cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900"
                  >
                    {availableRoles.length > 0 ? (
                      availableRoles.map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name} {r.permissions && r.permissions.length > 0 ? `(${r.permissions.length} ${language === 'ar' ? 'صلاحيات' : 'perms'})` : ''}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Employee">{language === 'ar' ? 'Employee (موظف)' : 'Employee (Requester)'}</option>
                        <option value="Agent">{language === 'ar' ? 'Agent (وكيل دعم)' : 'Agent (Support Eng)'}</option>
                        <option value="Admin">{language === 'ar' ? 'Admin (مدير نظام)' : 'Admin (Administrator)'}</option>
                      </>
                    )}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {language === 'ar' 
                      ? 'يتحكم الدور في الصلاحيات الممنوحة للمستخدم في جميع تطبيقات النظام.' 
                      : 'Controls granular permission matrices configured in Role Management.'}
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'تصنيف المستخدم (User Type)' : 'User System Classification'}
                  </label>
                  <select
                    value={userType}
                    onChange={(e) => setUserType(e.target.value as UserType)}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg bg-white cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900"
                  >
                    <option value="Operational User">
                      {language === 'ar' ? 'مستخدم تشغيلي (Operational User)' : 'Operational User'}
                    </option>
                    <option value="Technical User">
                      {language === 'ar' ? 'مستخدم تقني / دعم (Technical User)' : 'Technical User'}
                    </option>
                    <option value="System Admin">
                      {language === 'ar' ? 'مسؤول نظام كامل (System Admin)' : 'System Admin'}
                    </option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {language === 'ar'
                      ? 'يحدد نوع المستخدم واجهة التفاعل ومستوى الدخول الأمني العام.'
                      : 'Governs high-level administrative boundaries and interface presentation.'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-700 text-xs block">
                  {language === 'ar' ? 'معلومات نشاط الحساب:' : 'Account Metadata & Activity:'}
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div>
                    <span className="text-slate-400">{language === 'ar' ? 'تاريخ الإنشاء: ' : 'Created: '}</span>
                    <span className="font-mono">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">{language === 'ar' ? 'آخر دخول: ' : 'Last Active: '}</span>
                    <span className="font-mono">{user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Security & Access Policy */}
          {activeTab === 'security' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Account Status Switch */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    {isLockedOut ? (
                      <Lock className="w-4 h-4 text-rose-600" />
                    ) : (
                      <Unlock className="w-4 h-4 text-emerald-600" />
                    )}
                    <span className="font-bold text-slate-900">
                      {language === 'ar' ? 'حالة الحساب (Lockout Status)' : 'Account Status'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {isLockedOut
                      ? (language === 'ar' ? 'الحساب مقفل ولا يمكنه تسجيل الدخول.' : 'Account is locked out and cannot authenticate.')
                      : (language === 'ar' ? 'الحساب نشط ويعمل بشكل طبيعي.' : 'Account is active and permitted to authenticate.')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLockedOut(!isLockedOut)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center space-x-1 rtl:space-x-reverse ${
                    isLockedOut
                      ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-300'
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-300'
                  }`}
                >
                  {isLockedOut ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'إلغاء القفل (تفعيل)' : 'Unlock Account'}</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'قفل الحساب' : 'Lock Account'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* 2FA Policy Switch */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <ShieldCheck className={`w-4 h-4 ${twoFactorEnabled ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="font-bold text-slate-900">
                      {language === 'ar' ? 'المصادقة الثنائية (2FA Enforcement)' : 'Two-Factor Authentication (2FA)'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {twoFactorEnabled
                      ? (language === 'ar' ? 'مطلوب إدخال رمز التحقق عند كل دخول.' : 'TOTP authenticator app code is enforced.')
                      : (language === 'ar' ? 'المصادقة الثنائية معطلة لهذا المستخدم.' : '2FA is disabled for this user.')}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={twoFactorEnabled}
                    onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Security Actions Checkboxes */}
              <div className="space-y-2.5 px-1">
                <label className="flex items-start space-x-2.5 rtl:space-x-reverse cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reset2FA}
                    onChange={(e) => setReset2FA(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">
                      {language === 'ar' ? 'إعادة ضبط مفتاح المصادقة الثنائية (Reset 2FA Secret)' : 'Reset Authenticator Secret (Clear 2FA Key)'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {language === 'ar'
                        ? 'سيُطلب من المستخدم مسح رمز QR جديد عند تسجيل دخوله القادم.'
                        : 'Forces user to re-scan a fresh QR code setup on next login.'}
                    </span>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 rtl:space-x-reverse cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mustChangePassword}
                    onChange={(e) => setMustChangePassword(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">
                      {language === 'ar' ? 'إلزام تغيير كلمة المرور عند الدخول القادم' : 'Force Password Change on Next Login'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {language === 'ar'
                        ? 'يجب على المستخدم إدخال كلمة مرور جديدة بمجرد تسجيل الدخول.'
                        : 'User will be redirected to the change-password screen upon authentication.'}
                    </span>
                  </div>
                </label>
              </div>

              {/* Optional Password Reset Section */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 rtl:space-x-reverse text-blue-900 font-bold text-xs">
                    <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                    <span>{language === 'ar' ? 'تعيين كلمة مرور جديدة (اختياري)' : 'Assign New Password (Optional)'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 rtl:space-x-reverse cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{language === 'ar' ? 'توليد كلمة مرور' : 'Generate Secure'}</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={language === 'ar' ? 'اتركه فارغاً للإبقاء على كلمة المرور الحالية' : 'Leave empty to keep existing password'}
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg font-mono text-slate-800 bg-white pr-10 rtl:pr-3 rtl:pl-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 rtl:right-auto rtl:left-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {newPassword && (
                  <p className="text-[10px] text-emerald-700 font-medium flex items-center space-x-1 rtl:space-x-reverse">
                    <Check className="w-3 h-3" />
                    <span>{language === 'ar' ? 'سيتم تشفير وتحديث كلمة المرور عند الحفظ.' : 'New password will be securely hashed and assigned upon save.'}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 rtl:space-x-reverse text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <span className="text-[11px] text-slate-400 font-mono">
              {language === 'ar' ? 'قاعدة بيانات: PostgreSQL / Drizzle' : 'Storage: PostgreSQL / Drizzle'}
            </span>

            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer transition disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm cursor-pointer transition flex items-center space-x-1.5 rtl:space-x-reverse disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin mx-1" />}
                <span>
                  {isSubmitting 
                    ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving Changes...') 
                    : (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes')}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
