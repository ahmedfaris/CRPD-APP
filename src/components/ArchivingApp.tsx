import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { ArchivedDocument, DocumentClassification, DocumentCategory } from '../types';
import { INITIAL_DOCUMENTS } from '../data/mockData';
import { 
  Archive, 
  Search, 
  Plus, 
  Filter, 
  FileText, 
  ShieldAlert, 
  Clock, 
  QrCode, 
  Hash, 
  Download, 
  Eye, 
  CheckCircle2, 
  Barcode, 
  FolderLock, 
  Check, 
  FileCheck,
  X,
  ArrowLeft
} from 'lucide-react';

interface ArchivingAppProps {
  onBackToMetro: () => void;
}

export function ArchivingApp({ onBackToMetro }: ArchivingAppProps) {
  const { t, language, dir } = useLanguage();
  const { currentUser, isAdmin, hasPermission } = useAuth();
  const canCreate = isAdmin || hasPermission('Electronic Archiving.Create') || hasPermission('archiving.admin');

  const [documents, setDocuments] = useState<ArchivedDocument[]>(() => {
    try {
      const stored = localStorage.getItem('pwdsnapp_archived_docs_v1');
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return INITIAL_DOCUMENTS;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedClassification, setSelectedClassification] = useState<string>('ALL');
  const [activeModal, setActiveModal] = useState<ArchivedDocument | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // New Document Form State
  const [newTitleEn, setNewTitleEn] = useState('');
  const [newTitleAr, setNewTitleAr] = useState('');
  const [newCategory, setNewCategory] = useState<DocumentCategory>('Contracts & Agreements');
  const [newClassification, setNewClassification] = useState<DocumentClassification>('Confidential');
  const [newDepartment, setNewDepartment] = useState('IT Operations');
  const [newRetentionYears, setNewRetentionYears] = useState(10);
  const [newLocation, setNewLocation] = useState('Digital Vault - Encrypted Storage');

  const saveDocuments = (updated: ArchivedDocument[]) => {
    setDocuments(updated);
    try {
      localStorage.setItem('pwdsnapp_archived_docs_v1', JSON.stringify(updated));
    } catch {
      // storage error
    }
  };

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    if (!newTitleEn.trim()) return;

    const randomBarcode = `BAR-${Math.floor(100000 + Math.random() * 900000)}-${newCategory.slice(0, 3).toUpperCase()}`;
    const randomHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const newDoc: ArchivedDocument = {
      id: 'doc_' + Date.now(),
      titleEn: newTitleEn.trim(),
      titleAr: newTitleAr.trim() || newTitleEn.trim(),
      docNumber: `DOC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      category: newCategory,
      classification: newClassification,
      department: newDepartment,
      archivedDate: new Date().toISOString(),
      retentionYears: newRetentionYears,
      retentionExpiry: new Date(Date.now() + newRetentionYears * 365 * 24 * 60 * 60 * 1000).toISOString(),
      fileSize: '3.4 MB',
      fileFormat: 'PDF',
      sha256Hash: randomHash,
      archivedBy: currentUser?.email || 'admin@system.local',
      barcodeNumber: randomBarcode,
      physicalLocation: newLocation,
      status: 'Active',
      tags: ['Archived', newCategory.split(' ')[0], newClassification],
    };

    saveDocuments([newDoc, ...documents]);
    setIsUploadModalOpen(false);

    // Reset fields
    setNewTitleEn('');
    setNewTitleAr('');
  };

  const handleDownload = (doc: ArchivedDocument) => {
    setDownloadSuccess(doc.id);
    setTimeout(() => setDownloadSuccess(null), 2500);
  };

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.titleAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.docNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.barcodeNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'ALL' || doc.category === selectedCategory;
    const matchesClassification = selectedClassification === 'ALL' || doc.classification === selectedClassification;

    return matchesSearch && matchesCategory && matchesClassification;
  });

  const getClassificationBadge = (classification: DocumentClassification) => {
    switch (classification) {
      case 'Top Secret':
        return 'bg-rose-950/80 text-rose-300 border-rose-800';
      case 'Confidential':
        return 'bg-amber-950/80 text-amber-300 border-amber-800';
      case 'Restricted':
        return 'bg-blue-950/80 text-blue-300 border-blue-800';
      case 'Public':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8" dir={dir}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header & Navigation back to Metro */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBackToMetro}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition cursor-pointer mx-1 shadow-sm"
              title={language === 'ar' ? 'الرجوع إلى لوحة مترو' : 'Return to Metro Hub'}
            >
              <ArrowLeft className={`w-5 h-5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mx-1">
                  {t('arch.title')}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mx-1">
                  {language === 'ar' ? 'خزينة الأرشيف الرقمي' : 'Vault DB'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('arch.subtitle')}
              </p>
            </div>
          </div>

          {canCreate && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4 mx-1" />
              <span>{t('arch.uploadNew')}</span>
            </button>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('arch.totalDocs')}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{documents.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
              <Archive className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('arch.topSecret')}</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {documents.filter((d) => d.classification === 'Top Secret' || d.classification === 'Confidential').length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-600/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-500/30">
              <FolderLock className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('arch.retentionActive')}</p>
              <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-1">
                {language === 'ar' ? '100% موثق ومؤمن' : '100% Verified'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-600/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-200 dark:border-cyan-500/30">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${dir === 'rtl' ? 'right-3.5' : 'left-3.5'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('arch.searchPlaceholder')}
              className={`w-full py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 shadow-sm ${
                dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'
              }`}
            />
          </div>

          <select
            value={selectedClassification}
            onChange={(e) => setSelectedClassification(e.target.value)}
            className="px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-emerald-500 cursor-pointer shadow-sm"
          >
            <option value="ALL">{language === 'ar' ? 'كافة درجات السرية' : 'All Classifications'}</option>
            <option value="Top Secret">{language === 'ar' ? 'سري للغاية (Top Secret)' : 'Top Secret'}</option>
            <option value="Confidential">{language === 'ar' ? 'سري (Confidential)' : 'Confidential'}</option>
            <option value="Restricted">{language === 'ar' ? 'خاص ومقيد (Restricted)' : 'Restricted'}</option>
            <option value="Public">{language === 'ar' ? 'عام (Public)' : 'Public'}</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-emerald-500 cursor-pointer shadow-sm"
          >
            <option value="ALL">{language === 'ar' ? 'كافة تصنيفات الوثائق' : 'All Categories'}</option>
            <option value="Contracts & Agreements">{language === 'ar' ? 'العقود والاتفاقيات' : 'Contracts & Agreements'}</option>
            <option value="Administrative Decisions">{language === 'ar' ? 'القرارات الإدارية' : 'Administrative Decisions'}</option>
            <option value="Financial & Auditing">{language === 'ar' ? 'البيانات المالية والتدقيق' : 'Financial & Auditing'}</option>
            <option value="Security & Compliance">{language === 'ar' ? 'الأمان والامتثال والسياسات' : 'Security & Compliance'}</option>
            <option value="Technical Specs & Blueprints">{language === 'ar' ? 'المواصفات الفنية والمخططات' : 'Technical Specs'}</option>
          </select>
        </div>

        {/* Documents Table */}
        <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl">
          <div className="overflow-x-auto">
            <table className={`w-full text-xs border-collapse ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">{t('arch.docNumber')}</th>
                  <th className="py-3.5 px-4">{language === 'ar' ? 'عنوان الوثيقة' : 'Document Title'}</th>
                  <th className="py-3.5 px-4">{t('arch.classification')}</th>
                  <th className="py-3.5 px-4">{t('arch.barcode')}</th>
                  <th className="py-3.5 px-4">{t('arch.retention')}</th>
                  <th className={`py-3.5 px-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                    {language === 'ar' ? 'الإجراءات' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {doc.docNumber}
                    </td>

                    <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                      <div className="font-bold text-slate-900 dark:text-white text-xs">
                        {language === 'ar' ? doc.titleAr : doc.titleEn}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center space-x-2">
                        <span>{doc.department}</span>
                        <span className="mx-1">•</span>
                        <span>{doc.fileSize} ({doc.fileFormat})</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getClassificationBadge(doc.classification)}`}>
                        {language === 'ar' 
                          ? (doc.classification === 'Top Secret' ? 'سري للغاية' : doc.classification === 'Confidential' ? 'سري' : doc.classification === 'Restricted' ? 'مقيد' : 'عام')
                          : doc.classification}
                      </span>
                    </td>

                    {/* Barcode representation */}
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center space-x-1.5 px-2 py-1 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        <Barcode className="w-4 h-4 text-slate-500 dark:text-slate-400 mx-1" />
                        <span>{doc.barcodeNumber}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 mx-1" />
                        <span>{doc.retentionYears} {language === 'ar' ? 'سنوات حفظ' : 'Years'}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-500 font-mono">
                        {language === 'ar' ? 'الانتهاء: ' : 'Exp: '}{new Date(doc.retentionExpiry).getFullYear()}
                      </span>
                    </td>

                    <td className={`py-3.5 px-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                      <div className={`flex items-center space-x-2 ${dir === 'rtl' ? 'justify-start' : 'justify-end'}`}>
                        <button
                          onClick={() => setActiveModal(doc)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer mx-1"
                          title={t('arch.preview')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          className={`p-1.5 rounded-lg border transition cursor-pointer mx-1 ${
                            downloadSuccess === doc.id
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                          title={t('arch.download')}
                        >
                          {downloadSuccess === doc.id ? (
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* METADATA INSPECTION MODAL */}
        {activeModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <Archive className="w-5 h-5 text-emerald-400 mx-1" />
                  <span className="font-bold text-white text-sm">
                    {language === 'ar' ? 'البيانات الوصفية للوثيقة المؤرشفة' : 'Archived Record Metadata'}
                  </span>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="font-bold text-base text-white">{activeModal.titleAr || activeModal.titleEn}</h3>
                  <p className="text-slate-400 mt-0.5 text-xs">{activeModal.titleEn}</p>
                </div>

                {/* Barcode Graphic Visualization */}
                <div className="p-4 bg-white rounded-xl text-center space-y-2 text-slate-950">
                  <div className="font-mono text-[10px] tracking-widest uppercase font-bold text-slate-600">
                    {language === 'ar' ? 'الباركود النظامي المعتمد للأرشفة' : 'Official Regulatory Archive Barcode'}
                  </div>
                  <div className="font-bold font-mono text-2xl tracking-[0.25em] py-1 border-y-2 border-slate-900">
                    ||| | | |||| | || | |||| ||
                  </div>
                  <div className="font-mono text-xs font-bold">{activeModal.barcodeNumber}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      {language === 'ar' ? 'رقم الوثيقة' : 'Document Number'}
                    </span>
                    <p className="font-mono font-bold text-slate-700 dark:text-slate-200 mt-0.5">{activeModal.docNumber}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      {language === 'ar' ? 'درجة السرية' : 'Classification'}
                    </span>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{activeModal.classification}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      {language === 'ar' ? 'أرشفت بواسطة' : 'Archived By'}
                    </span>
                    <p className="font-mono text-slate-600 dark:text-slate-300 mt-0.5 truncate">{activeModal.archivedBy}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      {language === 'ar' ? 'موقع التخزين الرقمي' : 'Storage Location'}
                    </span>
                    <p className="text-slate-600 dark:text-slate-300 mt-0.5 truncate">{activeModal.physicalLocation}</p>
                  </div>
                </div>

                {/* Cryptographic SHA-256 Checksum */}
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center space-x-1">
                    <Hash className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 mx-1" />
                    <span>{language === 'ar' ? 'رمز التحقق التشفيري الرقمي (SHA-256)' : 'Cryptographic SHA-256 Integrity Checksum'}</span>
                  </span>
                  <code className="block text-[11px] font-mono text-cyan-700 dark:text-cyan-300 break-all bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 select-all">
                    {activeModal.sha256Hash}
                  </code>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* UPLOAD NEW ARCHIVE MODAL */}
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <form onSubmit={handleCreateDocument} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <Archive className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-1" />
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{t('arch.uploadNew')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'ar' ? 'عنوان الوثيقة بالإنجليزية' : 'Document Title (English)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitleEn}
                    onChange={(e) => setNewTitleEn(e.target.value)}
                    placeholder="e.g. Enterprise SLA Master Contract 2026"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'ar' ? 'عنوان الوثيقة بالعربية' : 'Document Title (Arabic)'}
                  </label>
                  <input
                    type="text"
                    value={newTitleAr}
                    onChange={(e) => setNewTitleAr(e.target.value)}
                    placeholder="مثال: العقد النموذجي الرئيسي لمستويات الخدمة"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {language === 'ar' ? 'التصنيف' : 'Category'}
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as DocumentCategory)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="Contracts & Agreements">{language === 'ar' ? 'العقود والاتفاقيات' : 'Contracts & Agreements'}</option>
                      <option value="Administrative Decisions">{language === 'ar' ? 'القرارات الإدارية' : 'Administrative Decisions'}</option>
                      <option value="Financial & Auditing">{language === 'ar' ? 'البيانات المالية' : 'Financial & Auditing'}</option>
                      <option value="Security & Compliance">{language === 'ar' ? 'الأمان والامتثال' : 'Security & Compliance'}</option>
                      <option value="Technical Specs & Blueprints">{language === 'ar' ? 'المواصفات الفنية' : 'Technical Specs'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {language === 'ar' ? 'درجة السرية' : 'Classification'}
                    </label>
                    <select
                      value={newClassification}
                      onChange={(e) => setNewClassification(e.target.value as DocumentClassification)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="Confidential">{language === 'ar' ? 'سري (Confidential)' : 'Confidential'}</option>
                      <option value="Top Secret">{language === 'ar' ? 'سري للغاية (Top Secret)' : 'Top Secret'}</option>
                      <option value="Restricted">{language === 'ar' ? 'مقيد (Restricted)' : 'Restricted'}</option>
                      <option value="Public">{language === 'ar' ? 'عام (Public)' : 'Public'}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {language === 'ar' ? 'فترة الحفظ (بالسنوات)' : 'Retention (Years)'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={newRetentionYears}
                      onChange={(e) => setNewRetentionYears(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {language === 'ar' ? 'موقع التخزين' : 'Storage Location'}
                    </label>
                    <input
                      type="text"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder={language === 'ar' ? 'مثال: الخزينة الرقمية - خادم B' : 'e.g. Vault B / Tier 2'}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer mx-1"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/30 cursor-pointer mx-1"
                >
                  {language === 'ar' ? 'تأكيد وتوليد الباركود' : 'Confirm & Generate Barcode'}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
