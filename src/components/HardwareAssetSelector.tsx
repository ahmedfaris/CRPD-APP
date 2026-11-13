import React, { useState, useMemo } from 'react';
import { useDevices } from '../context/DeviceContext';
import { useOrg } from '../context/OrgContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { ElectronicDevice, HardwareDeviceType, DeviceReceiptAttachment } from '../types';
import { isSameDepartment } from '../utils/departmentHelper';
import { 
  Laptop, 
  Printer, 
  ScanLine, 
  HardDrive, 
  Server, 
  Cpu, 
  Search, 
  Plus, 
  Check, 
  CheckCircle2, 
  X, 
  ShieldCheck, 
  ShieldAlert, 
  MapPin, 
  Building, 
  Building2,
  Lock,
  Hash, 
  Tag, 
  Layers, 
  Loader2, 
  RotateCcw,
  Sparkles,
  ChevronRight,
  Monitor,
  Paperclip,
  AlertTriangle,
  Trash2,
  Eye,
  FileText,
  Folder,
  FolderTree,
  FolderOpen,
  QrCode as QrCodeIcon
} from 'lucide-react';
import { AssetQrScannerModal } from './AssetQrScannerModal';

interface HardwareAssetSelectorProps {
  selectedDeviceId: string | number | null;
  selectedDevice: ElectronicDevice | null;
  onSelectDevice: (device: ElectronicDevice) => void;
  onClearDevice: () => void;
  hardwareDeviceType: HardwareDeviceType;
  onChangeHardwareDeviceType: (type: HardwareDeviceType) => void;
  assetType: string;
  onChangeAssetType: (val: string) => void;
  serialOrBarcode: string;
  onChangeSerialOrBarcode: (val: string) => void;
  physicalLocation: string;
  onChangePhysicalLocation: (val: string) => void;
  strictUserDepartmentOnly?: boolean;
}

export function mapDeviceTypeToHardwareType(deviceType: string, category: string): HardwareDeviceType {
  const dt = (deviceType || '').toLowerCase();
  if (dt.includes('computer') || dt.includes('pc') || dt.includes('laptop') || dt.includes('screen') || dt.includes('monitor') || dt.includes('workstation')) {
    return 'Computer';
  }
  if (dt.includes('printer')) {
    return 'Printer';
  }
  if (dt.includes('fingerprint') || dt.includes('biometric') || dt.includes('بصمة')) {
    return 'FingerPrint Device';
  }
  if (dt.includes('scanner') || dt.includes('ماسح')) {
    return 'Scanner';
  }
  if (category === 'network' || dt.includes('router') || dt.includes('switch') || dt.includes('access point') || dt.includes('firewall') || dt.includes('شبك')) {
    return 'Network Device';
  }
  return 'Other Device';
}

export function getDeviceCategoryIcon(deviceType: string, category: string) {
  const dt = (deviceType || '').toLowerCase();
  if (dt.includes('printer')) {
    return <Printer className="w-4 h-4 text-emerald-600" />;
  }
  if (dt.includes('scanner')) {
    return <ScanLine className="w-4 h-4 text-purple-600" />;
  }
  if (dt.includes('fingerprint') || dt.includes('biometric')) {
    return <Cpu className="w-4 h-4 text-amber-600" />;
  }
  if (category === 'network' || dt.includes('router') || dt.includes('switch')) {
    return <Server className="w-4 h-4 text-cyan-600" />;
  }
  if (dt.includes('screen') || dt.includes('monitor')) {
    return <Monitor className="w-4 h-4 text-indigo-600" />;
  }
  return <Laptop className="w-4 h-4 text-blue-600" />;
}

