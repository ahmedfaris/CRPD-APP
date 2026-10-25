import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  ElectronicDevice, 
  DeviceMaintenanceItem, 
  DeviceDepartmentHistoryItem, 
  MaintenanceRecord,
  DepartmentRequestDoc 
} from '../types';
import { 
  Wrench, 
  Building2, 
  History, 
  Calendar, 
  ArrowRightLeft, 
  Sparkles, 
  ShieldCheck, 
  Activity, 
  Clock, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  UserCheck, 
  Search, 
  ArrowUpDown, 
  Plus, 
  Eye, 
  Download, 
  HardDrive, 
  Filter, 
  Layers, 
  Coins,
  Cpu,
  Laptop,
  Printer,
  ChevronRight,
  ExternalLink,
  MapPin,
  Tag
} from 'lucide-react';

export type TimelineEventCategory = 'ALL' | 'MAINTENANCE' | 'TRANSFER' | 'MILESTONE';

export interface TimelineEventItem {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  category: 'MAINTENANCE' | 'TRANSFER' | 'MILESTONE';
  titleEn: string;
  titleAr: string;
  badgeEn: string;
  badgeAr: string;
  descriptionEn: string;
  descriptionAr: string;
  actorEn?: string;
  actorAr?: string;
  previousDeptEn?: string;
  previousDeptAr?: string;
  targetDeptEn?: string;
  targetDeptAr?: string;
  costIQD?: number;
  status?: string;
  ticketNo?: string;
  document?: DepartmentRequestDoc | null;
  notes?: string;
  theme: 'amber' | 'purple' | 'cyan' | 'emerald' | 'rose' | 'blue';
}

interface AssetTimelineViewProps {
  device: ElectronicDevice;
  centralMaintenanceRecords?: MaintenanceRecord[];
  onOpenMaintenance?: () => void;
  onOpenTransfer?: () => void;
  onPreviewDocument?: (doc: { name: string; url?: string; raw?: any }) => void;
  onSelectTicket?: (ticketNo: string) => void;
}

