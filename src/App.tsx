import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TicketProvider, useTickets } from './context/TicketContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginView } from './components/LoginView';
import { MetroNavbar } from './components/MetroNavbar';
import { MetroDashboard } from './components/MetroDashboard';
import { ArchivingApp } from './components/ArchivingApp';
import { EmployeeManagementApp } from './components/EmployeeManagementApp';
import { Navbar } from './components/Navbar';
import { TicketList } from './components/TicketList';
import { TicketDetailModal } from './components/TicketDetailModal';
import { CreateTicketModal } from './components/CreateTicketModal';
import { DashboardView } from './components/DashboardView';
import { UserManagementView } from './components/UserManagementView';
import { TeamManagementView } from './components/TeamManagementView';
import { UserManagementAppView } from './components/UserManagementAppView';
import { UserPolicyControlView } from './components/UserPolicyControlView';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { SystemSettingsModal } from './components/SystemSettingsModal';
import { ExportDocsModal } from './components/ExportDocsModal';
import { OrgStructureApp } from './components/OrgStructureApp';
import { DeviceManagementApp } from './components/DeviceManagementApp';
import { Ticket } from './types';
import { Database, Shield, Terminal, ArrowLeft, Lock } from 'lucide-react';

import { OrgProvider } from './context/OrgContext';
import { DeviceProvider } from './context/DeviceContext';

interface AccessDeniedViewProps {
  appName: string;
  onBackToMetro: () => void;
  onSelectTicket?: (ticketId: string) => void;
}

