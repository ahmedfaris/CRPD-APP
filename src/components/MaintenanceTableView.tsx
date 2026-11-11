import React, { useState } from 'react';
import { 
  Wrench, 
  FileText, 
  Coins, 
  Calendar, 
  User, 
  HardDrive, 
  Search, 
  Plus, 
  Download, 
  ExternalLink, 
  Eye, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Filter, 
  Layers, 
  X,
  FileCheck,
  AlertCircle
} from 'lucide-react';
import { MaintenanceRecord, DepartmentRequestDoc } from '../types';
import { useDevices } from '../context/DeviceContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface MaintenanceTableViewProps {
  onSelectTicket?: (ticketId: string) => void;
  onSelectAsset?: (assetId: number | string) => void;
}

export const MaintenanceTableView: React.FC<MaintenanceTableViewProps> = ({
  onSelectTicket,
  onSelectAsset
}) => {
  const { maintenanceRecords, devices, createMaintenanceTableRecord, deleteMaintenanceTableRecord } = useDevices();
  const { language, dir } = useLanguage();
  const { currentUser, isAdmin, hasPermission } = useAuth();
  const canDelete = isAdmin || hasPermission('Asset Management.Delete') || hasPermission('devices.manage') || hasPermission('assets.manage');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modals
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<MaintenanceRecord | null>(null);
  const [selectedDocPreview, setSelectedDocPreview] = useState<{ name: string; url?: string; raw?: any } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add Form State
  const [formAssetId, setFormAssetId] = useState<string>(devices[0]?.id ? String(devices[0].id) : '1');
  const [formMaintenanceType, setFormMaintenanceType] = useState('Routine Maintenance');
  const [formMaintenanceDate, setFormMaintenanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [formRequesterName, setFormRequesterName] = useState(currentUser?.fullName || 'Ahmed Faris');
  const [formDescription, setFormDescription] = useState('');
  const [formCost, setFormCost] = useState('0');
  const [formDocumentName, setFormDocumentName] = useState('');
  const [formDocumentData, setFormDocumentData] = useState<string | null>(null);
  const [formTicketNo, setFormTicketNo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Format currency in Iraqi Dinar (IQD)
  const formatCostIQD = (val: number | string) => {
    const num = parseFloat(String(val || '0')) || 0;
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: num % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return language === 'ar' ? `${formatted} د.ع` : `${formatted} IQD`;
  };

  // Filter records
  const filteredRecords = maintenanceRecords.filter(rec => {
    if (selectedType !== 'ALL' && rec.maintenanceType !== selectedType) return false;
    if (selectedStatus !== 'ALL' && (rec.status || 'Completed') !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = String(rec.id).includes(q);
      const matchAssetId = String(rec.assetId).includes(q);
      const matchAssetName = (rec.assetName || '').toLowerCase().includes(q);
      const matchAssetCode = (rec.assetCode || '').toLowerCase().includes(q);
      const matchType = rec.maintenanceType.toLowerCase().includes(q);
      const matchRequester = rec.maintenanceRequesterName.toLowerCase().includes(q);
      const matchDesc = rec.maintenanceDescription.toLowerCase().includes(q);
      const matchTicket = (rec.ticketNo || '').toLowerCase().includes(q);
      return matchId || matchAssetId || matchAssetName || matchAssetCode || matchType || matchRequester || matchDesc || matchTicket;
    }
    return true;
  });

  // Calculate Metrics
  const totalCost = maintenanceRecords.reduce((sum, r) => sum + (parseFloat(String(r.costOfMaintenance || '0')) || 0), 0);
  const completedCount = maintenanceRecords.filter(r => (r.status || 'Completed') === 'Completed').length;
  const inProgressCount = maintenanceRecords.filter(r => r.status === 'In Progress' || r.status === 'Scheduled').length;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormDocumentName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormDocumentData(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescription.trim()) return;

    setIsSubmitting(true);
    try {
      const docPayload: DepartmentRequestDoc | null = formDocumentName ? {
        requestNumber: `REQ-${Date.now().toString().slice(-5)}`,
        requestDate: formMaintenanceDate,
        fileName: formDocumentName,
        fileSize: '1.2 MB',
        fileType: 'application/pdf',
        source: 'PC Upload',
        scannedAt: new Date().toISOString(),
        dataUrl: formDocumentData || undefined
      } : null;

      const createRes = await createMaintenanceTableRecord({
        assetId: Number(formAssetId),
        maintenanceType: formMaintenanceType,
        maintenanceDate: new Date(formMaintenanceDate).toISOString(),
        maintenanceRequesterName: formRequesterName,
        maintenanceDescription: formDescription,
        maintenanceRequestDocument: docPayload,
        costOfMaintenance: parseFloat(formCost) || 0,
        ticketNo: formTicketNo.trim() || undefined,
        status: 'Completed',
        performedBy: 'Technical Support Team'
      });

      if (!createRes.success) {
        alert((language === 'ar' ? 'تعذر حفظ سجل الصيانة: ' : 'The maintenance record was not saved: ') + (createRes.error || ''));
        return;
      }

      setIsAddModalOpen(false);
      setFormDescription('');
      setFormDocumentName('');
      setFormDocumentData(null);
      setFormCost('0');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir={dir}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  {language === 'ar' ? 'جدول سجلات الصيانة المركزية' : 'Central Maintenance Records Table'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  {language === 'ar' 
                    ? 'جدول الصيانة المتكامل: ربط الأصول برقم الأصل، نوع وتاريخ الصيانة، اسم مقدم الطلب المرتبط بطلب الأجهزة، وثيقة الطلب وتكلفة الصيانة.'
                    : 'Relational maintenance table connected to assets, ticket creators, uploaded request documents, and maintenance costs.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'ar' ? 'إضافة سجل صيانة' : 'Add Maintenance Record'}</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
            <div className="text-[11px] font-semibold text-slate-400">
              {language === 'ar' ? 'إجمالي السجلات' : 'Total Records'}
            </div>
            <div className="text-xl font-black text-white mt-1">{maintenanceRecords.length}</div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
            <div className="text-[11px] font-semibold text-emerald-400">
              {language === 'ar' ? 'عمليات مكتملة' : 'Completed'}
            </div>
            <div className="text-xl font-black text-emerald-400 mt-1">{completedCount}</div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
            <div className="text-[11px] font-semibold text-amber-400">
              {language === 'ar' ? 'قيد التنفيذ / مجدولة' : 'In Progress / Sched.'}
            </div>
            <div className="text-xl font-black text-amber-400 mt-1">{inProgressCount}</div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
            <div className="text-[11px] font-semibold text-indigo-400">
              {language === 'ar' ? 'إجمالي التكاليف (د.ع)' : 'Total Cost (IQD)'}
            </div>
            <div className="text-xl font-black text-indigo-300 mt-1">
              {formatCostIQD(totalCost)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'ar' 
              ? 'بحث برقم الصيانة، رمز الأصل، اسم الأصل، مقدم الطلب، رقم التذكرة...' 
              : 'Search by ID, Asset Code, Asset Name, Requester, Ticket #...'}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-indigo-500"
          >
            <option value="ALL">{language === 'ar' ? 'جميع أنواع الصيانة' : 'All Maintenance Types'}</option>
            <option value="Routine Maintenance">{language === 'ar' ? 'صيانة دورية وقائية' : 'Routine Maintenance'}</option>
            <option value="Hardware Repair">{language === 'ar' ? 'إصلاح عتاد' : 'Hardware Repair'}</option>
            <option value="Component Replacement">{language === 'ar' ? 'استبدال قطع غيار' : 'Component Replacement'}</option>
            <option value="Inspection">{language === 'ar' ? 'فحص ومعايرة' : 'Inspection'}</option>
            <option value="Emergency Service">{language === 'ar' ? 'صيانة طارئة' : 'Emergency Service'}</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-indigo-500"
          >
            <option value="ALL">{language === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
            <option value="Completed">{language === 'ar' ? 'مكتمل' : 'Completed'}</option>
            <option value="In Progress">{language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</option>
            <option value="Scheduled">{language === 'ar' ? 'مجدول' : 'Scheduled'}</option>
          </select>
        </div>
      </div>

      {/* The Central Maintenance Table */}
      <div className="bg-slate-800/90 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-slate-300 border-b border-slate-700 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center w-16">ID</th>
                <th className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                    <span>{language === 'ar' ? 'الأصل المرتبط (Asset ID)' : 'Linked Asset (Asset ID)'}</span>
                  </div>
                </th>
                <th className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>{language === 'ar' ? 'نوع الصيانة' : 'Maintenance Type'}</span>
                  </div>
                </th>
                <th className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{language === 'ar' ? 'تاريخ الصيانة' : 'Maintenance Date'}</span>
                  </div>
                </th>
                <th className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{language === 'ar' ? 'مقدم الطلب (منشئ تذكرة العتاد)' : 'Requester Name (Hardware Ticket Creator)'}</span>
                  </div>
                </th>
                <th className="py-3.5 px-4">
                  <span>{language === 'ar' ? 'وصف الصيانة' : 'Description'}</span>
                </th>
                <th className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-rose-400" />
                    <span>{language === 'ar' ? 'وثيقة طلب الصيانة' : 'Request Document'}</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{language === 'ar' ? 'تكلفة الصيانة (د.ع)' : 'Cost of Maint. (IQD)'}</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">
                  <span>{language === 'ar' ? 'التذكرة / الإجراءات' : 'Ticket / Actions'}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Wrench className="w-8 h-8 text-slate-600 stroke-[1.5]" />
                      <p className="text-sm font-semibold">{language === 'ar' ? 'لا توجد سجلات صيانة مطابقة' : 'No maintenance records found'}</p>
                      <p className="text-xs text-slate-400">{language === 'ar' ? 'قم بإنشاء تذكرة صيانة عتاد أو أضف سجلاً جديداً' : 'Create a hardware maintenance ticket or add a new record'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const doc = parseDoc(rec.maintenanceRequestDocument);
                  const formattedCost = parseFloat(String(rec.costOfMaintenance || '0'));

                  return (
                    <tr 
                      key={rec.id}
                      className="hover:bg-slate-700/30 transition group"
                    >
                      {/* ID Field */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-400">
                        #{rec.id}
                      </td>

                      {/* Asset ID & Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                            <HardDrive className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{rec.assetName || `Asset #${rec.assetId}`}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 font-mono">
                                ID: {rec.assetId}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-cyan-400">{rec.assetCode || `AST-${rec.assetId}`}</span>
                              {rec.deviceType && <span>• {rec.deviceType}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Maintenance Type */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          rec.maintenanceType.includes('Repair') 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : rec.maintenanceType.includes('Routine')
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          <Wrench className="w-3 h-3" />
                          <span>{rec.maintenanceType}</span>
                        </span>
                      </td>

                      {/* Maintenance Date */}
                      <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{rec.maintenanceDate ? new Date(rec.maintenanceDate).toISOString().split('T')[0] : 'N/A'}</span>
                        </div>
                      </td>

                      {/* Maintenance Requester Name (Linked to Hardware Ticket Creator) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {rec.maintenanceRequesterName.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{rec.maintenanceRequesterName}</span>
                              <span className="text-[10px] text-indigo-400 px-1 py-0.2 rounded bg-indigo-950 border border-indigo-800">
                                {language === 'ar' ? 'منشئ التذكرة' : 'Ticket Creator'}
                              </span>
                            </div>
                            {rec.requesterId && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                UID: {rec.requesterId}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Maintenance Description */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-slate-300 text-xs line-clamp-2 leading-relaxed" title={rec.maintenanceDescription}>
                          {rec.maintenanceDescription}
                        </p>
                      </td>

                      {/* Maintenance Request Document (Uploaded during ticket creation) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {doc ? (
                          <button
                            type="button"
                            onClick={() => setSelectedDocPreview({ name: doc.fileName || 'Maintenance_Doc.pdf', url: doc.fileUrl || doc.dataUrl, raw: doc })}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition cursor-pointer"
                            title={language === 'ar' ? 'عرض وثيقة طلب الصيانة المرفوعة أثناء إنشاء التذكرة' : 'View document uploaded during ticket creation'}
                          >
                            <FileText className="w-3.5 h-3.5 text-rose-400" />
                            <span className="truncate max-w-[120px]">{doc.fileName || 'Doc.pdf'}</span>
                            <Eye className="w-3 h-3 text-rose-400 ml-0.5" />
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs italic">
                            {language === 'ar' ? 'لا توجد وثيقة مرفقة' : 'No document attached'}
                          </span>
                        )}
                      </td>

                      {/* Cost of Maintenance */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono font-bold text-emerald-400">
                        {formatCostIQD(rec.costOfMaintenance)}
                      </td>

                      {/* Ticket / Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {rec.ticketNo && (
                            <span 
                              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-400 font-mono text-[11px] font-semibold hover:border-cyan-500 transition cursor-pointer"
                              onClick={() => onSelectTicket && onSelectTicket(rec.ticketNo!)}
                              title={language === 'ar' ? 'تذكرة عتاد مرتبطة' : 'Linked hardware ticket'}
                            >
                              {rec.ticketNo}
                            </span>
                          )}

                          <button
                            onClick={() => setSelectedRecordForDetail(rec)}
                            className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title={language === 'ar' ? 'عرض كامل التفاصيل' : 'View Full Details'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canDelete && (
                            <button
                              onClick={async () => {
                                if (confirm(language === 'ar' ? `هل أنت متأكد من حذف سجل الصيانة #${rec.id}؟` : `Delete maintenance record #${rec.id}?`)) {
                                  const delRes = await deleteMaintenanceTableRecord(rec.id);
                                  if (!delRes.success) {
                                    alert((language === 'ar' ? 'تعذر حذف السجل: ' : 'The record was not deleted: ') + (delRes.error || ''));
                                  }
                                }
                              }}
                              className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-rose-900/60 text-slate-400 hover:text-rose-400 transition"
                              title={language === 'ar' ? 'حذف' : 'Delete'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DOCUMENT PREVIEW MODAL */}
      {selectedDocPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  {language === 'ar' ? 'وثيقة طلب الصيانة المرفوعة أثناء إنشاء التذكرة' : 'Maintenance Request Document (Uploaded during Ticket Creation)'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDocPreview(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-400">{language === 'ar' ? 'اسم الملف:' : 'File Name:'}</span>
                <span className="font-mono text-white font-bold">{selectedDocPreview.name}</span>
              </div>
              {selectedDocPreview.raw?.fileSize && (
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">{language === 'ar' ? 'الحجم:' : 'File Size:'}</span>
                  <span className="text-slate-200">{selectedDocPreview.raw.fileSize}</span>
                </div>
              )}
              {selectedDocPreview.raw?.source && (
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">{language === 'ar' ? 'المصدر:' : 'Source:'}</span>
                  <span className="text-slate-200">{selectedDocPreview.raw.source}</span>
                </div>
              )}
              {selectedDocPreview.raw?.requestNumber && (
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">{language === 'ar' ? 'رقم الطلب الرسمي:' : 'Official Request #:'}</span>
                  <span className="font-mono text-indigo-400 font-bold">{selectedDocPreview.raw.requestNumber}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-t border-slate-700/60">
                <span className="text-slate-400">{language === 'ar' ? 'موقع الحفظ على القرص:' : 'Disk Storage Location:'}</span>
                <span className="font-mono text-blue-400 font-medium text-xs flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-blue-400" />
                  {selectedDocPreview.raw?.filePath || `ticket requests/${selectedDocPreview.name}`}
                </span>
              </div>
            </div>

            {selectedDocPreview.url ? (
              <div className="border border-slate-700 rounded-xl overflow-hidden bg-black flex items-center justify-center p-2 min-h-[220px]">
                {selectedDocPreview.url.startsWith('data:image/') ? (
                  <img src={selectedDocPreview.url} alt="Uploaded Document" className="max-h-72 object-contain rounded" />
                ) : (
                  <iframe src={selectedDocPreview.url} className="w-full h-72 border-0" title="PDF Document" />
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 bg-slate-800/40 rounded-xl">
                <FileText className="w-10 h-10 text-rose-400/50 mx-auto mb-2" />
                <p className="text-xs">{language === 'ar' ? 'الوثيقة مسجلة في النظام كملف مرفق رسمي تم التحقق منه.' : 'Document is officially registered and verified in the database.'}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              {selectedDocPreview.url && (
                <a
                  href={selectedDocPreview.url}
                  download={selectedDocPreview.name}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>{language === 'ar' ? 'تحميل الوثيقة' : 'Download Document'}</span>
                </a>
              )}
              <button
                onClick={() => setSelectedDocPreview(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL RECORD DETAIL MODAL */}
      {selectedRecordForDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-2xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">
                  {language === 'ar' ? `تفاصيل سجل الصيانة #${selectedRecordForDetail.id}` : `Maintenance Record #${selectedRecordForDetail.id} Details`}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecordForDetail(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-800/80 p-3 rounded-xl space-y-1">
                <span className="text-slate-400">{language === 'ar' ? 'الأصل المرتبط (Asset ID):' : 'Linked Asset:'}</span>
                <div className="font-bold text-white text-sm">
                  {selectedRecordForDetail.assetName} (ID: {selectedRecordForDetail.assetId})
                </div>
                <div className="font-mono text-cyan-400">{selectedRecordForDetail.assetCode}</div>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl space-y-1">
                <span className="text-slate-400">{language === 'ar' ? 'نوع الصيانة:' : 'Maintenance Type:'}</span>
                <div className="font-bold text-amber-400 text-sm">{selectedRecordForDetail.maintenanceType}</div>
                <div className="text-slate-400 font-mono">
                  {selectedRecordForDetail.maintenanceDate ? new Date(selectedRecordForDetail.maintenanceDate).toLocaleString() : 'N/A'}
                </div>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl space-y-1">
                <span className="text-slate-400">{language === 'ar' ? 'مقدم الطلب (منشئ تذكرة العتاد):' : 'Requester (Hardware Ticket Creator):'}</span>
                <div className="font-bold text-white text-sm">{selectedRecordForDetail.maintenanceRequesterName}</div>
                {selectedRecordForDetail.requesterId && (
                  <div className="font-mono text-slate-400">UID: {selectedRecordForDetail.requesterId}</div>
                )}
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl space-y-1">
                <span className="text-slate-400">{language === 'ar' ? 'تكلفة الصيانة:' : 'Cost of Maintenance:'}</span>
                <div className="font-bold text-emerald-400 text-lg font-mono">
                  {formatCostIQD(selectedRecordForDetail.costOfMaintenance)}
                </div>
              </div>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-xl space-y-2 text-xs">
              <span className="text-slate-400 font-semibold">{language === 'ar' ? 'وصف الصيانة:' : 'Maintenance Description:'}</span>
              <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{selectedRecordForDetail.maintenanceDescription}</p>
            </div>

            {selectedRecordForDetail.maintenanceRequestDocument && (
              <div className="bg-slate-800/80 p-4 rounded-xl space-y-2 text-xs">
                <span className="text-slate-400 font-semibold">{language === 'ar' ? 'وثيقة طلب الصيانة المرفوعة أثناء إنشاء التذكرة:' : 'Request Document (from ticket creation):'}</span>
                <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-700">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-rose-400" />
                    <span className="text-white font-mono font-medium">
                      {parseDoc(selectedRecordForDetail.maintenanceRequestDocument)?.fileName || 'Document.pdf'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const d = parseDoc(selectedRecordForDetail.maintenanceRequestDocument);
                      setSelectedDocPreview({ name: d?.fileName || 'Doc.pdf', url: d?.fileUrl || d?.dataUrl, raw: d });
                    }}
                    className="px-2.5 py-1 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 rounded text-xs font-semibold transition"
                  >
                    {language === 'ar' ? 'عرض الوثيقة' : 'View Document'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedRecordForDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW MAINTENANCE RECORD MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">
                  {language === 'ar' ? 'إضافة سجل صيانة جديد في جدول الصيانة' : 'Add New Record to Maintenance Table'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              {/* Linked Asset */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {language === 'ar' ? 'الأصل المرتبط (من جدول الأصول Assets Table):' : 'Linked Asset (from Assets Table):'}
                </label>
                <select
                  value={formAssetId}
                  onChange={(e) => setFormAssetId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-hidden focus:border-indigo-500"
                >
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>
                      [{d.deviceCode}] {d.brand} {d.model} - {d.deviceType} ({d.department})
                    </option>
                  ))}
                </select>
              </div>

              {/* Maintenance Type & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {language === 'ar' ? 'نوع الصيانة:' : 'Maintenance Type:'}
                  </label>
                  <select
                    value={formMaintenanceType}
                    onChange={(e) => setFormMaintenanceType(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="Routine Maintenance">{language === 'ar' ? 'صيانة دورية وقائية' : 'Routine Maintenance'}</option>
                    <option value="Hardware Repair">{language === 'ar' ? 'إصلاح عتاد' : 'Hardware Repair'}</option>
                    <option value="Component Replacement">{language === 'ar' ? 'استبدال قطع غيار' : 'Component Replacement'}</option>
                    <option value="Inspection">{language === 'ar' ? 'فحص ومعايرة' : 'Inspection'}</option>
                    <option value="Emergency Service">{language === 'ar' ? 'صيانة طارئة' : 'Emergency Service'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {language === 'ar' ? 'تاريخ الصيانة:' : 'Maintenance Date:'}
                  </label>
                  <input
                    type="date"
                    value={formMaintenanceDate}
                    onChange={(e) => setFormMaintenanceDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Requester Name & Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {language === 'ar' ? 'اسم مقدم الطلب (منشئ التذكرة):' : 'Maintenance Requester Name:'}
                  </label>
                  <input
                    type="text"
                    value={formRequesterName}
                    onChange={(e) => setFormRequesterName(e.target.value)}
                    required
                    placeholder="e.g. Ahmed Faris"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {language === 'ar' ? 'تكلفة الصيانة (د.ع):' : 'Cost of Maintenance (IQD):'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formCost}
                      onChange={(e) => setFormCost(e.target.value)}
                      placeholder={language === 'ar' ? 'مثال: 50000' : 'e.g. 50000'}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 pr-12 rtl:pr-3 rtl:pl-12 text-white text-xs font-mono focus:outline-hidden focus:border-indigo-500"
                    />
                    <span className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                      {language === 'ar' ? 'د.ع' : 'IQD'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {language === 'ar' ? 'وصف الصيانة:' : 'Maintenance Description:'}
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  required
                  placeholder={language === 'ar' ? 'اكتب تفاصيل إجراءات الصيانة والأعطال والقطع المستبدلة...' : 'Write detailed maintenance description, issues fixed, replaced parts...'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Maintenance Request Document (Same document as during ticket creation) */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {language === 'ar' ? 'وثيقة طلب الصيانة (نفس وثيقة التذكرة الرسمية):' : 'Maintenance Request Document (Same as Ticket Creation):'}
                </label>
                <div className="border border-dashed border-slate-700 rounded-xl p-3 bg-slate-800/40 text-center">
                  <input
                    type="file"
                    id="maintDocUpload"
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg"
                  />
                  <label htmlFor="maintDocUpload" className="cursor-pointer flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-white">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    <span>{formDocumentName || (language === 'ar' ? 'انقر لرفع وثيقة الصيانة (PDF أو صورة)' : 'Click to upload maintenance request document (PDF or image)')}</span>
                  </label>
                </div>
              </div>

              {/* Optional Ticket No */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {language === 'ar' ? 'رقم التذكرة المرتبط (اختياري):' : 'Linked Ticket No (Optional):'}
                </label>
                <input
                  type="text"
                  value={formTicketNo}
                  onChange={(e) => setFormTicketNo(e.target.value)}
                  placeholder="e.g. TCK-2026-0001"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                >
                  {isSubmitting ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ السجل' : 'Save Record')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
