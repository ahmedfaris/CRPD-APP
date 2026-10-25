import React, { useState, useEffect } from 'react';
import { useTickets } from '../context/TicketContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { SupportTeam, TeamType, ApplicationUser } from '../types';
import { logger } from '../utils/logger';
import { TeamManagementView } from './TeamManagementView';
import { 
  X, 
  Settings, 
  ShieldCheck, 
  Users, 
  Sliders, 
  HardDrive, 
  Image as ImageIcon, 
  Clock, 
  CheckCircle2, 
  UserPlus, 
  UserMinus, 
  Wrench, 
  Laptop, 
  ShieldAlert,
  Save,
  Info,
  Terminal,
  Database,
  Download,
  FileCode,
  FileText,
  RefreshCw,
  Layers,
  AlertCircle,
  Server,
  Check,
  Loader2,
  Trash2,
  Activity,
  Filter,
  Search,
  KeyRound,
  ShieldOff,
  CloudCheck
} from 'lucide-react';

interface SystemSettingsModalProps {
  onClose: () => void;
  onOpenDocsExport?: () => void;
}

interface DbStats {
  database: {
    engine: string;
    host: string;
    name: string;
    orm: string;
    status: string;
  };
  counts: {
    departments: number;
    users: number;
    roles: number;
    roleAuditLogs: number;
    tickets: number;
    ticketComments: number;
    totalRecords: number;
  };
  timestamp: string;
}

