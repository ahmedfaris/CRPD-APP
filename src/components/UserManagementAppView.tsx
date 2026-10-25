import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Users, ShieldCheck, ArrowLeft, FolderArchive, 
  UserPlus, Edit, Trash2, Lock, Unlock, LogOut, Search, 
  Wrench, Send, Filter, Shield, UserCheck, CheckCircle2 
} from 'lucide-react';
import { UserPolicyControlView } from './UserPolicyControlView';
import { UserManagementView } from './UserManagementView';
import { CreateUserModal } from './CreateUserModal';
import { EditUserModal } from './EditUserModal';
import { NotificationBell } from './NotificationBell';
import { ApplicationUser, isUserTechnical, isUserOperator } from '../types';

interface UserManagementAppViewProps {
  onBackToHub: () => void;
}

export function UserManagementAppView({ onBackToHub }: UserManagementAppViewProps) {
  const { t, language, dir } = useLanguage();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'roles' | 'policy'>('dashboard');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<ApplicationUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | 'OPERATOR' | 'TECHNICAL' | 'SYSTEM_ADMIN'>('ALL');
  
  const { users, adminDeleteUser, adminUpdateUser, currentUser, logout, isAdmin, hasPermission, switchUser } = useAuth();
  const canCreateUser = isAdmin || hasPermission('User & Role Management.Create') || hasPermission('users.create') || hasPermission('users.manage');
  const canEditUser = isAdmin || hasPermission('User & Role Management.Edit') || hasPermission('users.update') || hasPermission('users.manage');
  const canDeleteUser = isAdmin || hasPermission('User & Role Management.Delete') || hasPermission('users.delete') || hasPermission('users.manage');

  const totalUsers = users.length;
  const technicalUsers = users.filter(u => isUserTechnical(u)).length;
  const operatorUsers = users.filter(u => isUserOperator(u)).length;
  const adminUsers = users.filter(u => (u.userType || '').toLowerCase() === 'system admin' || (u.role || '').toLowerCase() === 'admin').length;
  const activeUsers = users.filter(u => !u.isLockedOut).length;

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Type filtering
      if (selectedTypeFilter === 'TECHNICAL' && !isUserTechnical(u)) return false;
      if (selectedTypeFilter === 'OPERATOR' && !isUserOperator(u)) return false;
      if (selectedTypeFilter === 'SYSTEM_ADMIN') {
        const isSysAdmin = (u.userType || '').toLowerCase() === 'system admin' || (u.role || '').toLowerCase() === 'admin';
        if (!isSysAdmin) return false;
      }

      // Search filtering
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (u.fullName || '').toLowerCase().includes(q);
        const matchesUser = (u.userName || '').toLowerCase().includes(q);
        const matchesEmail = (u.email || '').toLowerCase().includes(q);
        const matchesDept = (u.department || '').toLowerCase().includes(q);
        const matchesRole = (u.role || '').toLowerCase().includes(q);
        const matchesType = (u.userType || '').toLowerCase().includes(q);
        return matchesName || matchesUser || matchesEmail || matchesDept || matchesRole || matchesType;
      }

      return true;
    });
  }, [users, selectedTypeFilter, searchQuery]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 text-slate-900 font-sans" dir={dir}>
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 shadow-sm text-white select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6 rtl:space-x-reverse">
            <button
              onClick={onBackToHub}
              className="flex items-center space-x-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition cursor-pointer"
            >
              <ArrowLeft className={`w-4 h-4 mx-1 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
              <span>{t('nav.allApps')} ({language === 'ar' ? 'مركز مترو' : 'Metro Hub'})</span>
            </button>
            <span className="text-xs text-slate-400 font-mono">
              {language === 'ar' ? 'التطبيق: ' : 'App: '}
              <strong className="text-slate-100">{language === 'ar' ? 'إدارة المستخدمين' : 'User Management'}</strong>
            </span>
          </div>

          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <NotificationBell variant="dark" />
            {currentUser && (
              <span className="text-xs text-slate-300 hidden sm:inline-block font-medium">
                {currentUser.fullName}
              </span>
            )}
            <button
              onClick={logout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 text-rose-300 transition cursor-pointer"
              title={t('nav.logout')}
            >
              <LogOut className="w-3.5 h-3.5 mx-1 text-rose-400" />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center space-x-6 rtl:space-x-reverse -mb-px overflow-x-auto no-scrollbar">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-bold text-sm whitespace-nowrap transition cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 mx-1" />
              <span>{language === 'ar' ? 'لوحة تحكم المستخدمين' : 'Users Dashboard'}</span>
            </button>
            <button
              onClick={() => setCurrentTab('roles')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-bold text-sm whitespace-nowrap transition cursor-pointer ${
                currentTab === 'roles'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Users className="w-4 h-4 mx-1" />
              <span>{language === 'ar' ? 'إدارة أدوار المستخدمين' : 'Users Role Management'}</span>
            </button>
            <button
              onClick={() => setCurrentTab('policy')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-bold text-sm whitespace-nowrap transition cursor-pointer ${
                currentTab === 'policy'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <ShieldCheck className="w-4 h-4 mx-1" />
              <span>{language === 'ar' ? 'إدارة السياسات الأمنية' : 'User Policy Management'}</span>
            </button>
          </nav>
        </div>
      </div>

      <main className="flex-1 w-full bg-slate-50">
        {currentTab === 'dashboard' && (
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            
            {/* Top Stats Overview with User Types */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div 
                onClick={() => setSelectedTypeFilter('ALL')}
                className={`p-4 rounded-2xl border transition cursor-pointer ${
                  selectedTypeFilter === 'ALL' 
                    ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-500/20' 
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold">{language === 'ar' ? 'إجمالي المستخدمين' : 'Total Users'}</span>
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{totalUsers}</div>
                <div className="text-[11px] text-slate-500 mt-1">{activeUsers} {language === 'ar' ? 'نشط في النظام' : 'active accounts'}</div>
              </div>

              <div 
                onClick={() => setSelectedTypeFilter('OPERATOR')}
                className={`p-4 rounded-2xl border transition cursor-pointer ${
                  selectedTypeFilter === 'OPERATOR' 
                    ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-500/20' 
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold">{language === 'ar' ? 'مشغل (Operator)' : 'Operators'}</span>
                  <Send className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold text-amber-700">{operatorUsers}</div>
                <div className="text-[11px] text-slate-500 mt-1">{language === 'ar' ? 'إنشاء التذاكر وعرض تذاكر القسم' : 'Create & dept tickets'}</div>
              </div>

              <div 
                onClick={() => setSelectedTypeFilter('TECHNICAL')}
                className={`p-4 rounded-2xl border transition cursor-pointer ${
                  selectedTypeFilter === 'TECHNICAL' 
                    ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20' 
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold">{language === 'ar' ? 'فني (Technical)' : 'Technical Staff'}</span>
                  <Wrench className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-emerald-700">{technicalUsers}</div>
                <div className="text-[11px] text-slate-500 mt-1">{language === 'ar' ? 'حل التذاكر والانضمام للفرق' : 'Solve tickets & join teams'}</div>
              </div>

              <div 
                onClick={() => setSelectedTypeFilter('SYSTEM_ADMIN')}
                className={`p-4 rounded-2xl border transition cursor-pointer ${
                  selectedTypeFilter === 'SYSTEM_ADMIN' 
                    ? 'bg-purple-50/70 border-purple-400 ring-2 ring-purple-500/20' 
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold">{language === 'ar' ? 'مسؤولو النظام' : 'System Admins'}</span>
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-purple-700">{adminUsers}</div>
                <div className="text-[11px] text-slate-500 mt-1">{language === 'ar' ? 'صلاحيات إدارة كاملة' : 'Full governance & admin'}</div>
              </div>
            </div>

            {/* Controls Bar: Search, Type Filter Tabs, and Create Action */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 flex-1 max-w-md relative">
                <Search className={`w-4 h-4 text-slate-400 absolute ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === 'ar' ? 'بحث بالاسم، الحساب، القسم، الدور، أو نوع المستخدم...' : 'Search by name, username, dept, role, or user type...'}
                  className={`w-full py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-slate-400 hover:text-slate-600 font-bold px-1"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                <span className="text-xs text-slate-500 font-bold whitespace-nowrap flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  {language === 'ar' ? 'تصفية النوع:' : 'Type:'}
                </span>

                <button
                  onClick={() => setSelectedTypeFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    selectedTypeFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {language === 'ar' ? 'الكل' : 'All'} ({totalUsers})
                </button>

                <button
                  onClick={() => setSelectedTypeFilter('OPERATOR')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    selectedTypeFilter === 'OPERATOR'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  <Send className="w-3 h-3" />
                  <span>{language === 'ar' ? 'مشغل' : 'Operator'} ({operatorUsers})</span>
                </button>

                <button
                  onClick={() => setSelectedTypeFilter('TECHNICAL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    selectedTypeFilter === 'TECHNICAL'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  <Wrench className="w-3 h-3" />
                  <span>{language === 'ar' ? 'فني' : 'Technical'} ({technicalUsers})</span>
                </button>

                <button
                  onClick={() => setSelectedTypeFilter('SYSTEM_ADMIN')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    selectedTypeFilter === 'SYSTEM_ADMIN'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>{language === 'ar' ? 'مسؤول نظام' : 'System Admin'} ({adminUsers})</span>
                </button>
              </div>

              {canCreateUser && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer shrink-0"
                >
                  <UserPlus className="w-4 h-4 mx-1" />
                  <span>{language === 'ar' ? 'إنشاء مستخدم جديد' : 'Create New User'}</span>
                </button>
              )}
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className={`w-full text-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-xs">
                    <tr>
                      <th className="py-4 px-6">{language === 'ar' ? 'الاسم الكامل' : 'Full Name'}</th>
                      <th className="py-4 px-6">{language === 'ar' ? 'نوع المستخدم (User Type)' : 'User Type'}</th>
                      <th className="py-4 px-6">{language === 'ar' ? 'القسم' : 'Department'}</th>
                      <th className="py-4 px-6">{language === 'ar' ? 'الدور' : 'Role'}</th>
                      <th className="py-4 px-6">{language === 'ar' ? 'اسم الحساب' : 'Account Name'}</th>
                      <th className="py-4 px-6">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                      <th className="py-4 px-6">{language === 'ar' ? 'آخر ظهور' : 'Last Online'}</th>
                      <th className="py-4 px-6 text-center">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="font-semibold">{language === 'ar' ? 'لم يتم العثور على مستخدمين مطابقين' : 'No matching users found'}</p>
                          <p className="text-xs mt-1 text-slate-400">{language === 'ar' ? 'جرب تغيير معايير البحث أو التصفية' : 'Try adjusting your search query or type filter'}</p>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isTechnical = isUserTechnical(u);
                        const isOperator = isUserOperator(u);
                        const isSysAdmin = (u.userType || '').toLowerCase() === 'system admin' || (u.role || '').toLowerCase() === 'admin';

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/60 transition">
                            {/* Full Name & Avatar */}
                            <td className="py-4 px-6 font-bold text-slate-900 flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${u.avatarColor} mx-2 shrink-0 shadow-xs text-white`}>
                                {u.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                              </div>
                              <div>
                                <span className="block">{u.fullName}</span>
                                <span className="text-[11px] text-slate-400 font-mono font-normal">{u.email}</span>
                              </div>
                            </td>

                            {/* USER TYPE COLUMN (DISPLAY USER TYPE) */}
                            <td className="py-4 px-6">
                              {isSysAdmin ? (
                                <div className="inline-flex flex-col items-start">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                                    <span>{language === 'ar' ? 'مسؤول نظام' : 'System Admin'}</span>
                                  </span>
                                  <span className="text-[10px] text-purple-600 mt-0.5 font-medium">
                                    {language === 'ar' ? 'صلاحيات إدارة كاملة' : 'Full Admin Scope'}
                                  </span>
                                </div>
                              ) : isTechnical ? (
                                <div className="inline-flex flex-col items-start">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{language === 'ar' ? 'فني (Technical)' : 'Technical'}</span>
                                  </span>
                                  <span className="text-[10px] text-emerald-600 mt-0.5 font-medium">
                                    {language === 'ar' ? 'حل التذاكر والدعم' : 'Solves Tickets & Teams'}
                                  </span>
                                </div>
                              ) : (
                                <div className="inline-flex flex-col items-start">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                    <Send className="w-3.5 h-3.5 text-amber-600" />
                                    <span>{language === 'ar' ? 'مشغل (Operator)' : 'Operator'}</span>
                                  </span>
                                  <span className="text-[10px] text-amber-700 mt-0.5 font-medium">
                                    {language === 'ar' ? 'إنشاء التذاكر والقسم' : 'Create & Dept Tickets'}
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Department */}
                            <td className="py-4 px-6 text-slate-600">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {u.department || 'N/A'}
                              </span>
                            </td>

                            {/* Role */}
                            <td className="py-4 px-6 text-slate-600">
                              <span className="text-xs font-semibold text-slate-700">
                                {u.role || 'Employee'}
                              </span>
                            </td>

                            {/* Account Name */}
                            <td className="py-4 px-6 text-slate-600 font-mono text-xs">{u.userName}</td>

                            {/* Account Status */}
                            <td className="py-4 px-6">
                              <div className="flex items-center space-x-2">
                                {u.isLockedOut ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700">
                                    {language === 'ar' ? 'مغلق' : 'Locked'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">
                                    {language === 'ar' ? 'نشط' : 'Active'}
                                  </span>
                                )}
                                <button
                                  onClick={() => adminUpdateUser(u.id, { isLockedOut: !u.isLockedOut })}
                                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                  title={u.isLockedOut ? 'Unlock User' : 'Lock User'}
                                >
                                  {u.isLockedOut ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>

                            {/* Last Online */}
                            <td className="py-4 px-6 text-slate-500 text-xs">
                              {new Date(u.lastActiveAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                            </td>

                             {/* Actions */}
                            <td className="py-4 px-6">
                              <div className="flex items-center justify-center space-x-2 rtl:space-x-reverse">
                                <button
                                  type="button"
                                  onClick={() => {
                                    switchUser(u.id);
                                    onBackToHub();
                                  }}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                  title={language === 'ar' ? `التبديل إلى حساب (${u.fullName}) لتجربة الصلاحيات` : `Switch to (${u.fullName}) to test permissions`}
                                >
                                  <UserCheck className="w-4 h-4" />
                                </button>
                                {canEditUser && (
                                  <button 
                                    type="button"
                                    id={`edit-user-btn-${u.id}`}
                                    onClick={() => setEditingUser(u)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer" 
                                    title={language === 'ar' ? 'تعديل بيانات المستخدم' : 'Edit User'}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                )}
                                {canDeleteUser && (
                                  <button 
                                    onClick={() => {
                                      if (window.confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المستخدم؟' : 'Are you sure you want to delete this user?')) {
                                        adminDeleteUser(u.id);
                                      }
                                    }}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer" 
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'roles' && (
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            <UserManagementView onOpenCreateModal={() => setShowCreateModal(true)} />
          </div>
        )}

        {currentTab === 'policy' && (
          <UserPolicyControlView onBackToHub={() => {}} />
        )}
      </main>

      {showCreateModal && (
        <CreateUserModal onClose={() => setShowCreateModal(false)} />
      )}

      {editingUser && (
        <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} />
      )}
    </div>
  );
}
