import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useDevices } from '../context/DeviceContext';
import { useOrg } from '../context/OrgContext';
import { 
  ElectronicDevice, 
  DeviceCategory, 
  DeviceType, 
  DeviceMaintenanceItem, 
  DeviceDepartmentHistoryItem,
  DeviceReceiptAttachment
} from '../types';
import { 
  Laptop, 
  Printer, 
  Monitor, 
  Fingerprint, 
  Scan, 
  Wifi, 
  Network, 
  Server, 
  HardDrive, 
  Cpu, 
  Wrench, 
  ShieldCheck, 
  History, 
  Calendar, 
  Building2, 
  Tag, 
  Search, 
  Plus, 
  Filter, 
  ArrowRightLeft, 
  Download, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  ChevronRight, 
  ArrowLeft, 
  Activity, 
  Clock, 
  FileText, 
  Sparkles,
  SlidersHorizontal,
  DollarSign,
  UserCheck,
  MapPin,
  Globe,
  Radio,
  Lock,
  FileCheck,
  Paperclip,
  Upload,
  Eye,
  ShieldAlert,
  Folder,
  FolderTree,
  FolderOpen,
  Hash,
  QrCode as QrCodeIcon,
  BarChart3
} from 'lucide-react';
import { isSameDepartment } from '../utils/departmentHelper';
import { AssetQrScannerModal } from './AssetQrScannerModal';
import { AssetQrBadgeModal } from './AssetQrBadgeModal';
import { MaintenanceTableView } from './MaintenanceTableView';
import { AssetStatisticsView } from './AssetStatisticsView';
import { AssetTimelineView } from './AssetTimelineView';
import { TicketDetailModal } from './TicketDetailModal';
import { useTickets } from '../context/TicketContext';

interface DeviceManagementAppProps {
  onBackToMetro: () => void;
}