export function SystemSettingsModal({ onClose, onOpenDocsExport }: SystemSettingsModalProps) {
  const { systemSettings, updateSystemSettings, teams, assignUserToTeam, removeUserFromTeam, tickets } = useTickets();
  const { currentUser, users } = useAuth();
  const { language, dir } = useLanguage();

  const isAdmin = currentUser?.userType === 'System Admin' || currentUser?.role === 'Admin';

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'general' | 'teams' | 'database' | 'serilog'>('general');

  // Local form state for settings
  const [maxPictures, setMaxPictures] = useState(systemSettings.maxPictureAttachments);
  const [maxSizeMB, setMaxSizeMB] = useState(systemSettings.maxAttachmentSizeMB);
  const [slaCritical, setSlaCritical] = useState(systemSettings.slaCriticalHours);
  const [slaMedium, setSlaMedium] = useState(systemSettings.slaMediumHours);
  const [slaLow, setSlaLow] = useState(systemSettings.slaLowHours);
  const [serilogApiUrl, setSerilogApiUrl] = useState(systemSettings.serilogApiUrl || '');
  const [serilogApiKey, setSerilogApiKey] = useState(systemSettings.serilogApiKey || '');
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || 'tech-team');
  const [userToAssign, setUserToAssign] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Database Export State
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [isExporting, setIsExporting] = useState<'json' | 'sql' | null>(null);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);
  const [exportErrorMsg, setExportErrorMsg] = useState<string | null>(null);

  // Serilog & Session Management State
  const [serilogLogs, setSerilogLogs] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSubsystemFilter, setLogSubsystemFilter] = useState<string>('all');
  const [logLevelFilter, setLogLevelFilter] = useState<string>('all');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const fetchSerilogData = async () => {
    setLoadingLogs(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      const [logsRes, sessionsRes] = await Promise.all([
        fetch('/api/system/serilog-logs?limit=200', { headers }),
        fetch('/api/system/sessions', { headers })
      ]);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setSerilogLogs(logsData.data || []);
      }
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setActiveSessions(sessionsData.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load Serilog logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من مسح جميع السجلات؟' : 'Are you sure you want to clear all logs?')) return;
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/system/serilog-logs/clear', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setSerilogLogs([]);
        setActionSuccessMsg(language === 'ar' ? 'تم مسح السجلات بنجاح' : 'Logs cleared successfully');
        setTimeout(() => setActionSuccessMsg(null), 3000);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleTerminateSession = async (sessionId: string, userEmail: string) => {
    if (!confirm(language === 'ar' ? `هل أنت متأكد من إنهاء جلسة ${userEmail}؟` : `Are you sure you want to terminate session for ${userEmail}?`)) return;
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/system/sessions/terminate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ sessionId })
      });
      if (res.ok) {
        fetchSerilogData();
        setActionSuccessMsg(language === 'ar' ? 'تم إنهاء الجلسة وتوثيق الحدث في سيريلوج' : 'Session terminated and logged to Serilog');
        setTimeout(() => setActionSuccessMsg(null), 3000);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  // Fetch DB statistics
  const fetchDbStats = async () => {
    setLoadingStats(true);
    setExportErrorMsg(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/database/stats', {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        setDbStats(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setExportErrorMsg(err.error || 'Failed to fetch database statistics');
      }
    } catch (err: any) {
      setExportErrorMsg(err.message || 'Error communicating with database API');
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchDbStats();
    }
  }, [isAdmin]);

  // Handle Export Action
  const handleExportDatabase = async (format: 'json' | 'sql') => {
    setIsExporting(format);
    setExportSuccessMsg(null);
    setExportErrorMsg(null);

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/database/export?format=${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          format,
          systemSettings,
          teams,
          tickets
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Export request failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `crpd_database_backup_${timestamp}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      logger.information('Database exported as {Format} by {User}', {
        Format: format.toUpperCase(),
        User: currentUser?.email || 'Admin'
      });

      setExportSuccessMsg(
        language === 'ar'
          ? `تم تصدير قاعدة البيانات بنجاح بتنسيق (${format.toUpperCase()}) وتحميل الملف.`
          : `Database successfully exported as ${format.toUpperCase()} and downloaded.`
      );
      setTimeout(() => setExportSuccessMsg(null), 6000);

      // Refresh stats
      fetchDbStats();
    } catch (err: any) {
      setExportErrorMsg(err.message || 'Failed to export database');
    } finally {
      setIsExporting(null);
    }
  };

  if (!currentUser) return null;

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir={dir}>
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
          <div className="px-6 py-4 bg-rose-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-rose-800">
              <ShieldAlert className="w-5 h-5 text-rose-600 mx-1" />
              <h3 className="font-bold text-sm">
                {language === 'ar' ? 'صلاحيات مسؤولي النظام فقط' : 'System Admins Only'}
              </h3>
            </div>
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 text-xs text-slate-600 space-y-3">
            <p>
              {language === 'ar'
                ? 'إعدادات النظام والتحكم بحدود المرفقات وفرق العمل وتصدير قاعدة البيانات متاحة فقط لمسؤولي النظام (System Admins).'
                : 'System configuration, attachment limits, support team staffing, and database export are restricted to System Admins.'}
            </p>
          </div>
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg"
            >
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSystemSettings({
      maxPictureAttachments: maxPictures,
      maxAttachmentSizeMB: maxSizeMB,
      slaCriticalHours: slaCritical,
      slaMediumHours: slaMedium,
      slaLowHours: slaLow,
      serilogApiUrl,
      serilogApiKey,
    }, currentUser);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const currentSelectedTeam = teams.find((t) => t.id === selectedTeamId) || teams[0];
  const currentTeamMembers = users.filter((u) => currentSelectedTeam?.memberUserIds.includes(u.id));
  const availableUsersToAssign = users.filter((u) => !currentSelectedTeam?.memberUserIds.includes(u.id));

  const handleAssignUser = () => {
    if (!userToAssign) return;
    assignUserToTeam(selectedTeamId, userToAssign);
    setUserToAssign('');
  };

  const getTeamIcon = (teamType: TeamType) => {
    switch (teamType) {
      case 'Technical Team':
        return <Wrench className="w-4 h-4 text-amber-500" />;
      case 'Database and Systems Admins':
        return <Laptop className="w-4 h-4 text-blue-500" />;
      case 'Security Team':
        return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in" dir={dir}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs mx-1">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {language === 'ar' ? 'إعدادات النظام وإدارة قاعدة البيانات' : 'System Settings & Database Management'}
              </h2>
              <p className="text-xs text-slate-400">
                {language === 'ar' 
                  ? 'التحكم في سياسات النظام، اتفاقيات SLA، الكوادر الفنية، وتصدير قاعدة البيانات' 
                  : 'Configure system thresholds, SLA targets, support teams, and export database snapshots'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2.5 bg-slate-800 border-b border-slate-700 flex items-center space-x-2 text-xs font-semibold overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
              activeTab === 'general'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 mx-1" />
            <span>{language === 'ar' ? 'السياسات ومهلات SLA' : 'Policies & SLAs'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('teams')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
              activeTab === 'teams'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Users className="w-3.5 h-3.5 mx-1" />
            <span>{language === 'ar' ? 'فرق العمل والكوادر' : 'Support Teams'}</span>
            <span className="mx-1 px-1.5 py-0.2 rounded-full bg-slate-700 text-[10px] font-mono text-slate-300">
              {teams.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('database');
              if (!dbStats) fetchDbStats();
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
              activeTab === 'database'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Database className="w-3.5 h-3.5 mx-1" />
            <span>{language === 'ar' ? 'تصدير قاعدة البيانات' : 'Database Export'}</span>
            <span className="mx-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
              SQL / JSON
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('serilog');
              fetchSerilogData();
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
              activeTab === 'serilog'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 mx-1" />
            <span>{language === 'ar' ? 'سجلات سيريلوج وجلسات الدخول' : 'Serilog & Sessions'}</span>
            <span className="mx-1 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold">
              Seq
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs sm:text-sm">
          
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-1" />
              <span className="font-bold">
                {language === 'ar' ? 'تم حفظ وتحديث إعدادات النظام بنجاح!' : 'System settings updated and applied successfully!'}
              </span>
            </div>
          )}

          {/* TAB 1: General Settings & Policies */}
          {activeTab === 'general' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center space-x-2 font-bold text-slate-800">
                    <ImageIcon className="w-4 h-4 text-purple-600 mx-1" />
                    <span>{language === 'ar' ? 'إعدادات وضوابط المرفقات المصورة (Pictures)' : 'Picture Attachments Policy'}</span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">
                    JPEG & PNG Only
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Max Photos */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'الحد الأقصى للصور لكل تذكرة' : 'Max Picture Attachments per Ticket'}
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={maxPictures}
                        onChange={(e) => setMaxPictures(parseInt(e.target.value, 10))}
                        className="flex-1 accent-purple-600 cursor-pointer"
                      />
                      <span className="w-12 text-center py-1 px-2 font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800">
                        {maxPictures}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {language === 'ar' ? 'القيمة الافتراضية: 3 صور كحد أقصى' : 'Default: 3 pictures per ticket'}
                    </p>
                  </div>

                  {/* Max Size in MB */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'الحد الأقصى لحجم كل صورة (ميجابايت)' : 'Max File Size per Picture (MB)'}
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={maxSizeMB}
                        onChange={(e) => setMaxSizeMB(parseInt(e.target.value, 10))}
                        className="flex-1 accent-purple-600 cursor-pointer"
                      />
                      <span className="w-16 text-center py-1 px-2 font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800">
                        {maxSizeMB} MB
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {language === 'ar' ? 'القيمة الافتراضية: 5 ميجابايت لكل صورة' : 'Default: 5 MB per picture'}
                    </p>
                  </div>
                </div>

                {/* SLA Targets */}
                <div className="pt-3 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-blue-600 mx-1" />
                    <span>{language === 'ar' ? 'مهلات المعالجة حسب مستويات الأولوية (SLA Target Hours)' : 'Resolution SLA Targets (Hours)'}</span>
                  </label>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <span className="block text-[11px] text-rose-700 font-bold mb-1">
                        ★★★ {language === 'ar' ? 'عالي / حرج (3 نجوم)' : 'Critical (3 Stars)'}
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={slaCritical}
                        onChange={(e) => setSlaCritical(parseInt(e.target.value, 10) || 4)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                      />
                      <span className="text-[10px] text-slate-400">{language === 'ar' ? 'ساعات' : 'hours'}</span>
                    </div>

                    <div>
                      <span className="block text-[11px] text-amber-700 font-bold mb-1">
                        ★★☆ {language === 'ar' ? 'متوسط (نجمتان)' : 'Medium (2 Stars)'}
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="72"
                        value={slaMedium}
                        onChange={(e) => setSlaMedium(parseInt(e.target.value, 10) || 24)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                      />
                      <span className="text-[10px] text-slate-400">{language === 'ar' ? 'ساعات' : 'hours'}</span>
                    </div>

                    <div>
                      <span className="block text-[11px] text-blue-700 font-bold mb-1">
                        ★☆☆ {language === 'ar' ? 'منخفض (نجمة واحدة)' : 'Low (1 Star)'}
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={slaLow}
                        onChange={(e) => setSlaLow(parseInt(e.target.value, 10) || 48)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                      />
                      <span className="text-[10px] text-slate-400">{language === 'ar' ? 'ساعات' : 'hours'}</span>
                    </div>
                  </div>
                </div>

                {/* Serilog External Server Config */}
                <div className="pt-3 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center space-x-1.5">
                    <Terminal className="w-4 h-4 text-emerald-600 mx-1" />
                    <span>{language === 'ar' ? 'إعدادات خادم Serilog الخارجي' : 'External Serilog Configuration'}</span>
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[11px] text-slate-700 font-bold mb-1">
                        {language === 'ar' ? 'رابط الخادم (API URL)' : 'Server API URL'}
                      </span>
                      <input
                        type="url"
                        value={serilogApiUrl}
                        onChange={(e) => setSerilogApiUrl(e.target.value)}
                        placeholder="https://api.seq.external-server.com"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-700 font-bold mb-1">
                        {language === 'ar' ? 'مفتاح الواجهة (API Key)' : 'API Key'}
                      </span>
                      <input
                        type="password"
                        value={serilogApiKey}
                        onChange={(e) => setSerilogApiKey(e.target.value)}
                        placeholder="Enter API Key"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 mx-1" />
                    <span>{language === 'ar' ? 'حفظ وتطبيق الإعدادات' : 'Save System Settings'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: Support Teams Management */}
          {activeTab === 'teams' && (
            <div className="space-y-4">
              <TeamManagementView />
            </div>
          )}

          {/* TAB 3: Database Export & Backup */}
          {activeTab === 'database' && (
            <div className="space-y-5">
              
              {/* Feedback messages */}
              {exportSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 flex items-center space-x-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mx-1" />
                  <div className="flex-1 text-xs font-semibold">
                    {exportSuccessMsg}
                  </div>
                </div>
              )}

              {exportErrorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 flex items-center space-x-2.5 animate-in fade-in">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mx-1" />
                  <div className="flex-1 text-xs font-semibold">
                    {exportErrorMsg}
                  </div>
                </div>
              )}

              {/* Database Status & Health Card */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-1">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-xs text-white">
                          {language === 'ar' ? 'حالة قاعدة بيانات النظام' : 'System Database Status'}
                        </h4>
                        <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-[10px] text-emerald-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mx-0.5"></span>
                          <span>{language === 'ar' ? 'نشطة ومتصلة' : 'Connected & Ready'}</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        PostgreSQL 15+ (Cloud SQL) • Managed by Drizzle ORM
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={fetchDbStats}
                    disabled={loadingStats}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center space-x-1.5 transition disabled:opacity-50 cursor-pointer"
                    title={language === 'ar' ? 'تحديث الإحصائيات' : 'Refresh database stats'}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mx-1 ${loadingStats ? 'animate-spin text-blue-400' : ''}`} />
                    <span>{language === 'ar' ? 'تحديث الإحصائيات' : 'Refresh Stats'}</span>
                  </button>
                </div>

                {/* Table Records Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {language === 'ar' ? 'الهيكل الإداري' : 'Departments'}
                    </span>
                    <span className="text-lg font-bold font-mono text-amber-400">
                      {dbStats?.counts.departments ?? '...'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {language === 'ar' ? 'المستخدمون' : 'Users'}
                    </span>
                    <span className="text-lg font-bold font-mono text-blue-400">
                      {dbStats?.counts.users ?? '...'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {language === 'ar' ? 'الأدوار' : 'Roles'}
                    </span>
                    <span className="text-lg font-bold font-mono text-purple-400">
                      {dbStats?.counts.roles ?? '...'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {language === 'ar' ? 'سجلات التدقيق' : 'Audit Logs'}
                    </span>
                    <span className="text-lg font-bold font-mono text-emerald-400">
                      {dbStats?.counts.roleAuditLogs ?? '...'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {language === 'ar' ? 'التذاكر' : 'Tickets'}
                    </span>
                    <span className="text-lg font-bold font-mono text-cyan-400">
                      {(dbStats?.counts.tickets && dbStats.counts.tickets > 0) ? dbStats.counts.tickets : tickets.length}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {language === 'ar' ? 'إجمالي السجلات' : 'Total Records'}
                    </span>
                    <span className="text-lg font-bold font-mono text-white">
                      {dbStats ? (dbStats.counts.totalRecords + (tickets.length > 0 && dbStats.counts.tickets === 0 ? tickets.length : 0)) : '...'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Export Formats Section */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
                    <Download className="w-4 h-4 text-emerald-600 mx-1" />
                    <span>{language === 'ar' ? 'خيارات تنزيل النسخة الاحتياطية' : 'Database Backup & Export Formats'}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {language === 'ar'
                      ? 'اختر التنسيق المناسب لتحميل نسخة كاملة من قاعدة بيانات النظام بكافة الجداول والسجلات'
                      : 'Select a format below to download a complete backup of all tables, schema definitions, and system records'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Format 1: SQL Dump Script */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-emerald-400 transition">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-mono font-bold text-xs mx-1">
                            .sql
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-900 text-xs">
                              {language === 'ar' ? 'سكربت قاعدة بيانات كامل (PostgreSQL Dump)' : 'PostgreSQL SQL Dump (.sql)'}
                            </h5>
                            <span className="text-[10px] text-emerald-700 font-semibold">
                              {language === 'ar' ? 'جاهز للاستيراد المباشر' : 'Direct Import Ready'}
                            </span>
                          </div>
                        </div>
                        <FileCode className="w-4 h-4 text-emerald-600" />
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {language === 'ar'
                          ? 'ملف نصي تنفيذي يحتوي على أوامر إنشاء الجداول (CREATE TABLE) وجمل الإدخال (INSERT INTO) مع التوافق الكامل مع أدوات psql و pgAdmin و DBeaver.'
                          : 'Executable SQL script including DDL table schemas, sequence sync, and transactional INSERT statements. Compatible with psql, pgAdmin, and Cloud SQL.'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">
                        MIME: application/sql
                      </span>
                      <button
                        type="button"
                        disabled={isExporting !== null}
                        onClick={() => handleExportDatabase('sql')}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {isExporting === 'sql' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin mx-1" />
                            <span>{language === 'ar' ? 'جارٍ التجهيز...' : 'Exporting...'}</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5 mx-1" />
                            <span>{language === 'ar' ? 'تصدير سكربت SQL' : 'Download .SQL Script'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Format 2: Structured JSON Export */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-blue-400 transition">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-mono font-bold text-xs mx-1">
                            .json
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-900 text-xs">
                              {language === 'ar' ? 'حزمة بيانات كاملة (Structured JSON)' : 'Structured JSON Package (.json)'}
                            </h5>
                            <span className="text-[10px] text-blue-700 font-semibold">
                              {language === 'ar' ? 'شامل الإعدادات والفرق' : 'Includes App Config & Teams'}
                            </span>
                          </div>
                        </div>
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {language === 'ar'
                          ? 'تنسيق قياسي منظم يحتوي على كافة كائنات وجداول قاعدة البيانات، بالإضافة إلى إعدادات النظام وتوزيع فرق الدعم الفني وسجلات التذاكر.'
                          : 'Structured hierarchical JSON containing all relational tables alongside active system settings, support team assignments, and ticket records.'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">
                        MIME: application/json
                      </span>
                      <button
                        type="button"
                        disabled={isExporting !== null}
                        onClick={() => handleExportDatabase('json')}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {isExporting === 'json' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin mx-1" />
                            <span>{language === 'ar' ? 'جارٍ التجهيز...' : 'Exporting...'}</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5 mx-1" />
                            <span>{language === 'ar' ? 'تصدير ملف JSON' : 'Download .JSON File'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Format 3: Google Docs Integration Export */}
                  {onOpenDocsExport && (
                    <div className="p-4 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 rounded-xl border border-indigo-200 shadow-xs flex flex-col justify-between hover:border-indigo-400 transition md:col-span-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-mono font-bold text-xs mx-1">
                              Doc
                            </div>
                            <div>
                              <h5 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                                <span>{language === 'ar' ? 'تصدير توثيق معمارية الدخول إلى Google Docs' : 'Export Authentication Docs to Google Docs'}</span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">Google Drive API</span>
                              </h5>
                              <span className="text-[10px] text-indigo-700 font-semibold">
                                {language === 'ar' ? 'إنشاء مستند سحابي حي في Google Drive' : 'Live Google Drive Document Creation'}
                              </span>
                            </div>
                          </div>
                          <CloudCheck className="w-5 h-5 text-indigo-600" />
                        </div>

                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {language === 'ar'
                            ? 'يقوم هذا الخيار بإنشاء مستند جديد في حساب Google Drive الخاص بك وكتابة كامل تفاصيل توثيق معمارية التحقق (Bcrypt, JWT, 2FA/TOTP)، الحسابات الافتراضية، وسياسات الحظر التصاعدي مباشرة.'
                            : 'Generates a brand new document in your Google Drive and inserts the complete authentication and login architecture documentation, seeded credentials, TOTP tolerance rules, and lockout workflows.'}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-indigo-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-mono">
                          OAuth: documents + drive.file
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenDocsExport();
                          }}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 mx-1" />
                          <span>{language === 'ar' ? 'فتح شاشة تصدير Google Docs' : 'Export to Google Docs'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>

                {/* Additional Guidance Info */}
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start space-x-2 text-[11px] text-amber-900">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 mx-1" />
                  <div className="leading-relaxed">
                    {language === 'ar' ? (
                      <>
                        <strong>ملاحظة أمان النسخ الاحتياطي:</strong> يُنصح بالاحتفاظ بنسخة احتياطية دورية وتخزينها في بيئة آمنة ومشفرة. تتضمن النسخة كافة بيانات الهيكل التنظيمي، سجلات المستخدمين، الصلاحيات، والتذاكر.
                      </>
                    ) : (
                      <>
                        <strong>Backup Security Notice:</strong> It is recommended to download periodic database snapshots and archive them securely. The export packages all organizational hierarchy units, user credentials, role permissions, and support tickets.
                      </>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 4: SERILOG & SESSIONS MANAGEMENT */}
          {activeTab === 'serilog' && (
            <div className="space-y-6 animate-in fade-in">
              {actionSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 flex items-center space-x-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-1 shrink-0" />
                  <span className="font-semibold text-xs">{actionSuccessMsg}</span>
                </div>
              )}

              {/* Top Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mx-1">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {language === 'ar' ? 'سجلات سيريلوج النشطة' : 'Serilog Events'}
                    </div>
                    <div className="text-xl font-black text-slate-900 font-mono">
                      {serilogLogs.length}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mx-1">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {language === 'ar' ? 'الجلسات النشطة في النظام' : 'Active DB Sessions'}
                    </div>
                    <div className="text-xl font-black text-slate-900 font-mono">
                      {activeSessions.filter(s => s.isActive).length}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mx-1">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {language === 'ar' ? 'سياسة الجلسات والأمان' : 'Session Policy'}
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      {language === 'ar' ? 'جهاز واحد / مهلة 15 د' : 'Single-Device / 15m Idle'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Sessions Control Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <KeyRound className="w-4 h-4 text-blue-600 mx-1" />
                    <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                      {language === 'ar' ? 'الجلسات النشطة المسجلة (حظر الدخول المتزامن)' : 'Active User Sessions (Single-Device Enforced)'}
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {language === 'ar' ? 'يتم إنهاء الجلسة القديمة فوراً عند الدخول من جهاز آخر' : 'Previous sessions are automatically terminated upon concurrent login'}
                  </span>
                </div>

                {activeSessions.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    {language === 'ar' ? 'لا توجد جلسات مسجلة حالياً.' : 'No active sessions currently recorded.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="p-2.5">{language === 'ar' ? 'المستخدم' : 'User'}</th>
                          <th className="p-2.5">{language === 'ar' ? 'عنوان IP والجهاز' : 'IP & Device'}</th>
                          <th className="p-2.5">{language === 'ar' ? 'وقت الإنشاء' : 'Created At'}</th>
                          <th className="p-2.5">{language === 'ar' ? 'آخر نشاط' : 'Last Activity'}</th>
                          <th className="p-2.5">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                          <th className="p-2.5 text-right">{language === 'ar' ? 'الإجراء' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeSessions.map((session) => (
                          <tr key={session.sessionId} className="hover:bg-slate-50/80 transition">
                            <td className="p-2.5 font-medium text-slate-900">
                              <div className="font-semibold">{session.userEmail}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">{session.sessionId}</div>
                            </td>
                            <td className="p-2.5 text-slate-600">
                              <div className="font-mono text-[11px]">{session.ipAddress || '127.0.0.1'}</div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{session.deviceInfo || 'Browser'}</div>
                            </td>
                            <td className="p-2.5 text-slate-500 text-[11px] whitespace-nowrap">
                              {new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="p-2.5 text-slate-500 text-[11px] whitespace-nowrap">
                              {new Date(session.lastActivityAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="p-2.5">
                              {session.isActive ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  {language === 'ar' ? 'نشطة' : 'Active'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                  {session.invalidationReason || 'Revoked'}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-right">
                              {session.isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleTerminateSession(session.sessionId, session.userEmail)}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold transition flex items-center space-x-1 ml-auto cursor-pointer"
                                >
                                  <ShieldOff className="w-3 h-3 mx-0.5" />
                                  <span>{language === 'ar' ? 'إنهاء الجلسة' : 'Revoke'}</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Serilog Event Log Stream */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg text-slate-200">
                <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-purple-400 mx-1" />
                    <span className="font-bold text-xs sm:text-sm text-white">
                      {language === 'ar' ? 'موجز أحداث سيريلوج المهيكلة (Serilog / Seq Stream)' : 'Serilog Structured Events Stream (Seq / JSON)'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={fetchSerilogData}
                      disabled={loadingLogs}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1 border border-slate-700 transition cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mx-1 ${loadingLogs ? 'animate-spin' : ''}`} />
                      <span>{language === 'ar' ? 'تحديث' : 'Refresh'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearLogs}
                      className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 mx-1" />
                      <span>{language === 'ar' ? 'مسح السجلات' : 'Clear Logs'}</span>
                    </button>
                  </div>
                </div>

                {/* Filter Toolbar */}
                <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center space-x-1.5 flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 mx-1" />
                    <input
                      type="text"
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      placeholder={language === 'ar' ? 'بحث في رسائل وأحداث سيريلوج...' : 'Search Serilog messages and properties...'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 text-[11px]">{language === 'ar' ? 'النظام الفرعي:' : 'Subsystem:'}</span>
                    <select
                      value={logSubsystemFilter}
                      onChange={(e) => setLogSubsystemFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-hidden focus:border-purple-500"
                    >
                      <option value="all">{language === 'ar' ? 'الكل' : 'All'}</option>
                      <option value="SessionManagement">SessionManagement</option>
                      <option value="LoggingService">LoggingService</option>
                      <option value="Security">Security</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 text-[11px]">{language === 'ar' ? 'المستوى:' : 'Level:'}</span>
                    <select
                      value={logLevelFilter}
                      onChange={(e) => setLogLevelFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-hidden focus:border-purple-500"
                    >
                      <option value="all">{language === 'ar' ? 'الكل' : 'All'}</option>
                      <option value="Information">Information</option>
                      <option value="Warning">Warning</option>
                      <option value="Error">Error</option>
                    </select>
                  </div>
                </div>

                {/* Log Event Rows */}
                <div className="max-h-96 overflow-y-auto divide-y divide-slate-800 font-mono text-xs">
                  {serilogLogs
                    .filter((log) => {
                      if (logLevelFilter !== 'all' && log.Level?.toLowerCase() !== logLevelFilter.toLowerCase()) return false;
                      if (logSubsystemFilter !== 'all' && log.Properties?.Subsystem !== logSubsystemFilter) return false;
                      if (logSearchQuery) {
                        const q = logSearchQuery.toLowerCase();
                        const matchMsg = log.RenderedMessage?.toLowerCase().includes(q);
                        const matchProps = JSON.stringify(log.Properties || {}).toLowerCase().includes(q);
                        if (!matchMsg && !matchProps) return false;
                      }
                      return true;
                    })
                    .map((log, idx) => {
                      const isWarn = log.Level === 'Warning';
                      const isErr = log.Level === 'Error';
                      return (
                        <div key={idx} className="p-3 hover:bg-slate-800/50 transition flex flex-col space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  isErr
                                    ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                    : isWarn
                                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                    : 'bg-blue-950 text-blue-400 border border-blue-800'
                                }`}
                              >
                                {log.Level}
                              </span>

                              {log.Properties?.Action && (
                                <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-semibold">
                                  {log.Properties.Action}
                                </span>
                              )}

                              {log.Properties?.Subsystem && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                                  {log.Properties.Subsystem}
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] text-slate-500">
                              {new Date(log.Timestamp).toLocaleString()}
                            </span>
                          </div>

                          <div className="text-slate-200 text-xs font-sans leading-relaxed">
                            {log.RenderedMessage || log.MessageTemplate}
                          </div>

                          {/* Properties Key-Value Display */}
                          {log.Properties && Object.keys(log.Properties).length > 0 && (
                            <div className="pt-1 flex flex-wrap gap-1.5 text-[10px]">
                              {Object.entries(log.Properties).map(([k, v]) => {
                                if (k === 'Action' || k === 'Subsystem') return null;
                                return (
                                  <span key={k} className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                                    <span className="text-purple-400 font-semibold">{k}:</span>{' '}
                                    <span className="text-slate-300">{String(v)}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {serilogLogs.length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-xs font-sans">
                      {language === 'ar' ? 'لا توجد سجلات مسجلة في ملف سيريلوج حتى الآن.' : 'No events logged in Serilog file yet.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            {language === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
}
