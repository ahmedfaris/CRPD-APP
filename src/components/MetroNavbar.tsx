import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { NotificationBell } from './NotificationBell';
import { 
  LogOut, 
  Languages, 
  User, 
  ShieldCheck, 
  Grid, 
  ChevronDown, 
  Layers,
  Archive,
  Users,
  Sliders,
  FolderArchive,
  Moon,
  Sun,
  UserCheck
} from 'lucide-react';

interface MetroNavbarProps {
  currentApp: 'metro' | 'tickets' | 'archiving' | 'employees' | 'policy' | 'org-structure' | 'devices';
  onSelectApp: (app: 'metro' | 'tickets' | 'archiving' | 'employees' | 'policy' | 'org-structure' | 'devices') => void;
  onSelectTicket?: (ticketId: string) => void;
}

export function MetroNavbar({ currentApp, onSelectApp, onSelectTicket }: MetroNavbarProps) {
  const { currentUser, logout, users, switchUser } = useAuth();
  const { language, toggleLanguage, t, dir } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white select-none shadow-sm" dir={dir}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Organization Branding & App Selector */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => onSelectApp('metro')}
            className={`flex items-center space-x-3 group focus:outline-hidden ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
            title={language === 'ar' ? 'العودة إلى مركز مترو' : 'Return to Metro Hub'}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition">
              <Grid className="w-5 h-5" />
            </div>
            <div className="mx-2">
              <div className="flex items-center space-x-2">
                <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                  CRPD APP
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 mx-1">
                  {language === 'ar' ? 'مركز التطبيقات' : 'Metro Hub'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                {t('app.subtitle')}
              </p>
            </div>
          </button>

          {/* Breadcrumb if inside an app */}
          {currentApp !== 'metro' && (
            <div className={`hidden md:flex items-center space-x-2 ${dir === 'rtl' ? 'border-r pr-4 mr-2' : 'border-l pl-4 ml-2'} border-slate-200 dark:border-slate-700 text-xs`}>
              <button
                onClick={() => onSelectApp('metro')}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center space-x-1 cursor-pointer"
              >
                <span>{t('metro.hub')}</span>
              </button>
              <span className="text-slate-300 dark:text-slate-600 mx-1">/</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center space-x-1.5">
                {currentApp === 'tickets' && <Layers className="w-3.5 h-3.5 mx-1" />}
                {currentApp === 'archiving' && <Archive className="w-3.5 h-3.5 mx-1" />}
                {currentApp === 'employees' && <Users className="w-3.5 h-3.5 mx-1" />}
                {currentApp === 'policy' && <Sliders className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400 mx-1" />}
                {currentApp === 'org-structure' && <Users className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 mx-1" />}
                {currentApp === 'devices' && <Grid className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400 mx-1" />}
                <span>
                  {currentApp === 'tickets' && t('nav.tickets')}
                  {currentApp === 'archiving' && t('nav.archiving')}
                  {currentApp === 'employees' && t('nav.employees')}
                  {currentApp === 'policy' && t('nav.policy')}
                  {currentApp === 'org-structure' && (language === 'ar' ? 'الهيكل التنظيمي' : 'Org Structure')}
                  {currentApp === 'devices' && (language === 'ar' ? 'إدارة الأصول' : 'Asset Management')}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Right Controls: Quick App Jump, Language Toggle, and Profile Dropdown */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          
          {/* Quick Apps Switcher Buttons if inside an app */}
          {currentApp !== 'metro' && (
            <button
              onClick={() => onSelectApp('metro')}
              className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              title={language === 'ar' ? 'العودة إلى مركز التطبيقات' : 'Return to Metro Hub'}
            >
              <Grid className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 mx-0.5" />
              <span className="hidden sm:inline">{t('nav.allApps')}</span>
            </button>
          )}

          {/* NOTIFICATION BELL ICON */}
          <NotificationBell 
            onSelectTicket={onSelectTicket} 
            variant="metro"
          />

          {/* LANGUAGE TOGGLE BUTTON (Arabic / English) */}
          <button
            onClick={toggleLanguage}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition shadow-sm hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer"
            title={language === 'en' ? 'التحويل إلى اللغة العربية' : 'Switch to English'}
          >
            <Languages className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0 mx-1" />
            <span className="tracking-wide">{language === 'en' ? 'العربية' : 'English'}</span>
          </button>

          {/* PROFILE & LOGOUT DROPDOWN */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center space-x-2.5 p-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 transition focus:outline-hidden hover:border-blue-500/50 cursor-pointer"
            >
              <div className={`w-8 h-8 rounded-lg ${currentUser?.avatarColor || 'bg-blue-600 text-white'} flex items-center justify-center font-bold text-xs shadow-sm`}>
                {currentUser?.fullName
                  ? currentUser.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)
                  : 'U'}
              </div>

              <div className={`hidden sm:block ${dir === 'rtl' ? 'text-right' : 'text-left'} mx-1.5`}>
                <div className="text-xs font-bold text-slate-100 flex items-center space-x-1.5">
                  <span className="truncate max-w-[120px]">{currentUser?.fullName}</span>
                  <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0 mx-1" />
                </div>
                <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <span className="truncate max-w-[100px]">{currentUser?.role}</span>
                </div>
              </div>

              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile Menu Popover */}
            {profileOpen && (
              <div className={`absolute ${dir === 'rtl' ? 'left-0' : 'right-0'} mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-3 z-50 text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95`} dir={dir}>
                
                {/* User Details Header */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950/70 rounded-xl border border-slate-200 dark:border-slate-800 mb-2">
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-10 h-10 rounded-xl ${currentUser?.avatarColor || 'bg-blue-600'} flex items-center justify-center font-bold text-sm text-white shadow-sm shrink-0`}>
                      {currentUser?.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="overflow-hidden mx-2">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser?.fullName}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">{currentUser?.email}</p>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">{t('nav.currentRole')}:</span>
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                      {currentUser?.role}
                    </span>
                  </div>
                </div>

                {/* Switch Identity (For Permissions Testing) */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 mb-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center justify-between">
                    <span>{language === 'ar' ? 'تبديل الهوية (فحص الصلاحيات)' : 'Switch Identity (Test Roles)'}</span>
                    <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {users.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          switchUser(u.id);
                          onSelectApp('metro');
                          setProfileOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-1.5 px-2 rounded-lg text-xs transition cursor-pointer ${
                          u.email === currentUser?.email
                            ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <span className="truncate max-w-[140px] text-start">{u.fullName}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono">
                          {u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme Toggle */}
                <button
                  onClick={() => {
                    toggleTheme();
                    setProfileOpen(false);
                  }}
                  className="w-full flex items-center space-x-2 p-2 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition mb-1 cursor-pointer"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 mx-1" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 mx-1" />
                  )}
                  <span className="font-medium">
                    {theme === 'dark' ? (language === 'ar' ? 'المظهر الفاتح' : 'Light Mode') : (language === 'ar' ? 'المظهر الداكن' : 'Dark Mode')}
                  </span>
                </button>

                {/* LOGOUT BUTTON */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center justify-center space-x-2 p-2 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/70 border border-rose-200 dark:border-rose-800/80 text-rose-600 dark:text-rose-200 transition shadow-sm cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-500 dark:text-rose-400 mx-1" />
                    <span>{t('nav.logout')}</span>
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
}