function AccessDeniedView({ appName, onBackToMetro, onSelectTicket }: AccessDeniedViewProps) {
  const { language, dir } = useLanguage();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" dir={dir}>
      <MetroNavbar currentApp="metro" onSelectApp={onBackToMetro} onSelectTicket={onSelectTicket} />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-rose-800/80 rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-rose-400">
            {language === 'ar' ? 'غير مصرح بالوصول (403)' : 'Access Denied (403 Forbidden)'}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            {language === 'ar' 
              ? `لا تملك الصلاحية الكافية للوصول إلى تطبيق (${appName}) أو استخدام وظائفه. يرجى مراجعة مسؤول النظام لمنحك الصلاحيات اللازمة.` 
              : `You do not have permission to access (${appName}) or use its functions. Please contact your system administrator to assign the necessary roles.`}
          </p>
          <div className="pt-2">
            <button
              onClick={onBackToMetro}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              {language === 'ar' ? 'العودة إلى مركز مترو' : 'Return to Metro Hub'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, currentUser, isAdmin, canAccessTeamManagement, canAccessApp, hasPermission } = useAuth();
  const { tickets } = useTickets();
  const { t, language, dir } = useLanguage();

  const canCreateTicket = Boolean(currentUser);

  // Active Organization App within the Portal: Metro Hub, Tickets, Archiving, Employees, Policy, Org Structure, or Devices
  const [currentApp, setCurrentApp] = useState<'metro' | 'tickets' | 'archiving' | 'employees' | 'policy' | 'org-structure' | 'devices'>('metro');

  // Ticket Management Sub-tabs
  const [currentTab, setCurrentTab] = useState<'tickets' | 'dashboard' | 'users'>('tickets');
  const [teamSubTab, setTeamSubTab] = useState<'teams' | 'roles'>('teams');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDocsExportModal, setShowDocsExportModal] = useState(false);

  const { activeTicketModalId, setActiveTicketModalId } = useNotifications();

  const handleSelectTicketFromNav = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setCurrentApp('tickets');
  };

  useEffect(() => {
    if (activeTicketModalId) {
      setSelectedTicketId(activeTicketModalId);
      setCurrentApp('tickets');
      setActiveTicketModalId(null);
    }
  }, [activeTicketModalId, setActiveTicketModalId]);

  // If user is not authenticated or undergoing 2FA, show the Login/2FA flow
  if (!isAuthenticated) {
    return <LoginView />;
  }

  // 1. METRO DASHBOARD HUB VIEW
  if (currentApp === 'metro') {
    return (
      <div className="min-h-screen dark:bg-slate-950 bg-slate-50 dark:text-slate-100 text-slate-900 flex flex-col font-sans" dir={dir}>
        <MetroNavbar 
          currentApp="metro" 
          onSelectApp={setCurrentApp} 
          onOpenDocsExport={() => setShowDocsExportModal(true)}
          onSelectTicket={handleSelectTicketFromNav}
        />
        <main className="flex-1">
          <MetroDashboard
            onSelectApp={setCurrentApp}
            ticketCount={tickets.length}
            documentCount={5}
            employeeCount={6}
            onOpenSettings={() => setShowSettingsModal(true)}
            onOpenDocsExport={() => setShowDocsExportModal(true)}
          />
        </main>
      {/* Main Container Modals */}
        {showSettingsModal && (
          <SystemSettingsModal 
            onClose={() => setShowSettingsModal(false)} 
            onOpenDocsExport={() => setShowDocsExportModal(true)}
          />
        )}
        {showDocsExportModal && (
          <ExportDocsModal onClose={() => setShowDocsExportModal(false)} />
        )}
      </div>
    );
  }

  // 2. ARCHIVING & ELECTRONIC RECORDS APP VIEW
  if (currentApp === 'archiving') {
    if (!canAccessApp('archiving')) {
      return (
        <AccessDeniedView 
          appName={language === 'ar' ? 'الأرشيف الإلكتروني' : 'Electronic Archiving'} 
          onBackToMetro={() => setCurrentApp('metro')} 
          onSelectTicket={handleSelectTicketFromNav}
        />
      );
    }
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" dir={dir}>
        <MetroNavbar 
          currentApp="archiving" 
          onSelectApp={setCurrentApp} 
          onOpenDocsExport={() => setShowDocsExportModal(true)}
          onSelectTicket={handleSelectTicketFromNav}
        />
        <main className="flex-1">
          <ArchivingApp onBackToMetro={() => setCurrentApp('metro')} />
        </main>
        {showDocsExportModal && (
          <ExportDocsModal onClose={() => setShowDocsExportModal(false)} />
        )}
      </div>
    );
  }

  // 3. EMPLOYEE MANAGEMENT & DIRECTORY APP VIEW
  if (currentApp === 'employees') {
    if (!canAccessApp('employees')) {
      return (
        <AccessDeniedView 
          appName={language === 'ar' ? 'إدارة الموظفين والكوادر' : 'Employee Management'} 
          onBackToMetro={() => setCurrentApp('metro')} 
          onSelectTicket={handleSelectTicketFromNav}
        />
      );
    }
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" dir={dir}>
        <MetroNavbar 
          currentApp="employees" 
          onSelectApp={setCurrentApp} 
          onOpenDocsExport={() => setShowDocsExportModal(true)}
          onSelectTicket={handleSelectTicketFromNav}
        />
        <main className="flex-1">
          <EmployeeManagementApp onBackToMetro={() => setCurrentApp('metro')} />
        </main>
        {showDocsExportModal && (
          <ExportDocsModal onClose={() => setShowDocsExportModal(false)} />
        )}
      </div>
    );
  }

  // 4. USER MANAGEMENT APP VIEW
  if (currentApp === 'policy') {
    if (!canAccessApp('policy')) {
      return (
        <AccessDeniedView 
          appName={language === 'ar' ? 'إدارة المستخدمين والصلاحيات' : 'User & Access Policy'} 
          onBackToMetro={() => setCurrentApp('metro')} 
          onSelectTicket={handleSelectTicketFromNav}
        />
      );
    }
    return (
      <>
        <UserManagementAppView 
          onBackToHub={() => setCurrentApp('metro')} 
        />
        {showDocsExportModal && (
          <ExportDocsModal onClose={() => setShowDocsExportModal(false)} />
        )}
      </>
    );
  }

  // 5. ORGANIZATIONAL STRUCTURE APP VIEW
  if (currentApp === 'org-structure') {
    if (!canAccessApp('org-structure')) {
      return (
        <AccessDeniedView 
          appName={language === 'ar' ? 'الهيكل التنظيمي' : 'Organizational Structure'} 
          onBackToMetro={() => setCurrentApp('metro')} 
          onSelectTicket={handleSelectTicketFromNav}
        />
      );
    }
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" dir={dir}>
        <MetroNavbar 
          currentApp="org-structure" 
          onSelectApp={setCurrentApp} 
          onOpenDocsExport={() => setShowDocsExportModal(true)}
          onSelectTicket={handleSelectTicketFromNav}
        />
        <main className="flex-1">
          <OrgStructureApp onBackToMetro={() => setCurrentApp('metro')} />
        </main>
        {showDocsExportModal && (
          <ExportDocsModal onClose={() => setShowDocsExportModal(false)} />
        )}
      </div>
    );
  }

  // 6. ELECTRONIC DEVICE MANAGEMENT APP VIEW
  if (currentApp === 'devices') {
    if (!canAccessApp('devices')) {
      return (
        <AccessDeniedView 
          appName={language === 'ar' ? 'إدارة الأصول والأجهزة' : 'Asset Management'} 
          onBackToMetro={() => setCurrentApp('metro')} 
          onSelectTicket={handleSelectTicketFromNav}
        />
      );
    }
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" dir={dir}>
        <MetroNavbar 
          currentApp="devices" 
          onSelectApp={setCurrentApp} 
          onOpenDocsExport={() => setShowDocsExportModal(true)}
          onSelectTicket={handleSelectTicketFromNav}
        />
        <main className="flex-1">
          <DeviceManagementApp onBackToMetro={() => setCurrentApp('metro')} />
        </main>
        {showDocsExportModal && (
          <ExportDocsModal onClose={() => setShowDocsExportModal(false)} />
        )}
      </div>
    );
  }

  // 7. TICKET MANAGEMENT SYSTEM VIEW
  if (!canAccessApp('tickets')) {
    return (
      <AccessDeniedView 
        appName={language === 'ar' ? 'إدارة التذاكر والدعم' : 'Ticket Management'} 
        onBackToMetro={() => setCurrentApp('metro')} 
        onSelectTicket={handleSelectTicketFromNav}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900" dir={dir}>
      
      {/* Top Navbar with Metro Hub link & Language Toggle */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onBackToMetro={() => setCurrentApp('metro')}
        onOpenDocsExport={() => setShowDocsExportModal(true)}
        onSelectTicket={handleSelectTicketFromNav}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Tab Views */}
        {currentTab === 'tickets' && (
          <TicketList
            onSelectTicket={(ticket: Ticket) => setSelectedTicketId(ticket.id)}
            onOpenCreate={canCreateTicket ? () => setShowCreateModal(true) : (() => {})}
            onNavigateToDashboard={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'dashboard' && (
          <DashboardView
            onSelectTicket={(ticket: Ticket) => setSelectedTicketId(ticket.id)}
            onOpenCreate={canCreateTicket ? () => setShowCreateModal(true) : undefined}
          />
        )}

        {currentTab === 'users' && canAccessTeamManagement && (
          teamSubTab === 'roles' && isAdmin ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <button
                  onClick={() => setTeamSubTab('teams')}
                  className="flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  <ArrowLeft className={`w-4 h-4 mx-1 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                  <span>{language === 'ar' ? 'العودة إلى جدول فرق العمل' : 'Back to Teams Table'}</span>
                </button>
                <span className="text-xs font-semibold text-slate-500">
                  {language === 'ar' ? 'تهيئة صلاحيات الأدوار (بما فيها إدارة الفرق)' : 'Configure Role Permissions'}
                </span>
              </div>
              <UserManagementView onOpenCreateModal={() => {}} />
            </div>
          ) : (
            <TeamManagementView onNavigateToRoles={isAdmin ? () => setTeamSubTab('roles') : undefined} />
          )
        )}

      </main>

      {/* Modals */}
      {selectedTicketId && (
        <TicketDetailModal
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
        />
      )}

      {showCreateModal && canCreateTicket && (
        <CreateTicketModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(newId) => {
            setShowCreateModal(false);
            setSelectedTicketId(newId);
          }}
        />
      )}

      {showSettingsModal && (
        <SystemSettingsModal 
          onClose={() => setShowSettingsModal(false)} 
          onOpenDocsExport={() => setShowDocsExportModal(true)}
        />
      )}

      {showDocsExportModal && (
        <ExportDocsModal onClose={() => setShowDocsExportModal(false)} />
      )}

      {/* Mandatory Password Change Filter Interceptor */}
      <ChangePasswordModal />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <OrgProvider>
            <DeviceProvider>
              <TicketProvider>
                <NotificationProvider>
                  <AppContent />
                </NotificationProvider>
              </TicketProvider>
            </DeviceProvider>
          </OrgProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
