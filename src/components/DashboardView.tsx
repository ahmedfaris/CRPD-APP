import React, { useMemo } from 'react';
import { useTickets } from '../context/TicketContext';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useLanguage } from '../context/LanguageContext';
import { Ticket } from '../types';
import { 
  BarChart3, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  ShieldCheck, 
  Database, 
  Layers, 
  Activity, 
  Server,
  ArrowUpRight,
  PlusCircle,
  Wrench,
  Laptop,
  UserPlus,
  Star,
  RefreshCw
} from 'lucide-react';

interface DashboardViewProps {
  onSelectTicket: (ticket: Ticket) => void;
  onOpenCreate?: () => void;
}

export function DashboardView({ onSelectTicket, onOpenCreate }: DashboardViewProps) {
  const { tickets, metrics, refreshTickets, isLoadingTickets } = useTickets();
  const { users, currentUser, isOperationalUser, isTechnicalUser, isAdmin, isAgent } = useAuth();
  const { getAllDepartments } = useOrg();
  const { language, dir } = useLanguage();

  const userDept = currentUser?.department;
  const isOpUserRestricted = !isTechnicalUser && !isAdmin && !isAgent && userDept && userDept !== 'Unassigned';

  const displayTickets = useMemo(() => {
    if (!isOpUserRestricted) return tickets;
    const normUserDept = (userDept || '').toLowerCase().trim();

    return tickets.filter((ticket) => {
      // If user is creator or requester
      if (
        (ticket.requesterId && (ticket.requesterId === currentUser?.id || ticket.requesterId === currentUser?.uid)) ||
        (ticket.requesterEmail && currentUser?.email && ticket.requesterEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
        (ticket.requesterName && currentUser?.fullName && ticket.requesterName.toLowerCase() === currentUser.fullName.toLowerCase())
      ) {
        return true;
      }

      const candidateDepts: string[] = [
        ticket.department,
        ticket.requesterDept,
        ticket.hardwareDetails?.department
      ].filter(Boolean).map((d) => String(d).toLowerCase().trim());

      const matchedRequester = users?.find(
        (u) =>
          (u.id && (u.id === ticket.requesterId || (u as any).uid === ticket.requesterId)) ||
          (u.email && ticket.requesterEmail && u.email.toLowerCase() === ticket.requesterEmail.toLowerCase()) ||
          (u.fullName && ticket.requesterName && u.fullName.toLowerCase() === ticket.requesterName.toLowerCase())
      );
      if (matchedRequester?.department) {
        candidateDepts.push(matchedRequester.department.toLowerCase().trim());
      }

      if (candidateDepts.some((cd) => cd === normUserDept || cd.includes(normUserDept) || normUserDept.includes(cd))) {
        return true;
      }

      const orgDepts = getAllDepartments ? getAllDepartments() : [];
      const userOrgNode = orgDepts.find((od) => {
        const en = (od.nameEn || '').toLowerCase().trim();
        const ar = (od.nameAr || '').toLowerCase().trim();
        return en === normUserDept || ar === normUserDept || normUserDept.includes(en) || normUserDept.includes(ar);
      });

      if (userOrgNode) {
        const userEn = (userOrgNode.nameEn || '').toLowerCase().trim();
        const userAr = (userOrgNode.nameAr || '').toLowerCase().trim();
        const userKey = userOrgNode.id.toLowerCase();
        for (const cd of candidateDepts) {
          if (cd === userEn || cd === userAr || cd === userKey || (userEn && cd.includes(userEn)) || (userAr && cd.includes(userAr))) {
            return true;
          }
        }
      }

      const synonymGroups = [
        ['operations', 'operations & logistics', 'العمليات', 'العمليات والتنفيذ'],
        ['information technology', 'it', 'it operations', 'it service desk', 'تكنولوجيا المعلومات', 'تقنية المعلومات'],
        ['customer support & helpdesk', 'customer support', 'helpdesk', 'دعم العملاء ومكتب المساعدة', 'الدعم الفني'],
        ['electronic archiving & records', 'archiving', 'الأرشيف الإلكتروني', 'الأرشفة الإلكترونية والسجلات', 'الأرشفة'],
        ['human resources', 'hr', 'الموارد البشرية']
      ];

      for (const group of synonymGroups) {
        const userInGroup = group.some((term) => normUserDept.includes(term) || term.includes(normUserDept));
        if (userInGroup) {
          const ticketInGroup = candidateDepts.some((cd) => group.some((term) => cd.includes(term) || term.includes(cd)));
          if (ticketInGroup) return true;
        }
      }

      return false;
    });
  }, [tickets, isOpUserRestricted, userDept, currentUser, users, getAllDepartments]);

  // Ticket type counts
  const typeCounts = {
    hardware: displayTickets.filter((t) => t.ticketType === 'Hardware Maintenance').length,
    troubleshoot: displayTickets.filter((t) => t.ticketType === 'Systems Troubleshoot').length,
    userRequest: displayTickets.filter((t) => t.ticketType === 'User Request').length,
  };

  // Priority stars counts
  const starCounts = {
    threeStar: displayTickets.filter((t) => (t.priorityStars || 2) === 3).length,
    twoStar: displayTickets.filter((t) => (t.priorityStars || 2) === 2).length,
    oneStar: displayTickets.filter((t) => (t.priorityStars || 2) === 1).length,
  };

  // Category counts
  const categoryCounts = displayTickets.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Priority counts
  const priorityCounts = {
    Critical: displayTickets.filter((t) => t.priority === 'Critical').length,
    High: displayTickets.filter((t) => t.priority === 'High').length,
    Medium: displayTickets.filter((t) => t.priority === 'Medium').length,
    Low: displayTickets.filter((t) => t.priority === 'Low').length,
  };

  const criticalTickets = displayTickets.filter((t) => t.priority === 'Critical' && t.status !== 'Closed');

  // Effective metrics scoped to display tickets if operational user is restricted
  const effectiveMetrics = isOpUserRestricted ? {
    total: displayTickets.length,
    open: displayTickets.filter((t) => t.status === 'Open').length,
    inProgress: displayTickets.filter((t) => t.status === 'In Progress').length,
    resolved: displayTickets.filter((t) => t.status === 'Resolved').length,
    closed: displayTickets.filter((t) => t.status === 'Closed').length,
    critical: criticalTickets.length,
    slaComplianceRate: metrics.slaComplianceRate,
    slaBreached: metrics.slaBreached,
    avgResolutionTimeHours: metrics.avgResolutionTimeHours
  } : metrics;

  return (
    <div className="space-y-6" dir={dir}>
      
      {/* Dashboard Action Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            {language === 'ar' ? 'لوحة تحكم مكتب الخدمة والتذاكر' : 'Service Desk & Ticket Dashboard'}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {language === 'ar' 
              ? 'إدارة التذاكر التشغيلية، واستكشاف أخطاء الأنظمة، وصيانة الأجهزة، وطلبات الهوية والصلاحيات (IAM)' 
              : 'Operational ticketing, system troubleshooting, hardware maintenance & IAM user requests'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => refreshTickets()}
            disabled={isLoadingTickets}
            title={language === 'ar' ? 'تحديث وتزامن البيانات' : 'Refresh & Sync Data'}
            className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
          >
            <RefreshCw className={`w-4.5 h-4.5 text-blue-600 ${isLoadingTickets ? 'animate-spin' : ''}`} />
          </button>

          {onOpenCreate && (
            <button
              id="dashboard-btn-create-ticket"
              onClick={onOpenCreate}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm sm:text-base shadow-md hover:shadow-lg transition cursor-pointer"
            >
              <PlusCircle className="w-5 h-5 mx-1" />
              <span>{language === 'ar' ? 'إنشاء تذكرة جديدة' : 'Create New Ticket'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Ticket Classification Breakdown (3 Types) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center">
              <Wrench className="w-4 h-4 mx-1.5 text-amber-500" />
              {language === 'ar' ? 'صيانة الأجهزة والمعدات' : 'Hardware Maintenance'}
            </span>
            <div className="text-3xl font-black text-slate-900">{typeCounts.hardware}</div>
            <div className="text-xs sm:text-sm text-slate-500">
              {language === 'ar' ? 'طابعات، ماسحات ضوئية، محطات عمل' : 'Printers, Scanners, Terminals'}
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-sm font-bold font-mono">
            {Math.round((typeCounts.hardware / (displayTickets.length || 1)) * 100)}%
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center">
              <Laptop className="w-4 h-4 mx-1.5 text-blue-500" />
              {language === 'ar' ? 'استكشاف أعطال الأنظمة' : 'Systems Troubleshoot'}
            </span>
            <div className="text-3xl font-black text-slate-900">{typeCounts.troubleshoot}</div>
            <div className="text-xs sm:text-sm text-slate-500">
              {language === 'ar' ? 'نظام قديم، نظام حديث، AD، ERP' : 'Old IMS, New IMS, AD, ERP'}
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-sm font-bold font-mono">
            {Math.round((typeCounts.troubleshoot / (displayTickets.length || 1)) * 100)}%
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center">
              <UserPlus className="w-4 h-4 mx-1.5 text-emerald-500" />
              {language === 'ar' ? 'طلبات المستخدمين (IAM)' : 'User Request (IAM)'}
            </span>
            <div className="text-3xl font-black text-slate-900">{typeCounts.userRequest}</div>
            <div className="text-xs sm:text-sm text-slate-500">
              {language === 'ar' ? 'حسابات جديدة، أدوار، صلاحيات وصول' : 'Accounts, Roles, Permissions'}
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-bold font-mono">
            {Math.round((typeCounts.userRequest / (displayTickets.length || 1)) * 100)}%
          </span>
        </div>
      </div>
      
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider">
              {language === 'ar' ? 'إجمالي البلاغات' : 'Total Tickets'}
            </span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Layers className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-900">{effectiveMetrics.total}</span>
            <span className="text-xs sm:text-sm text-slate-500 mx-1">{language === 'ar' ? 'تذكرة مسجلة' : 'tickets in DB'}</span>
          </div>
          <div className="mt-3 text-xs sm:text-sm text-slate-600 flex items-center justify-between pt-2.5 border-t border-slate-100 font-semibold">
            <span>{effectiveMetrics.open + effectiveMetrics.inProgress} {language === 'ar' ? 'نشطة' : 'active'}</span>
            <span className="text-emerald-600 font-bold">{effectiveMetrics.resolved + effectiveMetrics.closed} {language === 'ar' ? 'محلولة ومغلقة' : 'resolved'}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider">
              {language === 'ar' ? 'الالتزام باتفاقية SLA' : 'SLA Compliance'}
            </span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-900">{effectiveMetrics.slaComplianceRate}%</span>
            <span className="text-xs sm:text-sm text-emerald-600 font-bold mx-1">{language === 'ar' ? 'المستهدف ≥ 95%' : 'target ≥ 95%'}</span>
          </div>
          <div className="mt-3 text-xs sm:text-sm text-slate-600 flex items-center justify-between pt-2.5 border-t border-slate-100 font-semibold">
            <span>{language === 'ar' ? 'المتجاوزة:' : 'Breaches:'} {effectiveMetrics.slaBreached}</span>
            <span className="text-slate-500">{language === 'ar' ? 'الاستجابة والحل' : 'Response & Resol.'}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider">
              {language === 'ar' ? 'الحوادث الحرجة (Sev-1)' : 'Critical Incidents'}
            </span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <Flame className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-rose-600">{effectiveMetrics.critical}</span>
            <span className="text-xs sm:text-sm text-rose-500 font-bold mx-1">{language === 'ar' ? 'عاجل وحرج' : 'Sev-1 / Urgent'}</span>
          </div>
          <div className="mt-3 text-xs sm:text-sm text-slate-600 flex items-center justify-between pt-2.5 border-t border-slate-100 font-semibold">
            <span>{language === 'ar' ? 'أولوية NOC و SOC' : 'NOC & SOC priority'}</span>
            <span className="text-rose-600 font-bold">SLA: 1h / 4h</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider">
              {language === 'ar' ? 'متوسط وقت المعالجة' : 'Avg Resolution'}
            </span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Clock className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-900">
              {effectiveMetrics.avgResolutionTimeHours} {language === 'ar' ? 'ساعة' : 'h'}
            </span>
            <span className="text-xs sm:text-sm text-slate-500 mx-1">{language === 'ar' ? 'المتوسط الحسابي' : 'hours mean time'}</span>
          </div>
          <div className="mt-3 text-xs sm:text-sm text-slate-600 flex items-center justify-between pt-2.5 border-t border-slate-100 font-semibold">
            <span>{language === 'ar' ? 'مؤشر MTTR' : 'MTTR KPI'}</span>
            <span className="text-indigo-600 font-bold">{language === 'ar' ? 'المستهدف: < 8 ساعات' : 'Target: < 8h'}</span>
          </div>
        </div>

      </div>

      {/* Charts & Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Priority & Severity Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-600 mx-1" />
              <span>{language === 'ar' ? 'توزيع مستويات الأولوية والخطورة' : 'Priority & Severity Breakdown'}</span>
            </h3>
            <span className="text-xs sm:text-sm text-slate-500 font-medium">{language === 'ar' ? 'مباشر من قاعدة البيانات' : 'Real-time DB query'}</span>
          </div>

          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                <span className="font-bold text-rose-700 flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 mx-2" />
                  {language === 'ar' ? 'حرج وعاجل (Sev-1)' : 'Critical'}
                </span>
                <span className="font-mono text-slate-800 font-bold text-sm sm:text-base">{priorityCounts.Critical}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-rose-600 rounded-full" 
                  style={{ width: `${(priorityCounts.Critical / (displayTickets.length || 1)) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                <span className="font-bold text-orange-700 flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 mx-2" />
                  {language === 'ar' ? 'عالي الأولوية' : 'High'}
                </span>
                <span className="font-mono text-slate-800 font-bold text-sm sm:text-base">{priorityCounts.High}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 rounded-full" 
                  style={{ width: `${(priorityCounts.High / (displayTickets.length || 1)) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                <span className="font-bold text-amber-700 flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mx-2" />
                  {language === 'ar' ? 'متوسط الأولوية' : 'Medium'}
                </span>
                <span className="font-mono text-slate-800 font-bold text-sm sm:text-base">{priorityCounts.Medium}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full" 
                  style={{ width: `${(priorityCounts.Medium / (displayTickets.length || 1)) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                <span className="font-bold text-slate-700 flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 mx-2" />
                  {language === 'ar' ? 'منخفض' : 'Low'}
                </span>
                <span className="font-mono text-slate-800 font-bold text-sm sm:text-base">{priorityCounts.Low}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-slate-400 rounded-full" 
                  style={{ width: `${(priorityCounts.Low / (displayTickets.length || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Categories Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-indigo-600 mx-1" />
              <span>{language === 'ar' ? 'توزيع فئات الخدمة' : 'Service Category Allocation'}</span>
            </h3>
            <span className="text-xs sm:text-sm text-slate-500 font-medium">
              {Object.keys(categoryCounts).length} {language === 'ar' ? 'فئات نشطة' : 'categories active'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {Object.entries(categoryCounts).map(([cat, count]) => (
              <div key={cat} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs sm:text-sm text-slate-800 font-bold truncate mx-1">{cat}</span>
                <span className="text-xs sm:text-sm font-extrabold font-mono bg-white px-2.5 py-1 rounded-md border border-slate-200 text-blue-700">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Critical Active Incidents & System Health Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Critical Incidents List */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 mx-1" />
              <span>{language === 'ar' ? 'قائمة البلاغات الحرجة والطارئة' : 'High Priority & Critical Incident Queue'}</span>
            </h3>
            <span className="text-xs sm:text-sm text-rose-600 font-bold">
              {language === 'ar' ? 'تتطلب استجابة فورية' : 'Immediate response needed'}
            </span>
          </div>

          {criticalTickets.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 font-medium">
              {language === 'ar' ? 'لا توجد حوادث حرجة نشطة حالياً. جميع الأنظمة تعمل بصورة طبيعية.' : 'No active critical incidents. All systems functioning normally.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {criticalTickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onSelectTicket(t)}
                  className="py-3.5 px-2 flex items-center justify-between hover:bg-slate-50 rounded-xl cursor-pointer transition group"
                >
                  <div className="space-y-1 truncate pr-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs sm:text-sm font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 mx-1">
                        #{t.id}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                        {t.title}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600">
                      {t.department} • {language === 'ar' ? 'مقدم البلاغ:' : 'Requester:'} <strong className="text-slate-800">{t.requesterName}</strong> • {language === 'ar' ? 'المكلف:' : 'Assignee:'} <strong className="text-slate-800">{t.assigneeName || (language === 'ar' ? 'غير مسند' : 'Unassigned')}</strong>
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-xs sm:text-sm font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200">
                      {language === 'ar' ? 'حرج' : t.status}
                    </span>
                    <ArrowUpRight className={`w-4.5 h-4.5 text-slate-400 group-hover:text-blue-600 transition ${dir === 'rtl' ? 'rotate-[-90deg]' : ''}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Backend & Security Infrastructure Status (CRPD APP Environment) */}
        <div className="lg:col-span-4 bg-slate-900 text-slate-100 p-6 rounded-2xl border border-slate-800 shadow-md space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Server className="w-5 h-5 text-emerald-400 mx-1" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              {language === 'ar' ? 'بنية نظام CRPD APP التحتية' : 'CRPD APP Architecture'}
            </h3>
          </div>

          <div className="space-y-3.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{language === 'ar' ? 'قاعدة البيانات:' : 'Database Instance:'}</span>
              <span className="font-mono font-bold text-emerald-400">TicketManagementDB</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">{language === 'ar' ? 'خادم السجلات (Serilog):' : 'Serilog Sink:'}</span>
              <span className="font-mono font-bold text-blue-400">Seq @ :5341 (CompactJson)</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">{language === 'ar' ? 'تشفير كلمات المرور:' : 'Identity Hasher:'}</span>
              <span className="font-mono font-bold text-slate-200">BCrypt (WorkFactor: 11)</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">{language === 'ar' ? 'فلاتر الأمان والحماية:' : 'Security Filters:'}</span>
              <span className="font-mono text-xs sm:text-sm font-semibold text-amber-400">UserActivity + ForcePassword</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">{language === 'ar' ? 'سياسة قفل الحساب:' : 'Lockout Policy:'}</span>
              <span className="font-mono text-xs sm:text-sm font-semibold text-slate-300">
                {language === 'ar' ? '6 محاولات (5 د / 10 د / 15 د)' : '6 Attempts (5m / 10m / 15m)'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">{language === 'ar' ? 'سياسة كلمة المرور:' : 'Password Policy:'}</span>
              <span className="font-mono text-xs sm:text-sm font-semibold text-slate-300">
                {language === 'ar' ? '12+ حرف، أرقام، رموز، أحرف كبيرة' : '12+ Chars, Dig, Up, Low, Spec'}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-xs sm:text-sm text-slate-400 flex items-center justify-between">
            <span className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mx-1.5 animate-pulse" />
              {language === 'ar' ? 'كافة الأنظمة الفرعية تعمل بكفاءة' : 'All Subsystems Healthy'}
            </span>
            <span className="font-mono">Seed: admin@system.local</span>
          </div>
        </div>

      </div>

    </div>
  );
}
