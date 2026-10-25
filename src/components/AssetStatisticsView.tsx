// src/components/AssetStatisticsView.tsx
import React, { useMemo } from 'react';
import {
  HardDrive,
  Laptop,
  Network,
  ShieldCheck,
  Wrench,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Monitor,
  Fingerprint,
  Scan,
  Server,
  Wifi,
  BarChart3,
  PieChart,
  Layers,
  Building2,
  Calendar,
  Download,
  ArrowRight,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { ElectronicDevice } from '../types';
import { OrgDepartmentItem } from '../context/OrgContext';

interface AssetStatisticsViewProps {
  devices: ElectronicDevice[];
  scopedDevices: ElectronicDevice[];
  statusCounts: {
    operational: number;
    underMaintenance: number;
    storage: number;
    retired: number;
  };
  metrics: {
    total: number;
    electronicCount: number;
    networkCount: number;
    warrantyActiveCount: number;
    maintenanceCount: number;
  };
  selectedStatus: string;
  onSelectStatusFilter: (status: string) => void;
  onSwitchToAssets: () => void;
  onSwitchToMaintenance: () => void;
  orgDepts: OrgDepartmentItem[];
  language: 'ar' | 'en';
  dir: 'rtl' | 'ltr';
  onExportCSV: () => void;
}

export function AssetStatisticsView({
  devices,
  scopedDevices,
  statusCounts,
  metrics,
  selectedStatus,
  onSelectStatusFilter,
  onSwitchToAssets,
  onSwitchToMaintenance,
  orgDepts,
  language,
  dir,
  onExportCSV
}: AssetStatisticsViewProps) {
  const total = metrics.total;

  // Breakdown by specific device type
  const typeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    scopedDevices.forEach(d => {
      const t = d.deviceType || 'Other';
      counts[t] = (counts[t] || 0) + 1;
    });

    const typesOrder = [
      { key: 'Computer', labelAr: 'حاسوب / مكتبي ومحمول', labelEn: 'Computer / PC / Laptop', icon: Laptop, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
      { key: 'Printer', labelAr: 'طابعة مستندات وباركود', labelEn: 'Printer / Barcode', icon: Printer, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
      { key: 'Screen', labelAr: 'شاشة عرض ومونيتور', labelEn: 'Screen / Monitor', icon: Monitor, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
      { key: 'Fingerprint device', labelAr: 'جهاز بصمة وحضور', labelEn: 'Fingerprint Device', icon: Fingerprint, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
      { key: 'Scanner', labelAr: 'ماسح ضوئي وباركود', labelEn: 'Scanner / Reader', icon: Scan, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
      { key: 'router', labelAr: 'راوتر شبكة', labelEn: 'Network Router', icon: Server, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
      { key: 'switch', labelAr: 'سويتش شبكة', labelEn: 'Network Switch', icon: Network, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
      { key: 'access point', labelAr: 'نقطة وصول لاسلكية', labelEn: 'Access Point', icon: Wifi, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
    ];

    return typesOrder.map(item => ({
      ...item,
      count: counts[item.key] || 0,
      pct: total > 0 ? Math.round(((counts[item.key] || 0) / total) * 100) : 0
    }));
  }, [scopedDevices, total]);

  // Breakdown by department
  const deptStats = useMemo(() => {
    const map = new Map<string, { count: number; nameAr: string; nameEn: string; electronic: number; network: number; operational: number }>();

    scopedDevices.forEach(d => {
      const deptKey = d.department || 'Other';
      const existing = map.get(deptKey) || {
        count: 0,
        nameAr: d.departmentAr || deptKey,
        nameEn: deptKey,
        electronic: 0,
        network: 0,
        operational: 0
      };
      existing.count += 1;
      if (d.category === 'electronic') existing.electronic += 1;
      if (d.category === 'network') existing.network += 1;
      if (d.status === 'Operational') existing.operational += 1;
      if (d.departmentAr && !existing.nameAr) existing.nameAr = d.departmentAr;
      map.set(deptKey, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count);
  }, [scopedDevices]);

  // Top Brands
  const topBrands = useMemo(() => {
    const map = new Map<string, number>();
    scopedDevices.forEach(d => {
      const brand = (d.brand || 'Other').trim();
      map.set(brand, (map.get(brand) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([brand, count]) => ({
        brand,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [scopedDevices, total]);

  const warrantyActivePct = total > 0 ? Math.round((metrics.warrantyActiveCount / total) * 100) : 0;
  const operationalPct = total > 0 ? Math.round((statusCounts.operational / total) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir={dir}>
      
      {/* 1. Header Banner & Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-700/80 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>{language === 'ar' ? 'لوحة إحصائيات وتحليلات الأصول' : 'Asset Statistics & Analytics Dashboard'}</span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {language === 'ar' ? 'مؤشرات فورية' : 'Live KPIs'}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              {language === 'ar'
                ? 'تحليلات مباشرة للحالة التشغيلية، توزيع الأجهزة حسب الأقسام وفئات العتاد، فترات الضمان، ومعدلات الصيانة'
                : 'Real-time overview of asset operational health, departmental distribution, warranty statuses, and maintenance events'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={onExportCSV}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-cyan-400 mx-0.5" />
            <span>{language === 'ar' ? 'تصدير الأصول (CSV)' : 'Export CSV'}</span>
          </button>

          <button
            type="button"
            onClick={onSwitchToAssets}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition cursor-pointer"
          >
            <HardDrive className="w-4 h-4 mx-0.5" />
            <span>{language === 'ar' ? 'عرض جدول الأصول ←' : 'View Assets List →'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Executive Metrics Cards (5 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              {language === 'ar' ? 'إجمالي الأصول' : 'Total Assets'}
            </span>
            <HardDrive className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-2">{total}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{language === 'ar' ? 'أصل مسجل بالنظام' : 'Registered Assets'}</span>
            <span className="text-cyan-400 font-bold">{operationalPct}% {language === 'ar' ? 'نشط' : 'Active'}</span>
          </div>
        </div>

        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              {language === 'ar' ? 'أجهزة إلكترونية' : 'Electronic Devices'}
            </span>
            <Laptop className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-cyan-400 mt-2">{metrics.electronicCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {total > 0 ? `${Math.round((metrics.electronicCount / total) * 100)}%` : '0%'} {language === 'ar' ? 'من الإجمالي' : 'of inventory'}
          </div>
        </div>

        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              {language === 'ar' ? 'أجهزة شبكية' : 'Network Devices'}
            </span>
            <Network className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-teal-400 mt-2">{metrics.networkCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {total > 0 ? `${Math.round((metrics.networkCount / total) * 100)}%` : '0%'} {language === 'ar' ? 'بنية شبكية' : 'infrastructure'}
          </div>
        </div>

        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              {language === 'ar' ? 'تحت الضمان الساري' : 'Active Warranty'}
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-2">{metrics.warrantyActiveCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {warrantyActivePct}% {language === 'ar' ? 'تغطية الضمان' : 'Coverage rate'}
          </div>
        </div>

        <div 
          onClick={onSwitchToMaintenance}
          className="bg-slate-800/80 hover:bg-slate-800 p-4 rounded-xl border border-slate-700/80 hover:border-amber-500/50 shadow-md cursor-pointer transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              {language === 'ar' ? 'سجلات الصيانة' : 'Maintenance Records'}
            </span>
            <Wrench className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-2">{metrics.maintenanceCount}</div>
          <div className="text-[11px] text-amber-400/80 mt-1 flex items-center justify-between font-semibold">
            <span>{language === 'ar' ? 'عمليات دورية وإصلاح' : 'Logged events'}</span>
            <span className="underline">{language === 'ar' ? 'عرض الجدول ←' : 'View Table →'}</span>
          </div>
        </div>
      </div>

      {/* 3. Operational Status Summary Cards (Interactive with Direct Filter) */}
      <div className="bg-slate-800/80 backdrop-blur-md p-5 rounded-2xl border border-slate-700/80 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700/70">
          <div className="flex items-center space-x-2">
            <span className="flex h-2.5 w-2.5 relative mx-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>{language === 'ar' ? 'تقييم الحالة التشغيلية المباشرة للأصول' : 'Operational Status Assessment'}</span>
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            {language === 'ar' ? 'انقر فوق أي حالة لتصفية جدول الأصول فورياً' : 'Click any card to filter assets directly'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* OPERATIONAL */}
          <div
            onClick={() => {
              onSelectStatusFilter('Operational');
              onSwitchToAssets();
            }}
            className="group relative p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/40 hover:border-emerald-400 transition cursor-pointer overflow-hidden shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{language === 'ar' ? 'يعمل بكفاءة (Operational)' : 'Operational'}</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {total > 0 ? `${Math.round((statusCounts.operational / total) * 100)}%` : '0%'}
              </span>
            </div>
            <div className="text-3xl font-black text-white mt-2 tracking-tight">
              {statusCounts.operational}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>{language === 'ar' ? 'أصول نشطة بالخدمة المباشرة' : 'Active in service'}</span>
              <span className="text-emerald-400 group-hover:underline font-semibold text-[10px]">
                {language === 'ar' ? 'تصفية الأصول ←' : 'Filter Assets →'}
              </span>
            </div>
          </div>

          {/* UNDER MAINTENANCE */}
          <div
            onClick={() => {
              onSelectStatusFilter('Under Maintenance');
              onSwitchToAssets();
            }}
            className="group relative p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 hover:bg-amber-950/40 hover:border-amber-400 transition cursor-pointer overflow-hidden shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{language === 'ar' ? 'تحت الصيانة (Under Maintenance)' : 'Under Maintenance'}</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {total > 0 ? `${Math.round((statusCounts.underMaintenance / total) * 100)}%` : '0%'}
              </span>
            </div>
            <div className="text-3xl font-black text-amber-300 mt-2 tracking-tight">
              {statusCounts.underMaintenance}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>{language === 'ar' ? 'أصول قيد الفحص والإصلاح' : 'In repair or inspection'}</span>
              <span className="text-amber-400 group-hover:underline font-semibold text-[10px]">
                {language === 'ar' ? 'تصفية الأصول ←' : 'Filter Assets →'}
              </span>
            </div>
          </div>

          {/* STORAGE */}
          <div
            onClick={() => {
              onSelectStatusFilter('Storage');
              onSwitchToAssets();
            }}
            className="group relative p-4 rounded-xl border border-blue-500/30 bg-blue-950/20 hover:bg-blue-950/40 hover:border-blue-400 transition cursor-pointer overflow-hidden shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{language === 'ar' ? 'في المخزن (Storage)' : 'Storage'}</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {total > 0 ? `${Math.round((statusCounts.storage / total) * 100)}%` : '0%'}
              </span>
            </div>
            <div className="text-3xl font-black text-blue-300 mt-2 tracking-tight">
              {statusCounts.storage}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>{language === 'ar' ? 'مخزون احتياطي جاهز للتسليم' : 'Reserve ready to deploy'}</span>
              <span className="text-blue-400 group-hover:underline font-semibold text-[10px]">
                {language === 'ar' ? 'تصفية الأصول ←' : 'Filter Assets →'}
              </span>
            </div>
          </div>

          {/* RETIRED */}
          <div
            onClick={() => {
              onSelectStatusFilter('Retired');
              onSwitchToAssets();
            }}
            className="group relative p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/40 hover:border-rose-400 transition cursor-pointer overflow-hidden shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{language === 'ar' ? 'خارج الخدمة (Retired)' : 'Retired'}</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {total > 0 ? `${Math.round((statusCounts.retired / total) * 100)}%` : '0%'}
              </span>
            </div>
            <div className="text-3xl font-black text-rose-300 mt-2 tracking-tight">
              {statusCounts.retired}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>{language === 'ar' ? 'أصول متقاعدة أو مستبعدة' : 'Decommissioned / EOL'}</span>
              <span className="text-rose-400 group-hover:underline font-semibold text-[10px]">
                {language === 'ar' ? 'تصفية الأصول ←' : 'Filter Assets →'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Two-Column Detailed Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT: Distribution by Device Type */}
        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/70">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">
                  {language === 'ar' ? 'توزيع الأصول حسب نوع الجهاز' : 'Distribution by Device Type'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar' ? 'إجمالي الأجهزة الإلكترونية وأجهزة الشبكات' : 'Electronic and network gear breakdown'}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-slate-300 bg-slate-900 px-2 py-1 rounded-md border border-slate-700">
              {typeStats.filter(t => t.count > 0).length} {language === 'ar' ? 'أنواع نشطة' : 'Active Types'}
            </span>
          </div>

          <div className="space-y-3">
            {typeStats.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md ${item.bg} ${item.border} border flex items-center justify-center shrink-0`}>
                        <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                      </div>
                      <span className="font-semibold text-slate-200">
                        {language === 'ar' ? item.labelAr : item.labelEn}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-white">{item.count}</span>
                      <span className="text-slate-400 text-[11px]">({item.pct}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700/60">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.key.includes('router') || item.key.includes('switch') || item.key.includes('access')
                          ? 'bg-gradient-to-r from-teal-500 to-cyan-500'
                          : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                      }`}
                      style={{ width: `${Math.max(item.pct, item.count > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Distribution by Department */}
        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/70">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">
                  {language === 'ar' ? 'توزيع الأصول حسب الأقسام والهيكل' : 'Asset Distribution by Department'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar' ? 'حجم العهد والأجهزة المخصصة لكل وحدة إدارية' : 'Hardware allocation per administrative unit'}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-slate-300 bg-slate-900 px-2 py-1 rounded-md border border-slate-700">
              {deptStats.length} {language === 'ar' ? 'أقسام' : 'Departments'}
            </span>
          </div>

          <div className="space-y-3">
            {deptStats.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                {language === 'ar' ? 'لا توجد أصول مسجلة حالياً' : 'No assets registered yet'}
              </p>
            ) : (
              deptStats.map(dept => {
                const pct = total > 0 ? Math.round((dept.count / total) * 100) : 0;
                return (
                  <div key={dept.nameEn} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="font-semibold text-slate-200 truncate" title={language === 'ar' ? dept.nameAr : dept.nameEn}>
                          {language === 'ar' ? dept.nameAr : dept.nameEn}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono shrink-0">
                        <span className="font-bold text-white">{dept.count}</span>
                        <span className="text-slate-400 text-[11px]">({pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700/60">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>{dept.operational} {language === 'ar' ? 'تشغيلي' : 'operational'}</span>
                      <span>{dept.electronic} {language === 'ar' ? 'إلكتروني' : 'electronic'} • {dept.network} {language === 'ar' ? 'شبكي' : 'network'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 5. Bottom Insights: Top Brands & Warranty Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Top Manufacturers & Brands */}
        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-700/70">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">
                {language === 'ar' ? 'أبرز العلامات التجارية والشركات المصنعة' : 'Top Manufacturers & Brands'}
              </h4>
              <p className="text-[11px] text-slate-400">
                {language === 'ar' ? 'العلامات الأكثر انتشاراً في جرد الأصول' : 'Most deployed brands in inventory'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topBrands.length === 0 ? (
              <p className="text-xs text-slate-400 col-span-2 text-center py-4">
                {language === 'ar' ? 'لا توجد بيانات علامات تجارية' : 'No brand data available'}
              </p>
            ) : (
              topBrands.map((b, idx) => (
                <div key={b.brand} className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/70 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="w-6 h-6 rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 flex items-center justify-center text-xs font-bold">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-white text-xs truncate" title={b.brand}>
                      {b.brand}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-cyan-300 text-sm">{b.count}</span>
                    <span className="text-[10px] text-slate-400 ml-1">({b.pct}%)</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Warranty Health & Coverage Overview */}
        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-700/70">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">
                {language === 'ar' ? 'صحة وتغطية عقود الضمان والدعم الفني' : 'Warranty Health & Coverage'}
              </h4>
              <p className="text-[11px] text-slate-400">
                {language === 'ar' ? 'متابعة الأصول المغطاة بالضمان وتواريخ الانتهاء' : 'Warranty validity and active protection rates'}
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/40">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">
                    {language === 'ar' ? 'نسبة الأصول تحت الضمان الساري' : 'Warranty Coverage Rate'}
                  </span>
                  <span className="text-lg font-black text-emerald-400">
                    {warrantyActivePct}% {language === 'ar' ? 'ساري المفعول' : 'Active'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-white">{metrics.warrantyActiveCount}</span>
                <span className="text-xs text-slate-400 block">/ {total} {language === 'ar' ? 'أصل' : 'total'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300">
                <span className="block text-[11px] text-emerald-400/80 mb-1">
                  {language === 'ar' ? 'أجهزة تحت الضمان' : 'Under Warranty'}
                </span>
                <span className="text-xl font-bold">{metrics.warrantyActiveCount}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/70 text-slate-300">
                <span className="block text-[11px] text-slate-400 mb-1">
                  {language === 'ar' ? 'الضمان منتهي / خارج الضمان' : 'Warranty Expired'}
                </span>
                <span className="text-xl font-bold">{total - metrics.warrantyActiveCount}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
