// Central maintenance records for registered devices: create, edit and follow up maintenance work
// (diagnosis, action taken, parts and costs, warranty, technician / service provider, next due date).
import React, { useMemo, useState } from 'react';
import {
  Wrench, FileText, Search, Plus, Download, Eye, Trash2, X, Edit3, AlertTriangle, CalendarClock,
  CheckCircle2, Clock, PackageSearch, Coins, ShieldCheck, Upload, Paperclip, RotateCcw,
} from 'lucide-react';
import { MaintenanceRecord, MaintenancePart, ElectronicDevice } from '../types';
import { useDevices } from '../context/DeviceContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { DeviceTypeIcon, assetTypeLabel } from './assetTypeUi';

interface MaintenanceTableViewProps {
  onSelectTicket?: (ticketId: string) => void;
  onSelectAsset?: (assetId: number | string) => void;
}

// Must match MAINTENANCE_TYPES / MAINTENANCE_STATUSES on the server (maintenanceController.ts).
const TYPES: Array<{ value: string; ar: string }> = [
  { value: 'Routine Maintenance', ar: 'صيانة دورية وقائية' },
  { value: 'Hardware Repair', ar: 'إصلاح عتاد' },
  { value: 'Component Replacement', ar: 'استبدال قطع' },
  { value: 'Upgrade', ar: 'ترقية' },
  { value: 'Inspection', ar: 'فحص ومعايرة' },
  { value: 'Emergency Service', ar: 'صيانة طارئة' },
  { value: 'Software Service', ar: 'خدمة برمجية / نظام تشغيل' },
];
const STATUSES: Array<{ value: string; ar: string; cls: string }> = [
  { value: 'Scheduled', ar: 'مجدولة', cls: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  { value: 'In Progress', ar: 'قيد التنفيذ', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  { value: 'Pending Parts', ar: 'بانتظار قطع الغيار', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { value: 'Completed', ar: 'مكتملة', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { value: 'Cancelled', ar: 'ملغاة', cls: 'bg-slate-700/60 text-slate-300 border-slate-600' },
];
const OPEN = ['In Progress', 'Pending Parts'];
const DUE_SOON_DAYS = 30;

type FormState = {
  id?: number;
  assetId: string;
  maintenanceType: string;
  status: string;
  maintenanceDate: string;
  maintenanceRequesterName: string;
  ticketNo: string;
  maintenanceDescription: string;
  diagnosis: string;
  actionTaken: string;
  performedBy: string;
  vendor: string;
  underWarranty: boolean;
  parts: Array<{ name: string; quantity: string; unitCost: string }>;
  laborCost: string;
  nextMaintenanceDate: string;
  notes: string;
  documentName: string;
  documentData: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (dateStr: string) => Math.round((new Date(dateStr + 'T00:00:00').getTime() - new Date(today() + 'T00:00:00').getTime()) / 86400000);

export const MaintenanceTableView: React.FC<MaintenanceTableViewProps> = ({ onSelectAsset }) => {
  const {
    maintenanceRecords, devices, assetTypes,
    createMaintenanceTableRecord, updateMaintenanceTableRecord, deleteMaintenanceTableRecord,
  } = useDevices();
  const { language, dir } = useLanguage();
  const ar = language === 'ar';
  const { currentUser, isAdmin, isTechnicalUser, hasPermission } = useAuth();
  // Same rules as the server: managing needs an admin, a technical user or an asset permission.
  const canManage = Boolean(isAdmin || isTechnicalUser || hasPermission('Asset Management.Edit') || hasPermission('Asset Management.Create')
    || hasPermission('devices.manage') || hasPermission('assets.manage'));
  const canDelete = Boolean(isAdmin || hasPermission('Asset Management.Delete') || hasPermission('devices.manage') || hasPermission('assets.manage'));

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [detail, setDetail] = useState<MaintenanceRecord | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<MaintenanceRecord | null>(null);
  const [notice, setNotice] = useState('');

  const typeLabel = (v: string) => (ar ? TYPES.find(t => t.value === v)?.ar || v : v);
  const statusInfo = (v?: string) => STATUSES.find(s => s.value === (v || 'Completed')) || STATUSES[3];
  const money = (val: number | string | undefined) => {
    const n = Number(val) || 0;
    const f = n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return ar ? `${f} د.ع` : `${f} IQD`;
  };
  const deviceById = useMemo(() => new Map(devices.map(d => [String(d.id), d])), [devices]);

  // ---- Follow-up: the latest next-maintenance date per device that is overdue or due soon
  const followUps = useMemo(() => {
    const latestByDevice = new Map<string, MaintenanceRecord>();
    for (const r of maintenanceRecords) {
      if (r.status === 'Cancelled') continue;
      const key = String(r.assetId);
      const prev = latestByDevice.get(key);
      // Latest by day; records on the same day: the one entered last (higher id) wins.
      const day = (r.maintenanceDate || '').slice(0, 10);
      const prevDay = (prev?.maintenanceDate || '').slice(0, 10);
      if (!prev || day > prevDay || (day === prevDay && r.id > prev.id)) latestByDevice.set(key, r);
    }
    return [...latestByDevice.values()]
      .filter(r => r.nextMaintenanceDate && daysUntil(r.nextMaintenanceDate) <= DUE_SOON_DAYS)
      .map(r => ({ record: r, days: daysUntil(r.nextMaintenanceDate!) }))
      .sort((a, b) => a.days - b.days);
  }, [maintenanceRecords]);

  // ---- KPIs
  const kpis = useMemo(() => {
    const year = String(new Date().getFullYear());
    return {
      open: maintenanceRecords.filter(r => OPEN.includes(r.status || '')).length,
      scheduled: maintenanceRecords.filter(r => r.status === 'Scheduled').length,
      overdue: followUps.filter(f => f.days < 0).length,
      costYear: maintenanceRecords.filter(r => (r.maintenanceDate || '').startsWith(year) && r.status !== 'Cancelled')
        .reduce((s, r) => s + (Number(r.costOfMaintenance) || 0), 0),
      total: maintenanceRecords.length,
    };
  }, [maintenanceRecords, followUps]);

  // ---- Filtering
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return maintenanceRecords.filter(r => {
      if (typeFilter !== 'ALL' && r.maintenanceType !== typeFilter) return false;
      if (statusFilter !== 'ALL' && (r.status || 'Completed') !== statusFilter) return false;
      if (deviceTypeFilter !== 'ALL' && String(r.deviceType || '').toLowerCase() !== deviceTypeFilter.toLowerCase()) return false;
      const day = (r.maintenanceDate || '').slice(0, 10);
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      if (!q) return true;
      return [String(r.id), r.assetCode, r.assetName, r.maintenanceType, r.maintenanceRequesterName, r.maintenanceDescription,
        r.diagnosis, r.actionTaken, r.vendor, r.performedBy, r.ticketNo, r.serialNumber, r.department]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [maintenanceRecords, search, typeFilter, statusFilter, deviceTypeFilter, fromDate, toDate]);
  const filtersActive = typeFilter !== 'ALL' || statusFilter !== 'ALL' || deviceTypeFilter !== 'ALL' || !!fromDate || !!toDate || !!search;
  const clearFilters = () => { setSearch(''); setTypeFilter('ALL'); setStatusFilter('ALL'); setDeviceTypeFilter('ALL'); setFromDate(''); setToDate(''); };
  const filteredCost = filtered.reduce((s, r) => s + (Number(r.costOfMaintenance) || 0), 0);

  // ---- Form helpers
  const newForm = (preset?: Partial<FormState>): FormState => {
    const assetId = preset?.assetId || (devices[0] ? String(devices[0].id) : '');
    const dev = deviceById.get(assetId);
    return {
      assetId,
      maintenanceType: 'Hardware Repair',
      status: 'In Progress',
      maintenanceDate: today(),
      maintenanceRequesterName: currentUser?.fullName || '',
      ticketNo: '',
      maintenanceDescription: '',
      diagnosis: '',
      actionTaken: '',
      performedBy: currentUser?.fullName || '',
      vendor: '',
      underWarranty: Boolean(dev?.isWarrantyActive),
      parts: [],
      laborCost: '0',
      nextMaintenanceDate: '',
      notes: '',
      documentName: '',
      documentData: null,
      ...preset,
    };
  };
  const openCreate = (preset?: Partial<FormState>) => { setFormError(''); setForm(newForm(preset)); };
  const openEdit = (r: MaintenanceRecord) => {
    setFormError('');
    setDetail(null);
    const hasBreakdown = (r.partsUsed && r.partsUsed.length > 0) || Number(r.laborCost) > 0;
    setForm({
      id: r.id,
      assetId: String(r.assetId),
      maintenanceType: r.maintenanceType,
      status: r.status || 'Completed',
      maintenanceDate: (r.maintenanceDate || today()).slice(0, 10),
      maintenanceRequesterName: r.maintenanceRequesterName || '',
      ticketNo: r.ticketNo || '',
      maintenanceDescription: r.maintenanceDescription || '',
      diagnosis: r.diagnosis || '',
      actionTaken: r.actionTaken || '',
      performedBy: r.performedBy || '',
      vendor: r.vendor || '',
      underWarranty: Boolean(r.underWarranty),
      parts: (r.partsUsed || []).map(p => ({ name: p.name, quantity: String(p.quantity), unitCost: String(p.unitCost) })),
      // Older records only have a total: show it as labor so saving keeps the same total.
      laborCost: String(hasBreakdown ? (r.laborCost || 0) : (Number(r.costOfMaintenance) || 0)),
      nextMaintenanceDate: r.nextMaintenanceDate || '',
      notes: r.notes || '',
      documentName: '',
      documentData: null,
    });
  };

  const partsTotal = (f: FormState) => f.parts.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.unitCost) || 0), 0);
  const formTotal = (f: FormState) => partsTotal(f) + (Number(f.laborCost) || 0);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    if (file.size > 10 * 1024 * 1024) {
      setFormError(ar ? 'حجم الملف أكبر من 10 ميغابايت' : 'The file is larger than 10 MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setForm(prev => prev ? { ...prev, documentName: file.name, documentData: reader.result as string } : prev);
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.assetId) return setFormError(ar ? 'اختر الجهاز' : 'Choose the device');
    if (!form.maintenanceDescription.trim()) return setFormError(ar ? 'وصف المشكلة أو العمل مطلوب' : 'Describe the problem or the work');
    const badPart = form.parts.findIndex(p => !p.name.trim() || !(Number(p.quantity) >= 1) || !Number.isInteger(Number(p.quantity)) || Number(p.unitCost) < 0 || p.unitCost === '');
    if (badPart >= 0) return setFormError(ar ? `قطعة الغيار رقم ${badPart + 1}: أدخل الاسم والكمية (عدد صحيح) وسعر الوحدة` : `Part ${badPart + 1}: enter a name, a whole quantity and a unit cost`);
    if (!(Number(form.laborCost) >= 0)) return setFormError(ar ? 'أجور العمل يجب أن تكون رقماً موجباً' : 'Labor cost must be 0 or more');
    if (form.nextMaintenanceDate && form.nextMaintenanceDate < form.maintenanceDate) {
      return setFormError(ar ? 'موعد الصيانة القادمة يجب أن يكون بعد تاريخ هذه الصيانة' : 'The next maintenance date must be after this maintenance');
    }

    const parts: MaintenancePart[] = form.parts.map(p => ({ name: p.name.trim(), quantity: Number(p.quantity), unitCost: Number(p.unitCost) }));
    const payload: any = {
      maintenanceType: form.maintenanceType,
      status: form.status,
      maintenanceDate: new Date(form.maintenanceDate + 'T12:00:00').toISOString(),
      maintenanceRequesterName: form.maintenanceRequesterName.trim(),
      ticketNo: form.ticketNo.trim(),
      maintenanceDescription: form.maintenanceDescription.trim(),
      diagnosis: form.diagnosis.trim(),
      actionTaken: form.actionTaken.trim(),
      performedBy: form.performedBy.trim(),
      vendor: form.vendor.trim(),
      underWarranty: form.underWarranty,
      partsUsed: parts,
      laborCost: Number(form.laborCost) || 0,
      nextMaintenanceDate: form.nextMaintenanceDate,
      notes: form.notes.trim(),
    };
    if (form.documentData) {
      payload.maintenanceRequestDocument = {
        requestNumber: form.ticketNo.trim() || `REQ-${Date.now().toString().slice(-5)}`,
        requestDate: form.maintenanceDate,
        fileName: form.documentName,
        fileType: form.documentData.slice(5, form.documentData.indexOf(';')) || 'application/octet-stream',
        source: 'PC Upload',
        scannedAt: new Date().toISOString(),
        dataUrl: form.documentData,
      };
    }

    setSaving(true);
    const res = form.id
      ? await updateMaintenanceTableRecord(form.id, payload)
      : await createMaintenanceTableRecord({ ...payload, assetId: Number(form.assetId) });
    setSaving(false);
    if (!res.success) return setFormError(res.error || (ar ? 'تعذر حفظ السجل' : 'Could not save the record'));
    setForm(null);
    setNotice(form.id ? (ar ? 'تم حفظ التعديلات' : 'Changes saved') : (ar ? 'تمت إضافة سجل الصيانة' : 'Maintenance record added'));
    setTimeout(() => setNotice(''), 3000);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await deleteMaintenanceTableRecord(toDelete.id);
    setToDelete(null);
    setDetail(null);
    setNotice(res.success ? (ar ? 'تم حذف السجل' : 'Record deleted') : (res.error || ''));
    setTimeout(() => setNotice(''), 3000);
  };

  // Documents are served only to signed-in users, so fetch with the token and open a local copy.
  const openDocument = async (raw: any) => {
    let doc: any = raw;
    if (typeof raw === 'string') { try { doc = JSON.parse(raw); } catch { doc = { fileName: raw }; } }
    const url = doc?.fileUrl || (doc?.fileName ? `/api/ticket-requests/${encodeURIComponent(doc.fileName)}` : '');
    if (!url) return;
    if (url.startsWith('data:')) { window.open(url, '_blank'); return; }
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(String(res.status));
      const blobUrl = URL.createObjectURL(await res.blob());
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      setNotice(ar ? 'تعذر فتح الوثيقة' : 'Could not open the document');
      setTimeout(() => setNotice(''), 3000);
    }
  };

  const exportCsv = () => {
    const header = ['ID', 'Date', 'Asset code', 'Asset', 'Device type', 'Department', 'Type', 'Status', 'Problem', 'Diagnosis',
      'Action taken', 'Technician', 'Vendor', 'Under warranty', 'Parts', 'Parts cost', 'Labor cost', 'Total cost', 'Completed', 'Next due', 'Ticket'];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = filtered.map(r => [
      r.id, (r.maintenanceDate || '').slice(0, 10), r.assetCode, r.assetName, r.deviceType, r.department, r.maintenanceType, r.status,
      r.maintenanceDescription, r.diagnosis, r.actionTaken, r.performedBy, r.vendor, r.underWarranty ? 'Yes' : 'No',
      (r.partsUsed || []).map(p => `${p.name} x${p.quantity}`).join('; '), r.partsCost, r.laborCost, r.costOfMaintenance,
      (r.completedAt || '').slice(0, 10), r.nextMaintenanceDate, r.ticketNo,
    ].map(esc).join(','));
    const blob = new Blob(['﻿' + [header.map(esc).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `maintenance-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const field = 'w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 transition';
  const label = 'block text-[11px] font-semibold text-slate-300 mb-1';
  const selectedDevice: ElectronicDevice | undefined = form ? deviceById.get(form.assetId) : undefined;

  return (
    <div className="space-y-5" dir={dir} data-role="maintenance-view">
      {/* Header + KPIs */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700/80 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center"><Wrench className="w-5 h-5" /></div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white">{ar ? 'سجلات الصيانة' : 'Maintenance records'}</h2>
              <p className="text-xs text-slate-400">{ar ? 'متابعة أعمال الصيانة: التشخيص، الإجراء، قطع الغيار والتكاليف، والصيانة القادمة.' : 'Track maintenance work: diagnosis, action, parts and costs, and the next due date.'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700">
              <Download className="w-4 h-4" />CSV
            </button>
            {canManage && (
              <button onClick={() => openCreate()} disabled={devices.length === 0} data-role="add-maintenance"
                title={devices.length === 0 ? (ar ? 'سجّل جهازاً أولاً' : 'Register a device first') : ''}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-40 shadow-lg shadow-amber-600/20">
                <Plus className="w-4 h-4" />{ar ? 'سجل صيانة جديد' : 'New maintenance record'}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          {[
            { k: 'open', label: ar ? 'أعمال مفتوحة' : 'Open work', value: kpis.open, icon: Clock, cls: 'text-sky-300', onClick: () => setStatusFilter('In Progress') },
            { k: 'scheduled', label: ar ? 'مجدولة' : 'Scheduled', value: kpis.scheduled, icon: CalendarClock, cls: 'text-violet-300', onClick: () => setStatusFilter('Scheduled') },
            { k: 'overdue', label: ar ? 'صيانة دورية متأخرة' : 'Overdue preventive', value: kpis.overdue, icon: AlertTriangle, cls: kpis.overdue ? 'text-red-300' : 'text-slate-300' },
            { k: 'cost', label: ar ? `تكاليف ${new Date().getFullYear()}` : `${new Date().getFullYear()} cost`, value: money(kpis.costYear), icon: Coins, cls: 'text-emerald-300' },
            { k: 'total', label: ar ? 'إجمالي السجلات' : 'All records', value: kpis.total, icon: CheckCircle2, cls: 'text-slate-200', onClick: clearFilters },
          ].map(c => (
            <button key={c.k} type="button" onClick={c.onClick} disabled={!c.onClick} data-kpi={c.k}
              className="text-start bg-slate-800/70 border border-slate-700/70 rounded-xl p-3 hover:border-slate-500 disabled:hover:border-slate-700/70 transition">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400"><c.icon className="w-3.5 h-3.5" />{c.label}</div>
              <div className={`text-lg font-black mt-1 ${c.cls}`}>{c.value}</div>
            </button>
          ))}
        </div>
      </div>

      {notice && <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm" role="status">{notice}</div>}

      {/* Follow-up: overdue / due soon */}
      {followUps.length > 0 && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4" data-role="follow-ups">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-300 mb-3">
            <CalendarClock className="w-4 h-4" />
            {ar ? `صيانة قادمة أو متأخرة (خلال ${DUE_SOON_DAYS} يوماً)` : `Upcoming or overdue maintenance (next ${DUE_SOON_DAYS} days)`}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {followUps.map(({ record: r, days }) => (
              <div key={r.id} className="flex items-center justify-between gap-2 bg-slate-800/70 border border-slate-700 rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate"><span className="font-mono text-cyan-300">{r.assetCode}</span> {r.assetName}</div>
                  <div className={`text-[11px] ${days < 0 ? 'text-red-300' : days === 0 ? 'text-amber-300' : 'text-slate-400'}`}>
                    {r.nextMaintenanceDate} — {days < 0 ? (ar ? `متأخرة ${-days} يوم` : `${-days} days overdue`) : days === 0 ? (ar ? 'اليوم' : 'today') : (ar ? `بعد ${days} يوم` : `in ${days} days`)}
                  </div>
                </div>
                {canManage && (
                  <button onClick={() => openCreate({ assetId: String(r.assetId), maintenanceType: 'Routine Maintenance', status: 'Scheduled', maintenanceDate: days < 0 ? today() : r.nextMaintenanceDate!, maintenanceDescription: ar ? 'صيانة دورية وقائية' : 'Preventive maintenance' })}
                    className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-600/20 text-amber-200 border border-amber-500/40 hover:bg-amber-600/30">
                    {ar ? 'جدولة' : 'Schedule'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/70 space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} data-role="maintenance-search"
            placeholder={ar ? 'بحث: رمز الأصل، الجهاز، الرقم التسلسلي، المشكلة، التشخيص، الفني، الجهة المنفذة، رقم التذكرة...' : 'Search: asset code, device, serial, problem, diagnosis, technician, vendor, ticket...'}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl ps-9 pe-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5" data-role="status-filter">
            <option value="ALL">{ar ? 'كل الحالات' : 'All statuses'}</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{ar ? s.ar : s.value}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5">
            <option value="ALL">{ar ? 'كل أنواع الصيانة' : 'All maintenance types'}</option>
            {TYPES.map(t => <option key={t.value} value={t.value}>{ar ? t.ar : t.value}</option>)}
          </select>
          <select value={deviceTypeFilter} onChange={e => setDeviceTypeFilter(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5">
            <option value="ALL">{ar ? 'كل أنواع الأجهزة' : 'All device types'}</option>
            {assetTypes.map(t => <option key={t.key} value={t.key}>{ar ? t.nameAr : t.nameEn}</option>)}
          </select>
          <label className="flex items-center gap-1 text-slate-400">{ar ? 'من' : 'From'}
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1" />
          </label>
          <label className="flex items-center gap-1 text-slate-400">{ar ? 'إلى' : 'To'}
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1" />
          </label>
          {filtersActive && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-900 border border-slate-700">
              <RotateCcw className="w-3.5 h-3.5" />{ar ? 'مسح الفلاتر' : 'Clear filters'}
            </button>
          )}
          <span className="ms-auto text-slate-400">
            {ar ? `${filtered.length} سجل • ${money(filteredCost)}` : `${filtered.length} records • ${money(filteredCost)}`}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800/90 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start" data-role="maintenance-table">
            <thead>
              <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-700 text-[11px]">
                <th className="py-3 px-3 text-start">{ar ? 'التاريخ' : 'Date'}</th>
                <th className="py-3 px-3 text-start">{ar ? 'الجهاز' : 'Device'}</th>
                <th className="py-3 px-3 text-start">{ar ? 'النوع والحالة' : 'Type & status'}</th>
                <th className="py-3 px-3 text-start">{ar ? 'المشكلة / الإجراء' : 'Problem / action'}</th>
                <th className="py-3 px-3 text-start">{ar ? 'المنفذ' : 'Done by'}</th>
                <th className="py-3 px-3 text-end">{ar ? 'الكلفة' : 'Cost'}</th>
                <th className="py-3 px-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">
                  <PackageSearch className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  {maintenanceRecords.length === 0 ? (ar ? 'لا توجد سجلات صيانة بعد.' : 'No maintenance records yet.') : (ar ? 'لا توجد سجلات مطابقة للفلاتر.' : 'No records match the filters.')}
                </td></tr>
              )}
              {filtered.map(r => {
                const st = statusInfo(r.status);
                return (
                  <tr key={r.id} className="hover:bg-slate-700/30 cursor-pointer" onClick={() => setDetail(r)} data-role="maintenance-row" data-id={r.id}>
                    <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">{(r.maintenanceDate || '').slice(0, 10)}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <DeviceTypeIcon types={assetTypes} deviceType={r.deviceType} className="w-4 h-4 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-cyan-300">{r.assetCode}</div>
                          <div className="text-slate-300 truncate max-w-[180px]">{r.assetName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-200 font-semibold">{typeLabel(r.maintenanceType)}</div>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${st.cls}`}>{ar ? st.ar : st.value}</span>
                      {r.underWarranty && <span className="inline-flex items-center gap-0.5 ms-1 text-[10px] text-emerald-300"><ShieldCheck className="w-3 h-3" />{ar ? 'ضمان' : 'Warranty'}</span>}
                    </td>
                    <td className="py-2.5 px-3 max-w-xs">
                      <div className="text-slate-200 line-clamp-1">{r.maintenanceDescription}</div>
                      {(r.actionTaken || r.diagnosis) && <div className="text-slate-400 line-clamp-1 mt-0.5">{r.actionTaken || r.diagnosis}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      <div>{r.performedBy}</div>
                      {r.vendor && <div className="text-[11px] text-slate-500">{r.vendor}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-end font-mono font-bold text-emerald-300 whitespace-nowrap">{money(r.costOfMaintenance)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-end" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setDetail(r)} title={ar ? 'عرض' : 'View'} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"><Eye className="w-3.5 h-3.5" /></button>
                      {canManage && <button onClick={() => openEdit(r)} title={ar ? 'تعديل' : 'Edit'} data-role="edit-maintenance" className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-700"><Edit3 className="w-3.5 h-3.5" /></button>}
                      {canDelete && <button onClick={() => setToDelete(r)} title={ar ? 'حذف' : 'Delete'} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail */}
      {detail && (() => {
        const st = statusInfo(detail.status);
        const parts = detail.partsUsed || [];
        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setDetail(null)}>
            <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-role="maintenance-detail">
              <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-slate-500">#{detail.id}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${st.cls}`}>{ar ? st.ar : st.value}</span>
                    {detail.underWarranty && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">{ar ? 'ضمن الضمان' : 'Under warranty'}</span>}
                  </div>
                  <h3 className="font-bold text-white text-base mt-1">{typeLabel(detail.maintenanceType)}</h3>
                  <button className="text-xs text-cyan-300 hover:underline mt-0.5" onClick={() => onSelectAsset?.(detail.assetId)}>
                    <span className="font-mono">{detail.assetCode}</span> — {detail.assetName} ({assetTypeLabel(assetTypes, detail.deviceType, language)})
                  </button>
                </div>
                <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    [ar ? 'التاريخ' : 'Date', (detail.maintenanceDate || '').slice(0, 10)],
                    [ar ? 'تاريخ الإنجاز' : 'Completed', (detail.completedAt || '').slice(0, 10) || '—'],
                    [ar ? 'الصيانة القادمة' : 'Next due', detail.nextMaintenanceDate || '—'],
                    [ar ? 'مقدم الطلب' : 'Requested by', detail.maintenanceRequesterName || '—'],
                    [ar ? 'الفني' : 'Technician', detail.performedBy || '—'],
                    [ar ? 'الجهة المنفذة' : 'Service provider', detail.vendor || '—'],
                    [ar ? 'القسم' : 'Department', detail.department || '—'],
                    [ar ? 'الرقم التسلسلي' : 'Serial', detail.serialNumber || '—'],
                    [ar ? 'رقم التذكرة' : 'Ticket', detail.ticketNo || '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-slate-800/70 rounded-xl p-2.5">
                      <div className="text-slate-500 text-[10px]">{k}</div>
                      <div className="text-slate-100 font-semibold mt-0.5 break-words">{v}</div>
                    </div>
                  ))}
                </div>
                {[
                  [ar ? 'المشكلة / الطلب' : 'Problem / request', detail.maintenanceDescription],
                  [ar ? 'التشخيص' : 'Diagnosis', detail.diagnosis],
                  [ar ? 'الإجراء المتخذ' : 'Action taken', detail.actionTaken],
                  [ar ? 'ملاحظات' : 'Notes', detail.notes],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="bg-slate-800/70 rounded-xl p-3">
                    <div className="text-slate-400 font-semibold mb-1">{k}</div>
                    <p className="text-slate-100 text-sm whitespace-pre-wrap leading-relaxed">{v}</p>
                  </div>
                ))}
                <div className="bg-slate-800/70 rounded-xl p-3">
                  <div className="text-slate-400 font-semibold mb-2">{ar ? 'قطع الغيار والتكاليف' : 'Parts and costs'}</div>
                  {parts.length > 0 && (
                    <table className="w-full mb-2">
                      <tbody className="divide-y divide-slate-700/60">
                        {parts.map((p, i) => (
                          <tr key={i}>
                            <td className="py-1 text-slate-200">{p.name}</td>
                            <td className="py-1 text-slate-400 font-mono">× {p.quantity}</td>
                            <td className="py-1 text-end font-mono text-slate-300">{money(p.quantity * p.unitCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 font-mono">
                    {parts.length > 0 && <span className="text-slate-400">{ar ? 'القطع: ' : 'Parts: '}{money(detail.partsCost)}</span>}
                    {Number(detail.laborCost) > 0 && <span className="text-slate-400">{ar ? 'الأجور: ' : 'Labor: '}{money(detail.laborCost)}</span>}
                    <span className="text-emerald-300 font-bold">{ar ? 'الإجمالي: ' : 'Total: '}{money(detail.costOfMaintenance)}</span>
                  </div>
                </div>
                {detail.maintenanceRequestDocument && (
                  <button onClick={() => openDocument(detail.maintenanceRequestDocument)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:border-slate-500">
                    <FileText className="w-4 h-4 text-rose-400" />{ar ? 'فتح وثيقة الطلب' : 'Open request document'}
                  </button>
                )}
              </div>
              {(canManage || canDelete) && (
                <div className="flex justify-end gap-2 p-4 border-t border-slate-800">
                  {canDelete && <button onClick={() => setToDelete(detail)} className="px-4 py-2 rounded-xl text-sm text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30">{ar ? 'حذف' : 'Delete'}</button>}
                  {canManage && <button onClick={() => openEdit(detail)} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 flex items-center gap-1.5"><Edit3 className="w-4 h-4" />{ar ? 'تعديل' : 'Edit'}</button>}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Create / edit form */}
      {form && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={submit} className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-3xl w-full max-h-[94vh] overflow-y-auto" data-role="maintenance-form">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <h3 className="font-bold text-white">{form.id ? (ar ? `تعديل سجل الصيانة #${form.id}` : `Edit maintenance record #${form.id}`) : (ar ? 'سجل صيانة جديد' : 'New maintenance record')}</h3>
              <button type="button" onClick={() => setForm(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-5">
              {/* 1. Device and request */}
              <section className="space-y-3">
                <h4 className="text-xs font-bold text-amber-300">{ar ? '١. الجهاز والطلب' : '1. Device and request'}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className={label}>{ar ? 'الجهاز *' : 'Device *'}</label>
                    <select value={form.assetId} disabled={!!form.id} data-field="assetId"
                      onChange={e => { const d = deviceById.get(e.target.value); setForm({ ...form, assetId: e.target.value, underWarranty: Boolean(d?.isWarrantyActive) }); }}
                      className={`${field} disabled:opacity-60`}>
                      {devices.map(d => (
                        <option key={d.id} value={String(d.id)}>{d.deviceCode} — {d.brand} {d.model} ({assetTypeLabel(assetTypes, d.deviceType, language)}{d.department ? `، ${d.department}` : ''})</option>
                      ))}
                    </select>
                    {selectedDevice && (
                      <p className="text-[11px] mt-1 text-slate-400">
                        {ar ? 'الحالة الحالية: ' : 'Current status: '}<span className="text-slate-200">{selectedDevice.status}</span>
                        {' • '}
                        {selectedDevice.isWarrantyActive
                          ? <span className="text-emerald-300">{ar ? `ضمن الضمان حتى ${selectedDevice.warrantyExpiryDate}` : `Under warranty until ${selectedDevice.warrantyExpiryDate}`}</span>
                          : <span>{ar ? 'خارج الضمان' : 'Out of warranty'}</span>}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={label}>{ar ? 'نوع الصيانة *' : 'Maintenance type *'}</label>
                    <select value={form.maintenanceType} onChange={e => setForm({ ...form, maintenanceType: e.target.value })} className={field} data-field="maintenanceType">
                      {TYPES.map(t => <option key={t.value} value={t.value}>{ar ? t.ar : t.value}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={label}>{ar ? 'الحالة *' : 'Status *'}</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={field} data-field="status">
                      {STATUSES.map(s => <option key={s.value} value={s.value}>{ar ? s.ar : s.value}</option>)}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">{ar ? '«قيد التنفيذ» و«بانتظار القطع» تجعل الجهاز «تحت الصيانة» تلقائياً.' : '"In Progress" and "Pending Parts" mark the device "Under Maintenance".'}</p>
                  </div>
                  <div>
                    <label className={label}>{ar ? 'تاريخ الصيانة *' : 'Maintenance date *'}</label>
                    <input type="date" value={form.maintenanceDate} onChange={e => setForm({ ...form, maintenanceDate: e.target.value })} className={field} required data-field="maintenanceDate" />
                  </div>
                  <div>
                    <label className={label}>{ar ? 'مقدم الطلب' : 'Requested by'}</label>
                    <input value={form.maintenanceRequesterName} onChange={e => setForm({ ...form, maintenanceRequesterName: e.target.value })} maxLength={120} className={field} />
                  </div>
                  <div>
                    <label className={label}>{ar ? 'رقم التذكرة (إن وجد)' : 'Ticket number (optional)'}</label>
                    <input value={form.ticketNo} onChange={e => setForm({ ...form, ticketNo: e.target.value })} maxLength={40} dir="ltr" className={field} placeholder="TCK-2026-0001" />
                  </div>
                </div>
                <div>
                  <label className={label}>{ar ? 'وصف المشكلة أو العمل المطلوب *' : 'Problem or requested work *'}</label>
                  <textarea value={form.maintenanceDescription} onChange={e => setForm({ ...form, maintenanceDescription: e.target.value })} rows={2} maxLength={2000} className={`${field} resize-none`} data-field="maintenanceDescription" />
                </div>
              </section>

              {/* 2. Work done */}
              <section className="space-y-3">
                <h4 className="text-xs font-bold text-amber-300">{ar ? '٢. العمل المنجز' : '2. Work done'}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={label}>{ar ? 'التشخيص' : 'Diagnosis'}</label>
                    <textarea value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} rows={2} maxLength={2000} className={`${field} resize-none`} data-field="diagnosis" />
                  </div>
                  <div>
                    <label className={label}>{ar ? 'الإجراء المتخذ' : 'Action taken'}</label>
                    <textarea value={form.actionTaken} onChange={e => setForm({ ...form, actionTaken: e.target.value })} rows={2} maxLength={2000} className={`${field} resize-none`} data-field="actionTaken" />
                  </div>
                  <div>
                    <label className={label}>{ar ? 'الفني المنفذ' : 'Technician'}</label>
                    <input value={form.performedBy} onChange={e => setForm({ ...form, performedBy: e.target.value })} maxLength={120} className={field} />
                  </div>
                  <div>
                    <label className={label}>{ar ? 'جهة خارجية / وكيل الصيانة (إن وجد)' : 'External service provider (optional)'}</label>
                    <input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} maxLength={150} className={field} data-field="vendor" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={form.underWarranty} onChange={e => setForm({ ...form, underWarranty: e.target.checked })} className="accent-emerald-500" data-field="underWarranty" />
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />{ar ? 'الصيانة مشمولة بالضمان' : 'Covered by warranty'}
                </label>
              </section>

              {/* 3. Parts and costs */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-300">{ar ? '٣. قطع الغيار والتكاليف (د.ع)' : '3. Parts and costs (IQD)'}</h4>
                  <button type="button" data-role="add-part" onClick={() => setForm({ ...form, parts: [...form.parts, { name: '', quantity: '1', unitCost: '0' }] })}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-amber-200 bg-amber-600/20 border border-amber-500/40 hover:bg-amber-600/30">
                    <Plus className="w-3.5 h-3.5" />{ar ? 'إضافة قطعة' : 'Add part'}
                  </button>
                </div>
                {form.parts.length > 0 && (
                  <div className="space-y-2">
                    {form.parts.map((p, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center" data-role="part-row">
                        <input value={p.name} onChange={e => { const parts = [...form.parts]; parts[i] = { ...p, name: e.target.value }; setForm({ ...form, parts }); }}
                          placeholder={ar ? 'اسم القطعة' : 'Part name'} maxLength={100} className={`${field} col-span-5`} data-field="partName" />
                        <input type="number" min={1} step={1} value={p.quantity} onChange={e => { const parts = [...form.parts]; parts[i] = { ...p, quantity: e.target.value }; setForm({ ...form, parts }); }}
                          className={`${field} col-span-2`} title={ar ? 'الكمية' : 'Quantity'} data-field="partQty" />
                        <input type="number" min={0} step="any" value={p.unitCost} onChange={e => { const parts = [...form.parts]; parts[i] = { ...p, unitCost: e.target.value }; setForm({ ...form, parts }); }}
                          className={`${field} col-span-3`} title={ar ? 'سعر الوحدة' : 'Unit cost'} data-field="partCost" />
                        <span className="col-span-1 text-[11px] font-mono text-slate-400 text-end">{((Number(p.quantity) || 0) * (Number(p.unitCost) || 0)).toLocaleString('en-US')}</span>
                        <button type="button" onClick={() => setForm({ ...form, parts: form.parts.filter((_, j) => j !== i) })} className="col-span-1 p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 justify-self-end"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className={label}>{ar ? 'أجور العمل' : 'Labor cost'}</label>
                    <input type="number" min={0} step="any" value={form.laborCost} onChange={e => setForm({ ...form, laborCost: e.target.value })} className={field} data-field="laborCost" />
                  </div>
                  <div className="text-xs text-slate-400">{ar ? 'قطع الغيار: ' : 'Parts: '}<span className="font-mono text-slate-200">{money(partsTotal(form))}</span></div>
                  <div className="text-sm text-end">{ar ? 'الإجمالي: ' : 'Total: '}<span className="font-mono font-bold text-emerald-300" data-role="form-total">{money(formTotal(form))}</span></div>
                </div>
              </section>

              {/* 4. Follow-up */}
              <section className="space-y-3">
                <h4 className="text-xs font-bold text-amber-300">{ar ? '٤. المتابعة والمرفقات' : '4. Follow-up and attachments'}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={label}>{ar ? 'موعد الصيانة الدورية القادمة' : 'Next preventive maintenance'}</label>
                    <input type="date" value={form.nextMaintenanceDate} min={form.maintenanceDate} onChange={e => setForm({ ...form, nextMaintenanceDate: e.target.value })} className={field} data-field="nextMaintenanceDate" />
                    <div className="flex gap-1.5 mt-1.5">
                      {[3, 6, 12].map(m => (
                        <button type="button" key={m} onClick={() => { const d = new Date(form.maintenanceDate + 'T12:00:00'); d.setMonth(d.getMonth() + m); setForm({ ...form, nextMaintenanceDate: d.toISOString().slice(0, 10) }); }}
                          className="px-2 py-0.5 rounded-md text-[10px] text-slate-300 bg-slate-800 border border-slate-700 hover:border-slate-500">
                          +{m} {ar ? 'شهر' : 'mo'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={label}>{ar ? 'وثيقة الطلب أو تقرير الصيانة' : 'Request document or service report'}</label>
                    <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-600 text-xs text-slate-300 cursor-pointer hover:border-slate-400">
                      {form.documentName ? <Paperclip className="w-4 h-4 text-emerald-400" /> : <Upload className="w-4 h-4" />}
                      <span className="truncate">{form.documentName || (form.id ? (ar ? 'استبدال المرفق (اختياري)' : 'Replace attachment (optional)') : (ar ? 'اختيار ملف (PDF أو صورة)' : 'Choose a file (PDF or image)'))}</span>
                      <input type="file" accept="application/pdf,image/*" onChange={onPickFile} className="hidden" />
                    </label>
                  </div>
                </div>
                <div>
                  <label className={label}>{ar ? 'ملاحظات' : 'Notes'}</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} maxLength={2000} className={`${field} resize-none`} />
                </div>
              </section>

              {formError && <p className="text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2" role="alert" data-role="form-error">{formError}</p>}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-xl text-sm text-slate-300 bg-slate-800 hover:bg-slate-700">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50">
                {saving ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'حفظ السجل' : 'Save record')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation */}
      {toDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-white mb-2">{ar ? 'حذف سجل الصيانة' : 'Delete maintenance record'}</h3>
            <p className="text-sm text-slate-300 mb-5">{ar ? `حذف السجل #${toDelete.id} للجهاز ${toDelete.assetCode}؟ لا يمكن التراجع.` : `Delete record #${toDelete.id} for ${toDelete.assetCode}? This cannot be undone.`}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setToDelete(null)} className="px-4 py-2 rounded-xl text-sm text-slate-300 bg-slate-800 hover:bg-slate-700">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500">{ar ? 'حذف' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
