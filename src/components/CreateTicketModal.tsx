import React, { useState, useMemo } from 'react';
import { useTickets, getSlaMinutes, getAssignedTeamForTicketType } from '../context/TicketContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useOrg } from '../context/OrgContext';
import { isSameDepartment } from '../utils/departmentHelper';
import { 
  TicketType, 
  PriorityStars, 
  TicketPriority, 
  SupportedInformationSystem, 
  UserRequestAction,
  TicketAttachment,
  TicketStage,
  HardwareDeviceType,
  ElectronicDevice
} from '../types';
import { HardwareAssetSelector, mapDeviceTypeToHardwareType } from './HardwareAssetSelector';
import { WordEditor } from './WordEditor';
import { PictureAttachmentsUploader } from './PictureAttachmentsUploader';
import { StarPrioritySelector, starsToPriority } from './StarPrioritySelector';
import { 
  X, 
  Wrench, 
  Laptop, 
  UserPlus, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowLeft,
  ArrowRight,
  Server,
  FileCheck,
  Info,
  ChevronRight,
  Building2,
  HardDrive,
  RefreshCw
} from 'lucide-react';

interface CreateTicketModalProps {
  onClose: () => void;
  onCreated: (ticketId: string) => void;
}

const SUPPORTED_SYSTEMS: SupportedInformationSystem[] = [
  'Old IMS',
  'New IMS',
  '2FA',
  'Active Directory',
  'Enterprise ERP',
  'Document Archiving',
  'Corporate Email & 365',
  'Organizational Structure',
  'Asset Management',
  'Other System',
];

const HARDWARE_DEVICE_TYPES: HardwareDeviceType[] = [
  'Computer',
  'Printer',
  'FingerPrint Device',
  'Scanner',
  'Network Device',
  'Other Device',
];

const USER_REQUEST_ACTIONS: UserRequestAction[] = [
  'Create New User',
  'Delete User',
  'Modify User Account & Permissions',
  'Reset Password / Unlock Account',
  'Role & Privilege Elevation',
  'Other Request',
];