export function HardwareAssetSelector({
  selectedDeviceId,
  selectedDevice,
  onSelectDevice,
  onClearDevice,
  hardwareDeviceType,
  onChangeHardwareDeviceType,
  assetType,
  onChangeAssetType,
  serialOrBarcode,
  onChangeSerialOrBarcode,
  physicalLocation,
  onChangePhysicalLocation,
  strictUserDepartmentOnly = false,
}: HardwareAssetSelectorProps) {
  const { devices, addDevice, loading: devicesLoading, assetTypes } = useDevices();
  const { getAllDepartments, resolveHierarchyForDept } = useOrg();
  const { language } = useLanguage();
  const { currentUser, isTechnicalUser, isAdmin } = useAuth();

  // Determine user capabilities & department
  const isTech = Boolean(isTechnicalUser || isAdmin);
  const enforceStrictDept = Boolean(strictUserDepartmentOnly && !isTech);
  const userDept = currentUser?.department || '';

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'computer' | 'printer' | 'scanner' | 'biometric' | 'network'>('all');
  const [isBrowsingAssets, setIsBrowsingAssets] = useState(false);

  // Quick Add Asset Modal State
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickCategory, setQuickCategory] = useState<'electronic' | 'network'>('electronic');
  const [quickDeviceType, setQuickDeviceType] = useState('Computer');
  const [quickBrand, setQuickBrand] = useState('');
  const [quickModel, setQuickModel] = useState('');
  const [quickSerialNumber, setQuickSerialNumber] = useState('');
  const [quickDepartment, setQuickDepartment] = useState('');
  const [quickDepartmentAr, setQuickDepartmentAr] = useState('');
  const [quickLocation, setQuickLocation] = useState('');
  const [quickWarrantyPeriod, setQuickWarrantyPeriod] = useState('24 Months');
  const [isSubmittingQuickAsset, setIsSubmittingQuickAsset] = useState(false);
  const [quickAssetError, setQuickAssetError] = useState<string | null>(null);
  const [quickPurchaseReceipt, setQuickPurchaseReceipt] = useState<DeviceReceiptAttachment | null>(null);
  const [showQuickPledgeModal, setShowQuickPledgeModal] = useState(false);
  const [quickPreviewReceipt, setQuickPreviewReceipt] = useState<DeviceReceiptAttachment | null>(null);

  const [quickDivision, setQuickDivision] = useState('');

  // Department List sourced directly from Organizational Structure
  const orgDepts = getAllDepartments();

  const userOrgDept = useMemo(() => {
    return orgDepts.find(d => isSameDepartment(d.nameEn, userDept) || isSameDepartment(d.nameAr, userDept));
  }, [orgDepts, userDept]);

  const userDeptDisplay = language === 'ar' ? (userOrgDept?.nameAr || userDept) : (userOrgDept?.nameEn || userDept);

  const resolvedQuickHierarchy = useMemo(() => {
    return resolveHierarchyForDept(quickDepartment || userDept || '', quickDivision);
  }, [quickDepartment, userDept, quickDivision, resolveHierarchyForDept]);
  const departmentsList = useMemo(() => {
    // Departments come only from the organizational structure (no built-in examples).
    return (orgDepts || []).map(d => language === 'ar' ? (d.nameAr || d.nameEn) : d.nameEn);
  }, [orgDepts, language]);

  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [isQrScannerOpen, setIsQrScannerOpen] = useState<boolean>(false);

  // Assets scoped: Technical users always see all assets from all departments.
  // Non-technical users with strictUserDepartmentOnly are scoped strictly to their department.
  const scopedDevices = useMemo(() => {
    if (enforceStrictDept) {
      return devices.filter(dev => 
        isSameDepartment(dev.department, userDept) || 
        (dev.departmentAr && isSameDepartment(dev.departmentAr, userDept))
      );
    }
    if (selectedDeptFilter === 'ALL') {
      return devices;
    }
    return devices.filter(dev => 
      isSameDepartment(dev.department, selectedDeptFilter) || 
      (dev.departmentAr && isSameDepartment(dev.departmentAr, selectedDeptFilter))
    );
  }, [devices, selectedDeptFilter, enforceStrictDept, userDept]);

  // Filtered Assets from Asset Management System based on scoped list
  const filteredDevices = useMemo(() => {
    return scopedDevices.filter(dev => {
      // Category filter
      if (filterCategory !== 'all') {
        const dt = (dev.deviceType || '').toLowerCase();
        if (filterCategory === 'computer' && !(dt.includes('computer') || dt.includes('pc') || dt.includes('laptop') || dt.includes('workstation') || dt.includes('screen'))) {
          return false;
        }
        if (filterCategory === 'printer' && !dt.includes('printer')) {
          return false;
        }
        if (filterCategory === 'scanner' && !dt.includes('scanner')) {
          return false;
        }
        if (filterCategory === 'biometric' && !(dt.includes('fingerprint') || dt.includes('biometric') || dt.includes('بصمة'))) {
          return false;
        }
        if (filterCategory === 'network' && dev.category !== 'network' && !dt.includes('router') && !dt.includes('switch')) {
          return false;
        }
      }

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = (dev.deviceCode || '').toLowerCase().includes(q);
        const matchBrand = (dev.brand || '').toLowerCase().includes(q);
        const matchModel = (dev.model || '').toLowerCase().includes(q);
        const matchSerial = (dev.serialNumber || '').toLowerCase().includes(q);
        const matchDept = (dev.department || '').toLowerCase().includes(q);
        const matchType = (dev.deviceType || '').toLowerCase().includes(q);
        const matchLoc = (dev.location || '').toLowerCase().includes(q);
        return matchCode || matchBrand || matchModel || matchSerial || matchDept || matchType || matchLoc;
      }

      return true;
    });
  }, [scopedDevices, filterCategory, searchQuery]);

  // Open Quick Add Modal
  const handleOpenQuickAdd = () => {
    setQuickCategory('electronic');
    setQuickDeviceType('Computer');
    setQuickBrand('');
    setQuickModel('');
    setQuickSerialNumber('');
    const defaultMatched = userDept ? orgDepts.find(d => isSameDepartment(d.nameEn, userDept) || isSameDepartment(d.nameAr, userDept)) : null;
    const defaultOrgDept = defaultMatched || orgDepts[0];
    const initialDept = defaultOrgDept ? defaultOrgDept.nameEn : (userDept || 'Information Technology');
    setQuickDepartment(initialDept);
    setQuickDepartmentAr(defaultOrgDept ? defaultOrgDept.nameAr : '');
    setQuickLocation(physicalLocation || '');
    setQuickWarrantyPeriod('24 Months');
    setQuickPurchaseReceipt(null);
    setShowQuickPledgeModal(false);
    setQuickAssetError(null);
    setShowQuickAddModal(true);
  };

  // Receipt upload for quick add
  const handleQuickReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert(language === 'ar' ? 'حجم الملف يتجاوز الحد المسموح (10 ميجابايت)' : 'File size exceeds limit (10MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setQuickPurchaseReceipt({
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: reader.result as string,
        uploadedAt: new Date().toISOString()
      });
    };
    reader.readAsDataURL(file);
  };

  // Submit Quick Add Asset - triggers pledge confirmation modal
  const handleSubmitQuickAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickBrand.trim()) {
      setQuickAssetError(language === 'ar' ? 'يرجى إدخال اسم الشركة المصنعة (Brand).' : 'Please enter brand manufacturer.');
      return;
    }
    if (!quickModel.trim()) {
      setQuickAssetError(language === 'ar' ? 'يرجى إدخال طراز الجهاز (Model).' : 'Please enter model description.');
      return;
    }
    setQuickAssetError(null);
    setShowQuickPledgeModal(true);
  };

  // Final confirmation of quick asset with pledge "اتعهد بصحة جميع معلومات الجهاز"
  const handleConfirmQuickAsset = async () => {
    const effectiveDepartment = quickDepartment.trim() || userDept || 'Information Technology';

    const matchedDept = orgDepts.find(d => 
      isSameDepartment(d.nameEn, effectiveDepartment) || 
      isSameDepartment(d.nameAr, effectiveDepartment)
    );
    const resolvedDeptEn = matchedDept ? matchedDept.nameEn : effectiveDepartment;
    const resolvedDeptAr = matchedDept ? matchedDept.nameAr : (quickDepartmentAr || undefined);

    try {
      setIsSubmittingQuickAsset(true);
      setQuickAssetError(null);

      const res = await addDevice({
        category: quickCategory,
        deviceType: quickDeviceType,
        brand: quickBrand.trim(),
        model: quickModel.trim(),
        serialNumber: quickSerialNumber.trim() || undefined,
        department: resolvedDeptEn,
        departmentAr: resolvedDeptAr,
        location: quickLocation.trim() || undefined,
        warrantyPeriod: quickWarrantyPeriod,
        dateOfPurchase: new Date().toISOString().split('T')[0],
        warrantyStartDate: new Date().toISOString().split('T')[0],
        status: 'Operational',
        purchaseReceipt: quickPurchaseReceipt || undefined
      });

      if (res.success && res.data) {
        onSelectDevice(res.data);
        setShowQuickPledgeModal(false);
        setShowQuickAddModal(false);
        setIsBrowsingAssets(false);
      } else {
        setShowQuickPledgeModal(false);
        setQuickAssetError(res.error || (language === 'ar' ? 'فشل إضافة الأصل في النظام' : 'Failed to register asset.'));
      }
    } catch (err: any) {
      setShowQuickPledgeModal(false);
      setQuickAssetError(err.message || 'Error creating asset');
    } finally {
      setIsSubmittingQuickAsset(false);
    }
  };

  return (
    <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-4">
      {/* Header section with Asset Management link & count */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-amber-200/60">
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <div className="w-8 h-8 rounded-lg bg-amber-600/10 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <span>{language === 'ar' ? 'اختيار الأصل / الجهاز من نظام إدارة الأصول' : 'Select Asset from Asset Management System'}</span>
              <span className="text-rose-500">*</span>
            </h4>
            <p className="text-[11px] text-amber-800">
              {language === 'ar' 
                ? 'يتم تعبئة تفاصيل العتاد مباشرة من سجلات الأصول المسجلة بالهيئة' 
                : 'Pulls hardware specifications directly from registered organizational assets'}
            </p>
          </div>
        </div>

        {/* Total Assets Pill & Quick Add Trigger */}
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 text-[10px] font-mono font-bold border border-amber-300">
            {scopedDevices.length} {language === 'ar' ? 'أصل متاح' : 'assets available'}
          </span>
          <button
            type="button"
            onClick={() => setIsQrScannerOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold shadow-xs transition cursor-pointer"
            title={language === 'ar' ? 'مسح رمز QR للأصل بالكاميرا' : 'Scan Asset QR with Camera'}
          >
            <QrCodeIcon className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'مسح QR' : 'Scan QR'}</span>
          </button>
          <button
            type="button"
            onClick={handleOpenQuickAdd}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shadow-xs transition cursor-pointer"
            title={language === 'ar' ? 'إضافة أصل جديد سريعاً' : 'Quick Add Asset'}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'أصل جديد' : 'New Asset'}</span>
          </button>
        </div>
      </div>

      {/* DEPARTMENT FILTER / SCOPE BAR */}
      {enforceStrictDept ? (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 text-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Building2 className="w-5 h-5 text-blue-700 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-slate-900">
                  {language === 'ar' ? 'أصول قسم مقدم البلاغ (الهيكل التنظيمي):' : 'Requester Department Assets:'}
                </span>
                <span className="px-3 py-1 rounded-lg bg-blue-700 text-white font-black text-xs sm:text-sm">
                  {userDeptDisplay}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {language === 'ar'
                  ? `تُعرض حصرياً الأصول التابعة لقسمك (${scopedDevices.length} أصل مسجل). يمكنك الاختيار منها أو إضافة أصل جديد فوراً.`
                  : `Strictly showing assets assigned to your department (${scopedDevices.length} assets registered). Select one or add a new one.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenQuickAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs hover:shadow transition cursor-pointer shrink-0"
            title={language === 'ar' ? 'إضافة أصل جديد للقسم فوراً' : 'Quick Add Asset to Department'}
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'ar' ? 'إضافة أصل جديد للقسم (+)' : 'Add New Asset (+)'}</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-100/90 border border-amber-300/90 text-amber-950 text-xs">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="font-semibold">
              {language === 'ar' ? 'تصفية الأصول حسب القسم:' : 'Filter Assets by Department:'}
            </span>
          </div>
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-amber-300 text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="ALL">{language === 'ar' ? 'كافة أقسام الهيكل التنظيمي' : 'All Org Departments'}</option>
            {orgDepts.map(dept => (
              <option key={dept.id || dept.nameEn} value={dept.nameEn}>
                {language === 'ar' ? `${dept.nameAr} (${dept.nameEn})` : `${dept.nameEn} - ${dept.nameAr}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* SELECTED ASSET CARD (If an asset is selected and not browsing) */}
      {selectedDevice && !isBrowsingAssets ? (
        <div className="p-3.5 bg-white border-2 border-amber-500/70 rounded-xl shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0 mt-0.5">
                {getDeviceCategoryIcon(selectedDevice.deviceType, selectedDevice.category)}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-amber-600 text-white font-mono text-[10px] font-bold">
                    {selectedDevice.deviceCode}
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {selectedDevice.brand} {selectedDevice.model}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
                  <span><strong>{language === 'ar' ? 'النوع:' : 'Type:'}</strong> {selectedDevice.deviceType}</span>
                  <span>•</span>
                  <span><strong>{language === 'ar' ? 'القسم:' : 'Dept:'}</strong> {selectedDevice.department}</span>
                  {selectedDevice.serialNumber && (
                    <>
                      <span>•</span>
                      <span className="font-mono"><strong>S/N:</strong> {selectedDevice.serialNumber}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions: Change or Clear */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsBrowsingAssets(true)}
                className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition cursor-pointer"
              >
                {language === 'ar' ? 'تغيير الأصل' : 'Change Asset'}
              </button>
              <button
                type="button"
                onClick={onClearDevice}
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                title={language === 'ar' ? 'إلغاء التحديد' : 'Clear selection'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Badges & Physical Location check */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                <strong>{language === 'ar' ? 'الموقع المسجل:' : 'Registered Location:'}</strong> {selectedDevice.location || 'N/A'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                <strong>{language === 'ar' ? 'الضمان:' : 'Warranty:'}</strong>{' '}
                <span className={selectedDevice.isWarrantyActive ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                  {selectedDevice.isWarrantyActive 
                    ? (language === 'ar' ? 'تحت الضمان الساري' : 'Active Warranty') 
                    : (language === 'ar' ? 'منتهي الصلاحية' : 'Expired')}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>
                <strong>{language === 'ar' ? 'الحالة التشغيلية:' : 'Status:'}</strong>{' '}
                <span className="font-semibold text-slate-800">{selectedDevice.status}</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ASSET SELECTION BROWSER / LIST VIEW */
        <div className="bg-white border border-amber-200 rounded-xl p-3 shadow-xs space-y-3">
          {/* Search bar & Category filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'ar' ? 'ابحث برمز الأصل (DEV-...)، الطراز، الماركة، الرقم التسلسلي أو القسم...' : 'Search by asset code (DEV-...), brand, model, S/N, or department...'}
                className="w-full pl-9 pr-8 rtl:pl-8 rtl:pr-9 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category filter chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
              <button
                type="button"
                onClick={() => setFilterCategory('all')}
                className={`px-2.5 py-1 rounded-md font-semibold shrink-0 transition cursor-pointer ${
                  filterCategory === 'all'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {language === 'ar' ? 'كافة الأصول' : 'All Assets'} ({scopedDevices.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('computer')}
                className={`px-2.5 py-1 rounded-md font-semibold shrink-0 transition cursor-pointer ${
                  filterCategory === 'computer'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {language === 'ar' ? 'حواسيب وشاشات' : 'Computers & PCs'}
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('printer')}
                className={`px-2.5 py-1 rounded-md font-semibold shrink-0 transition cursor-pointer ${
                  filterCategory === 'printer'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {language === 'ar' ? 'طابعات' : 'Printers'}
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('scanner')}
                className={`px-2.5 py-1 rounded-md font-semibold shrink-0 transition cursor-pointer ${
                  filterCategory === 'scanner'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {language === 'ar' ? 'ماسحات ضوئية' : 'Scanners'}
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('biometric')}
                className={`px-2.5 py-1 rounded-md font-semibold shrink-0 transition cursor-pointer ${
                  filterCategory === 'biometric'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {language === 'ar' ? 'أجهزة البصمة' : 'Biometrics'}
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('network')}
                className={`px-2.5 py-1 rounded-md font-semibold shrink-0 transition cursor-pointer ${
                  filterCategory === 'network'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {language === 'ar' ? 'أجهزة الشبكة' : 'Network Devices'}
              </button>
            </div>
          </div>

          {/* ASSET LIST (Filled from Assets Management System) */}
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 p-1">
              {devicesLoading ? (
                <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                  <span>{language === 'ar' ? 'جارٍ تحميل الأصول...' : 'Loading assets...'}</span>
                </div>
              ) : filteredDevices.length > 0 ? (
                filteredDevices.map((dev) => {
                  const isSelected = selectedDeviceId === dev.id;
                  return (
                    <div
                      key={dev.id}
                      onClick={() => {
                        onSelectDevice(dev);
                        setIsBrowsingAssets(false);
                      }}
                      className={`p-2.5 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition ${
                        isSelected
                          ? 'bg-amber-100/90 border border-amber-300'
                          : 'hover:bg-amber-50/80 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-md bg-slate-100 shrink-0">
                          {getDeviceCategoryIcon(dev.deviceType, dev.category)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                              {dev.deviceCode}
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {dev.brand} {dev.model}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 truncate">
                            <span>{dev.deviceType}</span>
                            <span>•</span>
                            <span>{dev.department}</span>
                            {dev.serialNumber && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[10px] text-slate-600">S/N: {dev.serialNumber}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {dev.isWarrantyActive && (
                          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                            {language === 'ar' ? 'ضمان سارٍ' : 'Warranty'}
                          </span>
                        )}
                        <button
                          type="button"
                          className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 ${
                            isSelected
                              ? 'bg-amber-600 text-white'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-200'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>{language === 'ar' ? 'محدد' : 'Selected'}</span>
                            </>
                          ) : (
                            <span>{language === 'ar' ? 'اختيار' : 'Select'}</span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                  <p>
                    {language === 'ar'
                      ? 'لا توجد أصول مطابقة لمعايير البحث في نظام إدارة الأصول.'
                      : 'No assets found matching the search criteria in the Asset Management System.'}
                  </p>
                </div>
              )}
            </div>

            {/* MANDATORY: QUICK PLUS SIGN AT THE BOTTOM OF THE LIST */}
            <div className="p-2.5 bg-gradient-to-r from-amber-50 via-amber-100/60 to-amber-50 border-t border-amber-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] text-amber-900 font-medium">
                <span className="flex h-5 w-5 rounded-full bg-amber-600 text-white items-center justify-center font-bold text-xs shrink-0">
                  +
                </span>
                <span>
                  {!isTech && userDept
                    ? (language === 'ar'
                      ? `الجهاز غير موجود في القائمة؟ أضف الأصل فوراً إلى قسمك (${userDept}):`
                      : `Device not listed? Quick add asset to your department (${userDept}):`)
                    : (language === 'ar'
                      ? 'الجهاز غير موجود في القائمة؟ أضف الأصل فوراً لأي قسم بالنظام:'
                      : 'Device not listed? Quick add asset to any department in Asset Management:')}
                </span>
              </div>

              <button
                type="button"
                id="btn-quick-add-hardware-asset"
                onClick={handleOpenQuickAdd}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>
                  {!isTech && userDept
                    ? (language === 'ar' ? 'إضافة أصل لقسمي (+)' : 'Add Asset to My Dept (+)')
                    : (language === 'ar' ? 'إضافة أصل جديد الآن (+)' : 'Add New Asset (+)')}
                </span>
              </button>
            </div>
          </div>

          {selectedDevice && (
            <div className="text-right rtl:text-left">
              <button
                type="button"
                onClick={() => setIsBrowsingAssets(false)}
                className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                {language === 'ar' ? 'الرجوع للأصل المحدد حالياً' : 'Return to currently selected asset'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TICKET HARDWARE SPECIFICATION FIELDS (Synchronized with Asset) */}
      <div className="space-y-3 pt-1">
        <div className="text-[11px] font-bold text-amber-950 flex items-center justify-between">
          <span>{language === 'ar' ? 'بيانات وموقع البلاغ الفعلية:' : 'Actual Ticket Hardware Location & Specs:'}</span>
          <span className="text-[10px] text-slate-500 font-normal">
            {language === 'ar' ? '(يتم تعبئتها تلقائياً ويمكن تعديل موقع المحطة)' : '(Auto-filled from asset; editable if device relocated)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {language === 'ar' ? 'الموديل / طراز الأصل' : 'Model / Brand'}
            </label>
            <input
              type="text"
              value={assetType}
              onChange={(e) => onChangeAssetType(e.target.value)}
              placeholder={language === 'ar' ? 'مثال: Dell OptiPlex 7090' : 'e.g. Dell OptiPlex 7090'}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {language === 'ar' ? 'الرقم التسلسلي أو باركود الأصل' : 'Serial NO. or Barcode Tag'}
            </label>
            <input
              type="text"
              value={serialOrBarcode}
              onChange={(e) => onChangeSerialOrBarcode(e.target.value)}
              placeholder="SN-DEV-2026-X8"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {language === 'ar' ? 'الموقع الفعلي / المحطة الحالية' : 'Physical Location / Station'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={physicalLocation}
              onChange={(e) => onChangePhysicalLocation(e.target.value)}
              placeholder={language === 'ar' ? 'المبنى الرئيسي، الطابق 2، مكتب 204' : 'e.g. Main HQ, Floor 2, Desk 204'}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* QUICK ADD ASSET MODAL DIALOG */}
      {showQuickAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/20">
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg">
                    {language === 'ar' ? 'إضافة أصل جديد سريعاً لنظام إدارة الأصول' : 'Quick Add New Asset to Asset Management'}
                  </h3>
                  <p className="text-xs sm:text-sm text-amber-100 mt-0.5">
                    {language === 'ar' 
                      ? 'سيتم تسجيل الأصل فوراً في قاعدة بيانات الأصول واختياره لهذا البلاغ' 
                      : 'Asset will be saved in Asset Management and linked to this ticket'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddModal(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form: All fields full width, larger font */}
            <form onSubmit={handleSubmitQuickAsset} className="p-6 sm:p-7 space-y-5 overflow-y-auto flex-1 text-sm sm:text-base">
              {quickAssetError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <span>{quickAssetError}</span>
                </div>
              )}

              {/* 1. Asset Type Selection (Unified Dropdown List - Entire Modal Width) */}
              <div className="w-full">
                <label className="block font-bold text-slate-800 mb-1.5 text-sm sm:text-base">
                  {language === 'ar' ? 'نوع الأصل / تصنيف الجهاز *' : 'Asset / Device Type *'}
                </label>
                <select
                  value={quickDeviceType}
                  onChange={(e) => {
                    const t = assetTypes.find(x => x.key === e.target.value);
                    setQuickDeviceType(e.target.value);
                    if (t) setQuickCategory(t.category === 'network' ? 'network' : 'electronic');
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm sm:text-base text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 font-medium cursor-pointer shadow-xs"
                >
                  {/* Types come from the managed asset types list */}
                  {(['electronic', 'network'] as const).map(cat => {
                    const options = assetTypes.filter(t => t.category === cat && t.isActive);
                    if (options.length === 0) return null;
                    return (
                      <optgroup key={cat} label={cat === 'electronic'
                        ? (language === 'ar' ? '— الأجهزة الإلكترونية والمكتبية —' : '— Electronic & Office Devices —')
                        : (language === 'ar' ? '— عتاد وتجهيزات الشبكات —' : '— Network Hardware —')}>
                        {options.map(t => (
                          <option key={t.key} value={t.key}>{language === 'ar' ? `${t.nameAr} (${t.nameEn})` : t.nameEn}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              {/* 2. Department Selection (Entire Modal Width, NO organizational structure badge) */}
              <div className="w-full">
                <label className="block font-bold text-slate-800 mb-1.5 text-sm sm:text-base">
                  {language === 'ar' ? 'القسم / الوحدة الإدارية التابع لها الأصل *' : 'Department / Administrative Unit *'}
                </label>
                <select
                  required
                  value={quickDepartment}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQuickDepartment(val);
                    const matched = orgDepts.find(d => d.nameEn === val || d.nameAr === val);
                    if (matched) {
                      setQuickDepartmentAr(matched.nameAr);
                    }
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm sm:text-base text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 font-medium cursor-pointer shadow-xs"
                >
                  {orgDepts.map((dept) => (
                    <option key={dept.id || dept.nameEn} value={dept.nameEn}>
                      {language === 'ar' 
                        ? `${dept.nameAr} (${dept.nameEn})` 
                        : `${dept.nameEn} — ${dept.nameAr}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Brand / Manufacturer (Entire Modal Width) */}
              <div className="w-full">
                <label className="block font-bold text-slate-800 mb-1.5 text-sm sm:text-base">
                  {language === 'ar' ? 'الشركة المصنعة / العلامة التجارية (Brand) *' : 'Brand / Manufacturer *'}
                </label>
                <input
                  type="text"
                  required
                  value={quickBrand}
                  onChange={(e) => setQuickBrand(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: Dell, HP, Zebra, Cisco, Canon' : 'e.g. Dell, HP, Zebra, Cisco, Canon'}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm sm:text-base text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 shadow-xs"
                />
              </div>

              {/* 4. Model & Specifications (Entire Modal Width) */}
              <div className="w-full">
                <label className="block font-bold text-slate-800 mb-1.5 text-sm sm:text-base">
                  {language === 'ar' ? 'طراز الجهاز والمواصفات (Model & Specs) *' : 'Model & Specifications *'}
                </label>
                <input
                  type="text"
                  required
                  value={quickModel}
                  onChange={(e) => setQuickModel(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: OptiPlex 7090 Tower Core i7, LaserJet M404' : 'e.g. OptiPlex 7090, LaserJet M404'}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm sm:text-base text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 shadow-xs"
                />
              </div>

              {/* 5. Serial Number (Entire Modal Width) */}
              <div className="w-full">
                <label className="block font-bold text-slate-800 mb-1.5 text-sm sm:text-base">
                  {language === 'ar' ? 'الرقم التسلسلي (Serial Number / S/N)' : 'Serial Number (S/N)'}
                </label>
                <input
                  type="text"
                  value={quickSerialNumber}
                  onChange={(e) => setQuickSerialNumber(e.target.value)}
                  placeholder="e.g. SN-2026-X99"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm sm:text-base text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 font-mono shadow-xs"
                />
              </div>

              {/* 6. Physical Location (Entire Modal Width) */}
              <div className="w-full">
                <label className="block font-bold text-slate-800 mb-1.5 text-sm sm:text-base">
                  {language === 'ar' ? 'الموقع الفعلي / المحطة أو الغرفة' : 'Physical Location / Station / Room'}
                </label>
                <input
                  type="text"
                  value={quickLocation}
                  onChange={(e) => setQuickLocation(e.target.value)}
                  placeholder={language === 'ar' ? 'المبنى الرئيسي، الطابق 2، مكتب 204' : 'e.g. Main HQ, Floor 2, Room 204'}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm sm:text-base text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 shadow-xs"
                />
              </div>

              {/* 7. Warranty Period (Entire Modal Width) */}
              <div className="w-full">
                <label className="block font-bold text-slate-800 mb-1.5 text-sm sm:text-base">
                  {language === 'ar' ? 'مدة الضمان (Warranty Period)' : 'Warranty Period'}
                </label>
                <select
                  value={quickWarrantyPeriod}
                  onChange={(e) => setQuickWarrantyPeriod(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm sm:text-base text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 shadow-xs cursor-pointer"
                >
                  <option value="12 Months">12 Months (1 Year)</option>
                  <option value="24 Months">24 Months (2 Years)</option>
                  <option value="36 Months">36 Months (3 Years)</option>
                  <option value="60 Months">60 Months (5 Years)</option>
                </select>
              </div>

              {/* 8. Purchase Receipt (Optional Attachment - Entire Modal Width) */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-slate-800 text-sm sm:text-base">
                    {language === 'ar' ? 'فاتورة / إيصال الشراء (مرفق اختياري)' : 'Purchase Receipt (Optional Attachment)'}
                  </label>
                  <span className="text-xs text-amber-700 font-semibold">
                    {language === 'ar' ? '(اختياري)' : '(Optional)'}
                  </span>
                </div>

                {!quickPurchaseReceipt ? (
                  <label className="w-full flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl bg-slate-50 hover:bg-amber-50/40 transition cursor-pointer group">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                      <Paperclip className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 text-center mb-0.5">
                      {language === 'ar' ? 'انقر لإرفاق فاتورة الشراء أو اسحب الملف هنا' : 'Click to attach purchase receipt or drag & drop'}
                    </p>
                    <p className="text-xs text-slate-500 text-center">
                      {language === 'ar' ? 'يدعم صور PNG, JPG أو ملفات PDF حتى 10 ميجابايت' : 'Supports PNG, JPG, or PDF up to 10MB'}
                    </p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={handleQuickReceiptUpload}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="w-full p-3.5 rounded-xl border border-amber-300 bg-amber-50/70 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {quickPurchaseReceipt.type?.includes('image') || quickPurchaseReceipt.dataUrl?.startsWith('data:image') ? (
                        <img
                          src={quickPurchaseReceipt.dataUrl}
                          alt="Receipt preview"
                          className="w-12 h-12 object-cover rounded-lg border border-amber-300 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{quickPurchaseReceipt.name}</p>
                        <p className="text-xs text-slate-500">
                          {quickPurchaseReceipt.size ? `${(quickPurchaseReceipt.size / 1024).toFixed(1)} KB` : 'Attached'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {quickPurchaseReceipt.dataUrl && (
                        <button
                          type="button"
                          onClick={() => setQuickPreviewReceipt(quickPurchaseReceipt)}
                          className="p-2 rounded-lg bg-white border border-slate-200 text-amber-700 hover:bg-amber-100 transition cursor-pointer"
                          title={language === 'ar' ? 'معاينة' : 'Preview'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setQuickPurchaseReceipt(null)}
                        className="p-2 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title={language === 'ar' ? 'حذف' : 'Remove'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* In-Form Warning Notice (Always visible above save) */}
              <div className="w-full p-4 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-900 flex items-center gap-3 shadow-xs">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                <div className="text-sm sm:text-base font-bold text-amber-950">
                  <span>{language === 'ar' ? 'تنبيه: "اتعهد بصحة جميع معلومات الجهاز"' : 'Warning: "I certify the accuracy of all device information"'}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  disabled={isSubmittingQuickAsset}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickAsset}
                  className="px-6 py-2.5 rounded-xl text-sm sm:text-base font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                  <span>{language === 'ar' ? 'حفظ وإدراج الأصل في البلاغ' : 'Save & Select for Ticket'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK PLEDGE & WARNING CONFIRMATION MODAL */}
      {showQuickPledgeModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-amber-500 w-full max-w-lg p-6 sm:p-7 text-center space-y-4 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 mx-auto flex items-center justify-center border-2 border-amber-300 shadow-md">
              <ShieldAlert className="w-8 h-8 stroke-[2.2]" />
            </div>

            <h3 className="text-xl font-bold text-slate-900">
              {language === 'ar' ? 'تأكيد وإقرار تسجيل الجهاز' : 'Asset Information Verification'}
            </h3>

            {/* The EXACT required warning message */}
            <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-500 text-amber-950 shadow-inner">
              <p className="text-base sm:text-lg font-black tracking-wide leading-relaxed text-amber-900">
                "اتعهد بصحة جميع معلومات الجهاز"
              </p>
              <p className="text-xs text-amber-700 mt-1 font-mono">
                "I certify the accuracy of all device information"
              </p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'ar'
                ? 'بالضغط على "تأكيد الحفظ"، فإنك تقر وتتعهد بصحة كافة البيانات المدخلة لهذا الجهاز.'
                : 'By confirming, you certify that all information entered for this device is true and accurate.'}
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowQuickPledgeModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition cursor-pointer"
              >
                {language === 'ar' ? 'مراجعة البيانات / تراجع' : 'Review / Back'}
              </button>
              <button
                type="button"
                onClick={handleConfirmQuickAsset}
                disabled={isSubmittingQuickAsset}
                className="flex-1 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md shadow-amber-600/30 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSubmittingQuickAsset ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...'}</span>
                  </>
                ) : (
                  <span>{language === 'ar' ? 'تأكيد الحفظ' : 'Confirm Save'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK RECEIPT PREVIEW MODAL */}
      {quickPreviewReceipt && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <span className="font-bold text-sm text-slate-800 truncate">{quickPreviewReceipt.name}</span>
              <button
                onClick={() => setQuickPreviewReceipt(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-slate-100">
              {quickPreviewReceipt.dataUrl?.startsWith('data:image') || quickPreviewReceipt.type?.includes('image') ? (
                <img src={quickPreviewReceipt.dataUrl} alt={quickPreviewReceipt.name} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm" />
              ) : (
                <iframe src={quickPreviewReceipt.dataUrl} title="Receipt" className="w-full h-[65vh] rounded-lg" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ASSET QR SCANNER MODAL */}
      <AssetQrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        devices={scopedDevices}
        onSelectDevice={(device) => {
          onSelectDevice(device);
          setIsQrScannerOpen(false);
        }}
        onRegisterWithCode={(code) => {
          setIsQrScannerOpen(false);
          handleOpenQuickAdd();
          setQuickSerialNumber(code);
        }}
      />
    </div>
  );
}
