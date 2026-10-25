import React, { useState } from 'react';
import { useTickets } from '../context/TicketContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useOrg } from '../context/OrgContext';
import { 
  TicketStatus, 
  TicketPriority, 
  TicketAttachment, 
  TicketStage,
  PriorityStars,
  isUserTechnical
} from '../types';
import { StarPrioritySelector, starsToPriority } from './StarPrioritySelector';
import { PictureAttachmentsUploader } from './PictureAttachmentsUploader';
import { 
  X, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  Send, 
  Lock, 
  History, 
  MessageSquare, 
  Image as ImageIcon, 
  Tag, 
  Shield, 
  Download,
  FileText,
  Star,
  Wrench,
  Laptop,
  UserPlus,
  Server,
  Layers,
  Eye,
  ShieldAlert,
  HardDrive,
  ExternalLink
} from 'lucide-react';

interface TicketDetailModalProps {
  ticketId: string;
  onClose: () => void;
}

export function TicketDetailModal({ ticketId, onClose }: TicketDetailModalProps) {
  const { 
    tickets, 
    updateTicketStatus, 
    updateTicketStage, 
    updateTicketPriority, 
    assignTicket, 
    addComment, 
    addAttachment 
  } = useTickets();
  const { currentUser, users, isAgent, isTechnicalUser } = useAuth();
  const { getAllDepartments } = useOrg();
  const { language, dir } = useLanguage();

  const ticket = tickets.find((t) => t.id === ticketId || t.ticketNo === ticketId || String(t.id) === String(ticketId));

  const getRequesterOrgDepartment = () => {
    if (!ticket) return '';
    const matchedUser = users?.find((u) => 
      (u.id && (u.id === ticket.requesterId || (u as any).uid === ticket.requesterId)) ||
      (u.email && ticket.requesterEmail && u.email.toLowerCase() === ticket.requesterEmail.toLowerCase()) ||
      (u.fullName && ticket.requesterName && u.fullName.toLowerCase() === ticket.requesterName.toLowerCase())
    );

    const isUserTypeString = (str?: string | null): boolean => {
      if (!str) return false;
      const lower = str.toLowerCase().trim();
      return (
        lower === 'operational user' ||
        lower === 'system admin' ||
        lower === 'technical user' ||
        lower === 'operator' ||
        lower === 'admin' ||
        lower === 'مستخدم تشغيلي' ||
        lower === 'مدير نظام'
      );
    };

    let rawDept = '';
    if (matchedUser?.department && matchedUser.department.trim() && !isUserTypeString(matchedUser.department)) {
      rawDept = matchedUser.department.trim();
    } else if (ticket.requesterDept && ticket.requesterDept.trim() && !isUserTypeString(ticket.requesterDept) && ticket.requesterDept !== 'Unassigned') {
      rawDept = ticket.requesterDept.trim();
    } else if (ticket.department && ticket.department.trim() && !isUserTypeString(ticket.department) && ticket.department !== 'Unassigned') {
      rawDept = ticket.department.trim();
    }

    if (!rawDept) return language === 'ar' ? 'غير محدد في الهيكل' : 'Unassigned';

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
      return language === 'ar' ? (matchedOrg.nameAr || matchedOrg.nameEn) : (matchedOrg.nameEn || matchedOrg.nameAr);
    }
    const orgDictAr: Record<string, string> = {
      'operations': 'العمليات والتنفيذ',
      'operations & logistics': 'العمليات والتنفيذ',
      'information technology': 'تكنولوجيا المعلومات',
      'it': 'تكنولوجيا المعلومات',
      'it service desk': 'دعم العملاء ومكتب المساعدة',
      'customer support & helpdesk': 'دعم العملاء ومكتب المساعدة',
      'electronic archiving & records': 'الأرشفة الإلكترونية والسجلات',
      'human resources': 'الموارد البشرية',
      'cybersecurity (soc)': 'الأمن السيبراني (SOC)',
      'cloud infrastructure': 'البنية التحتية السحابية',
    };
    if (language === 'ar' && orgDictAr[norm]) return orgDictAr[norm];
    return rawDept;
  };

  const [activeTab, setActiveTab] = useState<'conversation' | 'history' | 'attachments'>('conversation');
  const [commentText, setCommentText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  
  // Image lightbox preview
  const [previewImage, setPreviewImage] = useState<TicketAttachment | null>(null);

  if (!ticket || !currentUser) {
    return null;
  }

  const isTechEngineer = Boolean(isAgent || isTechnicalUser || isUserTechnical(currentUser));
  const agents = users.filter((u) => isUserTechnical(u) || u.role === 'Agent' || u.role === 'Admin');

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    addComment(ticket.id, commentText.trim(), isInternalNote, currentUser);
    setCommentText('');
    setIsInternalNote(false);
  };

  const handleAttachmentChange = (newAttachments: TicketAttachment[]) => {
    // If a new attachment was added
    if (newAttachments.length > ticket.attachments.length) {
      const added = newAttachments[newAttachments.length - 1];
      addAttachment(ticket.id, added, currentUser);
    }
  };

  const currentStage: TicketStage = ticket.stage || 'New';
  const currentStars: PriorityStars = ticket.priorityStars || 2;

  const getStageLabel = (stage: TicketStage) => {
    if (language === 'ar') {
      switch (stage) {
        case 'New': return 'جديد (New)';
        case 'Triaged': return 'تم الفرز والتوجيه (Triaged)';
        case 'In Progress': return 'قيد المعالجة (In Progress)';
        case 'Pending Review': return 'بانتظار المراجعة (Pending)';
        case 'Resolved': return 'تم الحل والمعالجة (Resolved)';
        case 'Closed': return 'مغلق نهائياً (Closed)';
      }
    }
    return `Stage: ${stage}`;
  };

  const getPriorityLabel = (stars: PriorityStars) => {
    if (language === 'ar') {
      switch (stars) {
        case 1: return '★☆☆ نجمة واحدة (منخفض)';
        case 2: return '★★☆ نجمتان (متوسط)';
        case 3: return '★★★ 3 نجوم (عالي الأولوية)';
      }
    }
    return `${stars} Stars`;
  };

  const getTicketTypeLabel = (type: string) => {
    if (language === 'ar') {
      switch (type) {
        case 'Hardware Maintenance': return 'صيانة الأجهزة والمعدات';
        case 'Systems Troubleshoot': return 'معالجة أعطال الأنظمة';
        case 'User Request': return 'طلبات المستخدمين والصلاحيات';
      }
    }
    return type;
  };

  const getTeamLabel = (team: string) => {
    if (language === 'ar') {
      if (team === 'Technical Team' || team.includes('Technical') || team.includes('Hardware')) {
        return 'الفريق الفني للعتاد والأجهزة (Technical Team)';
      }
      if (team.includes('Systems')) return 'فريق مهندسي البرمجيات وقواعد البيانات';
      if (team.includes('Access')) return 'فريق أمن الهوية وإدارة الصلاحيات IAM';
    }
    return team;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in" dir={dir}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded border border-blue-300">
                {ticket.ticketNo || ticket.id}
              </span>

              {/* Ticket Type Badge */}
              <span className="inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-white">
                {ticket.ticketType === 'Hardware Maintenance' && <Wrench className="w-3 h-3 mx-1 text-amber-400" />}
                {ticket.ticketType === 'Systems Troubleshoot' && <Laptop className="w-3 h-3 mx-1 text-blue-400" />}
                {ticket.ticketType === 'User Request' && <UserPlus className="w-3 h-3 mx-1 text-emerald-400" />}
                {getTicketTypeLabel(ticket.ticketType)}
              </span>

              {/* Target System Badge if applicable */}
              {ticket.targetSystem && (
                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Server className="w-3 h-3 mx-1 text-indigo-500" />
                  {ticket.targetSystem}
                </span>
              )}

              {/* 3 Yellow Stars Display */}
              <div className="inline-flex items-center space-x-0.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                {[1, 2, 3].map((starNum) => (
                  <Star
                    key={starNum}
                    className={`w-3.5 h-3.5 ${
                      starNum <= currentStars
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-slate-300'
                    }`}
                  />
                ))}
                <span className="text-[11px] font-bold text-amber-800 mx-1">
                  {language === 'ar' ? `المستوى ${currentStars}` : `Level ${currentStars}`}
                </span>
              </div>

              {/* Assigned Team */}
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                • {language === 'ar' ? 'الفريق المكلف:' : 'Assigned:'}{' '}
                <strong className="text-slate-700">{getTeamLabel(ticket.assignedTeam)}</strong>
              </span>
            </div>
            
            <h2 className="text-lg font-bold text-slate-900 leading-snug">{ticket.title}</h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow & Stage Action Bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          
          {/* Stage Control */}
          <div>
            <label className="block text-slate-400 font-medium mb-1 uppercase tracking-wider text-[10px]">
              {language === 'ar' ? 'مرحلة سير البلاغ' : 'Ticket Stage'}
            </label>
            {isAgent ? (
              <select
                value={currentStage}
                onChange={(e) => updateTicketStage(ticket.id, e.target.value as TicketStage, currentUser)}
                className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="New">{getStageLabel('New')}</option>
                <option value="Triaged">{getStageLabel('Triaged')}</option>
                <option value="In Progress">{getStageLabel('In Progress')}</option>
                <option value="Pending Review">{getStageLabel('Pending Review')}</option>
                <option value="Resolved">{getStageLabel('Resolved')}</option>
                <option value="Closed">{getStageLabel('Closed')}</option>
              </select>
            ) : (
              <div className="py-1.5 px-2 bg-slate-100 rounded font-semibold text-slate-800">
                {getStageLabel(currentStage)}
              </div>
            )}
          </div>

          {/* Priority Stars Control */}
          <div>
            <label className="block text-slate-400 font-medium mb-1 uppercase tracking-wider text-[10px]">
              {language === 'ar' ? 'الأولوية (نظام 3 نجوم)' : 'Priority (3 Stars)'}
            </label>
            {isAgent ? (
              <select
                value={currentStars}
                onChange={(e) => {
                  const stars = parseInt(e.target.value, 10) as PriorityStars;
                  updateTicketPriority(ticket.id, starsToPriority(stars), currentUser, stars);
                }}
                className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value={1}>{getPriorityLabel(1)}</option>
                <option value={2}>{getPriorityLabel(2)}</option>
                <option value={3}>{getPriorityLabel(3)}</option>
              </select>
            ) : (
              <div className="py-1.5 px-2 bg-slate-100 rounded font-semibold text-slate-800">
                {getPriorityLabel(currentStars)}
              </div>
            )}
          </div>

          {/* Assigned Engineer */}
          <div>
            <label className="block text-slate-400 font-medium mb-1 uppercase tracking-wider text-[10px]">
              {language === 'ar' ? 'المهندس المكلف' : 'Assigned Engineer'}
            </label>
            {isTechEngineer ? (
              <select
                value={ticket.assigneeId || ''}
                onChange={(e) => {
                  const selectedUser = agents.find((u) => u.id === e.target.value) || null;
                  assignTicket(ticket.id, selectedUser, currentUser);
                }}
                className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">{language === 'ar' ? '-- غير مسند --' : '-- Unassigned --'}</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.fullName} ({agent.role})
                  </option>
                ))}
              </select>
            ) : (
              <div className="py-1.5 px-2 bg-slate-100 rounded font-semibold text-slate-800">
                {ticket.assigneeName || (language === 'ar' ? 'غير مسند' : 'Unassigned')}
              </div>
            )}
          </div>

          {/* SLA Overview Pill */}
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              {language === 'ar' ? 'موعد إغلاق البلاغ المستهدف SLA' : 'Resolution Target SLA'}
            </span>
            <div className="flex items-center space-x-1.5 mt-0.5">
              {ticket.isResolutionBreached ? (
                <span className="text-rose-700 font-bold flex items-center">
                  <AlertCircle className="w-3.5 h-3.5 mx-1" />
                  {language === 'ar' ? 'تم تجاوز الوقت المحدد' : 'Target Breached'}
                </span>
              ) : ticket.status === 'Resolved' || ticket.status === 'Closed' ? (
                <span className="text-emerald-700 font-semibold flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mx-1" />
                  {language === 'ar' ? 'مكتمل ضمن الوقت المحدد' : 'Met On Schedule'}
                </span>
              ) : (
                <span className="text-blue-700 font-semibold flex items-center">
                  <Clock className="w-3.5 h-3.5 mx-1" />
                  {language === 'ar' ? 'الموعد الأقصى: ' : 'Due: '}
                  {new Date(ticket.resolutionDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Modal Main Content */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Left Column: Details, Tabs, Conversation */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* User Request or Hardware details cards if present */}
            {ticket.userRequestDetails && (
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 flex items-center">
                    <UserPlus className="w-4 h-4 mx-1.5 text-emerald-600" />
                    {language === 'ar' ? 'مواصفات طلب المستخدم' : 'User Request Specifications'} ({ticket.userRequestAction || 'Access'})
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-semibold text-[11px]">
                    {ticket.targetSystem || 'Enterprise Directory'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-emerald-900 pt-1">
                  <div><strong>{language === 'ar' ? 'المستخدم المعني:' : 'Target Full Name:'}</strong> {ticket.userRequestDetails.targetFullName || 'N/A'}</div>
                  <div><strong>{language === 'ar' ? 'اسم المستخدم / البريد:' : 'Username / Email:'}</strong> {ticket.userRequestDetails.targetUsername || 'N/A'}</div>
                  <div><strong>{language === 'ar' ? 'القسم:' : 'Department:'}</strong> {ticket.userRequestDetails.targetDepartment || 'N/A'}</div>
                  <div><strong>{language === 'ar' ? 'الصلاحيات المطلوبة:' : 'Requested Roles:'}</strong> {ticket.userRequestDetails.roleOrPermissions || 'Standard'}</div>
                </div>
                {ticket.userRequestDetails.businessJustification && (
                  <p className="text-[11px] text-slate-600 pt-1 border-t border-emerald-200/60">
                    <strong>{language === 'ar' ? 'المبرر التشغيلي:' : 'Justification:'}</strong> {ticket.userRequestDetails.businessJustification}
                  </p>
                )}
              </div>
            )}

            {ticket.hardwareDetails && (
              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 flex items-center">
                    <Wrench className="w-4 h-4 mx-1.5 text-amber-600" />
                    {language === 'ar' ? 'مواصفات صيانة الأجهزة والمعدات (الأصل المحدد)' : 'Hardware Maintenance Specifications (Linked Asset)'}
                  </span>
                  {ticket.hardwareDetails.deviceCode && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 font-mono text-[11px] font-bold border border-amber-300">
                      {ticket.hardwareDetails.deviceCode}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-amber-900 pt-1">
                  <div><strong>{language === 'ar' ? 'نوع وطراز الأصل:' : 'Device & Model:'}</strong> {ticket.hardwareDetails.assetType || 'N/A'}</div>
                  <div><strong>{language === 'ar' ? 'الرقم / الباركود:' : 'Serial / Barcode:'}</strong> {ticket.hardwareDetails.serialOrBarcode || 'N/A'}</div>
                  <div><strong>{language === 'ar' ? 'الموقع الفعلي:' : 'Location:'}</strong> {ticket.hardwareDetails.physicalLocation || 'N/A'}</div>
                  {ticket.hardwareDetails.department && (
                    <div className="sm:col-span-3 text-[11px] text-amber-800 border-t border-amber-200/60 pt-1.5 mt-0.5">
                      <strong>{language === 'ar' ? 'القسم المخصص له الأصل:' : 'Asset Assigned Dept:'}</strong> {ticket.hardwareDetails.department}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Maintenance Request Document Uploaded During Ticket Creation */}
            {ticket.deptRequest && (
              <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-950 flex items-center">
                    <FileText className="w-4 h-4 mx-1.5 text-rose-600" />
                    {language === 'ar' ? 'وثيقة طلب الصيانة (المرفوعة أثناء إنشاء التذكرة)' : 'Maintenance Request Document (Uploaded during Ticket Creation)'}
                  </span>
                  {ticket.deptRequest.requestNumber && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-200/80 text-rose-900 font-mono text-[11px] font-bold border border-rose-300">
                      {ticket.deptRequest.requestNumber}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-rose-900">{ticket.deptRequest.fileName}</span>
                    <span className="text-slate-500">({ticket.deptRequest.fileSize})</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-100 text-blue-800 border border-blue-200">
                      <HardDrive className="w-3 h-3 mx-0.5 text-blue-600" />
                      {ticket.deptRequest.filePath || `ticket requests/${ticket.deptRequest.fileName}`}
                    </span>
                    {ticket.deptRequest.source && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {ticket.deptRequest.source}
                      </span>
                    )}
                  </div>
                  {(ticket.deptRequest.fileUrl || ticket.deptRequest.dataUrl) && (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={ticket.deptRequest.fileUrl || ticket.deptRequest.dataUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'معاينة' : 'Preview'}</span>
                      </a>
                      <a
                        href={ticket.deptRequest.fileUrl || ticket.deptRequest.dataUrl}
                        download={ticket.deptRequest.fileName}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'تحميل الوثيقة' : 'Download Document'}</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description Box (Rich Word Editor Render) */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                {language === 'ar' ? 'الوصف ومواصفات المشكلة' : 'Problem Description / Specifications'}
              </h3>
              
              {/* Check if HTML formatted or plain string */}
              {ticket.description.includes('<') && ticket.description.includes('>') ? (
                <div 
                  className="prose prose-sm max-w-none text-slate-800 text-xs sm:text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: ticket.description }}
                />
              ) : (
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-normal">
                  {ticket.description}
                </p>
              )}
              
              {ticket.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-200">
                  {ticket.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-white text-slate-600 border border-slate-300">
                      <Tag className="w-3 h-3 mx-1 text-slate-400" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Content Tabs */}
            <div className="border-b border-slate-200 flex items-center space-x-6 text-sm">
              <button
                onClick={() => setActiveTab('conversation')}
                className={`pb-2.5 font-semibold flex items-center space-x-2 border-b-2 transition cursor-pointer mx-1 ${
                  activeTab === 'conversation'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <MessageSquare className="w-4 h-4 mx-1" />
                <span>
                  {language === 'ar' ? `المحادثة والردود (${ticket.comments.length})` : `Comments & Discussion (${ticket.comments.length})`}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('attachments')}
                className={`pb-2.5 font-semibold flex items-center space-x-2 border-b-2 transition cursor-pointer mx-1 ${
                  activeTab === 'attachments'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ImageIcon className="w-4 h-4 mx-1" />
                <span>
                  {language === 'ar' ? `المرفقات المصورة (${ticket.attachments.length}/4)` : `Picture Attachments (${ticket.attachments.length}/4)`}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`pb-2.5 font-semibold flex items-center space-x-2 border-b-2 transition cursor-pointer mx-1 ${
                  activeTab === 'history'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-4 h-4 mx-1" />
                <span>
                  {language === 'ar' ? `سجل التدقيق (${ticket.history.length})` : `Audit Trail (${ticket.history.length})`}
                </span>
              </button>
            </div>

            {/* TAB: Conversation / Comments */}
            {activeTab === 'conversation' && (
              <div className="space-y-4">
                {ticket.comments.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    {language === 'ar' 
                      ? 'لا توجد تعليقات أو تحديثات بعد. أضف الرد الأول أدناه.'
                      : 'No comments or updates yet. Add the first response below.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ticket.comments.map((comment) => {
                      if (comment.isInternalNote && !isAgent) return null;

                      return (
                        <div
                          key={comment.id}
                          className={`p-4 rounded-xl border transition ${
                            comment.isInternalNote
                              ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                              : 'bg-white border-slate-200 text-slate-900 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-xs text-slate-900 mx-1">
                                {comment.authorName}
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {comment.authorRole}
                              </span>
                              {comment.authorUserType && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 mx-1">
                                  {comment.authorUserType}
                                </span>
                              )}
                              {comment.isInternalNote && (
                                <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300 mx-1">
                                  <Lock className="w-2.5 h-2.5 mx-1" />
                                  {language === 'ar' ? 'ملاحظة سرية للمهندسين' : 'INTERNAL NOTE (Agents Only)'}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {new Date(comment.createdAt).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                            {comment.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Comment Input Box */}
                <form onSubmit={handleSendComment} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      {language === 'ar' ? 'إضافة تعليق أو تحديث تشخيصي' : 'Add Comment / Update'}
                    </span>
                    {isAgent && (
                      <label className="flex items-center space-x-1.5 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500 mx-1"
                        />
                        <span className="font-medium text-amber-800">
                          {language === 'ar' ? 'ملاحظة داخلية خاصة (لفريق الدعم فقط)' : 'Private internal note'}
                        </span>
                      </label>
                    )}
                  </div>

                  <textarea
                    rows={3}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={language === 'ar' ? 'اكتب تحديثاً أو ملاحظة تشخيصية أو رداً للمستخدم...' : 'Type an update, diagnostic note, or response...'}
                    className="w-full p-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      {language === 'ar' ? 'النشر باسم:' : 'Posting as'} <strong>{currentUser.fullName}</strong> ({currentUser.userType})
                    </span>

                    <button
                      type="submit"
                      disabled={!commentText.trim()}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 mx-1" />
                      <span>{language === 'ar' ? 'إرسال التعليق' : 'Post Comment'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB: Attachments (JPEG/PNG Pictures only) */}
            {activeTab === 'attachments' && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        {language === 'ar' ? 'المرفقات المصورة للبلاغ' : 'Picture Attachments'}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {language === 'ar' ? 'صور فقط (JPEG, PNG) بحد أقصى 4 صور لكل تذكرة.' : 'Only pictures (JPEG, PNG) up to 4 attachments per ticket.'}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-600">
                      {ticket.attachments.length} / 4
                    </span>
                  </div>

                  {ticket.attachments.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-200">
                      {language === 'ar' ? 'لا توجد مرفقات مصورة مرفوعة لهذه التذكرة.' : 'No picture attachments uploaded for this ticket.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {ticket.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs group relative flex flex-col"
                        >
                          <div 
                            onClick={() => setPreviewImage(att)}
                            className="h-28 bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer relative"
                          >
                            {att.dataUrl ? (
                              <img 
                                src={att.dataUrl} 
                                alt={att.fileName} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-slate-400">
                                <ImageIcon className="w-8 h-8 text-blue-500 mb-1" />
                                <span className="text-[10px] font-mono">{att.fileType.split('/')[1]?.toUpperCase() || 'IMG'}</span>
                              </div>
                            )}

                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold space-x-1">
                              <Eye className="w-4 h-4 mx-1" />
                              <span>{language === 'ar' ? 'معاينة' : 'View'}</span>
                            </div>
                          </div>

                          <div className="p-2 space-y-0.5 text-start">
                            <p className="text-xs font-bold text-slate-800 truncate" title={att.fileName}>
                              {att.fileName}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {att.fileSize} • {att.uploadedBy}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add more pictures if under 4 */}
                  {ticket.attachments.length < 4 && (
                    <div className="pt-2">
                      <PictureAttachmentsUploader
                        attachments={ticket.attachments}
                        onChange={handleAttachmentChange}
                        maxFiles={4}
                        uploaderName={currentUser?.fullName || 'Assigned Agent'}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: Audit Trail */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                {ticket.history.map((hist) => (
                  <div key={hist.id} className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="font-semibold text-slate-700">{hist.actorName} ({hist.actorRole})</span>
                      <span>{new Date(hist.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-800 font-mono text-[12px]">{hist.action}</p>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* Main Right Column: Requester Meta, SLAs, Timeline */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Requester Identity Card */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>{language === 'ar' ? 'بيانات مقدم البلاغ' : 'Requester Details'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                  {ticket.requesterUserType === 'Operational User' && language === 'ar' ? 'مستخدم تشغيلي' : (ticket.requesterUserType || 'Operational User')}
                </span>
              </h4>
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs mx-1">
                  {ticket.requesterName.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">{ticket.requesterName}</p>
                  <p className="text-[11px] text-slate-500">{ticket.requesterEmail}</p>
                </div>
              </div>
              <div className="text-xs space-y-1.5 pt-2 border-t border-slate-100 text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">{language === 'ar' ? 'القسم (الهيكل التنظيمي):' : 'Dept (Org Structure):'}</span>
                  <span className="font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{getRequesterOrgDepartment()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{language === 'ar' ? 'تاريخ رفع البلاغ:' : 'Ticket Created:'}</span>
                  <span className="font-medium text-slate-800">
                    {new Date(ticket.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{language === 'ar' ? 'الفريق المعني:' : 'Assigned Team:'}</span>
                  <span className="font-bold text-blue-700 text-end text-[11px] max-w-[160px]">
                    {getTeamLabel(ticket.assignedTeam)}
                  </span>
                </div>
              </div>
            </div>

            {/* SLA Performance Card */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>{language === 'ar' ? 'المواعيد واتفاقية الخدمة SLA' : 'SLA Timelines'}</span>
                <Clock className="w-3.5 h-3.5 text-blue-500" />
              </h4>

              <div className="space-y-2 text-xs">
                {/* First Response SLA */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-700">
                      {language === 'ar' ? 'اتفاقية الاستجابة:' : 'Response SLA:'}
                    </span>
                    {ticket.respondedAt ? (
                      <span className="text-emerald-700 font-bold text-[11px] flex items-center">
                        <CheckCircle2 className="w-3 h-3 mx-1" />
                        {language === 'ar' ? 'تمت الاستجابة' : 'Acknowledged'}
                      </span>
                    ) : ticket.isResponseBreached ? (
                      <span className="text-rose-700 font-bold text-[11px]">
                        {language === 'ar' ? 'تم تجاوز الوقت' : 'Breached'}
                      </span>
                    ) : (
                      <span className="text-blue-700 font-bold text-[11px]">
                        {language === 'ar' ? `المستهدف: ${ticket.responseSlaMinutes} دقيقة` : `Target: ${ticket.responseSlaMinutes}m`}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {language === 'ar' ? 'الموعد الأقصى: ' : 'Due by: '}
                    {new Date(ticket.responseDueAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </p>
                </div>

                {/* Resolution SLA */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-700">
                      {language === 'ar' ? 'اتفاقية الحل والمعالجة:' : 'Resolution SLA:'}
                    </span>
                    {ticket.resolvedAt ? (
                      <span className="text-emerald-700 font-bold text-[11px] flex items-center">
                        <CheckCircle2 className="w-3 h-3 mx-1" />
                        {language === 'ar' ? 'تم الحل' : 'Resolved'}
                      </span>
                    ) : ticket.isResolutionBreached ? (
                      <span className="text-rose-700 font-bold text-[11px]">
                        {language === 'ar' ? 'تم تجاوز الوقت' : 'Breached'}
                      </span>
                    ) : (
                      <span className="text-blue-700 font-bold text-[11px]">
                        {language === 'ar' ? `المستهدف: ${ticket.resolutionSlaMinutes / 60} ساعة` : `Target: ${ticket.resolutionSlaMinutes / 60}h`}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {language === 'ar' ? 'الموعد الأقصى: ' : 'Due by: '}
                    {new Date(ticket.resolutionDueAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Stage Actions for Support Engineers */}
            {isTechEngineer && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-emerald-400 mx-1" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    {language === 'ar' ? 'إجراءات المهندس السريعة' : 'Engineer Fast Actions'}
                  </h4>
                </div>
                
                <div className="space-y-2">
                  {currentStage !== 'Resolved' && (
                    <button
                      onClick={() => updateTicketStage(ticket.id, 'Resolved', currentUser)}
                      className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mx-1" />
                      <span>{language === 'ar' ? 'اعتماد حل البلاغ (Resolved)' : 'Mark Stage Resolved'}</span>
                    </button>
                  )}

                  {currentStage !== 'In Progress' && currentStage !== 'Closed' && (
                    <button
                      onClick={() => updateTicketStage(ticket.id, 'In Progress', currentUser)}
                      className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <span>{language === 'ar' ? 'بدء العمل والمعالجة (In Progress)' : 'Advance to In Progress'}</span>
                    </button>
                  )}

                  {!ticket.assigneeId && (
                    <button
                      onClick={() => assignTicket(ticket.id, currentUser, currentUser)}
                      className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition cursor-pointer"
                    >
                      {language === 'ar' ? 'استلام البلاغ وتكليفي به' : 'Claim Ticket for Myself'}
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* Lightbox Modal for Picture Attachment Preview */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 animate-in fade-in cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 p-2 rounded-2xl overflow-hidden shadow-2xl">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img 
              src={previewImage.dataUrl} 
              alt={previewImage.fileName} 
              className="max-h-[82vh] max-w-full object-contain mx-auto rounded-lg"
            />
            <div className="p-3 text-center text-xs text-slate-300">
              <span className="font-bold text-white">{previewImage.fileName}</span> ({previewImage.fileSize}) • {language === 'ar' ? 'مرفوع بواسطة' : 'Uploaded by'} {previewImage.uploadedBy}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
