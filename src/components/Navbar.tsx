import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { NotificationBell } from './NotificationBell';
import { 
  LifeBuoy, 
  Users, 
  BarChart3, 
  Terminal, 
  LogOut, 
  ChevronDown, 
  PlusCircle, 
  AlertTriangle,
  Database,
  Grid,
  Languages,
  Moon,
  Sun,
  LayoutDashboard,
  Ticket
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'tickets' | 'dashboard' | 'users';
  onSelectTab: (tab: 'tickets' | 'dashboard' | 'users') => void;
  onOpenCreateTicket?: () => void;
  onBackToMetro?: () => void;
  onSelectTicket?: (ticketId: string) => void;
}

export function Navbar({ 
  currentTab, 
  onSelectTab, 
  onBackToMetro,
  onSelectTicket
}: NavbarProps) {
  const { currentUser, logout, isAdmin, canAccessTeamManagement } = useAuth();
  const { t, language, toggleLanguage, dir } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Agent':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Employee':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-slate-100 border-b border-slate-800 shadow-md select-none" dir={dir}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo, Metro Hub link & Identity */}
          <div className="flex items-center space-x-4">
            
            {onBackToMetro && (
              <button
                onClick={onBackToMetro}
                className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-bold transition group cursor-pointer"
                title={language === 'ar' ? 'العودة إلى مركز مترو' : 'Return to Metro Hub'}
              >
                <Grid className="w-4.5 h-4.5 text-blue-400 group-hover:rotate-45 transition-transform mx-1" />
                <span className="hidden sm:inline">{t('nav.allApps')}</span>
              </button>
            )}

            {/* Main Navigation Tabs */}
            <nav className={`flex items-center space-x-1.5 overflow-x-auto py-1 ${dir === 'rtl' ? 'pr-3 mr-2 border-r' : 'pl-3 ml-2 border-l'} border-slate-800`}>
              {/* Tickets List Button */}
              <button
                id="nav-tickets"
                onClick={() => onSelectTab('tickets')}
                className={`px-3.5 py-2 rounded-xl text-sm sm:text-base font-bold transition-colors flex items-center space-x-2 cursor-pointer ${
                  currentTab === 'tickets'
                    ? 'bg-slate-800 text-white shadow-xs ring-1 ring-slate-700'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
                title={language === 'ar' ? 'عرض جدول التذاكر والبلاغات' : 'View Tickets List'}
              >
                <Ticket className="w-4.5 h-4.5 text-blue-400 mx-0.5" />
                <span>{language === 'ar' ? 'التذاكر' : 'Tickets'}</span>
              </button>

              {/* Tickets Dashboard Button */}
              <button
                id="nav-tickets-dashboard"
                onClick={() => onSelectTab('dashboard')}
                className={`px-3.5 py-2 rounded-xl text-sm sm:text-base font-bold transition-colors flex items-center space-x-2 cursor-pointer ${
                  currentTab === 'dashboard'
                    ? 'bg-slate-800 text-white shadow-xs ring-1 ring-slate-700'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
                title={language === 'ar' ? 'لوحة تحكم ومؤشرات أداء التذاكر' : 'Tickets Dashboard & Performance Metrics'}
              >
                <LayoutDashboard className="w-4.5 h-4.5 text-emerald-400 mx-0.5" />
                <span>{language === 'ar' ? 'لوحة تحكم التذاكر' : 'Tickets Dashboard'}</span>
              </button>
              
              {canAccessTeamManagement && (
                <button
                  id="nav-users"
                  onClick={() => onSelectTab('users')}
                  className={`px-3.5 py-2 rounded-xl text-sm sm:text-base font-bold transition-colors flex items-center space-x-2 cursor-pointer ${
                    currentTab === 'users'
                      ? 'bg-slate-800 text-white shadow-xs ring-1 ring-slate-700'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                  title={language === 'ar' ? 'إدارة وتوزيع فرق العمل الفنية' : 'Support Teams Management'}
                >
                  <Users className="w-4.5 h-4.5 text-purple-400 mx-0.5" />
                  <span className="hidden sm:inline">{language === 'ar' ? 'إدارة فرق العمل' : 'Team Management'}</span>
                </button>
              )}
            </nav>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-2.5">
            
            {/* Notifications Bell Icon */}
            <NotificationBell 
              onSelectTicket={onSelectTicket} 
              variant="dark"
            />

            {/* Bilingual Language Switcher Button */}
            <button
              onClick={toggleLanguage}
              className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-bold transition cursor-pointer"
              title={language === 'en' ? 'التحويل إلى اللغة العربية' : 'Switch to English'}
            >
              <Languages className="w-4 h-4 text-blue-400 mx-1" />
              <span>{language === 'en' ? 'العربية' : 'EN'}</span>
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                id="btn-user-menu"
                onClick={() => setShowSwitchMenu(!showSwitchMenu)}
                className="flex items-center space-x-2 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition cursor-pointer"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${currentUser?.avatarColor || 'bg-slate-700'}`}>
                  {currentUser?.fullName ? currentUser.fullName.split(' ').map(n => n[0]).join('').slice(0, 2) : 'U'}
                </div>
                <div className={`hidden xl:block ${dir === 'rtl' ? 'text-right pl-1' : 'text-left pr-1'} mx-1`}>
                  <div className="text-sm font-bold text-slate-200 leading-tight">
                    {currentUser?.fullName}
                  </div>
                </div>
                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${getRoleBadge(currentUser?.role)} mx-1`}>
                  {currentUser?.role}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {/* Popover */}
              {showSwitchMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSwitchMenu(false)}
                  />
                  <div className={`absolute ${dir === 'rtl' ? 'left-0' : 'right-0'} mt-2 w-80 rounded-2xl bg-white text-slate-800 shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95`} dir={dir}>
                    <div className="px-5 py-3 border-b border-slate-100">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('auth.sessionActive')}</p>
                      <p className="text-base font-extrabold text-slate-900 mt-0.5">{currentUser?.fullName}</p>
                      <p className="text-sm text-slate-500 mt-0.5">{currentUser?.jobTitle} • {currentUser?.department}</p>
                    </div>

                    <div className="pt-2 px-2 space-y-1">
                      {/* Theme Toggle */}
                      <button
                        onClick={() => {
                          toggleTheme();
                          setShowSwitchMenu(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                      >
                        {theme === 'dark' ? (
                          <Sun className="w-4 h-4 text-amber-500 mx-1" />
                        ) : (
                          <Moon className="w-4 h-4 text-slate-500 mx-1" />
                        )}
                        <span>
                          {theme === 'dark' ? (language === 'ar' ? 'المظهر الفاتح' : 'Light Mode') : (language === 'ar' ? 'المظهر الداكن' : 'Dark Mode')}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          logout();
                          setShowSwitchMenu(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-sm font-bold text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 mx-1" />
                        <span>{t('nav.logout')}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}