export function CreateTicketModal({ onClose, onCreated }: CreateTicketModalProps) {
  const { createTicket, tickets, addComment, systemSettings } = useTickets();
  const { currentUser, isOperationalUser, isTechnicalUser, isAdmin } = useAuth();
  const isTech = Boolean(isTechnicalUser || isAdmin);
  const { getAllDepartments } = useOrg();
  const { language, dir } = useLanguage();

  // 2-Step Wizard:
  // Step 1: Ticket Details + Department Asset Selector at the end with Quick Add
  // Step 2: Confirmation & Submission (Official Request order removed)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Selected Ticket Type (default to Hardware Maintenance as requested)
  const [selectedType, setSelectedType] = useState<TicketType>('Hardware Maintenance');

  // Core Form Fields
  const [title, setTitle] = useState('');
  const [descriptionHtml, setDescriptionHtml] = useState('');
  const [priorityStars, setPriorityStars] = useState<PriorityStars>(2);
  const [stage] = useState<TicketStage>('New');

  // Specific: Hardware Maintenance (Linked directly to Asset Management System)
  const [hardwareDeviceType, setHardwareDeviceType] = useState<HardwareDeviceType>('Computer');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | number | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<ElectronicDevice | null>(null);
  const [assetType, setAssetType] = useState('');
  const [serialOrBarcode, setSerialOrBarcode] = useState('');
  const [physicalLocation, setPhysicalLocation] = useState('');

  const handleSelectAssetDevice = (device: ElectronicDevice) => {
    setSelectedDeviceId(device.id);
    setSelectedDevice(device);
    const mappedType = mapDeviceTypeToHardwareType(device.deviceType, device.category);
    setHardwareDeviceType(mappedType);
    setAssetType(`${device.brand} ${device.model}`.trim());
    setSerialOrBarcode(device.serialNumber || device.deviceCode || '');
    setPhysicalLocation(device.location || device.department || '');
  };

  const handleClearAssetDevice = () => {
    setSelectedDeviceId(null);
    setSelectedDevice(null);
    setAssetType('');
    setSerialOrBarcode('');
  };

  // Specific: Systems Troubleshoot & User Request
  const [targetSystem, setTargetSystem] = useState<SupportedInformationSystem>('Old IMS');
  const [customSystemName, setCustomSystemName] = useState('');
  const [systemIssueCategory, setSystemIssueCategory] = useState('Error / Crash');

  // Specific: User Request
  const [userRequestAction, setUserRequestAction] = useState<UserRequestAction>('Create New User');
  const [targetFullName, setTargetFullName] = useState('');
  const [targetUsername, setTargetUsername] = useState('');
  const [targetDepartment, setTargetDepartment] = useState('');
  const [roleOrPermissions, setRoleOrPermissions] = useState('');
  const [businessJustification, setBusinessJustification] = useState('');

  // Picture attachments (JPEG/PNG up to 3)
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  
  // Optional initial comment
  const [initialComment, setInitialComment] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Auto-calculated fields
  const ticketPriority: TicketPriority = starsToPriority(priorityStars);
  const sla = getSlaMinutes(ticketPriority, systemSettings);
  const nextTicketNumber = `TCK-2026-${String(tickets.length + 1).padStart(4, '0')}`;

  // Organization department resolution for requester
  const orgDepts = getAllDepartments();
  const userDept = currentUser?.department || 'Operations';
  const userOrgDept = useMemo(() => {
    return orgDepts.find(d => isSameDepartment(d.nameEn, userDept) || isSameDepartment(d.nameAr, userDept));
  }, [orgDepts, userDept]);
  const userDeptDisplay = language === 'ar' ? (userOrgDept?.nameAr || userDept) : (userOrgDept?.nameEn || userDept);

  // Helper translations
  const getTicketTypeTitle = (type: TicketType) => {
    if (language === 'ar') {
      switch (type) {
        case 'Hardware Maintenance': return 'صيانة الأجهزة والمعدات';
        case 'Systems Troubleshoot': return 'معالجة مشاكل وأعطال الأنظمة';
        case 'User Request': return 'طلبات المستخدمين والصلاحيات';
      }
    }
    return type;
  };

  const getHardwareLabel = (device: HardwareDeviceType) => {
    if (language === 'ar') {
      switch (device) {
        case 'Computer': return 'حاسوب / محطة عمل (Computer)';
        case 'Printer': return 'طابعة عادية / حرارية (Printer)';
        case 'FingerPrint Device': return 'جهاز البصمة والحضور (FingerPrint)';
        case 'Scanner': return 'ماسح ضوئي / باركود (Scanner)';
        case 'Network Device': return 'جهاز شبكة / راوتر / سويتش (Network)';
        case 'Other Device': return 'جهاز / أصل آخر...';
      }
    }
    return device;
  };

  const getSystemLabel = (sys: SupportedInformationSystem) => {
    if (language === 'ar') {
      switch (sys) {
        case 'Old IMS': return 'نظام إدارة المخزون القديم (Old IMS)';
        case 'New IMS': return 'نظام المخزون المتطور (New IMS)';
        case '2FA': return 'نظام المصادقة الثنائية (2FA)';
        case 'Active Directory': return 'دليل النطاق (Active Directory)';
        case 'Document Archiving': return 'أرشيف الوثائق الإلكتروني';
        case 'Enterprise ERP': return 'نظام تخطيط الموارد ERP';
        case 'Corporate Email & 365': return 'البريد الإلكتروني المؤسسي & 365';
        case 'Organizational Structure': return 'الهيكل التنظيمي (Organizational Structure)';
        case 'Asset Management': return 'إدارة الأصول والأجهزة (Asset Management)';
        case 'Other System': return 'نظام مؤسسي آخر...';
      }
    }
    return sys;
  };

  const getUserActionLabel = (action: UserRequestAction) => {
    if (language === 'ar') {
      switch (action) {
        case 'Create New User': return 'إنشاء حساب مستخدم جديد';
        case 'Delete User': return 'حذف أو إلغاء حساب مستخدم';
        case 'Modify User Account & Permissions': return 'تعديل بيانات الحساب والصلاحيات';
        case 'Reset Password / Unlock Account': return 'إعادة تعيين كلمة المرور / إلغاء القفل';
        case 'Role & Privilege Elevation': return 'ترقية الأدوار والامتيازات';
        case 'Other Request': return 'طلب وصول / إجراء آخر...';
      }
    }
    return action;
  };

  const getTeamName = (_type?: TicketType) => {
    return language === 'ar'
      ? 'الفريق الفني للعتاد والأجهزة (Technical Team)'
      : 'Technical Team';
  };

  if (!currentUser) return null;

  // Step 1 -> Step 2 validation
  const handleProceedToConfirmation = () => {
    if (!title.trim()) {
      alert(language === 'ar' ? 'يرجى إدخال عنوان البلاغ قبل المتابعة للتأكيد.' : 'Please enter a ticket title before proceeding.');
      return;
    }

    if (selectedType === 'Hardware Maintenance' && !selectedDevice && !assetType.trim()) {
      const confirmContinue = window.confirm(
        language === 'ar'
          ? 'لم يتم تحديد أصل من قائمة أصول القسم. هل ترغب باختيار الأصل الآن أم المتابعة بدون أصل محدد؟'
          : 'No device selected from department assets. Proceed without selecting an asset?'
      );
      if (!confirmContinue) return;
    }

    setCurrentStep(2);
  };

  // Step 2 Submission (Confirmation & Save to database with archiving)
  const handleFinalSubmit = async () => {
    if (!selectedType || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const actualTargetSystem = (targetSystem === 'Other System' && customSystemName.trim())
        ? customSystemName.trim()
        : targetSystem;

      const teamRes = getAssignedTeamForTicketType(selectedType);

      const createdTicket = await createTicket(
        {
          title: title.trim(),
          description: descriptionHtml.trim() || `<p>${title.trim()}</p>`,
          ticketType: selectedType,
          priorityStars,
          priority: ticketPriority,
          teamId: teamRes.teamId,
          hardwareDeviceType: selectedType === 'Hardware Maintenance' ? hardwareDeviceType : undefined,
          stage: 'New',
          targetSystem: (selectedType === 'Systems Troubleshoot' || selectedType === 'User Request') 
            ? actualTargetSystem 
            : undefined,
          userRequestAction: selectedType === 'User Request' ? userRequestAction : undefined,
          userRequestDetails: selectedType === 'User Request' ? {
            targetFullName: targetFullName.trim(),
            targetUsername: targetUsername.trim(),
            targetDepartment: targetDepartment.trim(),
            roleOrPermissions: roleOrPermissions.trim(),
            businessJustification: businessJustification.trim(),
          } : undefined,
          hardwareDetails: selectedType === 'Hardware Maintenance' ? {
            deviceId: selectedDeviceId || undefined,
            deviceCode: selectedDevice?.deviceCode || undefined,
            deviceType: hardwareDeviceType,
            assetType: assetType.trim() || (selectedDevice ? `${selectedDevice.brand} ${selectedDevice.model}` : hardwareDeviceType),
            brand: selectedDevice?.brand || undefined,
            model: selectedDevice?.model || undefined,
            serialOrBarcode: serialOrBarcode.trim(),
            physicalLocation: physicalLocation.trim(),
            department: selectedDevice?.department || currentUser?.department || undefined,
          } : undefined,
          attachments,
        },
        currentUser
      );

      if (initialComment.trim() && createdTicket?.id) {
        await addComment(createdTicket.id, initialComment.trim(), false, currentUser);
      }

      if (createdTicket?.id) {
        onCreated(createdTicket.id);
      }
    } catch (err: any) {
      console.error('Failed to create ticket in database:', err);
      setSubmitError(
        err?.message || (language === 'ar'
          ? 'تعذر حفظ التذكرة في قاعدة البيانات. يرجى التحقق وإعادة المحاولة.'
          : 'Failed to create ticket in database. Please verify and try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in" dir={dir}>
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {language === 'ar' ? 'حوار إنشاء تذكرة جديدة: صيانة الأجهزة والمعدات' : 'New Ticket Dialog: Hardware Maintenance'}
              </h2>
              <p className="text-xs text-slate-500">
                {language === 'ar'
                  ? `مقدم البلاغ: ${currentUser.fullName} — قسم: ${userDeptDisplay}`
                  : `Requester: ${currentUser.fullName} — Dept: ${userDeptDisplay}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Step Progress Indicator */}
        <div className="px-6 py-2.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            {/* Step 1 */}
            <div className={`flex items-center space-x-2 rtl:space-x-reverse ${currentStep === 1 ? 'text-blue-700 font-bold' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                currentStep === 1 ? 'bg-blue-600 text-white shadow-xs' : 'bg-emerald-600 text-white'
              }`}>
                {currentStep > 1 ? '✓' : '1'}
              </span>
              <span className="font-bold text-xs sm:text-sm">
                {language === 'ar' ? '1. إنشاء التذكرة وبيانات الأصل' : '1. Ticket & Asset Info'}
              </span>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />

            {/* Step 2 */}
            <div className={`flex items-center space-x-2 rtl:space-x-reverse ${currentStep === 2 ? 'text-blue-700 font-bold' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                currentStep === 2 ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-300 text-slate-600'
              }`}>
                2
              </span>
              <span className="font-bold text-xs sm:text-sm">
                {language === 'ar' ? '2. تأكيد التذكرة والإرسال' : '2. Ticket Confirmation'}
              </span>
            </div>
          </div>

          <div className="text-[11px] font-bold text-slate-600">
            {language === 'ar' ? `الخطوة ${currentStep} من 2` : `Step ${currentStep} of 2`}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* ============================================================ */}
          {/* PAGE 1: TICKET CREATION & DEPARTMENT ASSETS LIST AT THE END  */}
          {/* ============================================================ */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in">
              
              {/* Ticket Type Switcher Chips */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    {language === 'ar' ? 'نوع البلاغ:' : 'Ticket Type:'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedType('Hardware Maintenance')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        selectedType === 'Hardware Maintenance'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'صيانة الأجهزة والمعدات' : 'Hardware Maintenance'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedType('Systems Troubleshoot')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        selectedType === 'Systems Troubleshoot'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Laptop className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'أعطال الأنظمة' : 'Systems Troubleshoot'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedType('User Request')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        selectedType === 'User Request'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'طلبات المستخدمين' : 'User Request'}</span>
                    </button>
                  </div>
                </div>

                <div className="text-[12px] text-blue-800 self-start sm:self-auto font-medium">
                  {language === 'ar' ? 'الفريق المعني آلياً:' : 'Assigned Team:'}{' '}
                  <strong>{getTeamName(selectedType)}</strong>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                  {language === 'ar' ? 'عنوان البلاغ / موضوع التذكرة' : 'Ticket Title / Subject'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: تعطل طابعة قسم العمليات أو عطل في شاشة حاسوب المحطة 3...' : 'e.g. Operations printer paper jam or workstation monitor display issue...'}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Description using WordEditor */}
              <div>
                <WordEditor
                  value={descriptionHtml}
                  onChange={setDescriptionHtml}
                  label={language === 'ar' ? 'الوصف التفصيلي للمشكلة والخطوات (Word Editor)' : 'Detailed Description & Steps (Word Editor)'}
                  placeholder={language === 'ar' ? 'أدخل تفاصيل العطل، رسائل الخطأ، والأعراض الملاحظة على الجهاز...' : 'Type full issue details, error logs, or observed device symptoms...'}
                  minHeight="120px"
                />
              </div>

              {/* Priority Stars Selector */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <StarPrioritySelector
                  stars={priorityStars}
                  onChange={(stars) => setPriorityStars(stars)}
                />
              </div>

              {/* Picture Attachments Uploader (JPEG/PNG up to 3) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs sm:text-sm font-bold text-slate-800">
                    {language === 'ar' ? 'مرفقات صور الجهاز أو العطل' : 'Device or Error Pictures'}
                  </span>
                  <span className="text-[11px] text-blue-700 font-semibold">
                    {language === 'ar' ? 'تُحفظ وتؤرشف تلقائياً في مجلد tickets archive' : 'Auto-archived in tickets archive/'}
                  </span>
                </div>
                <PictureAttachmentsUploader
                  attachments={attachments}
                  onChange={setAttachments}
                  maxFiles={systemSettings?.maxPictureAttachments ?? 3}
                  maxSizeBytes={systemSettings?.maxAttachmentSizeBytes ?? 5 * 1024 * 1024}
                  uploaderName={currentUser?.fullName || 'Operational User'}
                />
              </div>

              {/* Optional initial comment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ar' ? 'ملاحظة أولية للفريق الفني المختص (اختياري)' : 'Initial Notes to Technical Support (Optional)'}
                </label>
                <input
                  type="text"
                  value={initialComment}
                  onChange={(e) => setInitialComment(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: الجهاز موجود على مكتب الموظف بالطابق الثاني...' : 'e.g. Device is located on 2nd floor desk...'}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* SPECIFIC FIELDS FOR SYSTEMS TROUBLESHOOT */}
              {selectedType === 'Systems Troubleshoot' && (
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-3">
                  <label className="block text-xs font-bold text-blue-950">
                    {language === 'ar' ? 'النظام المؤسسي المتأثر' : 'Affected Enterprise System'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SUPPORTED_SYSTEMS.map((sys) => (
                      <button
                        key={sys}
                        type="button"
                        onClick={() => setTargetSystem(sys)}
                        className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition text-start flex items-center justify-between cursor-pointer ${
                          targetSystem === sys
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{getSystemLabel(sys)}</span>
                        {targetSystem === sys && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>

                  {targetSystem === 'Other System' && (
                    <input
                      type="text"
                      required
                      value={customSystemName}
                      onChange={(e) => setCustomSystemName(e.target.value)}
                      placeholder={language === 'ar' ? 'أدخل اسم النظام...' : 'Specify system name...'}
                      className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              )}

              {/* SPECIFIC FIELDS FOR USER REQUEST */}
              {selectedType === 'User Request' && (
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-4">
                  <label className="block text-xs font-bold text-emerald-950 mb-2">
                    {language === 'ar' ? 'نوع الإجراء المطلوب' : 'Specific Action'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {USER_REQUEST_ACTIONS.map((action) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => setUserRequestAction(action)}
                        className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition text-start cursor-pointer ${
                          userRequestAction === action
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-100/50'
                        }`}
                      >
                        {getUserActionLabel(action)}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {language === 'ar' ? 'اسم الموظف المعني' : 'Target Employee Name'}
                      </label>
                      <input
                        type="text"
                        value={targetFullName}
                        onChange={(e) => setTargetFullName(e.target.value)}
                        placeholder={language === 'ar' ? 'الاسم الكامل...' : 'Full Name...'}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {language === 'ar' ? 'الدور أو الصلاحيات المطلوبة' : 'Requested Role'}
                      </label>
                      <input
                        type="text"
                        value={roleOrPermissions}
                        onChange={(e) => setRoleOrPermissions(e.target.value)}
                        placeholder={language === 'ar' ? 'الصلاحيات...' : 'Permissions...'}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* AT THE END OF PAGE 1: DEPARTMENT ASSETS LIST + QUICK ADD     */}
              {/* ============================================================ */}
              {selectedType === 'Hardware Maintenance' && (
                <div className="pt-2 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <HardDrive className="w-4.5 h-4.5 text-blue-600" />
                        <span>
                          {isTech
                            ? (language === 'ar' ? 'قائمة الأصول بكافة الأقسام' : 'All Departments Assets List')
                            : (language === 'ar' ? 'قائمة أصول القسم التابع له البلاغ' : 'Department Assets List')}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isTech
                          ? (language === 'ar'
                              ? 'بصفتك مستخدماً فنياً، يمكنك عرض واختيار الأصول من جميع الأقسام أو التصفية حسب القسم أو إضافة أصل جديد.'
                              : 'As a technical user, you can view and select assets across all departments, filter by department, or quick-add a new device.')
                          : (language === 'ar'
                              ? 'تؤخذ الأصول حصرياً من الأصول التابعة لقسمك. اختر الأصل المتأثر أو استخدم الزر السريع لإضافة أصل جديد.'
                              : 'Assets are scoped strictly to your department. Select the affected asset or use quick add for a new device.')}
                      </p>
                    </div>
                  </div>

                  <HardwareAssetSelector
                    selectedDeviceId={selectedDeviceId}
                    selectedDevice={selectedDevice}
                    onSelectDevice={handleSelectAssetDevice}
                    onClearDevice={handleClearAssetDevice}
                    hardwareDeviceType={hardwareDeviceType}
                    onChangeHardwareDeviceType={setHardwareDeviceType}
                    assetType={assetType}
                    onChangeAssetType={setAssetType}
                    serialOrBarcode={serialOrBarcode}
                    onChangeSerialOrBarcode={setSerialOrBarcode}
                    physicalLocation={physicalLocation}
                    onChangePhysicalLocation={setPhysicalLocation}
                    strictUserDepartmentOnly={!isTech}
                  />
                </div>
              )}

            </div>
          )}

          {/* ============================================================ */}
          {/* PAGE 2: CONFIRMATION STEP ONLY (Official Request PDF removed)*/}
          {/* ============================================================ */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in text-xs sm:text-sm">
              
              {/* Top Banner */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-extrabold text-blue-700">
                    {language === 'ar' ? 'الخطوة 2: مراجعة وتأكيد بيانات التذكرة' : 'Step 2: Ticket Confirmation'}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                    {title}
                  </h3>
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-mono font-bold text-xs shadow-xs">
                  {nextTicketNumber}
                </span>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Card 1: Routing & SLA */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                    <span>{language === 'ar' ? 'فريق الدعم واتفاقية الخدمة SLA' : 'Support Team & SLA Target'}</span>
                    <span className="text-amber-500 font-bold">
                      {'★'.repeat(priorityStars)}{'☆'.repeat(3 - priorityStars)} ({ticketPriority})
                    </span>
                  </div>
                  <div className="text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === 'ar' ? 'نوع البلاغ:' : 'Ticket Type:'}</span>
                      <strong className="text-slate-800">{getTicketTypeTitle(selectedType)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === 'ar' ? 'الفريق الفني المسند:' : 'Assigned Team:'}</span>
                      <strong className="text-blue-800">{getTeamName(selectedType)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === 'ar' ? 'مهلة الاستجابة:' : 'Response SLA:'}</span>
                      <strong className="text-slate-800">{sla.response / 60} {language === 'ar' ? 'ساعة' : 'hour(s)'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === 'ar' ? 'مهلة المعالجة والإغلاق:' : 'Resolution SLA:'}</span>
                      <strong className="text-slate-800">{sla.resolution / 60} {language === 'ar' ? 'ساعة' : 'hours'}</strong>
                    </div>
                  </div>
                </div>

                {/* Card 2: Requester & Department */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                    <span>{language === 'ar' ? 'بيانات مقدم البلاغ' : 'Requester Details'}</span>
                    <span className="text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded-lg text-[11px]">
                      {userDeptDisplay}
                    </span>
                  </div>
                  <div className="text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === 'ar' ? 'اسم المستخدم:' : 'User Name:'}</span>
                      <strong className="text-slate-800">{currentUser.fullName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === 'ar' ? 'البريد الإلكتروني:' : 'Email:'}</span>
                      <span className="text-slate-700 font-mono text-[11px]">{currentUser.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === 'ar' ? 'القسم (الهيكل التنظيمي):' : 'Department:'}</span>
                      <strong className="text-blue-900 font-bold">{userDeptDisplay}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === 'ar' ? 'مجلد الأرشفة المخصص:' : 'Archive Folder:'}</span>
                      <span className="font-mono text-blue-700 font-bold text-[11px] flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                        tickets archive/{nextTicketNumber}/
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Selected Asset Details Card */}
              {selectedType === 'Hardware Maintenance' && (
                <div className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50/50 space-y-3">
                  <div className="text-xs font-bold text-amber-950 border-b border-amber-200 pb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-amber-700" />
                      <span>{language === 'ar' ? 'الأصل المحدد للصيانة (تابع لقسم العمليات/القسم الإداري)' : 'Selected Device for Maintenance'}</span>
                    </span>
                    {selectedDevice?.deviceCode && (
                      <span className="font-mono px-2 py-0.5 rounded bg-amber-600 text-white font-bold text-[11px]">
                        {selectedDevice.deviceCode}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">{language === 'ar' ? 'نوع الجهاز:' : 'Device Type:'}</span>
                      <strong className="text-slate-900">{getHardwareLabel(hardwareDeviceType)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">{language === 'ar' ? 'الموديل / الأصل:' : 'Model / Asset:'}</span>
                      <strong className="text-slate-900">{assetType || selectedDevice?.model || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">{language === 'ar' ? 'الرقم التسلسلي S/N:' : 'Serial Number:'}</span>
                      <strong className="text-slate-900 font-mono">{serialOrBarcode || selectedDevice?.serialNumber || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">{language === 'ar' ? 'الموقع الفعلي:' : 'Location:'}</span>
                      <strong className="text-slate-900">{physicalLocation || selectedDevice?.location || 'N/A'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Description Preview */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                <div className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5">
                  {language === 'ar' ? 'نص الوصف والخطوات (Word Editor)' : 'Description Content'}
                </div>
                <div 
                  className="prose prose-xs max-w-none text-slate-700 bg-slate-50 p-3 rounded-xl max-h-32 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: descriptionHtml || `<p>${title}</p>` }}
                />
              </div>

              {/* Attachments Preview with Archive Naming Explanation */}
              {attachments.length > 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      {language === 'ar' ? `المرفقات المصورة (${attachments.length} صور):` : `Attached Pictures (${attachments.length}):`}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {language === 'ar' 
                        ? 'تسمية الفايلات: اسم التذكرة - رقم تسلسلي - تاريخ الرفع'
                        : 'File Naming: TicketTitle - Seq - UploadDate'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {attachments.map((att, idx) => {
                      const cleanTitle = title.replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim() || 'ticket';
                      const seq = String(idx + 1).padStart(2, '0');
                      const dateStr = new Date().toISOString().split('T')[0];
                      const ext = att.fileName.includes('.') ? att.fileName.slice(att.fileName.lastIndexOf('.')) : '.jpg';
                      const formattedArchiveName = `${cleanTitle} - ${seq} - ${dateStr}${ext}`;

                      return (
                        <div key={att.id || idx} className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                          {att.dataUrl && (
                            <div className="aspect-16/9 rounded-lg overflow-hidden bg-slate-900">
                              <img src={att.dataUrl} alt={att.fileName} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="text-[11px] font-bold text-slate-800 truncate" title={formattedArchiveName}>
                            {formattedArchiveName}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center justify-between">
                            <span>{att.fileSize}</span>
                            <span className="font-mono text-blue-600">tickets archive/</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>

          <div className="flex items-center gap-2.5">
            {/* If on Step 1, button leads to Confirmation Step 2 */}
            {currentStep === 1 && (
              <button
                type="button"
                id="btn-proceed-confirmation"
                onClick={handleProceedToConfirmation}
                className="px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer"
              >
                <span>{language === 'ar' ? 'التالي: تأكيد التذكرة' : 'Next: Confirm Ticket'}</span>
                {dir === 'rtl' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            )}

            {/* If on Step 2 (Confirmation), Back button to Step 1 & Submit button */}
            {currentStep === 2 && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  {dir === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                  <span>{language === 'ar' ? 'السابق: تعديل البيانات' : 'Back: Edit Details'}</span>
                </button>

                {submitError && (
                  <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg font-medium mx-2">
                    {submitError}
                  </div>
                )}

                <button
                  type="button"
                  id="btn-confirm-submit-ticket"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="px-7 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{language === 'ar' ? 'جارٍ أرشفة وحفظ التذكرة...' : 'Archiving & Saving Ticket...'}</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      <span>
                        {language === 'ar' ? `تأكيد وإرسال التذكرة (${nextTicketNumber})` : `Confirm & Submit Ticket (${nextTicketNumber})`}
                      </span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