export function DeviceManagementApp({ onBackToMetro }: DeviceManagementAppProps) {
  const { t, language, dir } = useLanguage();
  const { currentUser, users, isTechnicalUser, isAdmin, hasPermission } = useAuth();
  const canCreate = isAdmin || hasPermission('Asset Management.Create') || hasPermission('devices.manage') || hasPermission('assets.manage');
  const canEdit = isAdmin || hasPermission('Asset Management.Edit') || hasPermission('devices.manage') || hasPermission('assets.manage');
  const canDelete = isAdmin || hasPermission('Asset Management.Delete') || hasPermission('devices.manage') || hasPermission('assets.manage');
  const isTech = Boolean(isTechnicalUser || isAdmin);
  const userDept = currentUser?.department;
  const { 
    devices, 
    maintenanceRecords, 
    addDevice, 
    updateDevice, 
    transferDepartment, 
    addMaintenanceRecord, 
    deleteDevice,
    getDeviceFolder,
    uploadToDeviceFolder,
    getFolderHierarchy,
    syncFolders
  } = useDevices();
  const { tickets } = useTickets();
  const { getAllDepartments, resolveHierarchyForDept } = useOrg();

  // Main View Mode: Assets Inventory vs Asset Statistics Dashboard vs Central Maintenance Table
  const [activeMainTab, setActiveMainTab] = useState<'assets' | 'stats' | 'maintenance'>('assets');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'electronic' | 'network'>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedWarrantyStatus, setSelectedWarrantyStatus] = useState<'ALL' | 'active' | 'expired'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'Operational' | 'Under Maintenance' | 'Storage' | 'Retired'>('ALL');

  // Modals
  const [viewDeviceModal, setViewDeviceModal] = useState<ElectronicDevice | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'timeline' | 'departments' | 'maintenance' | 'folder'>('overview');
  const [selectedDocPreview, setSelectedDocPreview] = useState<{ name: string; url?: string; raw?: any } | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<ElectronicDevice | null>(null);
  const [transferModalDevice, setTransferModalDevice] = useState<ElectronicDevice | null>(null);
  const [maintenanceModalDevice, setMaintenanceModalDevice] = useState<ElectronicDevice | null>(null);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [badgeModalDevice, setBadgeModalDevice] = useState<ElectronicDevice | null>(null);
  const [formPurchaseReceipt, setFormPurchaseReceipt] = useState<DeviceReceiptAttachment | null>(null);
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [viewReceiptModal, setViewReceiptModal] = useState<DeviceReceiptAttachment | null>(null);

  // Device Folder States
  const [deviceFolderData, setDeviceFolderData] = useState<any>(null);
  const [isLoadingFolder, setIsLoadingFolder] = useState(false);
  const [isUploadingToFolder, setIsUploadingToFolder] = useState(false);
  const [isFoldersExplorerOpen, setIsFoldersExplorerOpen] = useState(false);
  const [foldersTreeData, setFoldersTreeData] = useState<any>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(false);

  // Forms State: Create / Edit Device
  const [formCategory, setFormCategory] = useState<DeviceCategory>('electronic');
  const [formDeviceType, setFormDeviceType] = useState<DeviceType>('Computer');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formSerialNumber, setFormSerialNumber] = useState('');
  const [formDateOfPurchase, setFormDateOfPurchase] = useState(new Date().toISOString().split('T')[0]);
  const [formWarrantyStartDate, setFormWarrantyStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formWarrantyPeriod, setFormWarrantyPeriod] = useState('24 Months');
  const [formDepartment, setFormDepartment] = useState('Information Technology');
  const [formDepartmentAr, setFormDepartmentAr] = useState('');
  const [formDivision, setFormDivision] = useState('');
  const [formDivisionAr, setFormDivisionAr] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formIpAddress, setFormIpAddress] = useState('');
  const [formMacAddress, setFormMacAddress] = useState('');
  const [formAssignedEmployee, setFormAssignedEmployee] = useState('');
  const [isManualEmployee, setIsManualEmployee] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<'Operational' | 'Under Maintenance' | 'Storage' | 'Retired'>('Operational');

  const getDeviceCodePrefix = (deviceType: string, category: string): string => {
    const t = (deviceType || '').toLowerCase();
    if (t.includes('printer') || t.includes('طابعة') || t.includes('barcode')) return 'PR';
    if (t.includes('computer') || t.includes('pc') || t.includes('laptop') || t.includes('desktop') || t.includes('حاسوب') || t.includes('كمبيوتر')) return 'PC';
    if (t.includes('scanner') || t.includes('ماسح')) return 'SC';
    if (t.includes('screen') || t.includes('monitor') || t.includes('شاشة')) return 'MN';
    if (t.includes('fingerprint') || t.includes('بصمة')) return 'FP';
    if (t.includes('router') || t.includes('راوتر')) return 'RT';
    if (t.includes('switch') || t.includes('سويتش')) return 'SW';
    if (t.includes('access point') || t.includes('نقطة وصول') || t.includes('wifi')) return 'AP';
    if (t.includes('server') || t.includes('خادم')) return 'SR';
    if (t.includes('phone') || t.includes('هاتف')) return 'PH';
    return category === 'network' ? 'NW' : 'DEV';
  };

  // Auto-calculated Asset ID: prefix (PR for printer, PC for Computer) + sequential device number for this department
  const calculatedAssetId = useMemo(() => {
    if (editingDevice) return editingDevice.deviceCode;
    const prefix = getDeviceCodePrefix(formDeviceType, formCategory);
    const deptNorm = (formDepartment || '').toLowerCase();
    const deptDevs = devices.filter(d => 
      (d.department || '').toLowerCase() === deptNorm || 
      (d.departmentAr || '').toLowerCase() === deptNorm
    );
    let maxSeq = 0;
    const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');
    for (const d of deptDevs) {
      const match = d.deviceCode?.trim().match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
    return `${prefix}-${String(maxSeq + 1).padStart(3, '0')}`;
  }, [editingDevice, formDeviceType, formCategory, formDepartment, devices]);

  // Resolved organizational hierarchy (Directorate -> Department)
  const resolvedOrgHierarchy = useMemo(() => {
    return resolveHierarchyForDept(formDepartment, formDivision);
  }, [formDepartment, formDivision, resolveHierarchyForDept]);

  // Load device folder info when viewDeviceModal changes
  React.useEffect(() => {
    if (viewDeviceModal && viewDeviceModal.id) {
      setIsLoadingFolder(true);
      getDeviceFolder(viewDeviceModal.id)
        .then(res => {
          if (res.success && res.data) {
            setDeviceFolderData(res.data);
          }
        })
        .finally(() => setIsLoadingFolder(false));
    } else {
      setDeviceFolderData(null);
    }
  }, [viewDeviceModal?.id]);

  // Forms State: Transfer Department
  const [transferTargetDept, setTransferTargetDept] = useState('');
  const [transferTargetDeptAr, setTransferTargetDeptAr] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);

  // Forms State: Add Maintenance Record
  const [maintDate, setMaintDate] = useState(new Date().toISOString().split('T')[0]);
  const [maintType, setMaintType] = useState<'Routine' | 'Repair' | 'Upgrade' | 'Inspection' | 'Replacement'>('Routine');
  const [maintDescription, setMaintDescription] = useState('');
  const [maintPerformedBy, setMaintPerformedBy] = useState(currentUser?.fullName || 'Hardware Technician');
  const [maintCost, setMaintCost] = useState('0');
  const [maintStatus, setMaintStatus] = useState<'Completed' | 'In Progress' | 'Scheduled'>('Completed');
  const [maintNotes, setMaintNotes] = useState('');

  // Department List sourced directly from Organizational Structure
  const orgDepts = getAllDepartments();
  const allDepartmentsList = useMemo(() => {
    if (orgDepts && orgDepts.length > 0) {
      return orgDepts.map(d => language === 'ar' ? (d.nameAr || d.nameEn) : d.nameEn);
    }
    return [
      language === 'ar' ? 'تكنولوجيا المعلومات' : 'Information Technology',
      language === 'ar' ? 'العمليات والتنفيذ' : 'Operations',
      language === 'ar' ? 'الأرشفة الإلكترونية والسجلات' : 'Electronic Archiving & Records',
      language === 'ar' ? 'دعم العملاء ومكتب المساعدة' : 'Customer Support & Helpdesk',
      language === 'ar' ? 'الموارد البشرية' : 'Human Resources'
    ];
  }, [orgDepts, language]);

  // Helper Icon for Device Types
  const getDeviceIcon = (type: string, category: string) => {
    const tLower = (type || '').toLowerCase();
    if (tLower.includes('computer') || tLower.includes('pc') || tLower.includes('laptop')) {
      return <Laptop className="w-5 h-5 text-blue-500" />;
    }
    if (tLower.includes('printer')) {
      return <Printer className="w-5 h-5 text-amber-500" />;
    }
    if (tLower.includes('screen') || tLower.includes('monitor')) {
      return <Monitor className="w-5 h-5 text-purple-500" />;
    }
    if (tLower.includes('fingerprint') || tLower.includes('biometric')) {
      return <Fingerprint className="w-5 h-5 text-emerald-500" />;
    }
    if (tLower.includes('scanner') || tLower.includes('scan')) {
      return <Scan className="w-5 h-5 text-cyan-500" />;
    }
    if (tLower.includes('router')) {
      return <Server className="w-5 h-5 text-indigo-500" />;
    }
    if (tLower.includes('switch')) {
      return <Network className="w-5 h-5 text-teal-500" />;
    }
    if (tLower.includes('access point') || tLower.includes('wifi') || tLower.includes('ap')) {
      return <Wifi className="w-5 h-5 text-sky-500" />;
    }
    return category === 'network' ? <Network className="w-5 h-5 text-indigo-500" /> : <HardDrive className="w-5 h-5 text-slate-500" />;
  };

  // Scope assets: allow all users to view assets with filter by selectedDepartment
  const scopedDevices = devices;

  // Filtered Devices
  const filteredDevices = useMemo(() => {
    return scopedDevices.filter(device => {
      // Category filter
      if (selectedCategory !== 'ALL' && device.category !== selectedCategory) {
        return false;
      }
      // Type filter
      if (selectedType !== 'ALL' && device.deviceType.toLowerCase() !== selectedType.toLowerCase()) {
        return false;
      }
      // Department filter (selectable for all users)
      if (selectedDepartment !== 'ALL' && !isSameDepartment(device.department, selectedDepartment) && !(device.departmentAr && isSameDepartment(device.departmentAr, selectedDepartment))) {
        return false;
      }
      // Warranty Status filter
      if (selectedWarrantyStatus === 'active' && !device.isWarrantyActive) {
        return false;
      }
      if (selectedWarrantyStatus === 'expired' && device.isWarrantyActive) {
        return false;
      }
      // Asset Status filter
      if (selectedStatus !== 'ALL' && device.status !== selectedStatus) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = device.deviceCode.toLowerCase().includes(q);
        const matchBrand = device.brand.toLowerCase().includes(q);
        const matchModel = device.model.toLowerCase().includes(q);
        const matchType = device.deviceType.toLowerCase().includes(q);
        const matchDept = device.department.toLowerCase().includes(q) || (device.departmentAr && device.departmentAr.toLowerCase().includes(q));
        const matchSerial = device.serialNumber ? device.serialNumber.toLowerCase().includes(q) : false;
        const matchIp = device.ipAddress ? device.ipAddress.toLowerCase().includes(q) : false;
        const matchEmp = device.assignedEmployee ? device.assignedEmployee.toLowerCase().includes(q) : false;
        return matchCode || matchBrand || matchModel || matchType || matchDept || matchSerial || matchIp || matchEmp;
      }
      return true;
    });
  }, [scopedDevices, selectedCategory, selectedType, selectedDepartment, selectedWarrantyStatus, selectedStatus, searchQuery]);

  // Live Status Counts for Inventory Assessment Summary Cards
  const statusCounts = useMemo(() => {
    const operational = scopedDevices.filter(d => d.status === 'Operational').length;
    const underMaintenance = scopedDevices.filter(d => d.status === 'Under Maintenance').length;
    const storage = scopedDevices.filter(d => d.status === 'Storage').length;
    const retired = scopedDevices.filter(d => d.status === 'Retired').length;
    return { operational, underMaintenance, storage, retired };
  }, [scopedDevices]);

  // Metrics
  const metrics = useMemo(() => {
    const total = scopedDevices.length;
    const electronicCount = scopedDevices.filter(d => d.category === 'electronic').length;
    const networkCount = scopedDevices.filter(d => d.category === 'network').length;
    const warrantyActiveCount = scopedDevices.filter(d => d.isWarrantyActive).length;
    const maintenanceCount = scopedDevices.reduce((sum, d) => sum + (d.maintenanceHistory?.length || 0), 0);
    return { total, electronicCount, networkCount, warrantyActiveCount, maintenanceCount };
  }, [scopedDevices]);

  // Open Create Modal
  const handleOpenCreate = () => {
    if (!canCreate) return;
    setEditingDevice(null);
    setFormCategory('electronic');
    setFormDeviceType('Computer');
    setFormBrand('');
    setFormModel('');
    setFormSerialNumber('');
    setFormDateOfPurchase(new Date().toISOString().split('T')[0]);
    setFormWarrantyStartDate(new Date().toISOString().split('T')[0]);
    setFormWarrantyPeriod('24 Months');

    const defaultMatched = userDept ? orgDepts.find(d => isSameDepartment(d.nameEn, userDept) || isSameDepartment(d.nameAr, userDept)) : null;
    const defaultDept = defaultMatched || orgDepts[0];
    const initialDeptEn = defaultDept ? defaultDept.nameEn : (userDept || 'Information Technology');
    const initialDeptAr = defaultDept ? defaultDept.nameAr : '';
    setFormDepartment(initialDeptEn);
    setFormDepartmentAr(initialDeptAr);
    setFormDivision('');
    setFormDivisionAr('');

    setFormLocation('');
    setFormIpAddress('');
    setFormMacAddress('');
    setFormAssignedEmployee('');
    setIsManualEmployee(false);
    setFormNotes('');
    setFormStatus('Operational');
    setFormPurchaseReceipt(null);
    setShowPledgeModal(false);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (dev: ElectronicDevice) => {
    if (!canEdit) return;
    setEditingDevice(dev);
    setFormCategory(dev.category);
    setFormDeviceType(dev.deviceType);
    setFormBrand(dev.brand);
    setFormModel(dev.model);
    setFormSerialNumber(dev.serialNumber || '');
    setFormDateOfPurchase(dev.dateOfPurchase);
    setFormWarrantyStartDate(dev.warrantyStartDate || dev.dateOfPurchase);
    setFormWarrantyPeriod(dev.warrantyPeriod);
    setFormDepartment(dev.department);
    setFormDepartmentAr(dev.departmentAr || '');
    setFormDivision(dev.division || '');
    setFormDivisionAr(dev.division || '');
    setFormLocation(dev.location || '');
    setFormIpAddress(dev.ipAddress || '');
    setFormMacAddress(dev.macAddress || '');
    setFormAssignedEmployee(dev.assignedEmployee || '');
    const isKnown = (users || []).some(u => u.fullName === dev.assignedEmployee || u.email === dev.assignedEmployee);
    setIsManualEmployee(!isKnown && Boolean(dev.assignedEmployee));
    setFormNotes(dev.notes || '');
    setFormStatus(dev.status);
    if (typeof dev.purchaseReceipt === 'object' && dev.purchaseReceipt !== null) {
      setFormPurchaseReceipt(dev.purchaseReceipt as DeviceReceiptAttachment);
    } else if (typeof dev.purchaseReceipt === 'string' && dev.purchaseReceipt) {
      setFormPurchaseReceipt({
        name: 'Purchase_Receipt_' + dev.deviceCode,
        dataUrl: dev.purchaseReceipt,
        type: 'application/pdf'
      });
    } else {
      setFormPurchaseReceipt(null);
    }
    setShowPledgeModal(false);
    setIsCreateModalOpen(true);
  };

  // Upload purchase receipt file handler
  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert(language === 'ar' ? 'حجم الملف يتجاوز الحد المسموح (10 ميجابايت)' : 'File size exceeds limit (10MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormPurchaseReceipt({
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: reader.result as string,
        uploadedAt: new Date().toISOString()
      });
    };
    reader.readAsDataURL(file);
  };

  // Form submit: triggers the pledge and warning confirmation dialog
  const handleSubmitDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBrand.trim() || !formModel.trim() || !formDepartment) return;
    setShowPledgeModal(true);
  };

  // Final execution of saving asset upon confirming the pledge: "اتعهد بصحة جميع معلومات الجهاز"
  const handleConfirmSaveDevice = async () => {
    if (!formBrand.trim() || !formModel.trim() || !formDepartment) return;

    if (editingDevice) {
      const matchedDept = orgDepts.find(d => 
        isSameDepartment(d.nameEn, formDepartment) || 
        isSameDepartment(d.nameAr, formDepartment)
      );
      const resolvedDeptEn = matchedDept ? matchedDept.nameEn : formDepartment;
      const resolvedDeptAr = matchedDept ? matchedDept.nameAr : (formDepartmentAr || undefined);
      const hierarchy = resolveHierarchyForDept(resolvedDeptEn, formDivision);

      await updateDevice(editingDevice.id, {
        category: formCategory,
        deviceType: formDeviceType,
        brand: formBrand.trim(),
        model: formModel.trim(),
        serialNumber: formSerialNumber.trim() || undefined,
        dateOfPurchase: formDateOfPurchase,
        warrantyStartDate: formWarrantyStartDate,
        warrantyPeriod: formWarrantyPeriod,
        department: resolvedDeptEn,
        departmentAr: resolvedDeptAr,
        organization: hierarchy.organizationAr,
        directorate: hierarchy.directorateAr,
        division: formDivision || hierarchy.divisionAr || undefined,
        location: formLocation.trim() || undefined,
        ipAddress: formIpAddress.trim() || undefined,
        macAddress: formMacAddress.trim() || undefined,
        assignedEmployee: formAssignedEmployee.trim() || undefined,
        notes: formNotes.trim() || undefined,
        status: formStatus,
        purchaseReceipt: formPurchaseReceipt || undefined
      });
      if (viewDeviceModal && viewDeviceModal.id === editingDevice.id) {
        setViewDeviceModal(prev => prev ? {
          ...prev,
          category: formCategory,
          deviceType: formDeviceType,
          brand: formBrand.trim(),
          model: formModel.trim(),
          serialNumber: formSerialNumber.trim() || undefined,
          dateOfPurchase: formDateOfPurchase,
          warrantyStartDate: formWarrantyStartDate,
          warrantyPeriod: formWarrantyPeriod,
          department: resolvedDeptEn,
          departmentAr: resolvedDeptAr,
          organization: hierarchy.organizationAr,
          directorate: hierarchy.directorateAr,
          division: formDivision || hierarchy.divisionAr || undefined,
          location: formLocation.trim() || undefined,
          ipAddress: formIpAddress.trim() || undefined,
          macAddress: formMacAddress.trim() || undefined,
          assignedEmployee: formAssignedEmployee.trim() || undefined,
          notes: formNotes.trim() || undefined,
          status: formStatus,
          purchaseReceipt: formPurchaseReceipt || undefined
        } : null);
      }
    } else {
      const effectiveDepartment = formDepartment || userDept || 'Information Technology';

      const matchedDept = orgDepts.find(d => 
        isSameDepartment(d.nameEn, effectiveDepartment) || 
        isSameDepartment(d.nameAr, effectiveDepartment)
      );
      const resolvedDeptEn = matchedDept ? matchedDept.nameEn : effectiveDepartment;
      const resolvedDeptAr = matchedDept ? matchedDept.nameAr : (formDepartmentAr || undefined);
      const hierarchy = resolveHierarchyForDept(resolvedDeptEn, formDivision);

      await addDevice({
        deviceCode: calculatedAssetId,
        category: formCategory,
        deviceType: formDeviceType,
        brand: formBrand.trim(),
        model: formModel.trim(),
        serialNumber: formSerialNumber.trim() || undefined,
        dateOfPurchase: formDateOfPurchase,
        warrantyStartDate: formWarrantyStartDate,
        warrantyPeriod: formWarrantyPeriod,
        department: resolvedDeptEn,
        departmentAr: resolvedDeptAr,
        organization: hierarchy.organizationAr,
        directorate: hierarchy.directorateAr,
        division: formDivision || hierarchy.divisionAr || undefined,
        location: formLocation.trim() || undefined,
        ipAddress: formIpAddress.trim() || undefined,
        macAddress: formMacAddress.trim() || undefined,
        assignedEmployee: formAssignedEmployee.trim() || undefined,
        notes: formNotes.trim() || undefined,
        status: formStatus,
        departmentHistory: [],
        maintenanceHistory: [],
        purchaseReceipt: formPurchaseReceipt || undefined
      });
    }

    setShowPledgeModal(false);
    setIsCreateModalOpen(false);
  };

  // Open Transfer Modal
  const handleOpenTransfer = (dev: ElectronicDevice) => {
    if (!canEdit) return;
    setTransferModalDevice(dev);
    const available = orgDepts.filter(d => 
      !isSameDepartment(d.nameEn, dev.department) && 
      !isSameDepartment(d.nameAr, dev.department)
    );
    const target = available[0] || orgDepts[0];
    setTransferTargetDept(target ? target.nameEn : 'Operations');
    setTransferTargetDeptAr(target ? target.nameAr : 'العمليات والتنفيذ');
    setTransferReason('');
    setTransferDate(new Date().toISOString().split('T')[0]);
  };

  // Submit Department Transfer
  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModalDevice || !transferTargetDept) return;

    const matched = orgDepts.find(d => 
      isSameDepartment(d.nameEn, transferTargetDept) || 
      isSameDepartment(d.nameAr, transferTargetDept)
    );
    const targetDeptEn = matched ? matched.nameEn : transferTargetDept;
    const targetDeptAr = matched ? matched.nameAr : (transferTargetDeptAr || transferTargetDept);

    await transferDepartment(transferModalDevice.id, targetDeptEn, transferReason, targetDeptAr);
    
    // Update active view modal if open
    if (viewDeviceModal && viewDeviceModal.id === transferModalDevice.id) {
      const historyItem: DeviceDepartmentHistoryItem = {
        id: 'dh-' + Date.now(),
        department: transferModalDevice.department,
        departmentAr: transferModalDevice.departmentAr || transferModalDevice.department,
        assignedDate: transferModalDevice.dateOfPurchase,
        transferredDate: transferDate,
        transferredBy: currentUser?.fullName || 'Current User',
        reason: transferReason || 'Departmental reorganization'
      };
      setViewDeviceModal(prev => prev ? {
        ...prev,
        department: targetDeptEn,
        departmentAr: targetDeptAr,
        departmentHistory: [...prev.departmentHistory, historyItem]
      } : null);
    }

    setTransferModalDevice(null);
  };

  // Open Maintenance Modal
  const handleOpenMaintenance = (dev: ElectronicDevice) => {
    setMaintenanceModalDevice(dev);
    setMaintDate(new Date().toISOString().split('T')[0]);
    setMaintType('Routine');
    setMaintDescription('');
    setMaintPerformedBy(currentUser?.fullName || 'Hardware Tech Team');
    setMaintCost('0');
    setMaintStatus('Completed');
    setMaintNotes('');
  };

  // Submit Maintenance Record
  const handleSubmitMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceModalDevice || !maintDescription.trim()) return;

    const newRecord: Omit<DeviceMaintenanceItem, 'id'> = {
      date: maintDate,
      type: maintType,
      description: maintDescription.trim(),
      performedBy: maintPerformedBy.trim(),
      cost: parseFloat(maintCost) || 0,
      status: maintStatus,
      notes: maintNotes.trim() || undefined
    };

    await addMaintenanceRecord(maintenanceModalDevice.id, newRecord);

    if (viewDeviceModal && viewDeviceModal.id === maintenanceModalDevice.id) {
      setViewDeviceModal(prev => prev ? {
        ...prev,
        maintenanceHistory: [...prev.maintenanceHistory, { ...newRecord, id: 'mh-' + Date.now() }]
      } : null);
    }

    setMaintenanceModalDevice(null);
  };

  // Handle Delete
  const handleDelete = async (dev: ElectronicDevice) => {
    if (!canDelete) return;
    const confirmMsg = language === 'ar' 
      ? `هل أنت متأكد من حذف الجهاز ${dev.deviceCode} (${dev.brand} ${dev.model})؟` 
      : `Are you sure you want to delete device ${dev.deviceCode} (${dev.brand} ${dev.model})?`;
    if (window.confirm(confirmMsg)) {
      await deleteDevice(dev.id);
      if (viewDeviceModal?.id === dev.id) {
        setViewDeviceModal(null);
      }
    }
  };

  // Open Disk Folders Explorer
  const handleOpenFoldersExplorer = async () => {
    setIsFoldersExplorerOpen(true);
    setIsLoadingTree(true);
    try {
      const res = await getFolderHierarchy();
      if (res.success && res.tree) {
        setFoldersTreeData(res.tree);
      }
    } catch (e) {
      console.warn('Failed to load folders tree', e);
    } finally {
      setIsLoadingTree(false);
    }
  };

  // Export inventory to CSV
  const handleExportCSV = () => {
    const headers = [
      'Device Code',
      'Category',
      'Device Type',
      'Brand',
      'Model',
      'Serial Number',
      'Current Department',
      'Date of Purchase',
      'Warranty Start Date',
      'Warranty Period',
      'Warranty Expiration',
      'Warranty Active',
      'Status',
      'IP Address',
      'MAC Address',
      'Location',
      'Assigned Employee',
      'Department History Count',
      'Maintenance History Count'
    ];

    const rows = filteredDevices.map(d => [
      `"${d.deviceCode}"`,
      `"${d.category}"`,
      `"${d.deviceType}"`,
      `"${d.brand}"`,
      `"${d.model}"`,
      `"${d.serialNumber || ''}"`,
      `"${d.department}"`,
      `"${d.dateOfPurchase}"`,
      `"${d.warrantyStartDate}"`,
      `"${d.warrantyPeriod}"`,
      `"${d.warrantyExpiryDate || ''}"`,
      `"${d.isWarrantyActive ? 'Yes' : 'No'}"`,
      `"${d.status}"`,
      `"${d.ipAddress || ''}"`,
      `"${d.macAddress || ''}"`,
      `"${d.location || ''}"`,
      `"${d.assignedEmployee || ''}"`,
      d.departmentHistory?.length || 0,
      d.maintenanceHistory?.length || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `assets_inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans selection:bg-blue-600 selection:text-white" dir={dir}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Top Header Ribbon & Back to Metro */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/80 backdrop-blur-md p-5 rounded-2xl border border-slate-700/80 shadow-xl">
          <div className="flex items-center space-x-3.5">
            <button
              onClick={onBackToMetro}
              className="p-2.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-600/60 shadow-xs cursor-pointer"
              title={language === 'ar' ? 'العودة إلى مركز مترو' : 'Back to Metro Hub'}
            >
              <ArrowLeft className={`w-5 h-5 mx-0.5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            </button>
            <div>
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
                  <Laptop className="w-5 h-5" />
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {language === 'ar' ? 'إدارة الأصول' : 'Asset Management'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {metrics.total} {language === 'ar' ? 'أصل' : 'Assets'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                {language === 'ar'
                  ? 'تسجيل وجرد ومتابعة الأصول والعهد التقنية (الحواسيب، الطابعات، الشاشات، أجهزة البصمة، والماسحات الضوئية) بالإضافة لأجهزة الشبكات (الراوترات، السويتشات، ونقاط الوصول) وتتبع فترات الضمان وسجل الصيانة وسجل انتقال الأقسام.'
                  : 'Register, track, and manage organization assets (computers, printers, screens, biometrics, scanners) and network gear with warranty monitoring, maintenance history, and department transfer logs.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setIsQrScannerOpen(true)}
              className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition cursor-pointer"
              title={language === 'ar' ? 'فحص رمز الاستجابة السريعة (QR) للأصل عبر كاميرا الجهاز' : 'Scan physical asset QR code using camera'}
            >
              <QrCodeIcon className="w-4 h-4 mx-1" />
              <span>{language === 'ar' ? 'مسح رمز QR للأصل' : 'Scan Asset QR'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600/70 transition shadow-xs cursor-pointer"
              title={language === 'ar' ? 'تصدير جدول جرد الأصول إلى CSV' : 'Export Asset Inventory to CSV'}
            >
              <Download className="w-4 h-4 text-cyan-400 mx-1" />
              <span>{language === 'ar' ? 'تصدير جرد الأصول' : 'Export Assets CSV'}</span>
            </button>

            {canCreate && (
              <button
                onClick={handleOpenCreate}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 mx-1" />
                <span>{language === 'ar' ? 'إدخال أصل جديد' : 'Register New Asset'}</span>
              </button>
            )}
          </div>
        </div>

        {/* MAIN VIEW NAVIGATION TABS: ASSETS INVENTORY vs ASSET STATISTICS DASHBOARD vs CENTRAL MAINTENANCE TABLE */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-700/80 w-fit overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveMainTab('assets')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeMainTab === 'assets'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>{language === 'ar' ? 'جرد الأصول والعتاد (Assets)' : 'Assets Inventory'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 font-mono">
              {metrics.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('stats')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeMainTab === 'stats'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-cyan-300" />
            <span>{language === 'ar' ? 'لوحة إحصائيات الأصول' : 'Asset Statistics'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 font-bold border border-cyan-700/50">
              {language === 'ar' ? 'تحليلات' : 'Analytics'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('maintenance')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeMainTab === 'maintenance'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>{language === 'ar' ? 'جدول سجلات الصيانة (Maintenance Table)' : 'Central Maintenance Table'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-mono">
              {metrics.maintenanceCount}
            </span>
          </button>
        </div>

        {activeMainTab === 'stats' ? (
          <AssetStatisticsView
            devices={devices}
            scopedDevices={scopedDevices}
            statusCounts={statusCounts}
            metrics={metrics}
            selectedStatus={selectedStatus}
            onSelectStatusFilter={(status) => setSelectedStatus(status)}
            onSwitchToAssets={() => setActiveMainTab('assets')}
            onSwitchToMaintenance={() => setActiveMainTab('maintenance')}
            orgDepts={orgDepts}
            language={language}
            dir={dir}
            onExportCSV={handleExportCSV}
          />
        ) : activeMainTab === 'maintenance' ? (
          <MaintenanceTableView />
        ) : (
          <>
        {/* SEARCH & FILTERS BAR */}
        <div className="bg-slate-800/90 p-4 sm:p-5 rounded-2xl border border-slate-700/80 space-y-4 shadow-lg">
          {/* Row 1: Search Box & Category Tabs */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === 'ar' 
                    ? 'بحث برمز الجهاز، الموديل، الماركة، الرقم التسلسلي، القسم، عنوان IP...' 
                    : 'Search by Device Code, Brand, Model, Serial No, Department, IP...'}
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-cyan-500 transition"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsQrScannerOpen(true)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-400 transition"
                    title={language === 'ar' ? 'مسح رمز QR بالكاميرا' : 'Scan QR with Camera'}
                  >
                    <QrCodeIcon className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsQrScannerOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-emerald-300 text-xs font-semibold transition cursor-pointer shrink-0"
                title={language === 'ar' ? 'فاحص رمز الاستجابة السريعة (QR) عبر الكاميرا' : 'QR Camera Scanner'}
              >
                <QrCodeIcon className="w-4 h-4 text-emerald-400" />
                <span>{language === 'ar' ? 'مسح QR' : 'Scan QR'}</span>
              </button>
            </div>

            {/* Category Segmented Buttons */}
            <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-700 self-start lg:self-auto">
              <button
                onClick={() => { setSelectedCategory('ALL'); setSelectedType('ALL'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {language === 'ar' ? 'كافة الأصول' : 'All Assets'} ({devices.length})
              </button>
              <button
                onClick={() => { setSelectedCategory('electronic'); setSelectedType('ALL'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                  selectedCategory === 'electronic'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Laptop className="w-3.5 h-3.5 mx-1" />
                <span>{language === 'ar' ? 'أجهزة إلكترونية' : 'Electronic'} ({metrics.electronicCount})</span>
              </button>
              <button
                onClick={() => { setSelectedCategory('network'); setSelectedType('ALL'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                  selectedCategory === 'network'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Network className="w-3.5 h-3.5 mx-1" />
                <span>{language === 'ar' ? 'أجهزة شبكية' : 'Network'} ({metrics.networkCount})</span>
              </button>
            </div>
          </div>

          {/* Row 2: Type Filter Chips & Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-400 flex items-center space-x-1">
              <SlidersHorizontal className="w-3.5 h-3.5 mx-1" />
              <span>{language === 'ar' ? 'النوع:' : 'Type:'}</span>
            </span>

            {/* Electronic Types */}
            {selectedCategory !== 'network' && (
              <>
                <button
                  onClick={() => setSelectedType(selectedType === 'Computer' ? 'ALL' : 'Computer')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center space-x-1 ${
                    selectedType === 'Computer'
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500'
                      : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Laptop className="w-3 h-3 mx-1" />
                  <span>{language === 'ar' ? 'حاسوب' : 'Computer'}</span>
                </button>
                <button
                  onClick={() => setSelectedType(selectedType === 'Printer' ? 'ALL' : 'Printer')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center space-x-1 ${
                    selectedType === 'Printer'
                      ? 'bg-amber-600/30 text-amber-300 border-amber-500'
                      : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Printer className="w-3 h-3 mx-1" />
                  <span>{language === 'ar' ? 'طابعة' : 'Printer'}</span>
                </button>
                <button
                  onClick={() => setSelectedType(selectedType === 'Screen' ? 'ALL' : 'Screen')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center space-x-1 ${
                    selectedType === 'Screen'
                      ? 'bg-purple-600/30 text-purple-300 border-purple-500'
                      : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Monitor className="w-3 h-3 mx-1" />
                  <span>{language === 'ar' ? 'شاشة' : 'Screen'}</span>
                </button>
                <button
                  onClick={() => setSelectedType(selectedType === 'Fingerprint device' ? 'ALL' : 'Fingerprint device')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center space-x-1 ${
                    selectedType === 'Fingerprint device'
                      ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500'
                      : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Fingerprint className="w-3 h-3 mx-1" />
                  <span>{language === 'ar' ? 'جهاز بصمة' : 'Fingerprint Device'}</span>
                </button>
                <button
                  onClick={() => setSelectedType(selectedType === 'Scanner' ? 'ALL' : 'Scanner')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center space-x-1 ${
                    selectedType === 'Scanner'
                      ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500'
                      : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Scan className="w-3 h-3 mx-1" />
                  <span>{language === 'ar' ? 'ماسح ضوئي' : 'Scanner'}</span>
                </button>
              </>
            )}

            {/* Network Types */}
            {selectedCategory !== 'electronic' && (
              <>
                <button
                  onClick={() => setSelectedType(selectedType === 'router' ? 'ALL' : 'router')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center space-x-1 ${
                    selectedType === 'router'
                      ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500'
                      : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Server className="w-3 h-3 mx-1" />
                  <span>{language === 'ar' ? 'راوتر' : 'Router'}</span>
                </button>
                <button
                  onClick={() => setSelectedType(selectedType === 'switch' ? 'ALL' : 'switch')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center space-x-1 ${
                    selectedType === 'switch'
                      ? 'bg-teal-600/30 text-teal-300 border-teal-500'
                      : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Network className="w-3 h-3 mx-1" />
                  <span>{language === 'ar' ? 'سويتش' : 'Switch'}</span>
                </button>
                <button
                  onClick={() => setSelectedType(selectedType === 'access point' ? 'ALL' : 'access point')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center space-x-1 ${
                    selectedType === 'access point'
                      ? 'bg-sky-600/30 text-sky-300 border-sky-500'
                      : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Wifi className="w-3 h-3 mx-1" />
                  <span>{language === 'ar' ? 'نقطة وصول' : 'Access Point'}</span>
                </button>
              </>
            )}

            <div className="h-4 w-[1px] bg-slate-700 mx-2 hidden sm:block" />

            {/* Department Filter: Selectable from Organizational Structure */}
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-slate-900/80 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-cyan-500 font-medium cursor-pointer"
            >
              <option value="ALL">{language === 'ar' ? 'كافة أقسام الهيكل التنظيمي' : 'All Org Departments'}</option>
              {orgDepts.map(dept => (
                <option key={dept.id || dept.nameEn} value={dept.nameEn}>
                  {language === 'ar' ? `${dept.nameAr} (${dept.nameEn})` : `${dept.nameEn} - ${dept.nameAr}`}
                </option>
              ))}
            </select>

            {/* Warranty Status Filter */}
            <select
              value={selectedWarrantyStatus}
              onChange={(e) => setSelectedWarrantyStatus(e.target.value as any)}
              className="bg-slate-900/80 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-cyan-500"
            >
              <option value="ALL">{language === 'ar' ? 'حالة الضمان: الكل' : 'Warranty: All'}</option>
              <option value="active">{language === 'ar' ? 'ساري المفعول (Active)' : 'Under Warranty'}</option>
              <option value="expired">{language === 'ar' ? 'منتهي الضمان (Expired)' : 'Warranty Expired'}</option>
            </select>

            {/* Asset Operational Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className={`bg-slate-900/80 border text-xs rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-cyan-500 cursor-pointer ${
                selectedStatus !== 'ALL' ? 'border-cyan-500 text-cyan-300 ring-1 ring-cyan-500/30' : 'border-slate-700 text-slate-300'
              }`}
            >
              <option value="ALL">{language === 'ar' ? 'حالة الأصل: الكل' : 'Status: All'}</option>
              <option value="Operational">{language === 'ar' ? 'يعمل بكفاءة (Operational)' : 'Operational'}</option>
              <option value="Under Maintenance">{language === 'ar' ? 'تحت الصيانة (Under Maintenance)' : 'Under Maintenance'}</option>
              <option value="Storage">{language === 'ar' ? 'في المخزن (Storage)' : 'Storage'}</option>
              <option value="Retired">{language === 'ar' ? 'خارج الخدمة (Retired)' : 'Retired'}</option>
            </select>

            {(selectedType !== 'ALL' || selectedDepartment !== 'ALL' || selectedWarrantyStatus !== 'ALL' || selectedStatus !== 'ALL' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSelectedType('ALL');
                  setSelectedDepartment('ALL');
                  setSelectedWarrantyStatus('ALL');
                  setSelectedStatus('ALL');
                  setSearchQuery('');
                }}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 transition cursor-pointer"
              >
                {language === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
              </button>
            )}
          </div>
        </div>

        {/* DEVICE LIST / GRID */}
        {filteredDevices.length === 0 ? (
          <div className="bg-slate-800/40 rounded-2xl border border-slate-800 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
              <HardDrive className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">
              {language === 'ar' ? 'لا توجد أصول مطابقة للبحث أو الفلتر' : 'No Assets Found Matching Filters'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {language === 'ar'
                ? 'جرّب تعديل مصطلحات البحث أو تغيير فلاتر التصنيف، أو قم بإدخال أصل جديد.'
                : 'Try adjusting your search criteria, clear active filters, or register a new asset.'}
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-3 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md"
            >
              <Plus className="w-4 h-4 mx-1" />
              <span>{language === 'ar' ? 'إدخال أصل جديد' : 'Register New Asset'}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredDevices.map(device => {
              const maintCount = device.maintenanceHistory?.length || 0;
              const deptTransfersCount = device.departmentHistory?.length || 0;

              return (
                <div
                  key={device.id}
                  className="bg-slate-800/70 hover:bg-slate-800/90 rounded-2xl border border-slate-700/80 hover:border-slate-600 transition duration-200 shadow-md hover:shadow-xl p-5 flex flex-col justify-between space-y-4 group"
                >
                  {/* Card Header: Type Badge, Icon, Device Code, Status */}
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-9 h-9 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-center group-hover:scale-105 transition">
                          {getDeviceIcon(device.deviceType, device.category)}
                        </div>
                        <div>
                          <span className="font-mono text-xs font-bold text-white tracking-wide">
                            {device.deviceCode}
                          </span>
                          <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                            <span className="capitalize">{device.deviceType}</span>
                            <span>•</span>
                            <span className="text-slate-300 font-semibold">{device.brand}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end space-y-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          device.status === 'Operational'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : device.status === 'Under Maintenance'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-slate-600/20 text-slate-300 border-slate-600/30'
                        }`}>
                          {device.status}
                        </span>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          device.isWarrantyActive
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}>
                          {device.isWarrantyActive 
                            ? (language === 'ar' ? 'ضمان ساري' : 'Warranty Active')
                            : (language === 'ar' ? 'منتهي الضمان' : 'Warranty Expired')}
                        </span>
                      </div>
                    </div>

                    {/* Model & Basic Specs */}
                    <div className="mt-3.5">
                      <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition line-clamp-1">
                        {device.model}
                      </h3>
                      {device.serialNumber && (
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          S/N: {device.serialNumber}
                        </p>
                      )}
                    </div>

                    {/* Department Tag & IP */}
                    <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="flex items-center space-x-1.5 text-slate-400">
                          <Building2 className="w-3.5 h-3.5 text-blue-400 mx-1" />
                          <span>{language === 'ar' ? 'القسم الحالي:' : 'Department:'}</span>
                        </span>
                        <span className="font-semibold text-white truncate max-w-[160px]" title={language === 'ar' ? (device.departmentAr || device.department) : device.department}>
                          {language === 'ar' ? (device.departmentAr || device.department) : device.department}
                        </span>
                      </div>

                      {device.ipAddress && (
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center space-x-1.5 text-slate-400">
                            <Globe className="w-3.5 h-3.5 text-cyan-400 mx-1" />
                            <span>{language === 'ar' ? 'عنوان IP:' : 'IP Address:'}</span>
                          </span>
                          <span className="font-mono text-cyan-300 font-semibold">{device.ipAddress}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-slate-300">
                        <span className="flex items-center space-x-1.5 text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-amber-400 mx-1" />
                          <span>{language === 'ar' ? 'تاريخ الشراء:' : 'Purchase Date:'}</span>
                        </span>
                        <span className="font-mono">{device.dateOfPurchase}</span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300">
                        <span className="flex items-center space-x-1.5 text-slate-400">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mx-1" />
                          <span>{language === 'ar' ? 'مدة الضمان:' : 'Warranty Period:'}</span>
                        </span>
                        <span className="font-medium text-slate-200">
                          {device.warrantyPeriod} {device.warrantyExpiryDate ? `(${device.warrantyExpiryDate})` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Counts of Maintenance & Department History */}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-xl border border-slate-700/60">
                      <span className="flex items-center space-x-1">
                        <Wrench className="w-3.5 h-3.5 text-amber-400 mx-1" />
                        <span>{maintCount} {language === 'ar' ? 'سجلات صيانة' : 'Maintenance Logs'}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <History className="w-3.5 h-3.5 text-purple-400 mx-1" />
                        <span>{deptTransfersCount} {language === 'ar' ? 'تحويلات سابقة' : 'Past Transfers'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Card Actions Ribbon */}
                  <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between gap-1">
                    <button
                      onClick={() => { setViewDeviceModal(device); setActiveDetailTab('overview'); }}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 text-xs font-bold border border-slate-600/70 transition flex items-center justify-center space-x-1 cursor-pointer"
                      title={language === 'ar' ? 'عرض السجلات والتفاصيل' : 'View Full Details & History'}
                    >
                      <FileText className="w-3.5 h-3.5 mx-1" />
                      <span>{language === 'ar' ? 'التفاصيل والسجل' : 'Details & History'}</span>
                    </button>

                    {canEdit && (
                      <button
                        onClick={() => handleOpenTransfer(device)}
                        className="p-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-purple-300 hover:text-purple-200 border border-slate-600/70 transition cursor-pointer"
                        title={language === 'ar' ? 'تحويل الجهاز لقسم آخر' : 'Transfer Department'}
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                    )}

                    {canEdit && (
                      <button
                        onClick={() => handleOpenMaintenance(device)}
                        className="p-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-600/70 transition cursor-pointer"
                        title={language === 'ar' ? 'إضافة سجل صيانة' : 'Add Maintenance Log'}
                      >
                        <Wrench className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => setBadgeModalDevice(device)}
                      className="p-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-teal-300 hover:text-teal-200 border border-slate-600/70 transition cursor-pointer"
                      title={language === 'ar' ? 'عرض وطباعة ملصق كود الأصل (QR)' : 'View / Print QR Code Tag'}
                    >
                      <QrCodeIcon className="w-4 h-4" />
                    </button>

                    {canEdit && (
                      <button
                        onClick={() => handleOpenEdit(device)}
                        className="p-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-blue-300 hover:text-blue-200 border border-slate-600/70 transition cursor-pointer"
                        title={language === 'ar' ? 'تعديل بيانات الجهاز' : 'Edit Specs'}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => handleDelete(device)}
                        className="p-1.5 rounded-xl bg-slate-700/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-600/70 transition cursor-pointer"
                        title={language === 'ar' ? 'حذف الجهاز' : 'Delete Device'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: VIEW DEVICE DETAILS & CHRONOLOGICAL HISTORIES (Department & Maint) */}
      {/* ========================================================================= */}
      {viewDeviceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div 
            className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-4xl lg:max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            dir={dir}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
                  {getDeviceIcon(viewDeviceModal.deviceType, viewDeviceModal.category)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      {viewDeviceModal.brand} {viewDeviceModal.model}
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {viewDeviceModal.deviceCode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {viewDeviceModal.category === 'network' ? 'Network Device' : 'Electronic Device'} • {viewDeviceModal.deviceType}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setBadgeModalDevice(viewDeviceModal)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-teal-200 border border-slate-700 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                  title={language === 'ar' ? 'عرض وطباعة ملصق كود الأصل (QR)' : 'Print / View QR Tag'}
                >
                  <QrCodeIcon className="w-4 h-4" />
                  <span>{language === 'ar' ? 'ملصق QR' : 'QR Tag'}</span>
                </button>

                <button
                  onClick={() => setViewDeviceModal(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center border-b border-slate-800 px-5 bg-slate-900/60 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveDetailTab('overview')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
                  activeDetailTab === 'overview'
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5 mx-1" />
                <span>{language === 'ar' ? 'المواصفات والضمان' : 'Overview & Warranty'}</span>
              </button>

              <button
                onClick={() => setActiveDetailTab('timeline')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
                  activeDetailTab === 'timeline'
                    ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5 mx-1 text-cyan-400" />
                <span>{language === 'ar' ? 'الخط الزمني للأصل' : 'Asset Timeline'}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 font-mono">
                  {(viewDeviceModal.departmentHistory?.length || 0) + (viewDeviceModal.maintenanceHistory?.length || 0) + 1}
                </span>
              </button>

              <button
                onClick={() => setActiveDetailTab('departments')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
                  activeDetailTab === 'departments'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5 mx-1" />
                <span>{language === 'ar' ? 'سجل الأقسام السابقة' : 'Department History'}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                  {viewDeviceModal.departmentHistory?.length || 0}
                </span>
              </button>

              <button
                onClick={() => setActiveDetailTab('maintenance')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
                  activeDetailTab === 'maintenance'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 mx-1" />
                <span>{language === 'ar' ? 'سجل الصيانة والدعم' : 'Maintenance History'}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                  {viewDeviceModal.maintenanceHistory?.length || 0}
                </span>
              </button>

              <button
                onClick={() => setActiveDetailTab('folder')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
                  activeDetailTab === 'folder'
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 mx-1 text-emerald-400" />
                <span>{language === 'ar' ? 'مجلد الجهاز والوثائق' : 'Device Folder & Files'}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-emerald-300 font-mono">
                  {deviceFolderData?.files?.length || 0}
                </span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              
              {/* TAB 5: DEVICE FOLDER & STORAGE FILES */}
              {activeDetailTab === 'folder' && (
                <div className="space-y-6">
                  {/* Folder Hierarchy Breadcrumb & Description Card */}
                  <div className="bg-linear-to-br from-slate-900 via-slate-900 to-emerald-950/20 p-5 rounded-2xl border border-emerald-700/60 shadow-lg space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                          <FolderTree className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                            <span>{language === 'ar' ? 'هرمية مجلد الأصل والملفات المخزنة' : 'Asset Folder Hierarchy & Stored Files'}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                              {language === 'ar' ? 'تخزين فعلي على القرص' : 'Physical Disk Storage'}
                            </span>
                          </h3>
                          <p className="text-slate-400 text-xs mt-0.5">
                            {language === 'ar'
                              ? 'الهرمية المعتمدة: المنظمة ← الدائرة ← القسم ← الشعبة (إن وجدت) ← مجلد الأصل (يبدأ برمز الجهاز)'
                              : 'Standard Hierarchy: Organization -> Directorate -> Department -> Division -> Asset Folder (starts with device code)'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          setIsLoadingFolder(true);
                          const res = await getDeviceFolder(viewDeviceModal.id);
                          if (res.success && res.data) {
                            setDeviceFolderData(res.data);
                          }
                          setIsLoadingFolder(false);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                      >
                        <History className={`w-3.5 h-3.5 text-cyan-400 ${isLoadingFolder ? 'animate-spin' : ''}`} />
                        <span>{language === 'ar' ? 'تحديث المجلد' : 'Refresh Folder'}</span>
                      </button>
                    </div>

                    {/* Hierarchy 4/5 Level Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                      <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                        <div className="text-slate-400 text-[11px] font-semibold mb-1 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{language === 'ar' ? '1. المنظمة (المجلد الرئيسي)' : '1. Organization (Root)'}</span>
                        </div>
                        <div className="text-white font-bold truncate">
                          {viewDeviceModal.organization || deviceFolderData?.hierarchy?.organization || 'الهيئة العامة للاتصالات والمعلوماتية'}
                        </div>
                      </div>

                      <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                        <div className="text-slate-400 text-[11px] font-semibold mb-1 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                          <span>{language === 'ar' ? '2. الدائرة التابعة' : '2. Directorate'}</span>
                        </div>
                        <div className="text-white font-bold truncate">
                          {viewDeviceModal.directorate || deviceFolderData?.hierarchy?.directorate || 'دائرة تكنولوجيا المعلومات والاتصالات'}
                        </div>
                      </div>

                      <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                        <div className="text-slate-400 text-[11px] font-semibold mb-1 flex items-center gap-1.5">
                          <Folder className="w-3.5 h-3.5 text-amber-400" />
                          <span>{language === 'ar' ? '3. القسم الإداري' : '3. Department'}</span>
                        </div>
                        <div className="text-white font-bold truncate">
                          {language === 'ar' ? (viewDeviceModal.departmentAr || viewDeviceModal.department) : viewDeviceModal.department}
                        </div>
                      </div>

                      <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                        <div className="text-slate-400 text-[11px] font-semibold mb-1 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{language === 'ar' ? '4. الشعبة (إن وُجدت)' : '4. Division (If any)'}</span>
                        </div>
                        <div className="text-white font-bold truncate">
                          {viewDeviceModal.division || deviceFolderData?.hierarchy?.division || (language === 'ar' ? '— بدون شعبة —' : '— None —')}
                        </div>
                      </div>
                    </div>

                    {/* Exact Disk Storage Path */}
                    <div className="bg-slate-950/80 border border-emerald-900/60 p-3 rounded-xl flex flex-col gap-1 font-mono text-xs">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11px]">
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'مسار مجلد الأصل في أرشيف الأصول (Asset Archive):' : 'Physical Asset Archive Storage Path:'}</span>
                      </div>
                      <div className="text-emerald-200 bg-slate-900/90 p-2 rounded-lg border border-slate-800 break-all select-all">
                        asset archive / {deviceFolderData?.relativePath || viewDeviceModal.folderPath || `${viewDeviceModal.department}/${viewDeviceModal.deviceCode}`}
                      </div>
                    </div>
                  </div>

                  {/* Files inside device folder */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-emerald-400" />
                        <h4 className="font-bold text-white text-xs sm:text-sm">
                          {language === 'ar' ? 'الملفات والوثائق المحفوظة في مجلد الأصل' : 'Documents & Files in Device Folder'}
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-bold">
                          {deviceFolderData?.files?.length || 0}
                        </span>
                      </div>

                      {/* Upload new file button */}
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-xs cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isUploadingToFolder ? (language === 'ar' ? 'جاري الرفع...' : 'Uploading...') : (language === 'ar' ? 'إضافة وثيقة للمجلد' : 'Add File to Folder')}</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setIsUploadingToFolder(true);
                            try {
                              const reader = new FileReader();
                              reader.onload = async () => {
                                await uploadToDeviceFolder(viewDeviceModal.id, file.name, reader.result as string);
                                const res = await getDeviceFolder(viewDeviceModal.id);
                                if (res.success && res.data) {
                                  setDeviceFolderData(res.data);
                                }
                              };
                              reader.readAsDataURL(file);
                            } finally {
                              setIsUploadingToFolder(false);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {isLoadingFolder ? (
                      <div className="text-center py-8 text-slate-400 bg-slate-800/40 rounded-xl border border-slate-700">
                        <History className="w-6 h-6 mx-auto mb-2 animate-spin text-cyan-400" />
                        <p>{language === 'ar' ? 'جاري فحص محتويات مجلد الجهاز...' : 'Reading device folder files...'}</p>
                      </div>
                    ) : (!deviceFolderData?.files || deviceFolderData.files.length === 0) ? (
                      <div className="text-center py-8 text-slate-400 bg-slate-800/40 rounded-xl border border-slate-700">
                        <Folder className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                        <p>{language === 'ar' ? 'المجلد فارغ حالياً، سيتم توليد بطاقة الجهاز عند التحديث.' : 'Device folder is currently empty.'}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {deviceFolderData.files.map((file: any, idx: number) => {
                          const isReceipt = file.isReceipt || file.name.toLowerCase().includes('receipt') || file.name.toLowerCase().includes('فاتورة');
                          const isJson = file.name.endsWith('.json');
                          const isTxt = file.name.endsWith('.txt');

                          return (
                            <div 
                              key={file.name || idx}
                              className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 ${
                                isReceipt 
                                  ? 'bg-cyan-950/30 border-cyan-700/60 shadow-inner' 
                                  : isJson 
                                    ? 'bg-slate-800/80 border-slate-700' 
                                    : 'bg-slate-800/60 border-slate-700/70'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                  isReceipt 
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                                    : isJson
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                      : 'bg-slate-700 text-slate-300'
                                }`}>
                                  {isReceipt ? <Paperclip className="w-4 h-4" /> : isJson ? <Cpu className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white text-xs truncate block" title={file.name}>
                                      {file.name}
                                    </span>
                                    {isReceipt && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded-sm bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold shrink-0">
                                        {language === 'ar' ? 'فاتورة الشراء' : 'Receipt'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                                    <span className="font-mono text-cyan-400 font-semibold">{file.sizeFormatted}</span>
                                    <span>•</span>
                                    <span>{new Date(file.modifiedAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/50">
                                <a
                                  href={file.downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 hover:text-white border border-cyan-500/40 text-xs font-bold transition flex items-center gap-1.5"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>{language === 'ar' ? 'معاينة / فتح' : 'Preview'}</span>
                                </a>

                                <a
                                  href={file.downloadUrl}
                                  download={file.name}
                                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>{language === 'ar' ? 'تنزيل' : 'Download'}</span>
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeDetailTab === 'overview' && (
                <div className="space-y-6">
                  {/* Quick specs grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
                      <span className="text-[11px] text-slate-400 block">{language === 'ar' ? 'القسم الحالي' : 'Current Department'}</span>
                      <span className="text-sm font-bold text-white mt-1 block">
                        {language === 'ar' ? (viewDeviceModal.departmentAr || viewDeviceModal.department) : viewDeviceModal.department}
                      </span>
                    </div>

                    <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
                      <span className="text-[11px] text-slate-400 block">{language === 'ar' ? 'حالة التشغيل' : 'Operational Status'}</span>
                      <span className="text-sm font-bold text-emerald-400 mt-1 block">{viewDeviceModal.status}</span>
                    </div>

                    <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
                      <span className="text-[11px] text-slate-400 block">{language === 'ar' ? 'الرقم التسلسلي (Serial No)' : 'Serial Number'}</span>
                      <span className="text-sm font-mono font-bold text-cyan-300 mt-1 block">{viewDeviceModal.serialNumber || 'N/A'}</span>
                    </div>

                    <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
                      <span className="text-[11px] text-slate-400 block">{language === 'ar' ? 'تاريخ الشراء' : 'Date of Purchase'}</span>
                      <span className="text-sm font-mono font-bold text-white mt-1 block">{viewDeviceModal.dateOfPurchase}</span>
                    </div>

                    <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
                      <span className="text-[11px] text-slate-400 block">{language === 'ar' ? 'تاريخ بدء الضمان' : 'Warranty Start Date'}</span>
                      <span className="text-sm font-mono font-bold text-white mt-1 block">{viewDeviceModal.warrantyStartDate}</span>
                    </div>

                    <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
                      <span className="text-[11px] text-slate-400 block">{language === 'ar' ? 'مدة الضمان وحالته' : 'Warranty Period & Status'}</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-sm font-bold text-white">{viewDeviceModal.warrantyPeriod}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          viewDeviceModal.isWarrantyActive 
                            ? 'bg-emerald-500/20 text-emerald-300' 
                            : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {viewDeviceModal.isWarrantyActive 
                            ? (language === 'ar' ? 'ساري حتى ' + viewDeviceModal.warrantyExpiryDate : 'Active until ' + viewDeviceModal.warrantyExpiryDate)
                            : (language === 'ar' ? 'منتهي بتاريخ ' + viewDeviceModal.warrantyExpiryDate : 'Expired on ' + viewDeviceModal.warrantyExpiryDate)}
                        </span>
                      </div>
                    </div>

                    {viewDeviceModal.ipAddress && (
                      <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
                        <span className="text-[11px] text-slate-400 block">{language === 'ar' ? 'عنوان IP' : 'IP Address'}</span>
                        <span className="text-sm font-mono font-bold text-cyan-300 mt-1 block">{viewDeviceModal.ipAddress}</span>
                      </div>
                    )}

                    {viewDeviceModal.macAddress && (
                      <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
                        <span className="text-[11px] text-slate-400 block">{language === 'ar' ? 'عنوان MAC' : 'MAC Address'}</span>
                        <span className="text-sm font-mono font-bold text-slate-300 mt-1 block">{viewDeviceModal.macAddress}</span>
                      </div>
                    )}

                    {viewDeviceModal.location && (
                      <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
                        <span className="text-[11px] text-slate-400 block">{language === 'ar' ? 'الموقع الفعلي / الغرفة' : 'Physical Location'}</span>
                        <span className="text-sm font-bold text-slate-200 mt-1 block">{viewDeviceModal.location}</span>
                      </div>
                    )}

                    {viewDeviceModal.assignedEmployee && (
                      <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
                        <span className="text-[11px] text-slate-400 block">{language === 'ar' ? 'الموظف المسند إليه' : 'Assigned Employee'}</span>
                        <span className="text-sm font-bold text-slate-200 mt-1 block">{viewDeviceModal.assignedEmployee}</span>
                      </div>
                    )}
                  </div>

                  {/* Timeline Highlights Preview Card */}
                  <div className="bg-gradient-to-r from-slate-900 via-cyan-950/20 to-slate-900 p-4 rounded-xl border border-cyan-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs sm:text-sm">
                            {language === 'ar' ? 'الخط الزمني الموحد للأصل' : 'Lifecycle Event Timeline'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            {(viewDeviceModal.departmentHistory?.length || 0) + (viewDeviceModal.maintenanceHistory?.length || 0) + 1} {language === 'ar' ? 'محطات' : 'events'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {language === 'ar'
                            ? 'تسلسل زمني تفاعلي يدمج أوامر الصيانة الدورية والطارئة، استبدال القطع، وتحويلات الأقسام منذ الشراء.'
                            : 'Interactive chronological sequence combining routine/emergency maintenance, parts replacements, and department transfers.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab('timeline')}
                      className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'استعراض الخط الزمني' : 'Open Timeline'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Purchase Receipt Attachment in Device Details */}
                  {viewDeviceModal.purchaseReceipt && (
                    <div className="bg-slate-800/60 p-4 rounded-xl border border-cyan-800/60 flex items-center justify-between gap-3 shadow-inner">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 border border-cyan-500/40">
                          <Paperclip className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[11px] text-slate-400 block font-medium">
                            {language === 'ar' ? 'فاتورة / إيصال الشراء المرفق:' : 'Attached Purchase Receipt:'}
                          </span>
                          <span className="text-sm font-bold text-white block truncate">
                            {typeof viewDeviceModal.purchaseReceipt === 'object' 
                              ? viewDeviceModal.purchaseReceipt.name 
                              : (language === 'ar' ? 'مستند إيصال الشراء' : 'Purchase Receipt Document')}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof viewDeviceModal.purchaseReceipt === 'object') {
                            setViewReceiptModal(viewDeviceModal.purchaseReceipt);
                          } else if (typeof viewDeviceModal.purchaseReceipt === 'string') {
                            setViewReceiptModal({
                              name: 'Purchase_Receipt_' + viewDeviceModal.deviceCode,
                              dataUrl: viewDeviceModal.purchaseReceipt,
                              type: 'application/pdf'
                            });
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>{language === 'ar' ? 'عرض الفاتورة' : 'View Receipt'}</span>
                      </button>
                    </div>
                  )}

                  {viewDeviceModal.notes && (
                    <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 space-y-1">
                      <span className="text-[11px] font-bold text-slate-400">{language === 'ar' ? 'ملاحظات وتفاصيل إضافية:' : 'Additional Notes / Specifications:'}</span>
                      <p className="text-slate-300 leading-relaxed">{viewDeviceModal.notes}</p>
                    </div>
                  )}

                  {/* Actions inside Modal */}
                  {canEdit && (
                    <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                      <button
                        onClick={() => handleOpenTransfer(viewDeviceModal)}
                        className="px-3.5 py-2 rounded-xl bg-purple-600/30 text-purple-300 hover:bg-purple-600/40 border border-purple-500/40 font-bold transition flex items-center space-x-1.5 cursor-pointer"
                      >
                        <ArrowRightLeft className="w-4 h-4 mx-1" />
                        <span>{language === 'ar' ? 'تحويل لقسم آخر' : 'Transfer Department'}</span>
                      </button>

                      <button
                        onClick={() => handleOpenMaintenance(viewDeviceModal)}
                        className="px-3.5 py-2 rounded-xl bg-amber-600/30 text-amber-300 hover:bg-amber-600/40 border border-amber-500/40 font-bold transition flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Wrench className="w-4 h-4 mx-1" />
                        <span>{language === 'ar' ? 'إضافة سجل صيانة' : 'Add Maintenance Log'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: UNIFIED LIFECYCLE TIMELINE VISUALIZATION */}
              {activeDetailTab === 'timeline' && (
                <AssetTimelineView
                  device={viewDeviceModal}
                  centralMaintenanceRecords={maintenanceRecords}
                  onOpenMaintenance={() => handleOpenMaintenance(viewDeviceModal)}
                  onOpenTransfer={() => handleOpenTransfer(viewDeviceModal)}
                  onPreviewDocument={(doc) => setSelectedDocPreview(doc)}
                  onSelectTicket={(ticketNo) => {
                    const found = tickets.find(t => t.ticketNo === ticketNo || String(t.id) === ticketNo);
                    if (found) setSelectedTicketId(String(found.id));
                  }}
                />
              )}

              {/* TAB 2: DEPARTMENT HISTORY LIST */}
              {activeDetailTab === 'departments' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        {language === 'ar' ? 'سجل تحويلات الجهاز بين الإدارات والأقسام' : 'Department Assignment & Transfer History'}
                      </h4>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {language === 'ar'
                          ? 'قائمة توضح كافة الأقسام التي كان يتبع لها هذا الجهاز منذ تاريخ شرائه وحتى الآن.'
                          : 'List of all departments this device was previously assigned to with transfer justifications.'}
                      </p>
                    </div>

                    {canEdit && (
                      <button
                        onClick={() => handleOpenTransfer(viewDeviceModal)}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition flex items-center space-x-1 cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 mx-1" />
                        <span>{language === 'ar' ? 'تحويل الآن' : 'Transfer Now'}</span>
                      </button>
                    )}
                  </div>

                  {/* Current Active Department Badge */}
                  <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/60 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-600/30 border border-purple-500/50 flex items-center justify-center text-purple-300">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                          {language === 'ar' ? 'القسم الحالي النشط' : 'Current Active Assignment'}
                        </span>
                        <span className="text-sm font-bold text-white">
                          {language === 'ar' ? (viewDeviceModal.departmentAr || viewDeviceModal.department) : viewDeviceModal.department}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {language === 'ar' ? 'نشط حالياً' : 'Active'}
                    </span>
                  </div>

                  {/* Previous Historical Departments Timeline */}
                  {(!viewDeviceModal.departmentHistory || viewDeviceModal.departmentHistory.length === 0) ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-800/30 rounded-xl border border-slate-800">
                      <History className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      <p>{language === 'ar' ? 'لم يتم تحويل هذا الجهاز من قبل، القسم الحالي هو القسم الأصلي منذ تاريخ الشراء.' : 'No previous department transfers recorded. This device has remained in its initial department.'}</p>
                    </div>
                  ) : (
                    <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-700/60">
                      {viewDeviceModal.departmentHistory.map((item, idx) => (
                        <div key={item.id || idx} className="relative pl-8 space-y-1">
                          <div className="absolute left-2 top-2 w-3 h-3 rounded-full bg-purple-500 border-2 border-slate-900" />
                          <div className="bg-slate-800/70 p-3.5 rounded-xl border border-slate-700/70 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-xs">
                                {language === 'ar' ? (item.departmentAr || item.department) : item.department}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                {item.transferredDate || item.assignedDate}
                              </span>
                            </div>

                            <div className="text-slate-300 text-xs">
                              <span className="text-slate-400">{language === 'ar' ? 'سبب التحويل: ' : 'Reason: '}</span>
                              {item.reason || (language === 'ar' ? 'إعادة توزيع الأصول التقنية' : 'Asset reassignment')}
                            </div>

                            {item.transferredBy && (
                              <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                                <UserCheck className="w-3 h-3 text-cyan-400 mx-1" />
                                <span>{language === 'ar' ? 'بواسطة: ' : 'Transferred by: '}</span>
                                <span className="text-slate-300 font-semibold">{item.transferredBy}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: MAINTENANCE HISTORY */}
              {activeDetailTab === 'maintenance' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        {language === 'ar' ? 'سجل الصيانة الدورية والدعم الفني' : 'Maintenance & Repair History Log'}
                      </h4>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {language === 'ar'
                          ? 'توثيق كافة عمليات الصيانة، الإصلاح، استبدال القطع، وترقيات العتاد.'
                          : 'Document all maintenance procedures, part replacements, hardware upgrades, and inspections.'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleOpenMaintenance(viewDeviceModal)}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 mx-1" />
                      <span>{language === 'ar' ? 'إضافة سجل' : 'Log Maintenance'}</span>
                    </button>
                  </div>

                  {(!viewDeviceModal.maintenanceHistory || viewDeviceModal.maintenanceHistory.length === 0) ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-800/30 rounded-xl border border-slate-800">
                      <Wrench className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      <p>{language === 'ar' ? 'لا توجد سجلات صيانة مسجلة لهذا الجهاز حتى الآن.' : 'No maintenance records registered for this device yet.'}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {viewDeviceModal.maintenanceHistory.map((maint, idx) => (
                        <div key={maint.id || idx} className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                                maint.type === 'Repair' 
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : maint.type === 'Upgrade'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : maint.type === 'Inspection'
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}>
                                {maint.type}
                              </span>
                              <span className="font-bold text-white text-xs">{maint.performedBy}</span>
                            </div>

                            <div className="flex items-center space-x-2 font-mono text-[11px] text-slate-400">
                              <span>{maint.date}</span>
                              {maint.cost !== undefined && maint.cost > 0 && (
                                <span className="text-emerald-400 font-bold">
                                  {maint.cost.toLocaleString('en-US')} {language === 'ar' ? 'د.ع' : 'IQD'}
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-slate-200 text-xs leading-relaxed">
                            {maint.description}
                          </p>

                          {maint.notes && (
                            <p className="text-slate-400 text-[11px] italic bg-slate-900/60 p-2 rounded-lg">
                              {maint.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                ID: {viewDeviceModal.id} • Created: {new Date(viewDeviceModal.createdAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => setViewDeviceModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: REGISTER / EDIT DEVICE */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div 
            className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            dir={dir}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 shrink-0">
                  <Laptop className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">
                    {editingDevice 
                      ? (language === 'ar' ? 'تعديل بيانات ومواصفات الأصل' : 'Edit Asset Specifications')
                      : (language === 'ar' ? 'إدخال أصل تقني أو شبكي جديد' : 'Register New Asset')}
                  </h2>
                  <p className="text-sm text-slate-300 mt-1">
                    {language === 'ar'
                      ? 'أدخل بيانات الماركة، الموديل، فترات الضمان، القسم، وفاتورة الشراء وسجل الأصل'
                      : 'Provide brand, model, warranty periods, department assignment, and purchase receipt'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title={language === 'ar' ? 'إغلاق' : 'Close'}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Form: Every field is full modal width with larger font */}
            <form onSubmit={handleSubmitDevice} className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 text-sm sm:text-base">
              
              {/* 1. Asset Type Selection (Unified Dropdown List) */}
              <div className="w-full">
                <label className="block text-slate-200 font-bold mb-2 text-sm sm:text-base">
                  {language === 'ar' ? 'نوع الأصل / تصنيف الجهاز *' : 'Asset / Device Type *'}
                </label>
                <select
                  value={`${formCategory}:${formDeviceType}`}
                  onChange={(e) => {
                    const [cat, dt] = e.target.value.split(':');
                    setFormCategory(cat as DeviceCategory);
                    setFormDeviceType(dt as DeviceType);
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base focus:outline-hidden focus:border-cyan-500 font-medium cursor-pointer shadow-xs"
                >
                  <optgroup label={language === 'ar' ? '— الأجهزة الإلكترونية والمكتبية —' : '— Electronic & Office Devices —'}>
                    <option value="electronic:Computer">{language === 'ar' ? 'حاسوب شخصي / مكتبي / محمول (Computer / Laptop)' : 'Computer / PC / Laptop'}</option>
                    <option value="electronic:Printer">{language === 'ar' ? 'طابعة مستندات أو باركود (Printer)' : 'Printer / Barcode'}</option>
                    <option value="electronic:Screen">{language === 'ar' ? 'شاشة عرض / مونيتور (Screen / Monitor)' : 'Screen / Monitor'}</option>
                    <option value="electronic:Fingerprint device">{language === 'ar' ? 'جهاز بصمة حضور وانصراف (Fingerprint Device)' : 'Fingerprint Device'}</option>
                    <option value="electronic:Scanner">{language === 'ar' ? 'ماسح ضوئي / قارئ باركود (Scanner)' : 'Scanner / Barcode Reader'}</option>
                  </optgroup>
                  <optgroup label={language === 'ar' ? '— عتاد وتجهيزات الشبكات —' : '— Network Hardware —'}>
                    <option value="network:router">{language === 'ar' ? 'راوتر شبكة (Router)' : 'Router (Network)'}</option>
                    <option value="network:switch">{language === 'ar' ? 'سويتش / موزع شبكة (Switch)' : 'Switch (Network)'}</option>
                    <option value="network:access point">{language === 'ar' ? 'نقطة وصول لاسلكية (Access Point)' : 'Access Point (Wireless)'}</option>
                  </optgroup>
                </select>
                <p className="text-xs text-slate-400 mt-1.5">
                  {language === 'ar' 
                    ? 'اختر نوع الجهاز المحدد بدقة لتحديد الفئة المناسبة وتنسيق الصيانة والعهد'
                    : 'Select the specific device type to accurately categorize the asset'}
                </p>
              </div>

              {/* Asset ID & Code Sequence Preview */}
              <div className="w-full bg-slate-950/80 border border-emerald-800/80 p-4 rounded-xl shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-bold text-xs sm:text-sm">
                      {language === 'ar' ? 'معرّف الأصل ورمز الجهاز (Asset ID):' : 'Asset ID & Device Code:'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-bold">
                    {language === 'ar' ? `تسلسل مرقم لقسم: ${formDepartment}` : `Sequence for: ${formDepartment}`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-mono text-xl sm:text-2xl font-black text-emerald-300 bg-slate-900 px-4 py-2 rounded-lg border border-emerald-600/80 tracking-wider shadow-inner">
                    {calculatedAssetId}
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed">
                    {language === 'ar'
                      ? `رمز الجهاز (${getDeviceCodePrefix(formDeviceType, formCategory)}) + تسلسل عددي تتابعي خاص بقسم الموظف. يُنشأ مجلد الأصل بهذا المعرّف في أرشيف الأصول.`
                      : `Device code (${getDeviceCodePrefix(formDeviceType, formCategory)}) + sequential number for this department. The asset folder is named after this ID in asset archive.`}
                  </div>
                </div>
              </div>

              {/* 2. Device User / Custodian Selection (المستخدم / الموظف المسند إليه الجهاز) */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-slate-200 font-bold text-sm sm:text-base">
                    {language === 'ar' ? 'المستخدم / الموظف المسند إليه الجهاز (أمين العهدة) *' : 'Assigned User / Custodian *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualEmployee(!isManualEmployee);
                    }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium underline cursor-pointer"
                  >
                    {isManualEmployee 
                      ? (language === 'ar' ? '← اختيار من قائمة موظفي النظام' : '← Choose from System Users')
                      : (language === 'ar' ? '+ إدخال اسم موظف يدوياً' : '+ Enter custom employee name')}
                  </button>
                </div>

                {!isManualEmployee ? (
                  <select
                    value={formAssignedEmployee}
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      if (selectedVal === '__manual__') {
                        setIsManualEmployee(true);
                        setFormAssignedEmployee('');
                        return;
                      }
                      setFormAssignedEmployee(selectedVal);
                      
                      // Find chosen user to auto-extract their department
                      const selectedUser = (users || []).find(u => 
                        (u.fullName || u.userName || u.email) === selectedVal ||
                        u.id === selectedVal ||
                        u.uid === selectedVal
                      );

                      if (selectedUser && selectedUser.department) {
                        const matchedDept = orgDepts.find(d => 
                          isSameDepartment(d.nameEn, selectedUser.department) || 
                          isSameDepartment(d.nameAr, selectedUser.department)
                        );
                        const resolvedDeptEn = matchedDept ? matchedDept.nameEn : selectedUser.department;
                        const resolvedDeptAr = matchedDept ? matchedDept.nameAr : selectedUser.department;
                        setFormDepartment(resolvedDeptEn);
                        setFormDepartmentAr(resolvedDeptAr);
                        setFormDivision('');
                        setFormDivisionAr('');
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base focus:outline-hidden focus:border-cyan-500 font-medium cursor-pointer shadow-xs"
                  >
                    <option value="">{language === 'ar' ? '— اختر الموظف المسند إليه الجهاز من النظام —' : '— Select Assigned Employee / User —'}</option>
                    {(users || []).map(u => {
                      const name = u.fullName || u.userName || u.email;
                      return (
                        <option key={u.id || u.uid || name} value={name}>
                          {name} {u.department ? `— [${language === 'ar' ? 'قسم:' : 'Dept:'} ${u.department}]` : ''}
                        </option>
                      );
                    })}
                    <option value="__manual__">
                      {language === 'ar' ? '➕ موظف آخر / إدخال يدوي...' : '➕ Other / Custom Name (Manual entry)...'}
                    </option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formAssignedEmployee}
                      onChange={(e) => setFormAssignedEmployee(e.target.value)}
                      placeholder={language === 'ar' ? 'مثال: محمد عبد الله (فريق الدعم الفني)' : 'e.g. Mohammed Abdullah'}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base focus:outline-hidden focus:border-cyan-500 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setIsManualEmployee(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs whitespace-nowrap cursor-pointer"
                    >
                      {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                )}

                {formAssignedEmployee && (
                  <div className="mt-2 p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>
                      {language === 'ar'
                        ? `تم تحديد قسم الجهاز تلقائياً حسب قسم الموظف المختار (${formDepartmentAr || formDepartment})، وتم ربط اسم المنظمة والدائرة من الهيكل التنظيمي.`
                        : `Device department auto-set from selected user (${formDepartment}), with org & directorate linked from org structure.`}
                    </span>
                  </div>
                )}
              </div>

              {/* 3. Department Selection (Entire modal width, sourced from Org Structure) */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-slate-200 font-bold text-sm sm:text-base">
                    {language === 'ar' ? 'القسم / الوحدة الإدارية التابع لها الأصل *' : 'Department / Administrative Unit *'}
                  </label>
                  <span className="text-xs text-slate-400">
                    {language === 'ar' ? '(تؤخذ المنظمة والدائرة تلقائياً من الهيكل حسب القسم)' : '(Org & Directorate auto-resolved from Org Structure)'}
                  </span>
                </div>
                <select
                  required
                  value={formDepartment}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormDepartment(val);
                    const matched = orgDepts.find(d => d.nameEn === val || d.nameAr === val);
                    if (matched) {
                      setFormDepartmentAr(matched.nameAr);
                    }
                    // Reset division if it does not belong to new department
                    setFormDivision('');
                    setFormDivisionAr('');
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base focus:outline-hidden focus:border-cyan-500 font-medium cursor-pointer shadow-xs"
                >
                  {orgDepts.map(dept => (
                    <option key={dept.id || dept.nameEn} value={dept.nameEn}>
                      {language === 'ar' 
                        ? `${dept.nameAr} (${dept.nameEn})` 
                        : `${dept.nameEn} — ${dept.nameAr}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Division Selection (Optional / If Exists) */}
              <div className="w-full">
                <label className="block text-slate-200 font-bold mb-2 text-sm sm:text-base flex items-center justify-between">
                  <span>{language === 'ar' ? 'اسم الشعبة (إن وُجدت)' : 'Division Name (If exists)'}</span>
                  <span className="text-xs text-cyan-400 font-normal">
                    {language === 'ar' ? '(اختياري)' : '(Optional)'}
                  </span>
                </label>
                {resolvedOrgHierarchy.availableDivisions.length > 0 ? (
                  <select
                    value={formDivision}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormDivision(val);
                      const divMatched = resolvedOrgHierarchy.availableDivisions.find(d => d.nameEn === val || d.nameAr === val);
                      setFormDivisionAr(divMatched ? divMatched.nameAr : val);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base focus:outline-hidden focus:border-cyan-500 cursor-pointer shadow-xs"
                  >
                    <option value="">{language === 'ar' ? '— بدون شعبة محددة —' : '— No specific division —'}</option>
                    {resolvedOrgHierarchy.availableDivisions.map(div => (
                      <option key={div.id} value={div.nameAr || div.nameEn}>
                        {language === 'ar' ? div.nameAr : div.nameEn}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formDivision}
                    onChange={(e) => {
                      setFormDivision(e.target.value);
                      setFormDivisionAr(e.target.value);
                    }}
                    placeholder={language === 'ar' ? 'مثال: شعبة الدعم الفني، شعبة الشبكات، شعبة الأرشفة...' : 'e.g. Technical Support Division'}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base focus:outline-hidden focus:border-cyan-500 shadow-xs"
                  />
                )}
              </div>

              {/* 5. Organizational Hierarchy & Device Folder Path Preview Card */}
              <div className="w-full bg-linear-to-br from-slate-900/90 via-slate-900 to-cyan-950/30 border border-cyan-700/60 rounded-2xl p-4 sm:p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm sm:text-base">
                    <FolderTree className="w-5 h-5 text-cyan-400 shrink-0" />
                    <span>{language === 'ar' ? 'هرمية مجلد الجهاز في الهيكل التنظيمي' : 'Device Folder Hierarchy in Org Structure'}</span>
                  </div>
                  <span className="text-xs bg-cyan-950/80 text-cyan-300 border border-cyan-600/50 px-2.5 py-0.5 rounded-full font-mono">
                    {language === 'ar' ? 'تخزين تلقائي على القرص' : 'Auto Disk Storage'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs sm:text-sm">
                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/70">
                    <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                      {language === 'ar' ? '1. المجلد الرئيسي (المنظمة)' : '1. Root Folder (Org)'}
                    </div>
                    <div className="text-white font-bold truncate">
                      {language === 'ar' ? resolvedOrgHierarchy.organizationAr : resolvedOrgHierarchy.organizationEn}
                    </div>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/70">
                    <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                      {language === 'ar' ? '2. مجلد الدائرة' : '2. Directorate'}
                    </div>
                    <div className="text-white font-bold truncate">
                      {language === 'ar' ? resolvedOrgHierarchy.directorateAr : resolvedOrgHierarchy.directorateEn}
                    </div>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/70">
                    <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5 text-amber-400" />
                      {language === 'ar' ? '3. مجلد القسم' : '3. Department'}
                    </div>
                    <div className="text-white font-bold truncate">
                      {language === 'ar' ? resolvedOrgHierarchy.departmentAr : resolvedOrgHierarchy.departmentEn}
                    </div>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/70">
                    <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-emerald-400" />
                      {language === 'ar' ? '4. الشعبة (إن وجدت)' : '4. Division (If exists)'}
                    </div>
                    <div className="text-white font-bold truncate">
                      {formDivision ? formDivision : (language === 'ar' ? '— بدون شعبة —' : '— None —')}
                    </div>
                  </div>
                </div>

                {/* Storage Path Summary in Asset Archive */}
                <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <FolderOpen className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-semibold text-slate-400">
                      {language === 'ar' ? 'مسار مجلد الأصل في أرشيف الأصول (Asset Archive):' : 'Asset Archive Storage Path:'}
                    </span>
                  </div>
                  <div className="font-mono text-cyan-200 bg-slate-950/80 border border-cyan-800/60 p-2.5 rounded-xl break-all leading-relaxed">
                    <span className="text-emerald-400 font-bold">asset archive</span>
                    {' / '}
                    {language === 'ar' ? resolvedOrgHierarchy.directorateAr : resolvedOrgHierarchy.directorateEn}
                    {' / '}
                    {language === 'ar' ? resolvedOrgHierarchy.departmentAr : resolvedOrgHierarchy.departmentEn}
                    {' / '}
                    <span className="text-amber-300 font-bold bg-amber-500/10 px-1 rounded">
                      {calculatedAssetId}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {language === 'ar'
                      ? 'يتم إنشاء مجلد الأصل داخل مجلد قسم الموظف والدائرة التابعة له باسم رمز الأصل (Asset ID)، وتُحفظ بداخله كافة وثائق ومستندات الأصل وفاتورة الشراء تلقائياً.'
                      : 'Asset folder is created inside the user department and directorate folder named after the Asset ID, storing all asset documents and purchase receipt.'}
                  </p>
                </div>
              </div>

              {/* 3. Brand / Manufacturer (Entire modal width) */}
              <div className="w-full">
                <label className="block text-slate-200 font-bold mb-2 text-sm sm:text-base">
                  {language === 'ar' ? 'العلامة التجارية / الشركة المصنعة (Brand) *' : 'Brand / Manufacturer *'}
                </label>
                <input
                  type="text"
                  required
                  value={formBrand}
                  onChange={(e) => setFormBrand(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: Dell, HP, Cisco, Canon, ZKTeco, Lenovo, Apple' : 'e.g. Dell, HP, Cisco, Canon, ZKTeco, Lenovo'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base focus:outline-hidden focus:border-cyan-500 shadow-xs"
                />
              </div>

              {/* 4. Model & Specifications (Entire modal width) */}
              <div className="w-full">
                <label className="block text-slate-200 font-bold mb-2 text-sm sm:text-base">
                  {language === 'ar' ? 'الموديل والمواصفات (Model & Specs) *' : 'Model & Specifications *'}
                </label>
                <input
                  type="text"
                  required
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: OptiPlex 7090 Tower Core i7 32GB, LaserJet M608dn, Catalyst 2960' : 'e.g. OptiPlex 7090, LaserJet M608dn, Catalyst 2960'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base focus:outline-hidden focus:border-cyan-500 shadow-xs"
                />
              </div>

              {/* 5. Serial Number / Asset Tag (Entire modal width) */}
              <div className="w-full">
                <label className="block text-slate-200 font-bold mb-2 text-sm sm:text-base">
                  {language === 'ar' ? 'الرقم التسلسلي / كود الأصل (Serial Number / Asset Tag)' : 'Serial Number / Asset Tag'}
                </label>
                <input
                  type="text"
                  value={formSerialNumber}
                  onChange={(e) => setFormSerialNumber(e.target.value)}
                  placeholder="e.g. SN-883910-US / DL-7090-88341"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base font-mono focus:outline-hidden focus:border-cyan-500 shadow-xs"
                />
              </div>

              {/* 6. Operational Status (Entire modal width) */}
              <div className="w-full">
                <label className="block text-slate-200 font-bold mb-2 text-sm sm:text-base">
                  {language === 'ar' ? 'الحالة التشغيلية للأصل *' : 'Operational Status *'}
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base focus:outline-hidden focus:border-cyan-500 cursor-pointer shadow-xs"
                >
                  <option value="Operational">{language === 'ar' ? 'Operational (يعمل بكفاءة)' : 'Operational (Active & Working)'}</option>
                  <option value="Under Maintenance">{language === 'ar' ? 'Under Maintenance (تحت الصيانة)' : 'Under Maintenance'}</option>
                  <option value="Storage">{language === 'ar' ? 'Storage (في المخزن / احتياطي)' : 'Storage (In Reserve)'}</option>
                  <option value="Retired">{language === 'ar' ? 'Retired (متقاعد / خارج الخدمة)' : 'Retired (Out of Service)'}</option>
                </select>
              </div>

              {/* 7. Date of Purchase (Entire modal width) */}
              <div className="w-full">
                <label className="block text-slate-200 font-bold mb-2 text-sm sm:text-base">
                  {language === 'ar' ? 'تاريخ الشراء (Date of Purchase) *' : 'Date of Purchase *'}
                </label>
                <input
                  type="date"
                  required
                  value={formDateOfPurchase}
                  onChange={(e) => {
                    setFormDateOfPurchase(e.target.value);
                    if (!formWarrantyStartDate) setFormWarrantyStartDate(e.target.value);
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base focus:outline-hidden focus:border-cyan-500 shadow-xs"
                />
              </div>

              {/* 8. Warranty Start Date (Entire modal width) */}
              <div className="w-full">
                <label className="block text-slate-200 font-bold mb-2 text-sm sm:text-base">
                  {language === 'ar' ? 'تاريخ بدء الضمان (Warranty Start Date) *' : 'Warranty Start Date *'}
                </label>
                <input
                  type="date"
                  required
                  value={formWarrantyStartDate}
                  onChange={(e) => setFormWarrantyStartDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base focus:outline-hidden focus:border-cyan-500 shadow-xs"
                />
              </div>

              {/* 9. Warranty Period (Entire modal width) */}
              <div className="w-full">
                <label className="block text-slate-200 font-bold mb-2 text-sm sm:text-base">
                  {language === 'ar' ? 'فترة الضمان (Warranty Period) *' : 'Warranty Period *'}
                </label>
                <input
                  type="text"
                  required
                  value={formWarrantyPeriod}
                  onChange={(e) => setFormWarrantyPeriod(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: 12 شهر، 24 شهر، 3 سنوات' : 'e.g. 12 Months, 24 Months, 3 Years'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base focus:outline-hidden focus:border-cyan-500 shadow-xs"
                />
              </div>

              {/* 10. IP Address (Optional - Entire modal width) */}
              <div className="w-full">
                <label className="block text-slate-200 font-bold mb-2 text-sm sm:text-base">
                  {language === 'ar' ? 'عنوان IP (اختياري)' : 'IP Address (Optional)'}
                </label>
                <input
                  type="text"
                  value={formIpAddress}
                  onChange={(e) => setFormIpAddress(e.target.value)}
                  placeholder="e.g. 192.168.10.45"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base font-mono focus:outline-hidden focus:border-cyan-500 shadow-xs"
                />
              </div>

              {/* 11. MAC Address (Optional - Entire modal width) */}
              <div className="w-full">
                <label className="block text-slate-200 font-bold mb-2 text-sm sm:text-base">
                  {language === 'ar' ? 'عنوان MAC (اختياري)' : 'MAC Address (Optional)'}
                </label>
                <input
                  type="text"
                  value={formMacAddress}
                  onChange={(e) => setFormMacAddress(e.target.value)}
                  placeholder="e.g. 00:1A:2B:3C:4D:5E"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base font-mono focus:outline-hidden focus:border-cyan-500 shadow-xs"
                />
              </div>

              {/* 12. Physical Location / Room (Entire modal width) */}
              <div className="w-full">
                <label className="block text-slate-200 font-bold mb-2 text-sm sm:text-base">
                  {language === 'ar' ? 'الموقع الفعلي / الغرفة أو المكتب' : 'Physical Location / Room / Office'}
                </label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: المبنى الرئيسي - الطابق الثالث، غرفة الخوادم أ' : 'e.g. HQ Building - 3rd Floor, Server Room A'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base focus:outline-hidden focus:border-cyan-500 shadow-xs"
                />
              </div>

              {/* Purchase Receipt (Optional Attachment - Entire modal width) */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-slate-200 font-bold text-sm sm:text-base">
                    {language === 'ar' ? 'فاتورة / إيصال الشراء (مرفق اختياري)' : 'Purchase Receipt (Optional Attachment)'}
                  </label>
                  <span className="text-xs text-cyan-400 font-semibold">
                    {language === 'ar' ? '(اختياري)' : '(Optional)'}
                  </span>
                </div>

                {!formPurchaseReceipt ? (
                  <label className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-700 hover:border-cyan-500/70 rounded-2xl bg-slate-950/40 hover:bg-slate-950/70 transition cursor-pointer group shadow-inner">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-110 transition border border-cyan-500/30">
                      <Paperclip className="w-6 h-6" />
                    </div>
                    <p className="text-sm sm:text-base font-bold text-white mb-1 text-center">
                      {language === 'ar' ? 'انقر لرفع فاتورة الشراء أو اسحب الملف هنا' : 'Click to attach purchase receipt or drag & drop'}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 text-center">
                      {language === 'ar' 
                        ? 'يدعم صور PNG, JPG, JPEG أو ملفات PDF (حتى 10 ميجابايت)' 
                        : 'Supports PNG, JPG, JPEG, or PDF up to 10MB'}
                    </p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={handleReceiptUpload}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="w-full p-4 rounded-xl border border-cyan-800/70 bg-gradient-to-r from-slate-950 via-cyan-950/25 to-slate-950 flex items-center justify-between gap-3 shadow-inner">
                    <div className="flex items-center gap-3.5 overflow-hidden">
                      {formPurchaseReceipt.type?.includes('image') || formPurchaseReceipt.dataUrl?.startsWith('data:image') ? (
                        <img
                          src={formPurchaseReceipt.dataUrl}
                          alt="Receipt preview"
                          className="w-14 h-14 object-cover rounded-lg border border-cyan-600/50 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 border border-cyan-500/40">
                          <FileText className="w-7 h-7" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm sm:text-base font-bold text-white truncate">{formPurchaseReceipt.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formPurchaseReceipt.size ? `${(formPurchaseReceipt.size / 1024).toFixed(1)} KB` : 'Attached'}
                          {formPurchaseReceipt.uploadedAt && ` • ${new Date(formPurchaseReceipt.uploadedAt).toLocaleDateString()}`}
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold mt-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {language === 'ar' ? 'تم إرفاق فاتورة الشراء بنجاح' : 'Receipt attached'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {formPurchaseReceipt.dataUrl && (
                        <button
                          type="button"
                          onClick={() => setViewReceiptModal(formPurchaseReceipt)}
                          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
                          title={language === 'ar' ? 'معاينة الفاتورة' : 'Preview Receipt'}
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setFormPurchaseReceipt(null)}
                        className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition cursor-pointer"
                        title={language === 'ar' ? 'إزالة الفاتورة' : 'Remove Receipt'}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 15. Notes & Additional Details (Entire modal width) */}
              <div className="w-full">
                <label className="block text-slate-200 font-bold mb-2 text-sm sm:text-base">
                  {language === 'ar' ? 'ملاحظات وتفاصيل فنية إضافية' : 'Notes & Additional Technical Details'}
                </label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={language === 'ar' ? 'أي تفاصيل فنية، مواصفات رام أو معالج، أو شروط صيانة خاصة...' : 'Any technical specs, CPU, RAM, or special instructions...'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm sm:text-base focus:outline-hidden focus:border-cyan-500 shadow-xs"
                />
              </div>

              {/* 16. In-Form Warning Notice (Always visible above save) */}
              <div className="w-full p-4.5 rounded-xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 flex items-center gap-3.5 shadow-md">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                <div className="text-sm sm:text-base font-bold text-amber-300">
                  <span>{language === 'ar' ? 'إقرار صحة البيانات: "اتعهد بصحة جميع معلومات الجهاز"' : 'Data Accuracy Warning: "I certify the accuracy of all device information"'}</span>
                </div>
              </div>

              {/* Modal Footer / Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm sm:text-base font-bold transition cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm sm:text-base font-bold shadow-lg shadow-blue-500/25 transition cursor-pointer"
                >
                  {editingDevice 
                    ? (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes')
                    : (language === 'ar' ? 'حفظ الجهاز الجديد' : 'Register Device')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PLEDGE & WARNING CONFIRMATION MODAL UPON SAVING ASSET */}
      {/* ========================================================================= */}
      {showPledgeModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div 
            className="bg-slate-900 border-2 border-amber-500 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden p-6 sm:p-8 text-center space-y-5 animate-in fade-in zoom-in-95 duration-150"
            dir={dir}
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-500/50 text-amber-400 mx-auto flex items-center justify-center shadow-lg shadow-amber-500/25">
              <ShieldAlert className="w-9 h-9 stroke-[2.2]" />
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                {language === 'ar' ? 'تأكيد وإقرار تسجيل الجهاز' : 'Asset Information Verification'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300">
                {language === 'ar'
                  ? 'يُرجى مراجعة وتأكيد الإقرار والتعهد التالي لإتمام حفظ بيانات الجهاز في النظام:'
                  : 'Please review and confirm the following official pledge to save this asset:'}
              </p>
            </div>

            {/* The EXACT required warning message */}
            <div className="p-4 sm:p-5 rounded-xl bg-amber-500/20 border-2 border-amber-400 text-amber-200 shadow-inner">
              <p className="text-base sm:text-xl font-black tracking-wide leading-relaxed text-amber-300">
                "اتعهد بصحة جميع معلومات الجهاز"
              </p>
              <p className="text-xs text-amber-400/80 mt-1.5 font-mono">
                "I certify the accuracy of all device information"
              </p>
            </div>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {language === 'ar'
                ? 'بالضغط على "تأكيد الحفظ"، فإنك تقر وتتعهد بصحة ودقة كافة المواصفات والتواريخ والملحقات المدخلة لهذا الأصل في نظام إدارة الأصول.'
                : 'By confirming, you certify that all technical specifications, dates, serial numbers, and attachments entered for this asset are true and accurate.'}
            </p>

            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowPledgeModal(false)}
                className="flex-1 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm sm:text-base transition cursor-pointer"
              >
                {language === 'ar' ? 'مراجعة البيانات / تراجع' : 'Review Data / Back'}
              </button>

              <button
                type="button"
                onClick={handleConfirmSaveDevice}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm sm:text-base shadow-lg shadow-amber-500/30 transition cursor-pointer"
              >
                {language === 'ar' ? 'تأكيد الحفظ' : 'Confirm Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PURCHASE RECEIPT PREVIEW MODAL */}
      {/* ========================================================================= */}
      {viewReceiptModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5 min-w-0">
                <Paperclip className="w-5 h-5 text-cyan-400 shrink-0" />
                <h4 className="text-sm sm:text-base font-bold text-white truncate">{viewReceiptModal.name}</h4>
              </div>
              <button
                onClick={() => setViewReceiptModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-slate-950/70">
              {viewReceiptModal.dataUrl?.startsWith('data:image') || viewReceiptModal.type?.includes('image') ? (
                <img 
                  src={viewReceiptModal.dataUrl} 
                  alt={viewReceiptModal.name} 
                  className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg border border-slate-800" 
                />
              ) : (
                <iframe 
                  src={viewReceiptModal.dataUrl} 
                  title="Receipt Document" 
                  className="w-full h-[70vh] rounded-lg border border-slate-800" 
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ORGANIZATION DEVICE FOLDERS EXPLORER (DISK STORAGE TREE) */}
      {/* ========================================================================= */}
      {isFoldersExplorerOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div 
            className="bg-slate-900 border border-cyan-800/80 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            dir={dir}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-linear-to-r from-slate-950 via-slate-900 to-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <FolderTree className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                    <span>{language === 'ar' ? 'مستكشف مجلدات الأجهزة على القرص' : 'Organization Device Folders Explorer'}</span>
                    <span className="text-xs bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 px-2.5 py-0.5 rounded-full font-mono font-bold">
                      {language === 'ar' ? 'هيكلية المجلدات الرسمية' : 'Physical Hierarchy'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {language === 'ar'
                      ? 'المنظمة ← الدائرة ← القسم ← الشعبة (إن وجدت) ← مجلد الأصل (يبدأ برمز الجهاز المخزن له في قاعدة البيانات)'
                      : 'Organization -> Directorate -> Department -> Division -> Asset Folder (starts with stored device code)'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setIsLoadingTree(true);
                    await syncFolders();
                    const res = await getFolderHierarchy();
                    if (res.success && res.tree) {
                      setFoldersTreeData(res.tree);
                    }
                    setIsLoadingTree(false);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title={language === 'ar' ? 'مزامنة كافة مجلدات الأجهزة على القرص' : 'Synchronize all device folders'}
                >
                  <History className={`w-3.5 h-3.5 ${isLoadingTree ? 'animate-spin' : ''}`} />
                  <span>{language === 'ar' ? 'مزامنة المجلدات' : 'Sync Folders'}</span>
                </button>

                <button
                  onClick={() => setIsFoldersExplorerOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Tree Explorer */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {isLoadingTree ? (
                <div className="text-center py-16 text-slate-400">
                  <History className="w-8 h-8 mx-auto mb-3 animate-spin text-cyan-400" />
                  <p className="font-semibold text-sm">{language === 'ar' ? 'جاري تحميل هرمية المجلدات...' : 'Loading folder tree...'}</p>
                </div>
              ) : !foldersTreeData || Object.keys(foldersTreeData).length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-slate-800/30 rounded-2xl border border-slate-800">
                  <Folder className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p className="font-semibold text-sm">{language === 'ar' ? 'لا توجد مجلدات بعد. اضغط "مزامنة المجلدات" لإنشائها فورياً.' : 'No folders found. Click "Sync Folders" to generate them.'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(foldersTreeData).map(([orgName, orgObj]: [string, any]) => (
                    <div key={orgName} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                      {/* Level 1: Organization */}
                      <div className="flex items-center gap-2.5 text-white font-bold text-sm sm:text-base border-b border-slate-800 pb-2.5">
                        <Building2 className="w-5 h-5 text-cyan-400 shrink-0" />
                        <span className="text-cyan-300 font-mono text-xs px-2 py-0.5 rounded-sm bg-cyan-950/80 border border-cyan-700/50">
                          {language === 'ar' ? 'المنظمة' : 'Org'}
                        </span>
                        <span>{orgName}</span>
                      </div>

                      {/* Level 2: Directorates */}
                      <div className="pl-4 sm:pl-6 space-y-3 border-l-2 border-slate-800 mr-2">
                        {Object.entries(orgObj.directorates || {}).map(([dirName, dirObj]: [string, any]) => (
                          <div key={dirName} className="space-y-2.5">
                            <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs sm:text-sm">
                              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                              <span className="text-blue-300 font-mono text-[10px] px-1.5 py-0.2 rounded-sm bg-blue-950/80 border border-blue-700/50">
                                {language === 'ar' ? 'الدائرة' : 'Directorate'}
                              </span>
                              <span>{dirName}</span>
                            </div>

                            {/* Level 3: Departments */}
                            <div className="pl-4 sm:pl-6 space-y-2 border-l-2 border-slate-800/70">
                              {Object.entries(dirObj.departments || {}).map(([deptName, deptObj]: [string, any]) => (
                                <div key={deptName} className="space-y-2">
                                  <div className="flex items-center gap-2 text-slate-300 font-medium text-xs">
                                    <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span className="text-amber-300 font-mono text-[10px] px-1.5 py-0.2 rounded-sm bg-amber-950/80 border border-amber-700/50">
                                      {language === 'ar' ? 'القسم' : 'Dept'}
                                    </span>
                                    <span className="font-bold">{deptName}</span>
                                    <span className="text-[10px] text-slate-400">
                                      ({(deptObj.devices?.length || 0) + Object.values(deptObj.divisions || {}).reduce((acc: number, d: any) => acc + (d.devices?.length || 0), 0)} {language === 'ar' ? 'أصل' : 'devices'})
                                    </span>
                                  </div>

                                  {/* Level 4: Divisions (if any) */}
                                  {Object.entries(deptObj.divisions || {}).map(([divName, divObj]: [string, any]) => (
                                    <div key={divName} className="pl-4 sm:pl-6 space-y-1.5 border-l-2 border-slate-800/50">
                                      <div className="flex items-center gap-2 text-slate-400 text-xs">
                                        <Tag className="w-3 h-3 text-emerald-400 shrink-0" />
                                        <span className="text-emerald-300 font-mono text-[9px] px-1.5 py-0.2 rounded-sm bg-emerald-950/80 border border-emerald-700/50">
                                          {language === 'ar' ? 'الشعبة' : 'Division'}
                                        </span>
                                        <span className="font-semibold text-slate-300">{divName}</span>
                                      </div>

                                      {/* Devices in Division */}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-3">
                                        {divObj.devices?.map((dev: any) => (
                                          <div
                                            key={dev.id}
                                            onClick={() => {
                                              const fullDev = devices.find(d => String(d.id) === String(dev.id));
                                              if (fullDev) {
                                                setViewDeviceModal(fullDev);
                                                setActiveDetailTab('folder');
                                                setIsFoldersExplorerOpen(false);
                                              }
                                            }}
                                            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition flex items-center justify-between group shadow-xs"
                                          >
                                            <div className="flex items-center gap-2 min-w-0">
                                              <FolderOpen className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition shrink-0" />
                                              <div className="min-w-0">
                                                <div className="font-bold text-white text-xs truncate group-hover:text-cyan-300">
                                                  {dev.folderName}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono">
                                                  {dev.deviceType} • {dev.deviceCode}
                                                </div>
                                              </div>
                                            </div>
                                            <span className="text-[10px] text-cyan-400 font-semibold shrink-0 group-hover:underline">
                                              {language === 'ar' ? 'عرض ←' : 'View →'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}

                                  {/* Level 5: Devices directly in Department */}
                                  {deptObj.devices && deptObj.devices.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4 sm:pl-6">
                                      {deptObj.devices.map((dev: any) => (
                                        <div
                                          key={dev.id}
                                          onClick={() => {
                                            const fullDev = devices.find(d => String(d.id) === String(dev.id));
                                            if (fullDev) {
                                              setViewDeviceModal(fullDev);
                                              setActiveDetailTab('folder');
                                              setIsFoldersExplorerOpen(false);
                                            }
                                          }}
                                          className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition flex items-center justify-between group shadow-xs"
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            <FolderOpen className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition shrink-0" />
                                            <div className="min-w-0">
                                              <div className="font-bold text-white text-xs truncate group-hover:text-cyan-300">
                                                {dev.folderName}
                                              </div>
                                              <div className="text-[10px] text-slate-400 font-mono">
                                                {dev.deviceType} • {dev.deviceCode}
                                              </div>
                                            </div>
                                          </div>
                                          <span className="text-[10px] text-cyan-400 font-semibold shrink-0 group-hover:underline">
                                            {language === 'ar' ? 'عرض ←' : 'View →'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">
                Root: asset archive/
              </span>
              <button
                type="button"
                onClick={() => setIsFoldersExplorerOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: TRANSFER DEPARTMENT */}
      {/* ========================================================================= */}
      {transferModalDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div 
            className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            dir={dir}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {language === 'ar' ? 'تحويل الأصل لقسم آخر' : 'Transfer Asset to Another Department'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {transferModalDevice.brand} {transferModalDevice.model} ({transferModalDevice.deviceCode})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setTransferModalDevice(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTransfer} className="p-6 space-y-4 text-xs">
              
              <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">{language === 'ar' ? 'القسم الحالي:' : 'Current Department:'}</span>
                  <span className="text-sm font-bold text-white">
                    {language === 'ar' ? (transferModalDevice.departmentAr || transferModalDevice.department) : transferModalDevice.department}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300">
                  {language === 'ar' ? 'سيتم أرشفته بالسجل' : 'Will be archived'}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-bold">
                    {language === 'ar' ? 'القسم الجديد المستلم (من الهيكل التنظيمي) *' : 'New Target Department (from Org Structure) *'}
                  </label>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-900/60 text-purple-300 border border-purple-700/50">
                    <Building2 className="w-3 h-3 text-purple-400" />
                    {language === 'ar' ? 'الهيكل التنظيمي' : 'Org Structure'}
                  </span>
                </div>
                <select
                  required
                  value={transferTargetDept}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTransferTargetDept(val);
                    const matched = orgDepts.find(d => d.nameEn === val || d.nameAr === val);
                    if (matched) {
                      setTransferTargetDeptAr(matched.nameAr);
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-hidden focus:border-purple-500 font-medium"
                >
                  {orgDepts
                    .filter(d => !isSameDepartment(d.nameEn, transferModalDevice.department) && !isSameDepartment(d.nameAr, transferModalDevice.department))
                    .map(dept => (
                      <option key={dept.id || dept.nameEn} value={dept.nameEn}>
                        {language === 'ar' 
                          ? `${dept.nameAr} (${dept.nameEn})` 
                          : `${dept.nameEn} — ${dept.nameAr} [${dept.type}]`}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {language === 'ar' ? 'تاريخ التحويل الفعلي' : 'Effective Transfer Date'}
                </label>
                <input
                  type="date"
                  required
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {language === 'ar' ? 'سبب التحويل / المبرر الإداري' : 'Transfer Reason / Justification'}
                </label>
                <textarea
                  rows={3}
                  required
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: إعادة هيكلة، متطلبات مشروع جديد، انتقال الموظف...' : 'e.g. Reassigned for new project requirements or staff relocation'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTransferModalDevice(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-lg shadow-purple-500/20 cursor-pointer"
                >
                  {language === 'ar' ? 'تأكيد التحويل وحفظ السجل' : 'Confirm Transfer & Archive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ADD MAINTENANCE RECORD */}
      {/* ========================================================================= */}
      {maintenanceModalDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div 
            className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            dir={dir}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600/30 border border-amber-500/40 flex items-center justify-center text-amber-300">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {language === 'ar' ? 'تسجيل عملية صيانة جديدة' : 'Log Maintenance Event'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {maintenanceModalDevice.brand} {maintenanceModalDevice.model} ({maintenanceModalDevice.deviceCode})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setMaintenanceModalDevice(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitMaintenance} className="p-6 space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {language === 'ar' ? 'تاريخ الصيانة *' : 'Maintenance Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={maintDate}
                    onChange={(e) => setMaintDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {language === 'ar' ? 'نوع الصيانة *' : 'Maintenance Type *'}
                  </label>
                  <select
                    value={maintType}
                    onChange={(e) => setMaintType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="Routine">Routine (صيانة دورية وقائية)</option>
                    <option value="Repair">Repair (إصلاح عطل)</option>
                    <option value="Upgrade">Upgrade (ترقية عتاد / سوفتوير)</option>
                    <option value="Inspection">Inspection (فحص ومعايرة)</option>
                    <option value="Replacement">Replacement (استبدال قطع غيار)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {language === 'ar' ? 'الجهة / الفني المنفذ *' : 'Performed By (Technician / Vendor) *'}
                </label>
                <input
                  type="text"
                  required
                  value={maintPerformedBy}
                  onChange={(e) => setMaintPerformedBy(e.target.value)}
                  placeholder="e.g. Internal IT Hardware Team, Canon Official Support"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {language === 'ar' ? 'وصف تفاصيل عملية الصيانة المنجزة *' : 'Detailed Work Description *'}
                </label>
                <textarea
                  rows={3}
                  required
                  value={maintDescription}
                  onChange={(e) => setMaintDescription(e.target.value)}
                  placeholder={language === 'ar' ? 'اكتب ما تم إنجازه، استبدال القطع، تنظيف، فحص، أو تحديث...' : 'Describe the work performed, replaced parts, testing results...'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {language === 'ar' ? 'التكلفة المالية (د.ع)' : 'Cost (IQD)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={maintCost}
                      onChange={(e) => setMaintCost(e.target.value)}
                      placeholder={language === 'ar' ? 'مثال: 50000' : 'e.g. 50000'}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 pr-12 rtl:pr-3 rtl:pl-12 text-white focus:outline-hidden focus:border-amber-500"
                    />
                    <span className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                      {language === 'ar' ? 'د.ع' : 'IQD'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {language === 'ar' ? 'حالة عملية الصيانة' : 'Status'}
                  </label>
                  <select
                    value={maintStatus}
                    onChange={(e) => setMaintStatus(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="Completed">Completed (مكتمل بنجاح)</option>
                    <option value="In Progress">In Progress (قيد التنفيذ)</option>
                    <option value="Scheduled">Scheduled (مجدول لاحقاً)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setMaintenanceModalDevice(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {language === 'ar' ? 'حفظ سجل الصيانة' : 'Save Maintenance Log'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ASSET QR CODE CAMERA SCANNER (HTML5-QRCODE LIVE CAMERA & FILE)    */}
      {/* ========================================================================= */}
      <AssetQrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        devices={devices}
        onSelectDevice={(device) => {
          setViewDeviceModal(device);
          setActiveDetailTab('overview');
        }}
        onTransferDevice={(device) => handleOpenTransfer(device)}
        onMaintenanceDevice={(device) => handleOpenMaintenance(device)}
        onRegisterWithCode={(code) => {
          handleOpenCreate();
          setFormSerialNumber(code);
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL 6: ASSET QR BADGE & PRINTABLE STICKER                                */}
      {/* ========================================================================= */}
      <AssetQrBadgeModal
        device={badgeModalDevice}
        onClose={() => setBadgeModalDevice(null)}
      />

      {/* ========================================================================= */}
      {/* MODAL 7: OFFICIAL MAINTENANCE REQUEST ATTACHED DOCUMENT PREVIEW           */}
      {/* ========================================================================= */}
      {selectedDocPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-xl w-full p-6 space-y-4" dir={dir}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  {language === 'ar' ? 'وثيقة طلب الصيانة المرفوعة أثناء إنشاء التذكرة' : 'Maintenance Request Document'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDocPreview(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
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
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: LINKED TICKET DETAILS MODAL                                      */}
      {/* ========================================================================= */}
      {selectedTicketId && (
        <TicketDetailModal
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
        />
      )}

    </div>
  );
}
