import React, { useState } from 'react';
import { TicketAttachment } from '../types';
import { 
  Image as ImageIcon, 
  UploadCloud, 
  X, 
  AlertCircle, 
  Eye, 
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface PictureAttachmentsUploaderProps {
  attachments: TicketAttachment[];
  onChange: (attachments: TicketAttachment[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number;
  uploaderName?: string;
}

export function PictureAttachmentsUploader({
  attachments,
  onChange,
  maxFiles = 3, // Default 3 pictures as required
  maxSizeBytes = 5 * 1024 * 1024, // Default 5 MB as required
  uploaderName = 'Operational User'
}: PictureAttachmentsUploaderProps) {
  const { language, t } = useLanguage();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<TicketAttachment | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  const maxMb = Math.round(maxSizeBytes / (1024 * 1024));

  const processFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);

    const availableSlots = maxFiles - attachments.length;
    if (availableSlots <= 0) {
      setErrorMessage(
        language === 'ar' 
          ? `تم الوصول للحد الأقصى (${maxFiles} صور) المسموح بها لكل تذكرة.`
          : `Maximum of ${maxFiles} pictures allowed per ticket.`
      );
      return;
    }

    const filesToProcess = Array.from(fileList).slice(0, availableSlots);
    if (fileList.length > availableSlots) {
      setErrorMessage(
        language === 'ar'
          ? `يمكنك إضافة ${availableSlots} صورة إضافية فقط (الحد الأقصى ${maxFiles} صور).`
          : `Only ${availableSlots} more picture(s) can be attached (max ${maxFiles}).`
      );
    }

    const newAttachments: TicketAttachment[] = [];

    filesToProcess.forEach((file) => {
      // Validation: strictly JPEG or PNG
      const isJpegOrPng = allowedTypes.includes(file.type.toLowerCase()) || 
        file.name.toLowerCase().endsWith('.jpg') || 
        file.name.toLowerCase().endsWith('.jpeg') || 
        file.name.toLowerCase().endsWith('.png');

      if (!isJpegOrPng) {
        setErrorMessage(
          language === 'ar'
            ? `تم رفض الملف "${file.name}": يُسمح فقط بملفات الصور بصيغتي JPEG أو PNG.`
            : `Rejected "${file.name}": Only pictures in JPEG or PNG format are permitted.`
        );
        return;
      }

      // Max individual image size (default 5MB)
      if (file.size > maxSizeBytes) {
        setErrorMessage(
          language === 'ar'
            ? `تجاوز حجم الملف "${file.name}" الحد الأقصى المسموح به (${maxMb} ميجابايت).`
            : `"${file.name}" exceeds ${maxMb}MB limit.`
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const newAtt: TicketAttachment = {
          id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          fileName: file.name,
          fileSize: `${(file.size / 1024).toFixed(1)} KB`,
          fileType: file.type || 'image/jpeg',
          dataUrl,
          uploadedAt: new Date().toISOString(),
          uploadedBy: uploaderName,
        };
        onChange([...attachments, ...newAttachments, newAtt]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const removeAttachment = (id: string) => {
    onChange(attachments.filter((a) => a.id !== id));
    setErrorMessage(null);
  };

  return (
    <div className="space-y-3">
      {/* Header and Slot Counter */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
          <ImageIcon className="w-4 h-4 text-purple-600" />
          <span>
            {language === 'ar' ? 'المرفقات المصورة (صور JPEG أو PNG فقط)' : 'Picture Attachments (JPEG or PNG only)'}
          </span>
        </label>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          attachments.length === maxFiles 
            ? 'bg-amber-100 text-amber-800' 
            : 'bg-slate-100 text-slate-600'
        }`}>
          {attachments.length} / {maxFiles} {language === 'ar' ? 'صور' : 'pictures'}
        </span>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start space-x-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Upload Dropzone (only shown if slots remain) */}
      {attachments.length < maxFiles && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-4 text-center transition cursor-pointer ${
            isDragging 
              ? 'border-purple-500 bg-purple-50/50' 
              : 'border-slate-300 hover:border-purple-400 hover:bg-slate-50'
          }`}
        >
          <input
            type="file"
            id="picture-file-input"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
          <label htmlFor="picture-file-input" className="cursor-pointer block space-y-1">
            <UploadCloud className="w-6 h-6 mx-auto text-purple-500" />
            <p className="text-xs font-bold text-slate-800">
              {language === 'ar' ? 'اضغط لاختيار الصور أو اسحبها وأفلتها هنا' : 'Click to upload or drag & drop pictures'}
            </p>
            <p className="text-[11px] text-slate-500">
              {language === 'ar' 
                ? `تدعم صور JPEG (.jpg/.jpeg) و PNG (.png) بحد أقصى ${maxMb} ميجابايت لكل صورة • متبقي ${maxFiles - attachments.length} صور`
                : `Supports JPEG (.jpg/.jpeg) and PNG (.png) (Max ${maxMb}MB each) • Up to ${maxFiles - attachments.length} more`}
            </p>
          </label>
        </div>
      )}

      {/* Attachments Grid */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {attachments.map((att, idx) => (
            <div 
              key={att.id || idx}
              className="relative group rounded-xl border border-slate-200 overflow-hidden bg-slate-900 shadow-xs aspect-4/3 flex flex-col"
            >
              {/* Picture preview */}
              {att.dataUrl ? (
                <img
                  src={att.dataUrl}
                  alt={att.fileName}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300 cursor-pointer"
                  onClick={() => setLightboxImage(att)}
                />
              ) : (
                <div 
                  className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-300 p-2 cursor-pointer"
                  onClick={() => setLightboxImage(att)}
                >
                  <ImageIcon className="w-8 h-8 text-purple-400 mb-1" />
                  <span className="text-[10px] font-mono text-center truncate w-full px-1">{att.fileName}</span>
                </div>
              )}

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center space-x-2">
                <button
                  type="button"
                  onClick={() => setLightboxImage(att)}
                  className="p-1.5 rounded-lg bg-white/90 text-slate-900 hover:bg-white transition"
                  title={language === 'ar' ? 'عرض بالحجم الكامل' : 'View Full Size'}
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition"
                  title={language === 'ar' ? 'حذف الصورة' : 'Remove Picture'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Bottom tag */}
              <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 backdrop-blur-xs px-2 py-1 flex items-center justify-between text-[10px] text-white">
                <span className="truncate max-w-[80px]" title={att.fileName}>{att.fileName}</span>
                <span className="text-slate-400 shrink-0 font-mono">{att.fileSize}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div 
            className="relative max-w-3xl w-full max-h-[85vh] flex flex-col bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-slate-950 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-white truncate max-w-sm">{lightboxImage.fileName}</span>
                <span className="text-xs text-slate-400">({lightboxImage.fileSize})</span>
              </div>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 flex items-center justify-center bg-black/60 overflow-auto">
              {lightboxImage.dataUrl ? (
                <img 
                  src={lightboxImage.dataUrl} 
                  alt={lightboxImage.fileName}
                  className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-lg"
                />
              ) : (
                <div className="text-slate-400 text-xs py-12">
                  {language === 'ar' ? 'تعذر تحميل معاينة الصورة' : 'Picture preview not cached'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