export function AssetTimelineView({
  device,
  centralMaintenanceRecords = [],
  onOpenMaintenance,
  onOpenTransfer,
  onPreviewDocument,
  onSelectTicket
}: AssetTimelineViewProps) {
  const { language, dir } = useLanguage();
  const [categoryFilter, setCategoryFilter] = useState<TimelineEventCategory>('ALL');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Currency Formatter for Iraqi Dinar (IQD)
  const formatCostIQD = (val?: number | string) => {
    if (val === undefined || val === null) return null;
    const num = parseFloat(String(val || '0')) || 0;
    if (num <= 0) return null;
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: num % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return language === 'ar' ? `${formatted} د.ع` : `${formatted} IQD`;
  };

  // Helper relative time formatter
  const getRelativeTime = (dateStr: string) => {
    try {
      const eventTime = new Date(dateStr).getTime();
      if (isNaN(eventTime)) return '';
      const now = Date.now();
      const diffMs = now - eventTime;
      const isFuture = diffMs < 0;
      const absDiffDays = Math.round(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
      
      if (absDiffDays === 0) return language === 'ar' ? 'اليوم' : 'Today';
      if (absDiffDays === 1) return isFuture ? (language === 'ar' ? 'غداً' : 'Tomorrow') : (language === 'ar' ? 'أمس' : 'Yesterday');
      if (absDiffDays < 30) {
        return isFuture
          ? (language === 'ar' ? `خلال ${absDiffDays} يوم` : `In ${absDiffDays} days`)
          : (language === 'ar' ? `منذ ${absDiffDays} يوم` : `${absDiffDays}d ago`);
      }
      const months = Math.round(absDiffDays / 30);
      if (months < 12) {
        return isFuture
          ? (language === 'ar' ? `خلال ${months} شهر` : `In ${months} mo`)
          : (language === 'ar' ? `منذ ${months} شهر` : `${months} mo ago`);
      }
      const years = (absDiffDays / 365).toFixed(1);
      return isFuture
        ? (language === 'ar' ? `خلال ${years} سنة` : `In ${years} yr`)
        : (language === 'ar' ? `منذ ${years} سنة` : `${years} yr ago`);
    } catch {
      return '';
    }
  };

  // Parse attached documents from central maintenance or legacy entries
  const parseDoc = (docRaw: any): DepartmentRequestDoc | null => {
    if (!docRaw) return null;
    let doc: any = null;
    if (typeof docRaw === 'object') {
      doc = { ...docRaw };
    } else if (typeof docRaw === 'string') {
      try {
        doc = JSON.parse(docRaw);
      } catch {
        doc = { fileName: docRaw, fileSize: '', fileType: 'application/pdf', source: 'PC Upload', requestNumber: '', requestDate: '', scannedAt: '' };
      }
    }
    if (!doc) return null;
    if (!doc.fileUrl && doc.fileName) {
      doc.fileUrl = `/api/ticket-requests/${encodeURIComponent(doc.fileName)}`;
    }
    if (!doc.filePath && doc.fileName) {
      doc.filePath = `ticket requests/${doc.fileName}`;
    }
    if (!doc.dataUrl && doc.fileUrl) {
      doc.dataUrl = doc.fileUrl;
    }
    return doc as DepartmentRequestDoc;
  };

  // Compile Unified Event Stream
  const allEvents = useMemo(() => {
    const list: TimelineEventItem[] = [];

    // 1. Initial Purchase & Registration Milestone
    const purchaseDate = device.dateOfPurchase || device.createdAt?.split('T')[0] || '2024-01-01';
    list.push({
      id: `milestone-purchase-${device.id}`,
      date: purchaseDate,
      timestamp: new Date(purchaseDate).getTime() || 0,
      category: 'MILESTONE',
      titleEn: `Asset Purchase & Commissioning (${device.brand} ${device.model})`,
      titleAr: `شراء وتدشين الأصل التقني (${device.brand} ${device.model})`,
      badgeEn: 'Commissioned',
      badgeAr: 'تدشين وتسجيل',
      descriptionEn: `Official acquisition and initial operational registration of ${device.brand} ${device.model} (${device.deviceCode}). Allocated to ${device.department}.`,
      descriptionAr: `تم إدخال ${device.brand} ${device.model} (رمز الأصل: ${device.deviceCode}) رسمياً إلى الخدمة وتخصيصه لإدارة ${device.departmentAr || device.department}.`,
      actorEn: device.assignedEmployee ? `Assigned to: ${device.assignedEmployee}` : 'IT Procurement & Logistics',
      actorAr: device.assignedEmployee ? `الموظف المسند إليه: ${device.assignedEmployee}` : 'لجنة المشتريات واللوجستيات',
      targetDeptEn: device.department,
      targetDeptAr: device.departmentAr || device.department,
      notes: device.location ? (language === 'ar' ? `الموقع الابتدائي: ${device.location}` : `Initial Location: ${device.location}`) : undefined,
      theme: 'cyan'
    });

    // 2. Warranty Activation Milestone
    if (device.warrantyStartDate) {
      list.push({
        id: `milestone-warranty-start-${device.id}`,
        date: device.warrantyStartDate,
        timestamp: new Date(device.warrantyStartDate).getTime() || 0,
        category: 'MILESTONE',
        titleEn: `Manufacturer Warranty Active (${device.warrantyPeriod})`,
        titleAr: `تفعيل سريان الضمان المصنعي (${device.warrantyPeriod})`,
        badgeEn: 'Warranty Active',
        badgeAr: 'سريان الضمان',
        descriptionEn: `Hardware warranty coverage initiated for duration of ${device.warrantyPeriod}. Valid through ${device.warrantyExpiryDate || 'scheduled period'}.`,
        descriptionAr: `بدء سريان تغطية الضمان الفني والعتادي لمدة ${device.warrantyPeriod}. ينتهي بتاريخ ${device.warrantyExpiryDate || 'الفترة المحددة'}.`,
        actorEn: `${device.brand} Authorized Support`,
        actorAr: `مركز دعم ${device.brand} المعتمد`,
        theme: 'emerald'
      });
    }

    // 3. Warranty Expiry Milestone
    if (device.warrantyExpiryDate) {
      const isPast = new Date(device.warrantyExpiryDate).getTime() < Date.now();
      list.push({
        id: `milestone-warranty-end-${device.id}`,
        date: device.warrantyExpiryDate,
        timestamp: new Date(device.warrantyExpiryDate).getTime() || 0,
        category: 'MILESTONE',
        titleEn: isPast ? 'Manufacturer Warranty Expired' : 'Upcoming Warranty Expiration',
        titleAr: isPast ? 'انتهاء فترة الضمان المصنعي' : 'موعد انتهاء الضمان المصنعي المرتقب',
        badgeEn: isPast ? 'Warranty Expired' : 'Warranty Ending',
        badgeAr: isPast ? 'منتهي الضمان' : 'قرب انتهاء الضمان',
        descriptionEn: isPast 
          ? `Standard manufacturer warranty concluded on ${device.warrantyExpiryDate}. Ongoing maintenance handled via internal support.`
          : `Standard manufacturer coverage active until ${device.warrantyExpiryDate}.`,
        descriptionAr: isPast
          ? `انتهت فترة الضمان المصنعي المعتمدة بتاريخ ${device.warrantyExpiryDate}. تخضع الصيانة الحالية للدعم الذاتي الداخلي.`
          : `الضمان الفني ساري ومفعل رسمياً حتى ${device.warrantyExpiryDate}.`,
        theme: isPast ? 'rose' : 'emerald'
      });
    }

    // 4. Department Transfer History
    if (device.departmentHistory && Array.isArray(device.departmentHistory)) {
      device.departmentHistory.forEach((dh, index) => {
        const transferDate = dh.transferredDate || dh.assignedDate || purchaseDate;
        list.push({
          id: dh.id || `transfer-${index}-${device.id}`,
          date: transferDate,
          timestamp: new Date(transferDate).getTime() || 0,
          category: 'TRANSFER',
          titleEn: `Department Reassignment: Transferred to ${dh.department}`,
          titleAr: `تحويل قسم: نقل العهدة إلى ${dh.departmentAr || dh.department}`,
          badgeEn: 'Dept Transfer',
          badgeAr: 'تحويل قسم',
          descriptionEn: dh.reason || 'Hardware reassignment and organizational asset transfer.',
          descriptionAr: dh.reason || 'إعادة توزيع الأصول التقنية وتنظيم العهدة بين الأقسام.',
          actorEn: dh.transferredBy ? `Authorized by: ${dh.transferredBy}` : 'System Administrator',
          actorAr: dh.transferredBy ? `باعتماد: ${dh.transferredBy}` : 'إدارة النظام والعهد',
          targetDeptEn: dh.department,
          targetDeptAr: dh.departmentAr || dh.department,
          theme: 'purple'
        });
      });
    }

    // 5. Device-Specific Maintenance History Log
    const seenMaintenanceKeys = new Set<string>();
    if (device.maintenanceHistory && Array.isArray(device.maintenanceHistory)) {
      device.maintenanceHistory.forEach((mh, index) => {
        const maintDate = mh.date || purchaseDate;
        const key = `${maintDate}_${(mh.description || '').slice(0, 20)}`;
        seenMaintenanceKeys.add(key);

        let theme: TimelineEventItem['theme'] = 'amber';
        if (mh.type === 'Repair' || mh.type === 'Replacement') theme = 'rose';
        else if (mh.type === 'Upgrade') theme = 'cyan';
        else if (mh.type === 'Inspection') theme = 'blue';

        list.push({
          id: mh.id || `maint-dev-${index}-${device.id}`,
          date: maintDate,
          timestamp: new Date(maintDate).getTime() || 0,
          category: 'MAINTENANCE',
          titleEn: `${mh.type} Maintenance Procedure`,
          titleAr: `إجراء صيانة فنية: ${mh.type}`,
          badgeEn: mh.type,
          badgeAr: mh.type,
          descriptionEn: mh.description,
          descriptionAr: mh.description,
          actorEn: mh.performedBy || 'Hardware Tech Team',
          actorAr: mh.performedBy || 'فريق الدعم الفني',
          costIQD: mh.cost ? Number(mh.cost) : undefined,
          status: mh.status || 'Completed',
          notes: mh.notes,
          theme
        });
      });
    }

    // 6. Central Maintenance Table Records (Linked via Asset ID or Code)
    const matchingCentral = (centralMaintenanceRecords || []).filter(
      r => String(r.assetId) === String(device.id) || (r.assetCode && r.assetCode === device.deviceCode)
    );

    matchingCentral.forEach((cr, index) => {
      const crDate = cr.maintenanceDate ? cr.maintenanceDate.split('T')[0] : purchaseDate;
      const key = `${crDate}_${(cr.maintenanceDescription || '').slice(0, 20)}`;
      
      // If already recorded in device log, augment with document and ticket rather than duplicating
      const existing = list.find(item => item.category === 'MAINTENANCE' && item.date === crDate);
      if (existing) {
        if (!existing.ticketNo && cr.ticketNo) existing.ticketNo = cr.ticketNo;
        if (!existing.document && cr.maintenanceRequestDocument) {
          existing.document = parseDoc(cr.maintenanceRequestDocument);
        }
        if (!existing.costIQD && cr.costOfMaintenance) {
          existing.costIQD = Number(cr.costOfMaintenance);
        }
        return;
      }

      const doc = parseDoc(cr.maintenanceRequestDocument);
      let theme: TimelineEventItem['theme'] = 'amber';
      const mType = (cr.maintenanceType || '').toLowerCase();
      if (mType.includes('repair') || mType.includes('replac')) theme = 'rose';
      else if (mType.includes('upgrade')) theme = 'cyan';

      list.push({
        id: `maint-central-${cr.id || index}-${device.id}`,
        date: crDate,
        timestamp: new Date(crDate).getTime() || 0,
        category: 'MAINTENANCE',
        titleEn: `${cr.maintenanceType || 'Maintenance'} Service Record`,
        titleAr: `سجل صيانة: ${cr.maintenanceType || 'صيانة معتمدة'}`,
        badgeEn: cr.maintenanceType || 'Service Order',
        badgeAr: cr.maintenanceType || 'أمر صيانة',
        descriptionEn: cr.maintenanceDescription,
        descriptionAr: cr.maintenanceDescription,
        actorEn: cr.performedBy || cr.maintenanceRequesterName || 'Technical Support Team',
        actorAr: cr.performedBy || cr.maintenanceRequesterName || 'فريق الدعم الفني',
        costIQD: cr.costOfMaintenance ? Number(cr.costOfMaintenance) : undefined,
        status: cr.status || 'Completed',
        ticketNo: cr.ticketNo,
        document: doc,
        notes: cr.notes,
        theme
      });
    });

    return list;
  }, [device, centralMaintenanceRecords, language]);

  // Aggregate Metrics for Header
  const metrics = useMemo(() => {
    const totalEvents = allEvents.length;
    const maintenanceCount = allEvents.filter(e => e.category === 'MAINTENANCE').length;
    const transferCount = allEvents.filter(e => e.category === 'TRANSFER').length;
    const milestoneCount = allEvents.filter(e => e.category === 'MILESTONE').length;
    const totalCostIQD = allEvents.reduce((acc, curr) => acc + (curr.costIQD || 0), 0);

    return {
      totalEvents,
      maintenanceCount,
      transferCount,
      milestoneCount,
      totalCostIQD
    };
  }, [allEvents]);

  // Filter & Sort
  const filteredEvents = useMemo(() => {
    return allEvents
      .filter(item => {
        // Category Filter
        if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = (item.titleEn + ' ' + item.titleAr).toLowerCase().includes(q);
          const matchDesc = (item.descriptionEn + ' ' + item.descriptionAr).toLowerCase().includes(q);
          const matchActor = (item.actorEn + ' ' + (item.actorAr || '')).toLowerCase().includes(q);
          const matchDate = item.date.includes(q);
          const matchBadge = (item.badgeEn + ' ' + item.badgeAr).toLowerCase().includes(q);
          const matchTicket = (item.ticketNo || '').toLowerCase().includes(q);
          const matchNotes = (item.notes || '').toLowerCase().includes(q);
          return matchTitle || matchDesc || matchActor || matchDate || matchBadge || matchTicket || matchNotes;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'oldest') {
          return a.timestamp - b.timestamp;
        }
        return b.timestamp - a.timestamp;
      });
  }, [allEvents, categoryFilter, searchQuery, sortOrder]);

  // Icon selector based on category and theme
  const getEventIcon = (event: TimelineEventItem) => {
    if (event.category === 'TRANSFER') {
      return <Building2 className="w-4 h-4 text-purple-400" />;
    }
    if (event.category === 'MILESTONE') {
      if (event.theme === 'emerald') return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      if (event.theme === 'rose') return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      return <Sparkles className="w-4 h-4 text-cyan-400" />;
    }
    // MAINTENANCE
    if (event.theme === 'rose') return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    if (event.theme === 'cyan') return <Cpu className="w-4 h-4 text-cyan-400" />;
    return <Wrench className="w-4 h-4 text-amber-400" />;
  };

  const getThemePillStyle = (theme: TimelineEventItem['theme']) => {
    switch (theme) {
      case 'purple':
        return 'text-purple-300 bg-purple-500/10 border border-purple-500/30';
      case 'rose':
        return 'text-rose-300 bg-rose-500/10 border border-rose-500/30';
      case 'cyan':
        return 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/30';
      case 'emerald':
        return 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/30';
      case 'blue':
        return 'text-blue-300 bg-blue-500/10 border border-blue-500/30';
      case 'amber':
      default:
        return 'text-amber-300 bg-amber-500/10 border border-amber-500/30';
    }
  };

  const getNodeRingStyle = (theme: TimelineEventItem['theme']) => {
    switch (theme) {
      case 'purple':
        return 'bg-purple-950 border-purple-500/80 ring-purple-500/20';
      case 'rose':
        return 'bg-rose-950 border-rose-500/80 ring-rose-500/20';
      case 'cyan':
        return 'bg-cyan-950 border-cyan-500/80 ring-cyan-500/20';
      case 'emerald':
        return 'bg-emerald-950 border-emerald-500/80 ring-emerald-500/20';
      case 'blue':
        return 'bg-blue-950 border-blue-500/80 ring-blue-500/20';
      case 'amber':
      default:
        return 'bg-amber-950 border-amber-500/80 ring-amber-500/20';
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      
      {/* 1. TOP METRICS STRIP: High-Density Operational Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/80">
        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">{language === 'ar' ? 'إجمالي المحطات' : 'Total Events'}</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">{metrics.totalEvents}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{language === 'ar' ? 'سجل تتبع زمني' : 'lifecycle checkpoints'}</div>
        </div>

        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">{language === 'ar' ? 'عمليات الصيانة' : 'Maintenance'}</span>
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">{metrics.maintenanceCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{language === 'ar' ? 'أوامر وفحوصات' : 'service orders logged'}</div>
        </div>

        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">{language === 'ar' ? 'تحويلات الأقسام' : 'Dept Transfers'}</span>
            <Building2 className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-purple-400">{metrics.transferCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{language === 'ar' ? 'انتقال بين الإدارات' : 'reallocations recorded'}</div>
        </div>

        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">{language === 'ar' ? 'إجمالي تكلفة الصيانة' : 'Cumulative Cost'}</span>
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 truncate">
            {formatCostIQD(metrics.totalCostIQD) || (language === 'ar' ? '0 د.ع' : '0 IQD')}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{language === 'ar' ? 'بالدينار العراقي (IQD)' : 'in Iraqi Dinar'}</div>
        </div>
      </div>

      {/* 2. INTERACTIVE CONTROLS BAR: Filters, Search, Sorting, and Actions */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 shadow-xs">
        
        {/* Category Segmented Control */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              categoryFilter === 'ALL'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
            }`}
          >
            {language === 'ar' ? 'كافة المحطات' : 'All Events'} ({allEvents.length})
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('MAINTENANCE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              categoryFilter === 'MAINTENANCE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-800 text-amber-300/80 hover:text-amber-200 hover:bg-slate-750 border border-amber-500/20'
            }`}
          >
            <Wrench className="w-3 h-3" />
            <span>{language === 'ar' ? 'سجل الصيانة' : 'Maintenance'}</span>
            <span className="font-mono text-[10px]">({metrics.maintenanceCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('TRANSFER')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              categoryFilter === 'TRANSFER'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-800 text-purple-300/80 hover:text-purple-200 hover:bg-slate-750 border border-purple-500/20'
            }`}
          >
            <Building2 className="w-3 h-3" />
            <span>{language === 'ar' ? 'تحويل الأقسام' : 'Transfers'}</span>
            <span className="font-mono text-[10px]">({metrics.transferCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('MILESTONE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              categoryFilter === 'MILESTONE'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
            }`}
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>{language === 'ar' ? 'محطات الأصل' : 'Milestones'}</span>
            <span className="font-mono text-[10px]">({metrics.milestoneCount})</span>
          </button>
        </div>

        {/* Right side: Search, Order, and Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Search */}
          <div className="relative flex-1 sm:flex-initial">
            <Search className={`w-3.5 h-3.5 text-slate-400 absolute top-2.5 ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'ar' ? 'بحث في الخط الزمني...' : 'Filter timeline...'}
              className={`bg-slate-950/70 border border-slate-700/80 rounded-xl py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 w-full sm:w-44 ${dir === 'rtl' ? 'pr-8 pl-2' : 'pl-8 pr-2'}`}
            />
          </div>

          {/* Sort Direction Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
            title={sortOrder === 'newest' ? (language === 'ar' ? 'الترتيب: الأحدث أولاً' : 'Sort: Newest First') : (language === 'ar' ? 'الترتيب: الأقدم أولاً' : 'Sort: Oldest First')}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline font-mono text-[11px]">
              {sortOrder === 'newest' ? (language === 'ar' ? 'الأحدث' : 'Newest') : (language === 'ar' ? 'الأقدم' : 'Oldest')}
            </span>
          </button>

          {/* Quick Action: Log Maintenance */}
          {onOpenMaintenance && (
            <button
              type="button"
              onClick={onOpenMaintenance}
              className="px-2.5 py-1.5 rounded-xl bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              title={language === 'ar' ? 'تسجيل صيانة جديدة لهذا الأصل' : 'Log Maintenance'}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'صيانة' : 'Maint'}</span>
            </button>
          )}

          {/* Quick Action: Transfer Department */}
          {onOpenTransfer && (
            <button
              type="button"
              onClick={onOpenTransfer}
              className="px-2.5 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-300 border border-purple-500/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              title={language === 'ar' ? 'تحويل الأصل لقسم آخر' : 'Transfer Department'}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'تحويل' : 'Transfer'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. VISUAL TIMELINE STREAM */}
      <div className="relative">
        {/* Timeline Spine / Rail */}
        <div 
          className={`absolute top-4 bottom-4 w-0.5 bg-gradient-to-b from-cyan-500/60 via-purple-500/50 to-amber-500/40 ${
            dir === 'rtl' ? 'right-4 sm:right-6' : 'left-4 sm:left-6'
          }`} 
        />

        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/30 rounded-2xl border border-slate-800/80 p-6 space-y-2">
            <Activity className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="font-bold text-slate-300 text-xs">
              {language === 'ar' ? 'لا توجد محطات زمنية مطابقة لمعايير البحث والتصفية' : 'No timeline events matching current filter criteria'}
            </p>
            <p className="text-[11px] text-slate-500">
              {language === 'ar' ? 'جرب اختيار تصنيف آخر أو مسح كلمة البحث' : 'Try selecting another category filter or clearing the search text'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => {
              const formattedCost = formatCostIQD(event.costIQD);
              const relativeTime = getRelativeTime(event.date);

              return (
                <div key={event.id} className={`relative flex items-start group ${dir === 'rtl' ? 'pr-11 sm:pr-14' : 'pl-11 sm:pl-14'}`}>
                  
                  {/* Timeline Glowing Node Circle */}
                  <div 
                    className={`absolute top-3.5 w-7 h-7 rounded-xl border-2 ring-4 flex items-center justify-center transition-all duration-300 shadow-md ${getNodeRingStyle(event.theme)} ${
                      dir === 'rtl' ? 'right-0.5 sm:right-2.5' : 'left-0.5 sm:left-2.5'
                    }`}
                  >
                    {getEventIcon(event)}
                  </div>

                  {/* Event Card Content */}
                  <div className="w-full bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/90 rounded-2xl p-4 sm:p-5 transition shadow-sm space-y-3">
                    
                    {/* Event Header: Date, Badges, and Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Event Category Badge */}
                        <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${getThemePillStyle(event.theme)}`}>
                          {language === 'ar' ? event.badgeAr : event.badgeEn}
                        </span>

                        {/* Date & Relative Time (Unboxed clean typography with separator per design constitution) */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-semibold text-slate-300">{event.date}</span>
                          {relativeTime && (
                            <>
                              <span aria-hidden="true" className="text-slate-600">·</span>
                              <span className="text-[11px] text-cyan-400/90">{relativeTime}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status / Cost Tags */}
                      <div className="flex items-center gap-2">
                        {formattedCost && (
                          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-500/30">
                            {formattedCost}
                          </span>
                        )}

                        {event.status && (
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                            {event.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Event Main Title */}
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition">
                        {language === 'ar' ? event.titleAr : event.titleEn}
                      </h4>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        {language === 'ar' ? event.descriptionAr : event.descriptionEn}
                      </p>
                    </div>

                    {/* Department Transfer Route Visualization */}
                    {event.category === 'TRANSFER' && event.targetDeptEn && (
                      <div className="p-3 bg-purple-950/20 border border-purple-800/40 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
                          <span className="text-slate-400">{language === 'ar' ? 'إعادة التخصيص:' : 'Reassignment:'}</span>
                          <span className="font-bold text-purple-300">
                            {language === 'ar' ? (event.targetDeptAr || event.targetDeptEn) : event.targetDeptEn}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-purple-400/80">
                          {language === 'ar' ? 'سجل رسمي' : 'Authorized Transfer'}
                        </span>
                      </div>
                    )}

                    {/* Metadata Strip: Actor, Cost, Notes, and Attached Documents */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] text-slate-400 border-t border-slate-800/60">
                      
                      {/* Actor / Technician / Authorized Officer */}
                      {(event.actorEn || event.actorAr) && (
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>{language === 'ar' ? 'المسؤول / الفني: ' : 'Authorized by: '}</span>
                          <span className="font-semibold text-slate-200">
                            {language === 'ar' ? (event.actorAr || event.actorEn) : event.actorEn}
                          </span>
                        </div>
                      )}

                      {/* Linked Support Ticket Reference */}
                      {event.ticketNo && (
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>{language === 'ar' ? 'التذكرة المرتبطة:' : 'Linked Ticket:'}</span>
                          <button
                            type="button"
                            onClick={() => onSelectTicket && onSelectTicket(event.ticketNo!)}
                            className="font-mono text-blue-300 font-bold hover:underline cursor-pointer bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-800/60 flex items-center gap-1"
                          >
                            <span>{event.ticketNo}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}

                      {/* Official Attached Maintenance Request Document */}
                      {event.document && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onPreviewDocument && onPreviewDocument({
                              name: event.document?.fileName || 'Maintenance_Doc.pdf',
                              url: event.document?.fileUrl || event.document?.dataUrl,
                              raw: event.document
                            })}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition cursor-pointer"
                            title={language === 'ar' ? 'معاينة وثيقة طلب الصيانة المرفقة' : 'Preview attached request document'}
                          >
                            <FileText className="w-3.5 h-3.5 text-rose-400" />
                            <span className="truncate max-w-[140px] font-mono text-[11px]">{event.document.fileName || 'Doc.pdf'}</span>
                            <Eye className="w-3 h-3 text-rose-400 ml-0.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Technician Notes (if available) */}
                    {event.notes && (
                      <div className="text-[11px] text-slate-300 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed font-sans">
                        <span className="text-slate-500 font-semibold">{language === 'ar' ? 'ملاحظات فنية: ' : 'Technical Notes: '}</span>
                        {event.notes}
                      </div>
                    )}

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
