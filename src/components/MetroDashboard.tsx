import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTickets } from '../context/TicketContext';
import { useDevices } from '../context/DeviceContext';
import { 
  Layers, 
  Archive, 
  Users, 
  ShieldCheck, 
  ShieldOff,
  Activity, 
  Clock, 
  ArrowRight, 
  QrCode, 
  Server,
  Lock,
  ExternalLink,
  ChevronRight,
  Sliders,
  FolderArchive,
  Settings,
  Image as ImageIcon,
  Wrench,
  Folders,
  FileCheck,
  Laptop,
  Network
} from 'lucide-react';

interface MetroDashboardProps {
  onSelectApp: (app: 'tickets' | 'archiving' | 'employees' | 'policy' | 'org-structure' | 'devices') => void;
  ticketCount: number;
  documentCount: number;
  employeeCount: number;
  onOpenSettings?: () => void;
}

export function MetroDashboard({ 
  onSelectApp, 
  ticketCount, 
  documentCount, 
  employeeCount,
  onOpenSettings
}: MetroDashboardProps) {
  const { currentUser, users, global2FAEnforced, serverToleranceSeconds, canAccessApp, isAdmin } = useAuth();
  const { systemSettings, teams } = useTickets();
  const { devices } = useDevices();
  const { t, language, dir } = useLanguage();

  const usersWith2FA = users.filter(u => global2FAEnforced || u.twoFactorEnabled).length;
  const adminHas2FA = users.find(u => u.id === 'usr_admin_01')?.twoFactorEnabled;

  const canTickets = canAccessApp('tickets');
  const canArchiving = canAccessApp('archiving');
  const canEmployees = canAccessApp('employees');
  const canOrgStructure = canAccessApp('org-structure');
  const canDevices = canAccessApp('devices');
  const canPolicy = canAccessApp('policy');

  const visibleTilesCount = [canTickets, canArchiving, canEmployees, canOrgStructure, canDevices, canPolicy, isAdmin].filter(Boolean).length;

  return (
    <div className="min-h-[calc(100vh-4rem)] dark:bg-slate-950 bg-slate-50 dark:text-slate-100 text-slate-900 p-4 sm:p-6 lg:p-8" dir={dir}>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Metro Header / Welcome Ribbon */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {t('metro.welcome')} <span className="text-blue-600 dark:text-blue-400">{currentUser?.fullName}</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('metro.orgOverview')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-3 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900/80 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400 mx-1" />
              <span className="font-mono">
                {new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="text-slate-300 dark:text-slate-600 mx-1">|</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{language === 'ar' ? 'الأنظمة متصلة وتعمل' : 'Live Systems Online'}</span>
            </div>
          </div>
        </div>

        {/* METRO TILES GRID: Organization Applications */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          
          {/* TILE 1: TICKET MANAGEMENT */}
          {canTickets && (
            <div
              onClick={() => onSelectApp('tickets')}
              className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 p-6 shadow-xl border border-blue-600/40 hover:border-blue-400 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1 flex flex-col justify-between min-h-[260px]"
            >
              <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl group-hover:scale-150 transition duration-500 pointer-events-none" />

              <div>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition duration-300">
                    <Layers className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/15 text-blue-100 border border-white/20 backdrop-blur-xs">
                    {ticketCount} {language === 'ar' ? 'تذاكر' : 'Tickets'}
                  </span>
                </div>

                <div className="mt-5">
                  <h2 className="text-lg font-bold text-white tracking-tight group-hover:text-blue-200 transition">
                    {t('tile.tickets.title')}
                  </h2>
                  <p className="text-xs text-blue-100/80 mt-2 line-clamp-2 leading-relaxed">
                    {t('tile.tickets.desc')}
                  </p>
                </div>
              </div>

              <div className="pt-5 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center space-x-1.5 text-blue-200">
                  <Activity className="w-3.5 h-3.5 text-emerald-400 mx-1" />
                  <span>{t('tile.tickets.stat')}</span>
                </span>
                <div className={`flex items-center space-x-1 text-white transition ${dir === 'rtl' ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`}>
                  <span>{language === 'ar' ? 'فتح' : 'Open'}</span>
                  <ChevronRight className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>
          )}

          {/* TILE 2: ARCHIVING & RECORDS */}
          {canArchiving && (
            <div
              onClick={() => onSelectApp('archiving')}
              className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-teal-800 to-emerald-950 p-6 shadow-xl border border-emerald-600/40 hover:border-emerald-400 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-1 flex flex-col justify-between min-h-[260px]"
            >
              <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl group-hover:scale-150 transition duration-500 pointer-events-none" />

              <div>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition duration-300">
                    <Archive className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/15 text-emerald-100 border border-white/20 backdrop-blur-xs">
                    {documentCount} {language === 'ar' ? 'وثائق' : 'Records'}
                  </span>
                </div>

                <div className="mt-5">
                  <h2 className="text-lg font-bold text-white tracking-tight group-hover:text-emerald-200 transition">
                    {t('tile.archiving.title')}
                  </h2>
                  <p className="text-xs text-emerald-100/80 mt-2 line-clamp-2 leading-relaxed">
                    {t('tile.archiving.desc')}
                  </p>
                </div>
              </div>

              <div className="pt-5 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center space-x-1.5 text-emerald-200">
                  <QrCode className="w-3.5 h-3.5 text-cyan-300 mx-1" />
                  <span>{t('tile.archiving.stat')}</span>
                </span>
                <div className={`flex items-center space-x-1 text-white transition ${dir === 'rtl' ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`}>
                  <span>{language === 'ar' ? 'فتح' : 'Open'}</span>
                  <ChevronRight className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>
          )}

          {/* TILE 3: EMPLOYEE MANAGEMENT */}
          {canEmployees && (
            <div
              onClick={() => onSelectApp('employees')}
              className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-purple-800 to-indigo-950 p-6 shadow-xl border border-violet-600/40 hover:border-violet-400 transition-all duration-300 hover:shadow-2xl hover:shadow-violet-500/20 hover:-translate-y-1 flex flex-col justify-between min-h-[260px]"
            >
              <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-purple-500/10 rounded-full blur-2xl group-hover:scale-150 transition duration-500 pointer-events-none" />

              <div>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition duration-300">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/15 text-purple-100 border border-white/20 backdrop-blur-xs">
                    {employeeCount} {language === 'ar' ? 'كوادر' : 'Staff'}
                  </span>
                </div>

                <div className="mt-5">
                  <h2 className="text-lg font-bold text-white tracking-tight group-hover:text-purple-200 transition">
                    {t('tile.employees.title')}
                  </h2>
                  <p className="text-xs text-purple-100/80 mt-2 line-clamp-2 leading-relaxed">
                    {t('tile.employees.desc')}
                  </p>
                </div>
              </div>

              <div className="pt-5 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center space-x-1.5 text-purple-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-300 mx-1" />
                  <span>{t('tile.employees.stat')}</span>
                </span>
                <div className={`flex items-center space-x-1 text-white transition ${dir === 'rtl' ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`}>
                  <span>{language === 'ar' ? 'فتح' : 'Open'}</span>
                  <ChevronRight className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>
          )}

          {/* TILE 4: ORGANIZATIONAL STRUCTURE */}
          {canOrgStructure && (
            <div
              onClick={() => onSelectApp('org-structure')}
              className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 via-orange-700 to-amber-900 p-6 shadow-xl border border-amber-500/40 hover:border-amber-400 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/20 hover:-translate-y-1 flex flex-col justify-between min-h-[260px]"
            >
              <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl group-hover:scale-150 transition duration-500 pointer-events-none" />

              <div>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition duration-300">
                    <Folders className="w-6 h-6" />
                  </div>
                </div>

                <div className="mt-5">
                  <h2 className="text-lg font-bold text-white tracking-tight group-hover:text-amber-200 transition">
                    {language === 'ar' ? 'الهيكل التنظيمي' : 'Organizational Structure'}
                  </h2>
                  <p className="text-xs text-amber-100/80 mt-2 line-clamp-2 leading-relaxed">
                    {language === 'ar' ? 'إدارة الهيكل التنظيمي للشركة والإدارات والأقسام' : 'Manage the company organizational structure, directorates, departments, and divisions'}
                  </p>
                </div>
              </div>

              <div className="pt-5 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center space-x-1.5 text-amber-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-300 mx-1" />
                  <span>{language === 'ar' ? 'صلاحيات الإدارة' : 'Management Access'}</span>
                </span>
                <div className={`flex items-center space-x-1 text-white transition ${dir === 'rtl' ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`}>
                  <span>{language === 'ar' ? 'فتح' : 'Open'}</span>
                  <ChevronRight className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>
          )}

          {/* TILE 5: ASSET MANAGEMENT */}
          {canDevices && (
            <div
              onClick={() => onSelectApp('devices')}
              className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-700 via-blue-800 to-slate-900 p-6 shadow-xl border border-cyan-500/40 hover:border-cyan-400 transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/20 hover:-translate-y-1 flex flex-col justify-between min-h-[260px]"
            >
              <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-cyan-500/10 rounded-full blur-2xl group-hover:scale-150 transition duration-500 pointer-events-none" />

              <div>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition duration-300">
                    <Laptop className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/15 text-cyan-100 border border-white/20 backdrop-blur-xs">
                    {devices.length} {language === 'ar' ? 'أصول' : 'Assets'}
                  </span>
                </div>

                <div className="mt-5">
                  <h2 className="text-lg font-bold text-white tracking-tight group-hover:text-cyan-200 transition">
                    {language === 'ar' ? 'إدارة الأصول' : 'Asset Management App'}
                  </h2>
                  <p className="text-xs text-cyan-100/80 mt-2 line-clamp-2 leading-relaxed">
                    {language === 'ar' 
                      ? 'جرد وإدارة الأصول التقنية: الحواسيب، الطابعات، الشاشات، أجهزة البصمة، السكانر، والراوترات والسويتشات مع متابعة الضمان وسجل الصيانة وتاريخ انتقال الأقسام.' 
                      : 'Manage computers, printers, screens, biometric readers, scanners, routers & switches with warranty tracking, maintenance logs, and department history.'}
                  </p>
                </div>
              </div>

              <div className="pt-5 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center space-x-1.5 text-cyan-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-300 mx-1" />
                  <span>
                    {devices.filter(d => d.isWarrantyActive).length} {language === 'ar' ? 'تحت الضمان' : 'In Warranty'}
                  </span>
                </span>
                <div className={`flex items-center space-x-1 text-white transition ${dir === 'rtl' ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`}>
                  <span>{language === 'ar' ? 'فتح' : 'Open'}</span>
                  <ChevronRight className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>
          )}
          
          {/* TILE 6: USER POLICY & ROLES */}
          {canPolicy && (
            <div
              onClick={() => onSelectApp('policy')}
              className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-rose-700 via-pink-800 to-rose-950 p-6 shadow-xl border border-rose-600/40 hover:border-rose-400 transition-all duration-300 hover:shadow-2xl hover:shadow-rose-500/20 hover:-translate-y-1 flex flex-col justify-between min-h-[260px]"
            >
              <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-rose-500/10 rounded-full blur-2xl group-hover:scale-150 transition duration-500 pointer-events-none" />

              <div>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition duration-300">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                </div>

                <div className="mt-5">
                  <h2 className="text-lg font-bold text-white tracking-tight group-hover:text-rose-200 transition">
                    {t('metro.status.title')}
                  </h2>
                  <p className="text-xs text-rose-100/80 mt-2 line-clamp-2 leading-relaxed">
                    {global2FAEnforced
                      ? (language === 'ar' ? 'المصادقة الثنائية إلزامية على كافة المستخدمين.' : 'Global 2FA is strictly enforced across all accounts.')
                      : (language === 'ar' ? 'السياسة المرنة مفعلة: المسؤول الافتراضي بدون 2FA، ويتم التحكم بتفعيل/تعطيل 2FA لكل مستخدم.' : 'Selective policy: Default Admin is without 2FA, per-user toggle is enabled.')}
                  </p>
                </div>
              </div>

              <div className="pt-5 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center space-x-1.5 text-rose-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-300 mx-1" />
                  <span>
                    {language === 'ar' 
                      ? `السماحية: ±${serverToleranceSeconds}ث` 
                      : `Tolerance: ±${serverToleranceSeconds}s`}
                  </span>
                </span>
                <div className={`flex items-center space-x-1 text-white transition ${dir === 'rtl' ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`}>
                  <span>{language === 'ar' ? 'فتح' : 'Open'}</span>
                  <ChevronRight className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>
          )}

          {/* TILE 7: SYSTEM SETTINGS (Admin Only) */}
          {isAdmin && (
            <div
              onClick={onOpenSettings}
              className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 via-slate-800 to-black p-6 shadow-xl border border-slate-600/40 hover:border-slate-400 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-500/20 hover:-translate-y-1 flex flex-col justify-between min-h-[260px]"
            >
              <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-slate-500/10 rounded-full blur-2xl group-hover:scale-150 transition duration-500 pointer-events-none" />

              <div>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition duration-300">
                    <Settings className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/15 text-slate-100 border border-white/20 backdrop-blur-xs">
                    {language === 'ar' ? 'تحكم المسؤول' : 'Admin Control'}
                  </span>
                </div>

                <div className="mt-5">
                  <h2 className="text-lg font-bold text-white tracking-tight group-hover:text-slate-200 transition">
                    {language === 'ar' ? 'إعدادات النظام' : 'System Settings'}
                  </h2>
                  <p className="text-xs text-slate-300/80 mt-2 line-clamp-2 leading-relaxed">
                    {language === 'ar'
                      ? 'تكوين ضوابط النظام والإعدادات العامة والتفضيلات.'
                      : 'Configure global system settings, preferences, and operational controls.'}
                  </p>
                </div>
              </div>

              <div className="pt-5 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center space-x-1.5 text-slate-300">
                  <Settings className="w-3.5 h-3.5 text-slate-400 mx-1" />
                  <span>{language === 'ar' ? 'إدارة النظام' : 'System Mgt'}</span>
                </span>
                <div className={`flex items-center space-x-1 text-white transition ${dir === 'rtl' ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`}>
                  <span>{language === 'ar' ? 'فتح' : 'Open'}</span>
                  <ChevronRight className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>
          )}

          {/* EMPTY STATE: USER HAS NO PERMISSIONS ON ANY APP */}
          {visibleTilesCount === 0 && (
            <div className="col-span-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                {language === 'ar' ? 'لا توجد تطبيقات مخصصة لحسابك' : 'No Applications Assigned'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                {language === 'ar' 
                  ? 'دورك الحالي في النظام لا يحتوي على صلاحيات للوصول إلى أي تطبيقات. يرجى التواصل مع مسؤول النظام لتحديث صلاحيات حسابك.'
                  : 'Your current role does not have permissions to access any applications. Please contact your system administrator to assign the necessary roles.'}
              </p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
