import { useState, useMemo } from 'react';
import { useTickets } from '../context/TicketContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useOrg } from '../context/OrgContext';
import { useDevices } from '../context/DeviceContext';
import { isSameDepartment } from '../utils/departmentHelper';
import { Ticket, TicketPriority, TicketStatus, TicketCategory, TicketDepartment, TicketType } from '../types';
import { CATEGORIES, DEPARTMENTS } from '../data/mockData';
import { 
  Search, 
  Filter, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  MessageSquare, 
  Paperclip, 
  User, 
  Flame, 
  RefreshCw,
  ArrowUpDown,
  Star,
  Wrench,
  Laptop,
  UserPlus,
  PlusCircle,
  Server,
  Image as ImageIcon,
  Building2,
  HardDrive
} from 'lucide-react';

interface TicketListProps {
  onSelectTicket: (ticket: Ticket) => void;
  onOpenCreate: () => void;
  onNavigateToDashboard?: () => void;
}

export function TicketList({ onSelectTicket, onOpenCreate, onNavigateToDashboard }: TicketListProps) {
  const { tickets, refreshTickets, isLoadingTickets } = useTickets();
  const { currentUser, isAgent, isOperationalUser, isTechnicalUser, isAdmin, hasPermission, users } = useAuth();
  const { getAllDepartments } = useOrg();
  const { devices } = useDevices();
  const { language, dir } = useLanguage();

  const isTech = Boolean(isTechnicalUser || isAdmin || isAgent);
  const orgDepts = getAllDepartments ? getAllDepartments() : [];

  // Any user can create tickets; all submitted tickets are sent to Technical Teams
  const canCreate = Boolean(currentUser);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [quickPreset, setQuickPreset] = useState<'all' | 'my-assigned' | 'my-created' | 'critical' | 'sla-risk'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'priority' | 'sla'>('newest');
  const [showAllAssetsPanel, setShowAllAssetsPanel] = useState(false);
  const [assetDeptFilter, setAssetDeptFilter] = useState<string>('ALL');
  const [assetSearchTerm, setAssetSearchTerm] = useState('');

  const filteredAllDeptAssets = useMemo(() => {
    return devices.filter((dev) => {
      if (assetDeptFilter !== 'ALL') {
        const matchDept = isSameDepartment(dev.department, assetDeptFilter) || (dev.departmentAr && isSameDepartment(dev.departmentAr, assetDeptFilter));
        if (!matchDept) return false;
      }
      if (assetSearchTerm.trim()) {
        const q = assetSearchTerm.toLowerCase().trim();
        return (
          (dev.deviceCode || '').toLowerCase().includes(q) ||
          (dev.brand || '').toLowerCase().includes(q) ||
          (dev.model || '').toLowerCase().includes(q) ||
          (dev.deviceType || '').toLowerCase().includes(q) ||
          (dev.serialNumber || '').toLowerCase().includes(q) ||
          (dev.department || '').toLowerCase().includes(q) ||
          (dev.departmentAr || '').toLowerCase().includes(q) ||
          (dev.location || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [devices, assetDeptFilter, assetSearchTerm]);

  const isUserTypeString = (str?: string | null): boolean => {
    if (!str) return false;
    const lower = str.toLowerCase().trim();
    return (
      lower === 'operational user' ||
      lower === 'system admin' ||
      lower === 'technical user' ||
      lower === 'technical' ||
      lower === 'operator' ||
      lower === 'admin' ||
      lower === 'administrator' ||
      lower === 'agent' ||
      lower === 'employee' ||
      lower === 'مستخدم تشغيلي' ||
      lower === 'مدير نظام' ||
      lower === 'فني' ||
      lower === 'مشغل' ||
      lower === 'موظف'
    );
  };

  const getUserDepartment = (ticket: Ticket): string => {
    // 1. Search for user in the system users by ID, Email, or Name to get their official org department
    const matchedUser = users?.find((u) => 
      (u.id && (u.id === ticket.requesterId || (u as any).uid === ticket.requesterId)) ||
      (u.email && ticket.requesterEmail && u.email.toLowerCase() === ticket.requesterEmail.toLowerCase()) ||
      (u.fullName && ticket.requesterName && u.fullName.toLowerCase() === ticket.requesterName.toLowerCase())
    );

    // Get candidate department name - strictly prioritize user's actual organizational department
    let rawDept = '';
    if (matchedUser?.department && matchedUser.department.trim() && !isUserTypeString(matchedUser.department)) {
      rawDept = matchedUser.department.trim();
    } else if (ticket.requesterDept && ticket.requesterDept.trim() && !isUserTypeString(ticket.requesterDept) && ticket.requesterDept !== 'Unassigned') {
      rawDept = ticket.requesterDept.trim();
    } else if (ticket.hardwareDetails?.department && ticket.hardwareDetails.department.trim() && !isUserTypeString(ticket.hardwareDetails.department)) {
      rawDept = ticket.hardwareDetails.department.trim();
    } else if (ticket.department && ticket.department.trim() && !isUserTypeString(ticket.department) && ticket.department !== 'Unassigned') {
      rawDept = ticket.department.trim();
    }

    if (!rawDept) {
      return language === 'ar' ? 'غير محدد بالهيكل' : 'Unassigned';
    }

    // 2. Look up the department in the Organizational Structure (الهيكل التنظيمي)
    const orgDepts = getAllDepartments ? getAllDepartments() : [];
    const norm = rawDept.toLowerCase().trim();

    const matchedOrg = orgDepts.find((od) => {
      const en = (od.nameEn || '').toLowerCase().trim();
      const ar = (od.nameAr || '').toLowerCase().trim();
      return (
        en === norm ||
        ar === norm ||
        (en.length > 3 && norm.includes(en)) ||
        (ar.length > 3 && norm.includes(ar)) ||
        (norm.length > 3 && en.includes(norm)) ||
        (norm.length > 3 && ar.includes(norm))
      );
    });

    if (matchedOrg) {
      if (language === 'ar') {
        return matchedOrg.nameAr || matchedOrg.nameEn;
      }
      return matchedOrg.nameEn || matchedOrg.nameAr;
    }

    // Standard fallback dictionary matching Organizational Structure
    const orgDictAr: Record<string, string> = {
      'operations': 'العمليات والتنفيذ',
      'operations & logistics': 'العمليات والتنفيذ',
      'information technology': 'تكنولوجيا المعلومات',
      'it': 'تكنولوجيا المعلومات',
      'it operations': 'تكنولوجيا المعلومات',
      'it service desk': 'دعم العملاء ومكتب المساعدة',
      'customer support & helpdesk': 'دعم العملاء ومكتب المساعدة',
      'customer support': 'دعم العملاء ومكتب المساعدة',
      'electronic archiving & records': 'الأرشفة الإلكترونية والسجلات',
      'archiving': 'الأرشفة الإلكترونية والسجلات',
      'human resources': 'الموارد البشرية',
      'hr': 'الموارد البشرية',
      'cybersecurity (soc)': 'الأمن السيبراني (SOC)',
      'cloud infrastructure': 'البنية التحتية السحابية',
      'software development': 'تطوير البرمجيات',
      'network operations (noc)': 'شبكات الاتصالات (NOC)',
      'finance & compliance': 'الشؤون المالية والامتثال',
    };

    if (language === 'ar') {
      if (orgDictAr[norm]) {
        return orgDictAr[norm];
      }
      return rawDept;
    }

    return rawDept;
  };

  // Operation users should only see tickets belonging to their departments
  const isTicketInUserDepartment = (ticket: Ticket): boolean => {
    if (!currentUser) return false;
    const userDept = (currentUser.department || '').trim();
    if (!userDept || userDept === 'Unassigned') return true;

    // If the user created or requested this ticket, it always belongs to their view
    if (
      (currentUser.id && (ticket.requesterId === currentUser.id || ticket.createdBy === currentUser.id)) ||
      (currentUser.uid && (ticket.requesterId === currentUser.uid || ticket.createdBy === currentUser.uid)) ||
      (currentUser.email && ticket.requesterEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
      (currentUser.fullName && ticket.requesterName?.toLowerCase() === currentUser.fullName.toLowerCase())
    ) {
      return true;
    }

    // Candidate departments from the ticket
    const ticketResolvedDept = getUserDepartment(ticket);
    const candidateDepts: string[] = [
      ticket.department,
      ticket.requesterDept,
      ticket.hardwareDetails?.department,
      ticketResolvedDept
    ].filter(Boolean).map((d) => String(d).toLowerCase().trim());

    // Also check requester's department from users list
    const matchedRequester = users?.find(
      (u) =>
        (u.id && (u.id === ticket.requesterId || (u as any).uid === ticket.requesterId)) ||
        (u.email && ticket.requesterEmail && u.email.toLowerCase() === ticket.requesterEmail.toLowerCase()) ||
        (u.fullName && ticket.requesterName && u.fullName.toLowerCase() === ticket.requesterName.toLowerCase())
    );
    if (matchedRequester?.department) {
      candidateDepts.push(matchedRequester.department.toLowerCase().trim());
    }

    const normUserDept = userDept.toLowerCase().trim();

    // Direct match with any candidate department
    if (candidateDepts.some((cd) => cd === normUserDept || cd.includes(normUserDept) || normUserDept.includes(cd))) {
      return true;
    }

    // Org structure match: check if user department and candidate department map to the same org node
    const orgDepts = getAllDepartments ? getAllDepartments() : [];
    const userOrgNode = orgDepts.find((od) => {
      const en = (od.nameEn || '').toLowerCase().trim();
      const ar = (od.nameAr || '').toLowerCase().trim();
      return (
        en === normUserDept ||
        ar === normUserDept ||
        normUserDept.includes(en) ||
        normUserDept.includes(ar) ||
        (en && en.includes(normUserDept)) ||
        (ar && ar.includes(normUserDept))
      );
    });

    if (userOrgNode) {
      const userEn = (userOrgNode.nameEn || '').toLowerCase().trim();
      const userAr = (userOrgNode.nameAr || '').toLowerCase().trim();
      const userKey = userOrgNode.id.toLowerCase();

      for (const cd of candidateDepts) {
        if (
          cd === userEn ||
          cd === userAr ||
          cd === userKey ||
          (userEn && cd.includes(userEn)) ||
          (userAr && cd.includes(userAr)) ||
          (userEn && userEn.includes(cd)) ||
          (userAr && userAr.includes(cd))
        ) {
          return true;
        }
      }
    }

    // Synonym group matching
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
  };

  // Filter and sort tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // Operation users should ONLY see tickets belonging to their departments.
      // Technical users, agents, and administrators must see all tickets sent to technical teams across all departments.
      if (isOperationalUser && !isAdmin && !isAgent && !isTechnicalUser) {
        if (!isTicketInUserDepartment(ticket)) {
          return false;
        }
      }
      // Quick preset
      if (quickPreset === 'my-assigned') {
        const isAssigned = 
          (currentUser?.id && (ticket.assigneeId === currentUser.id || String(ticket.assigneeId) === String(currentUser.id))) ||
          (currentUser?.uid && (ticket.assigneeId === currentUser.uid || String(ticket.assigneeId) === String(currentUser.uid))) ||
          (currentUser?.fullName && ticket.assigneeName?.toLowerCase() === currentUser.fullName.toLowerCase()) ||
          (currentUser?.email && (ticket as any).assigneeEmail?.toLowerCase() === currentUser.email.toLowerCase());
        
        // For technical users, all tickets dispatched to Technical Teams apply directly to their team queue
        const isTeamAssigned = (isTechnicalUser || isAgent) && (
          !ticket.assignedTeam ||
          ticket.assignedTeam.toLowerCase().includes('tech') ||
          ticket.assignedTeam.includes('فني') ||
          ticket.teamId === 'tech-team' ||
          ticket.teamId === 'technical'
        );

        if (!isAssigned && !isTeamAssigned) return false;
      }

      if (quickPreset === 'my-created') {
        const isCreator = 
          (currentUser?.id && (ticket.requesterId === currentUser.id || ticket.createdBy === currentUser.id)) ||
          (currentUser?.uid && (ticket.requesterId === currentUser.uid || ticket.createdBy === currentUser.uid)) ||
          (currentUser?.email && ticket.requesterEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
          (currentUser?.fullName && ticket.requesterName?.toLowerCase() === currentUser.fullName.toLowerCase());
        if (!isCreator) return false;
      }

      if (quickPreset === 'critical' && ticket.priority !== 'Critical') return false;
      if (quickPreset === 'sla-risk' && !ticket.isResponseBreached && !ticket.isResolutionBreached) return false;

      // Ticket Type
      if (typeFilter !== 'all' && ticket.ticketType !== typeFilter) return false;

      // Status
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;

      // Priority
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;

      // Category
      if (categoryFilter !== 'all' && ticket.category !== categoryFilter) return false;

      // Department
      if (departmentFilter !== 'all') {
        const matchTicketDept =
          isSameDepartment(getUserDepartment(ticket), departmentFilter) ||
          isSameDepartment(ticket.department, departmentFilter) ||
          (ticket.requesterDept && isSameDepartment(ticket.requesterDept, departmentFilter)) ||
          (ticket.hardwareDetails?.department && isSameDepartment(ticket.hardwareDetails.department, departmentFilter));
        if (!matchTicketDept) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesId = (ticket.ticketNo || ticket.id).toLowerCase().includes(query);
        const matchesTitle = ticket.title.toLowerCase().includes(query);
        const matchesDesc = ticket.description.toLowerCase().includes(query);
        const matchesRequester = ticket.requesterName.toLowerCase().includes(query);
        const matchesType = (ticket.ticketType || '').toLowerCase().includes(query);
        const matchesTeam = (ticket.assignedTeam || '').toLowerCase().includes(query);
        const matchesSystem = (ticket.targetSystem || '').toLowerCase().includes(query);
        const matchesAssetCode = (ticket.hardwareDetails?.deviceCode || '').toLowerCase().includes(query);
        const matchesAssetType = (ticket.hardwareDetails?.assetType || '').toLowerCase().includes(query);
        const matchesAssetSerial = (ticket.hardwareDetails?.serialOrBarcode || '').toLowerCase().includes(query);
        const matchesAssetDept = (ticket.hardwareDetails?.department || '').toLowerCase().includes(query);
        const matchesTags = ticket.tags.some((t) => t.toLowerCase().includes(query));
        if (
          !matchesId &&
          !matchesTitle &&
          !matchesDesc &&
          !matchesRequester &&
          !matchesTags &&
          !matchesType &&
          !matchesTeam &&
          !matchesSystem &&
          !matchesAssetCode &&
          !matchesAssetType &&
          !matchesAssetSerial &&
          !matchesAssetDept
        ) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortOrder === 'priority') {
        const weight: Record<TicketPriority, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        return weight[b.priority] - weight[a.priority];
      }
      if (sortOrder === 'sla') {
        const aDue = new Date(a.resolutionDueAt).getTime();
        const bDue = new Date(b.resolutionDueAt).getTime();
        return aDue - bDue;
      }
      // default newest
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tickets, searchTerm, typeFilter, statusFilter, priorityFilter, categoryFilter, departmentFilter, quickPreset, sortOrder, currentUser]);

  const getPriorityBadge = (priority: TicketPriority) => {
    switch (priority) {
      case 'Critical':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
            <Flame className="w-3 h-3 mx-1 text-red-600 animate-pulse" />
            {language === 'ar' ? 'حرج وعاجل' : 'Critical'}
          </span>
        );
      case 'High':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
            {language === 'ar' ? 'عالي الأولوية' : 'High'}
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
            {language === 'ar' ? 'متوسط' : 'Medium'}
          </span>
        );
      case 'Low':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
            {language === 'ar' ? 'منخفض' : 'Low'}
          </span>
        );
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    if (language === 'ar') {
      switch (status) {
        case 'New':
          return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">جديدة</span>;
        case 'Open':
          return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">مفتوحة</span>;
        case 'In Progress':
          return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">قيد المعالجة</span>;
        case 'Pending Customer':
          return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">بانتظار المستخدم</span>;
        case 'Resolved':
          return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">تم الحل</span>;
        case 'Closed':
        default:
          return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">مغلقة</span>;
      }
    }

    switch (status) {
      case 'New':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">New</span>;
      case 'Open':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">Open</span>;
      case 'In Progress':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">In Progress</span>;
      case 'Pending Customer':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Pending User</span>;
      case 'Resolved':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Resolved</span>;
      case 'Closed':
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Closed</span>;
    }
  };

  const getStageBadge = (stage?: string, status?: string) => {
    const val = stage || status || 'New';
    if (language === 'ar') {
      switch (val) {
        case 'New': return 'جديد (New)';
        case 'Triaged': return 'تم الفرز (Triaged)';
        case 'In Progress': return 'قيد المعالجة (In Progress)';
        case 'Pending Review': return 'بانتظار المراجعة (Pending)';
        case 'Resolved': return 'تم الحل (Resolved)';
        case 'Closed': return 'مغلق (Closed)';
        default: return val;
      }
    }
    return val;
  };

  const getTicketTypeLabel = (type?: string) => {
    if (!type) return language === 'ar' ? 'بلاغ دعم فني' : 'Support Ticket';
    if (language === 'ar') {
      switch (type) {
        case 'Hardware Maintenance': return 'صيانة أجهزة ومعدات';
        case 'Systems Troubleshoot': return 'أعطال أنظمة وتشغيل';
        case 'User Request': return 'طلب مستخدم وصلاحيات';
        default: return type;
      }
    }
    return type;
  };

  const getSlaIndicator = (ticket: Ticket) => {
    if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
      return (
        <span className="inline-flex items-center text-xs text-emerald-700 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 mx-1 text-emerald-600" />
          {language === 'ar' ? 'مكتمل بنجاح' : 'Completed'}
        </span>
      );
    }

    if (ticket.isResolutionBreached || ticket.isResponseBreached) {
      return (
        <span className="inline-flex items-center text-xs text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
          <AlertCircle className="w-3.5 h-3.5 mx-1 text-rose-600" />
          {language === 'ar' ? 'تجاوز وقت SLA' : 'SLA Breached'}
        </span>
      );
    }

    const dueMs = new Date(ticket.resolutionDueAt).getTime();
    const remainingHours = Math.max(0, (dueMs - Date.now()) / 3600000);

    if (remainingHours < 2) {
      return (
        <span className="inline-flex items-center text-xs text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          <Clock className="w-3.5 h-3.5 mx-1 text-amber-600 animate-spin" />
          {language === 'ar' 
            ? (remainingHours < 1 ? 'متبقي أقل من ساعة' : `متبقي ${remainingHours.toFixed(1)} ساعة`)
            : (remainingHours < 1 ? '< 1h due' : `${remainingHours.toFixed(1)}h due`)}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center text-xs text-slate-600 font-medium">
        <Clock className="w-3.5 h-3.5 mx-1 text-slate-400" />
        {language === 'ar'
          ? (remainingHours > 24 ? `متبقي ${Math.round(remainingHours / 24)} يوم` : `متبقي ${remainingHours.toFixed(0)} ساعة`)
          : (remainingHours > 24 ? `${Math.round(remainingHours / 24)}d left` : `${remainingHours.toFixed(0)}h left`)}
      </span>
    );
  };

  return (
    <div className="space-y-4" dir={dir}>
      {/* Filter and Search Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
          
          {/* Search Box */}
          <div className="sm:col-span-2 md:col-span-3 relative">
            <Search className={`w-4.5 h-4.5 text-slate-400 absolute top-3.5 ${dir === 'rtl' ? 'right-3.5' : 'left-3.5'}`} />
            <input
              type="text"
              placeholder={language === 'ar' ? 'بحث برقم البلاغ، الأصل، القسم، العنوان...' : 'Search by ticket #ID, asset, dept, summary...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm sm:text-base text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition ${
                dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'
              }`}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className={`absolute top-3 text-slate-400 hover:text-slate-600 text-sm font-semibold ${dir === 'rtl' ? 'left-3' : 'right-3'}`}
              >
                {language === 'ar' ? 'مسح' : 'Clear'}
              </button>
            )}
          </div>

          {/* Department Dropdown (All Departments visible to technical users) */}
          <div className="md:col-span-2">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
            >
              <option value="all">{language === 'ar' ? 'كافة الأقسام' : 'All Departments'}</option>
              {orgDepts.map((dept) => (
                <option key={dept.id || dept.nameEn} value={dept.nameEn}>
                  {language === 'ar' ? (dept.nameAr || dept.nameEn) : dept.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Ticket Type Dropdown */}
          <div className="md:col-span-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
            >
              <option value="all">{language === 'ar' ? 'جميع أنواع البلاغات' : 'All Ticket Types'}</option>
              <option value="Hardware Maintenance">{language === 'ar' ? 'صيانة الأجهزة والمعدات' : 'Hardware Maint.'}</option>
              <option value="Systems Troubleshoot">{language === 'ar' ? 'أعطال الأنظمة' : 'Systems Troubleshoot'}</option>
              <option value="User Request">{language === 'ar' ? 'طلبات المستخدمين (IAM)' : 'User Request (IAM)'}</option>
            </select>
          </div>

          {/* Status / Stage Dropdown */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
            >
              <option value="all">{language === 'ar' ? 'كافة المراحل والحالات' : 'All Stages & Statuses'}</option>
              <option value="New">{language === 'ar' ? 'جديد (New)' : 'New'}</option>
              <option value="Open">{language === 'ar' ? 'مفتوح (Open)' : 'Open'}</option>
              <option value="In Progress">{language === 'ar' ? 'قيد المعالجة (In Progress)' : 'In Progress'}</option>
              <option value="Pending Customer">{language === 'ar' ? 'بانتظار المستخدم' : 'Pending User'}</option>
              <option value="Resolved">{language === 'ar' ? 'تم الحل (Resolved)' : 'Resolved'}</option>
              <option value="Closed">{language === 'ar' ? 'مغلق (Closed)' : 'Closed'}</option>
            </select>
          </div>

          {/* Priority Dropdown */}
          <div className="md:col-span-1">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full py-2.5 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
            >
              <option value="all">{language === 'ar' ? 'الأولوية' : 'Priority'}</option>
              <option value="Critical">{language === 'ar' ? '★★★ حرج' : '★★★ Critical'}</option>
              <option value="High">{language === 'ar' ? '★★★ عالي' : '★★★ High'}</option>
              <option value="Medium">{language === 'ar' ? '★★☆ متوسط' : '★★☆ Medium'}</option>
              <option value="Low">{language === 'ar' ? '★☆☆ منخفض' : '★☆☆ Low'}</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="md:col-span-2">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
              title="Sort tickets"
            >
              <option value="newest">{language === 'ar' ? 'الترتيب: الأحدث' : 'Sort: Newest'}</option>
              <option value="priority">{language === 'ar' ? 'الترتيب: الأولوية' : 'Sort: Priority'}</option>
              <option value="sla">{language === 'ar' ? 'الترتيب: موعد SLA' : 'Sort: SLA Due'}</option>
            </select>
          </div>

        </div>

        {/* Technical Users: All Departments Assets Directory Bar */}
        {isTech && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-700">
              <HardDrive className="w-4 h-4 text-amber-600" />
              <span className="font-bold">
                {language === 'ar'
                  ? `دليل أصول كافة الأقسام للمستخدم الفني (${devices.length} أصل مسجل):`
                  : `Technical User All-Departments Assets Directory (${devices.length} registered assets):`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAllAssetsPanel(!showAllAssetsPanel)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer ${
                showAllAssetsPanel
                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>
                {showAllAssetsPanel
                  ? (language === 'ar' ? 'إخفاء أصول كافة الأقسام' : 'Hide All Dept Assets')
                  : (language === 'ar' ? 'عرض جميع الأصول من كافة الأقسام' : 'View All Assets Across All Departments')}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/90 text-amber-900 font-mono text-xs font-extrabold">
                {devices.length}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Technical Users: Expandable All-Departments Assets Browser */}
      {isTech && showAllAssetsPanel && (
        <div className="bg-amber-50/70 rounded-2xl border border-amber-200 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-600 text-white">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {language === 'ar' ? 'سجل الأصول والمعدات لكافة الأقسام' : 'All Departments Hardware Assets Inventory'}
                </h3>
                <p className="text-xs text-slate-600">
                  {language === 'ar'
                    ? 'يُسمح للمستخدمين الفنيين بالاطلاع على كافة الأصول في جميع أقسام الهيكل التنظيمي'
                    : 'Technical users have full visibility into all assets across all organizational departments'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className={`w-4 h-4 text-slate-400 absolute top-2.5 ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  value={assetSearchTerm}
                  onChange={(e) => setAssetSearchTerm(e.target.value)}
                  placeholder={language === 'ar' ? 'بحث برمز الأصل، الطراز، القسم...' : 'Search code, model, dept...'}
                  className={`py-1.5 bg-white border border-amber-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                    dir === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'
                  }`}
                />
              </div>

              <select
                value={assetDeptFilter}
                onChange={(e) => setAssetDeptFilter(e.target.value)}
                className="py-1.5 px-3 bg-white border border-amber-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="ALL">{language === 'ar' ? 'كافة أقسام الهيكل التنظيمي' : 'All Org Departments'}</option>
                {orgDepts.map((dept) => (
                  <option key={dept.id || dept.nameEn} value={dept.nameEn}>
                    {language === 'ar' ? `${dept.nameAr} (${dept.nameEn})` : `${dept.nameEn} - ${dept.nameAr}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredAllDeptAssets.length === 0 ? (
            <div className="p-6 bg-white rounded-xl border border-amber-200 text-center text-xs sm:text-sm text-slate-500">
              {language === 'ar' ? 'لا توجد أصول مسجلة تطابق البحث الحالي.' : 'No registered assets match the current filter.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto p-1">
              {filteredAllDeptAssets.map((dev) => (
                <div
                  key={dev.id}
                  className="p-3 bg-white rounded-xl border border-amber-200/90 hover:border-amber-400 shadow-2xs flex flex-col justify-between gap-2 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-xs font-extrabold border border-amber-300">
                        {dev.deviceCode}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 truncate">
                        {language === 'ar' ? (dev.departmentAr || dev.department) : dev.department}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {dev.brand} {dev.model}
                    </div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                      <span>{dev.deviceType}</span>
                      {dev.serialNumber && (
                        <>
                          <span>•</span>
                          <span className="font-mono">S/N: {dev.serialNumber}</span>
                        </>
                      )}
                      {dev.location && (
                        <>
                          <span>•</span>
                          <span>{dev.location}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ticket Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-slate-700">
          <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
            <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              {language === 'ar' ? 'قائمة البلاغات والتذاكر' : 'Ticket Queue'}
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-mono text-xs sm:text-sm font-extrabold mx-1">
              {filteredTickets.length}
            </span>
            {/* أيقونة التحديث والتزامن بشكل Refresh */}
            <button
              onClick={() => refreshTickets()}
              disabled={isLoadingTickets}
              title={language === 'ar' ? 'تحديث وتزامن البلاغات والتذاكر' : 'Refresh & Sync Tickets'}
              className="p-2 text-slate-600 hover:text-blue-600 bg-white hover:bg-slate-100 rounded-xl border border-slate-300 shadow-xs transition cursor-pointer mx-1 disabled:opacity-50 flex items-center justify-center"
            >
              <RefreshCw className={`w-4 h-4 text-blue-600 ${isLoadingTickets ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <span className="hidden md:block text-xs sm:text-sm text-slate-500 font-medium">
              {language === 'ar' ? 'انقر على أي بلاغ لعرض تفاصيل المحادثة وسجل التدقيق ومواعيد SLA' : 'Click any ticket row to view conversation, audit history & SLA details'}
            </span>
            {canCreate && (
              <button
                onClick={onOpenCreate}
                id="ticket-list-btn-create"
                className="flex items-center space-x-2 px-4 py-2 text-sm sm:text-base font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md hover:shadow-lg transition cursor-pointer mx-1"
              >
                <PlusCircle className="w-4.5 h-4.5 mx-1" />
                <span>{language === 'ar' ? 'إنشاء تذكرة جديدة' : 'New Ticket'}</span>
              </button>
            )}
          </div>
        </div>

        {filteredTickets.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Filter className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {language === 'ar' ? 'لم يتم العثور على تذاكر مطابقة' : 'No matching tickets found'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {language === 'ar' 
                ? 'جرب تعديل خيارات البحث أو تصفية الفلاتر لعرض مزيد من التذاكر.' 
                : 'Try adjusting your search filters or clearing the search terms to see more tickets.'}
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('all');
                setStatusFilter('all');
                setPriorityFilter('all');
                setCategoryFilter('all');
                setQuickPreset('all');
              }}
              className="mt-4 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer"
            >
              {language === 'ar' ? 'إعادة ضبط كافة الفلاتر' : 'Reset all filters'}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTickets.map((ticket) => {
              const stars = ticket.priorityStars || (ticket.priority === 'Critical' || ticket.priority === 'High' ? 3 : ticket.priority === 'Medium' ? 2 : 1);

              return (
                <div
                  key={ticket.id}
                  onClick={() => onSelectTicket(ticket)}
                  className="p-4 hover:bg-blue-50/40 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  {/* Left info: ID, Priority, Title, Meta */}
                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Ticket Header & Metadata */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-sm sm:text-base font-extrabold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                        #{ticket.ticketNo || ticket.id}
                      </span>

                      {/* Ticket Type Badge */}
                      <span className="inline-flex items-center text-xs sm:text-sm font-bold px-3.5 py-1 rounded-full bg-slate-800 text-white">
                        {ticket.ticketType === 'Hardware Maintenance' && <Wrench className="w-4 h-4 mx-1 text-amber-400" />}
                        {ticket.ticketType === 'Systems Troubleshoot' && <Laptop className="w-4 h-4 mx-1 text-blue-400" />}
                        {ticket.ticketType === 'User Request' && <UserPlus className="w-4 h-4 mx-1 text-emerald-400" />}
                        {getTicketTypeLabel(ticket.ticketType)}
                      </span>

                      {/* 3 Yellow Stars Priority Badge */}
                      <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200" title={`Priority Level ${stars}`}>
                        {[1, 2, 3].map((starNum) => (
                          <Star
                            key={starNum}
                            className={`w-4 h-4 ${
                              starNum <= stars
                                ? 'fill-amber-400 text-amber-500'
                                : 'text-slate-300'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Stage Badge */}
                      <span className="px-3 py-1 rounded-lg text-xs sm:text-sm font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        {getStageBadge(ticket.stage, ticket.status)}
                      </span>

                      {/* Target System if applicable */}
                      {ticket.targetSystem && (
                        <span className="inline-flex items-center text-xs sm:text-sm font-bold px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Server className="w-4 h-4 mx-1 text-indigo-500" />
                          {ticket.targetSystem}
                        </span>
                      )}

                      {/* Linked Asset Badge if applicable */}
                      {(ticket.hardwareDetails?.deviceCode || ticket.hardwareDetails?.assetType) && (
                        <span className="inline-flex items-center text-xs sm:text-sm font-bold px-3 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                          <HardDrive className="w-4 h-4 mx-1 text-amber-600" />
                          <span>
                            {ticket.hardwareDetails.deviceCode ? `${ticket.hardwareDetails.deviceCode} — ` : ''}
                            {ticket.hardwareDetails.assetType}
                            {ticket.hardwareDetails.department ? ` (${ticket.hardwareDetails.department})` : ''}
                          </span>
                        </span>
                      )}

                      <span className="text-base text-slate-300 hidden sm:inline">•</span>
                      <span className="text-sm sm:text-base text-slate-600 hidden sm:inline">
                        {language === 'ar' ? 'الفريق:' : 'Team:'} <strong className="text-slate-800 font-bold">{ticket.assignedTeam}</strong>
                      </span>
                    </div>

                    <h4 className="text-lg sm:text-xl font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                      {ticket.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-4 text-sm sm:text-base text-slate-600">
                      {/* مقدم البلاغ - اسم المستخدم */}
                      <span className="flex items-center">
                        <User className="w-4.5 h-4.5 mx-1 text-slate-500" />
                        <span className="text-slate-500 mx-1">{language === 'ar' ? 'مقدم البلاغ:' : 'Requester:'}</span>
                        <span className="font-bold text-slate-900 mx-1">{ticket.requesterName}</span>
                      </span>

                      {/* قسم المستخدم التابع له بالهيكل التنظيمي (وليس نوع المستخدم) */}
                      <span className="flex items-center">
                        <Building2 className="w-4.5 h-4.5 mx-1 text-blue-600" />
                        <span className="text-slate-600 font-bold mx-1">{language === 'ar' ? 'قسم المستخدم:' : 'User Department:'}</span>
                        <span 
                          title={language === 'ar' ? 'القسم التابع له في الهيكل التنظيمي' : 'Department from Organizational Structure'}
                          className="font-extrabold text-blue-900 bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg text-sm sm:text-base inline-flex items-center gap-1 shadow-2xs"
                        >
                          {getUserDepartment(ticket)}
                        </span>
                      </span>

                      {/* المكلف */}
                      <span className="flex items-center">
                        <span className="text-slate-500 mx-1">{language === 'ar' ? 'المكلف:' : 'Assignee:'}</span>
                        {ticket.assigneeName ? (
                          <span className="font-bold text-slate-900 mx-1 bg-slate-100 px-2.5 py-1 rounded-lg text-sm sm:text-base border border-slate-200">
                            {ticket.assigneeName}
                          </span>
                        ) : (
                          <span className="text-amber-800 font-bold mx-1 bg-amber-50 px-2.5 py-1 rounded-lg text-sm sm:text-base border border-amber-200">
                            {language === 'ar' ? 'غير مسند' : 'Unassigned'}
                          </span>
                        )}
                      </span>

                      {ticket.comments.length > 0 && (
                        <span className="flex items-center text-slate-600 font-semibold">
                          <MessageSquare className="w-4.5 h-4.5 mx-1 text-slate-400" />
                          {ticket.comments.length}
                        </span>
                      )}

                      {ticket.attachments.length > 0 && (
                        <span className="flex items-center text-slate-600 font-semibold">
                          <ImageIcon className="w-4.5 h-4.5 mx-1 text-blue-500" />
                          {ticket.attachments.length} {language === 'ar' ? 'صور مرفقة' : 'pictures'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side SLA & Timestamp */}
                  <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 shrink-0">
                    <div>{getSlaIndicator(ticket)}</div>
                    <div className="text-xs sm:text-sm text-slate-500 mt-1 font-semibold">
                      {language === 'ar' ? 'تاريخ الإنشاء: ' : 'Created '}
                      {new Date(ticket.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
