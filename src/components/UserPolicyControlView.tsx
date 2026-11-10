import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { logger } from '../utils/logger';
import { 
  ShieldCheck, 
  ShieldAlert, 
  ShieldOff, 
  Lock, 
  Unlock, 
  RotateCcw, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  UserCheck, 
  KeyRound, 
  QrCode, 
  Sliders, 
  ArrowLeft, 
  Sparkles,
  RefreshCw,
  Info,
  Check,
  X,
  Clock,
  Edit,
  Wrench,
  Send
} from 'lucide-react';
import { ApplicationRole, ApplicationUser, isUserTechnical, isUserOperator } from '../types';
import { EditUserModal } from './EditUserModal';

interface UserPolicyControlViewProps {
  onBackToHub: () => void;
}

export function UserPolicyControlView({ onBackToHub }: UserPolicyControlViewProps) {
  const { 
    users, 
    currentUser, 
    global2FAEnforced, 
    adminToggleGlobal2FA,
    serverToleranceSeconds,
    setServerToleranceSeconds,
    adminToggleUser2FA,
    adminResetUser2FASecret,
    adminUnlockUser,
    adminResetPassword,
    adminToggleForceChange,
    adminUpdateUserRole
  } = useAuth();
  const { t, language, dir } = useLanguage();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | '2fa_active' | '2fa_disabled' | 'locked'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  // Interactive state
  const [actionNotification, setActionNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<string | null>(null);
  const [selectedUserForPolicy, setSelectedUserForPolicy] = useState<ApplicationUser | null>(null);
  const [policyData, setPolicyData] = useState({
    passwordMinLength: 8,
    passwordRequireSpecial: false,
    passwordRequireNumber: false,
    passwordRequireUppercase: false,
    passwordRequireLowercase: false
  });
  const [tempPassword, setTempPassword] = useState('ChangeMe@2026!');
  const [tempPassError, setTempPassError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<ApplicationUser | null>(null);

  
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPolicy) return;
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/users/${(selectedUserForPolicy as any).uid}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-App-Action': 'strict-client-action'
        },
        body: JSON.stringify(policyData)
      });
      if (res.ok) {
        setSelectedUserForPolicy(null);
        window.location.reload(); // Quick refresh to reflect the changes from the backend
      } else {
        const data = await res.json();
        console.error("Failed to save policy:", data);
        alert(data.error || "Failed to save policy");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setActionNotification({ message, type });
    setTimeout(() => setActionNotification(null), 3500);
  };

  // Unique departments
  const departments = useMemo(() => {
    const set = new Set(users.map(u => u.department));
    return Array.from(set);
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = 
        u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.department.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesDept = deptFilter === 'all' || u.department === deptFilter;

      let matchesStatus = true;
      if (statusFilter === '2fa_active') {
        matchesStatus = global2FAEnforced || !!u.twoFactorEnabled;
      } else if (statusFilter === '2fa_disabled') {
        matchesStatus = !global2FAEnforced && !u.twoFactorEnabled;
      } else if (statusFilter === 'locked') {
        matchesStatus = u.isLockedOut;
      }

      return matchesSearch && matchesRole && matchesDept && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, deptFilter, statusFilter, global2FAEnforced]);

  // Statistics
  const totalCount = users.length;
  const active2FACount = users.filter(u => global2FAEnforced || u.twoFactorEnabled).length;
  const disabled2FACount = totalCount - active2FACount;
  const lockedCount = users.filter(u => u.isLockedOut).length;
  const compliancePercent = totalCount > 0 ? Math.round((active2FACount / totalCount) * 100) : 0;

  // Handlers
    const updateUserStatus = async (userId: string, updates: any) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("Failed to update user");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating user");
    }
  };

  const handleToggle2FA = (userId: string, currentStatus: boolean, email: string) => {
    updateUserStatus(userId, { twoFactorEnabled: !currentStatus });
  };

  const handleResetSecret = (userId: string, email: string) => {
    updateUserStatus(userId, { twoFactorSecret: null });
  };

  const handleUnlock = (userId: string, email: string) => {
    updateUserStatus(userId, { isLockedOut: false, failedAccessCount: 0, lockoutEnd: null, lockoutCount: 0 });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword) return;
    
    // In a real app we'd hash this or send it to a specialized endpoint
    // For now we simulate updating the force change flag.
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/auth/reset-password-admin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uid: selectedUserForPassword, newPassword: tempPassword })
      });
      if (res.ok) {
        setTempPassError(null);
        setSelectedUserForPassword(null);
        showNotification('Password updated successfully');
      } else {
        const err = await res.json();
        setTempPassError(err.error || 'Failed to update password');
      }
    } catch (err) {
      setTempPassError('Network error');
    }
  };

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col" dir={dir}>
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/20 mx-1">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mx-1">
                  {t('policy.title')}
                </h1>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 mx-1">
                  {t('tile.policy.badge')}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {t('policy.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionNotification && (
        <div className={`fixed top-24 z-50 animate-in fade-in slide-in-from-top-3 max-w-md ${dir === 'rtl' ? 'left-6' : 'right-6'}`}>
          <div className="p-3.5 rounded-xl shadow-xl border bg-slate-900 text-slate-100 border-cyan-500/50 flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mx-1" />
            <p className="text-xs font-medium">{actionNotification.message}</p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        
        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>{t('policy.totalUsers')}</span>
              <UserCheck className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{totalCount}</div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">TicketManagementDB</p>
          </div>

          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>{t('policy.twoFactorActive')}</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {active2FACount} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({compliancePercent}%)</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${compliancePercent}%` }}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>{t('policy.twoFactorDisabled')}</span>
              <ShieldOff className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-500 dark:text-amber-400 tracking-tight">{disabled2FACount}</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {language === 'ar' ? 'دخول مباشر بكلمة المرور' : 'Direct password sign-in'}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>{t('policy.lockedAccounts')}</span>
              <Lock className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            </div>
            <div className={`text-2xl font-bold tracking-tight ${lockedCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {lockedCount}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              {language === 'ar' ? 'سياسة الحظر: 6 محاولات (5 د / 10 د / 15 د)' : '6 attempts policy (5m / 10m / 15m)'}
            </p>
          </div>
        </div>

        {/* User Accounts & 2FA Policy Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-4 p-5">
          
          {/* Controls Bar: Search, Status Filter, Role, Dept */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={language === 'ar' ? 'بحث باسم الموظف أو البريد أو القسم...' : 'Search user name, email, department...'}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 transition"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex rounded-xl bg-slate-50 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    statusFilter === 'all' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {language === 'ar' ? 'الكل' : 'All'} ({users.length})
                </button>
                <button
                  onClick={() => setStatusFilter('2fa_active')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center space-x-1 ${
                    statusFilter === '2fa_active' ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>2FA Active ({active2FACount})</span>
                </button>
                <button
                  onClick={() => setStatusFilter('2fa_disabled')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center space-x-1 ${
                    statusFilter === '2fa_disabled' ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShieldOff className="w-3 h-3" />
                  <span>2FA Disabled ({disabled2FACount})</span>
                </button>
                {lockedCount > 0 && (
                  <button
                    onClick={() => setStatusFilter('locked')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center space-x-1 ${
                      statusFilter === 'locked' ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700/50' : 'text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300'
                    }`}
                  >
                    <Lock className="w-3 h-3" />
                    <span>Locked ({lockedCount})</span>
                  </button>
                )}
              </div>

              {/* Department Dropdown */}
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-cyan-500"
              >
                <option value="all">{language === 'ar' ? 'كافة الأقسام' : 'All Departments'}</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">{language === 'ar' ? 'المستخدم والهوية' : 'User Identity'}</th>
                  <th className="py-3 px-4">{language === 'ar' ? 'سياسة كلمة المرور' : 'Password Policy'}</th>
                  <th className="py-3 px-4">{language === 'ar' ? 'المصادقة الثنائية (2FA)' : '2FA Policy'}</th>
                  <th className="py-3 px-4">{language === 'ar' ? 'حالة الحساب' : 'Account Status'}</th>
                  
                  <th className="py-3 px-4 text-right">{language === 'ar' ? 'إجراءات أخرى' : 'Other Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {filteredUsers.map((user) => {
                  const isEffective2FA = global2FAEnforced || !!user.twoFactorEnabled;
                  const hasSecret = !!(user.hasTwoFactorSecret || user.twoFactorSecret);
                  const isCurrentUser = currentUser?.id === user.id;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      
                      {/* Identity Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${user.avatarColor}`}>
                            {user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-semibold text-slate-900 dark:text-white">{user.fullName}</span>
                              {user.id === 'usr_admin_01' && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                  Default Admin
                                </span>
                              )}
                              {isCurrentUser && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{user.email}</span>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              {isUserTechnical(user) ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <Wrench className="w-2.5 h-2.5 inline" /> {language === 'ar' ? 'فني' : 'Technical'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <Send className="w-2.5 h-2.5 inline" /> {language === 'ar' ? 'مشغل' : 'Operator'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Password Policy Column */}
                      <td className="py-3.5 px-4">
                        <div 
                          onClick={() => {
                            setSelectedUserForPolicy(user);
                            setPolicyData({
                              passwordMinLength: user.passwordMinLength || 8,
                              passwordRequireSpecial: user.passwordRequireSpecial || false,
                              passwordRequireNumber: user.passwordRequireNumber || false,
                              passwordRequireUppercase: user.passwordRequireUppercase || false,
                              passwordRequireLowercase: user.passwordRequireLowercase || false
                            });
                          }}
                          className="flex flex-col space-y-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-1.5 -ml-1.5 rounded-lg transition group"
                          title="Click to edit password policy"
                        >
                          <div className="flex items-center space-x-1">
                            <span className="text-slate-900 dark:text-slate-100 font-medium text-xs group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition">
                              {language === 'ar' ? 'الطول الأدنى:' : 'Min Length:'} {user.passwordMinLength || 8}
                            </span>
                          </div>
                          <div className="flex space-x-1 mt-0.5">
                            {(user.passwordRequireSpecial || user.passwordRequireNumber || user.passwordRequireUppercase || user.passwordRequireLowercase) ? (
                              <>
                                {user.passwordRequireUppercase && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded text-[9px] font-bold border border-blue-200 dark:border-blue-800">A-Z</span>}
                                {user.passwordRequireLowercase && <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 rounded text-[9px] font-bold border border-sky-200 dark:border-sky-800">a-z</span>}
                                {user.passwordRequireNumber && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 rounded text-[9px] font-bold border border-amber-200 dark:border-amber-800">0-9</span>}
                                {user.passwordRequireSpecial && <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 rounded text-[9px] font-bold border border-rose-200 dark:border-rose-800">!@#</span>}
                              </>
                            ) : (
                               <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">Standard</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2FA Policy Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center space-x-2">
                            {isEffective2FA ? (
                              <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400">
                                <ShieldCheck className="w-4 h-4 shrink-0" />
                                <span className="font-semibold text-xs">{t('policy.twoFactorActive')}</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1.5 text-amber-500 dark:text-amber-400">
                                <ShieldOff className="w-4 h-4 shrink-0" />
                                <span className="font-semibold text-xs">{t('policy.twoFactorDisabled')}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2 mt-1">
                            <button
                              type="button"
                              onClick={() => handleToggle2FA((user as any).uid || user.id, !!user.twoFactorEnabled, user.email)}
                              className={`px-2.5 py-1 rounded-md font-bold text-[10px] transition flex items-center space-x-1 border shadow-sm ${
                                user.twoFactorEnabled
                                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-900'
                                  : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-900'
                              }`}
                              title={user.twoFactorEnabled ? t('policy.deactivate') : t('policy.activate')}
                            >
                              {user.twoFactorEnabled ? (
                                <>
                                  <ShieldOff className="w-3 h-3" />
                                  <span>{t('policy.deactivate')}</span>
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>{t('policy.activate')}</span>
                                </>
                              )}
                            </button>
                            
                            {hasSecret && (
                              <button
                                type="button"
                                onClick={() => handleResetSecret((user as any).uid || user.id, user.email)}
                                className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition border border-slate-200 dark:border-slate-700"
                                title={t('policy.resetSecret')}
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="text-[9px] text-slate-500 dark:text-slate-400">
                            {hasSecret ? (
                              <span className="text-emerald-600 dark:text-emerald-400/90">
                                • {t('policy.secretSet')}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 italic">
                                • {t('policy.noSecret')}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Account Status Column */}
                      <td className="py-3.5 px-4">
                        <div 
                          className={`cursor-pointer inline-flex items-center space-x-1.5 px-2 py-1 rounded-md text-xs font-bold transition ${
                            user.isLockedOut 
                              ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800'
                              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800'
                          }`}
                          onClick={() => {
                            if (user.isLockedOut) {
                              const reason = user.lockoutEnd 
                                ? `Account locked due to multiple failed login attempts. Lockout expires at: ${new Date(user.lockoutEnd).toLocaleString()}`
                                : 'Account locked by administrator.';
                              alert(reason);
                            } else {
                              alert('Account is active and operating normally.');
                            }
                          }}
                        >
                          {user.isLockedOut ? (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>{language === 'ar' ? 'مقفول' : 'Locked'}</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{language === 'ar' ? 'نشط' : 'Active'}</span>
                            </>
                          )}
                        </div>
                        {user.isLockedOut && (
                          <div className="mt-2">
                             <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnlock((user as any).uid || user.id, user.email);
                                }}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition border border-slate-200 dark:border-slate-700"
                              >
                                {t('policy.unlock')}
                              </button>
                          </div>
                        )}
                      </td>
                      {/* Other Actions Column */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5 rtl:space-x-reverse">
                          <button
                            type="button"
                            onClick={() => setEditingUser(user)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 transition border border-blue-200 dark:border-blue-800 text-[11px] flex items-center space-x-1 rtl:space-x-reverse cursor-pointer"
                            title={language === 'ar' ? 'تعديل بيانات المستخدم' : 'Edit User'}
                          >
                            <Edit className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            <span>{language === 'ar' ? 'تعديل' : 'Edit'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUserForPassword(user.id);
                              setTempPassword('ChangeMe@2026!');
                              setTempPassError(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition border border-slate-200 dark:border-slate-700 text-[11px] flex items-center space-x-1 rtl:space-x-reverse cursor-pointer"
                            title="Reset password"
                          >
                            <KeyRound className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                            <span>Reset Pass</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No accounts found matching current query and filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      
      {/* Password Policy Modal */}
      {selectedUserForPolicy && (
        <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4" dir={dir}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400 mx-1" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mx-1">
                  {language === 'ar' ? 'سياسة كلمة المرور للحساب' : 'Account Password Policy'}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedUserForPolicy(null)}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePolicy} className="space-y-5 text-xs">
              
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium">
                  {language === 'ar' ? 'الحد الأدنى لطول كلمة المرور (8 - 64)' : 'Minimum Password Length (8 - 64)'}
                </label>
                <input
                  type="number"
                  min={8}
                  max={64}
                  required
                  value={policyData.passwordMinLength || ''}
                  onChange={(e) => setPolicyData({...policyData, passwordMinLength: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-slate-700 dark:text-slate-300 font-medium">
                  {language === 'ar' ? 'متطلبات التعقيد' : 'Complexity Requirements'}
                </label>
                
                <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" checked={policyData.passwordRequireUppercase} onChange={(e) => setPolicyData({...policyData, passwordRequireUppercase: e.target.checked})} className="peer sr-only" />
                    <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 peer-checked:bg-cyan-500 peer-checked:border-cyan-500 transition"></div>
                    <CheckCircle2 className="w-3 h-3 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition" />
                  </div>
                  <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition">
                     {language === 'ar' ? 'تتطلب أحرف كبيرة (A-Z)' : 'Require Uppercase Letters (A-Z)'}
                  </span>
                </label>

                <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" checked={policyData.passwordRequireLowercase} onChange={(e) => setPolicyData({...policyData, passwordRequireLowercase: e.target.checked})} className="peer sr-only" />
                    <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 peer-checked:bg-cyan-500 peer-checked:border-cyan-500 transition"></div>
                    <CheckCircle2 className="w-3 h-3 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition" />
                  </div>
                  <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition">
                     {language === 'ar' ? 'تتطلب أحرف صغيرة (a-z)' : 'Require Lowercase Letters (a-z)'}
                  </span>
                </label>

                <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" checked={policyData.passwordRequireNumber} onChange={(e) => setPolicyData({...policyData, passwordRequireNumber: e.target.checked})} className="peer sr-only" />
                    <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 peer-checked:bg-cyan-500 peer-checked:border-cyan-500 transition"></div>
                    <CheckCircle2 className="w-3 h-3 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition" />
                  </div>
                  <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition">
                     {language === 'ar' ? 'تتطلب أرقام (0-9)' : 'Require Numbers (0-9)'}
                  </span>
                </label>

                <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" checked={policyData.passwordRequireSpecial} onChange={(e) => setPolicyData({...policyData, passwordRequireSpecial: e.target.checked})} className="peer sr-only" />
                    <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 peer-checked:bg-cyan-500 peer-checked:border-cyan-500 transition"></div>
                    <CheckCircle2 className="w-3 h-3 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition" />
                  </div>
                  <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition">
                     {language === 'ar' ? 'تتطلب رموز خاصة (!@#)' : 'Require Special Characters (!@#)'}
                  </span>
                </label>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="text-slate-500 flex items-center space-x-1.5">
                   <Clock className="w-3.5 h-3.5" />
                   <span>
                      {language === 'ar' ? 'آخر تغيير لكلمة المرور:' : 'Last password change:'} 
                      {selectedUserForPolicy.passwordLastChangedAt 
                        ? new Date(selectedUserForPolicy.passwordLastChangedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')
                        : (language === 'ar' ? ' لم يتم التغيير قط' : ' Never changed')}
                   </span>
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPolicy(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer mx-1"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition shadow-sm cursor-pointer mx-1"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {selectedUserForPassword && (
        <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4" dir={dir}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-cyan-600 dark:text-cyan-400 mx-1" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mx-1">
                  {language === 'ar' ? 'إعادة تعيين كلمة المرور المؤقتة' : 'Reset Temporary Password'}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedUserForPassword(null)}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                {language === 'ar'
                  ? 'أدخل كلمة مرور مؤقتة متوافقة مع سياسة أمان المؤسسة (8 أحرف على الأقل، حرف كبير، حرف صغير، رقم، ورمز خاص).'
                  : 'Enter a temporary password adhering to organization policy (min 8 chars, uppercase, lowercase, digit, special character).'}
              </p>

              {tempPassError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                  {tempPassError}
                </div>
              )}

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium">
                  {language === 'ar' ? 'كلمة المرور المؤقتة' : 'Temporary Password'}
                </label>
                <input
                  type="text"
                  required
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPassword(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer mx-1"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition shadow-sm cursor-pointer mx-1"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} />
      )}
    </div>
  );
}
