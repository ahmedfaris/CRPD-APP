import React, { useState, useEffect } from 'react';
import { X, Printer, Download, QrCode as QrCodeIcon, Copy, Check, HardDrive, Laptop, Network } from 'lucide-react';
import QRCode from 'qrcode';
import { ElectronicDevice } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface AssetQrBadgeModalProps {
  device: ElectronicDevice | null;
  onClose: () => void;
}

export const AssetQrBadgeModal: React.FC<AssetQrBadgeModalProps> = ({ device, onClose }) => {
  const { language, dir } = useLanguage();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!device) return;

    // Generate high resolution QR code data URL
    // Payload contains deviceCode, serial, and specs in standard format
    const payload = JSON.stringify({
      asset: 'IT_ASSET',
      deviceCode: device.deviceCode,
      brand: device.brand,
      model: device.model,
      serialNumber: device.serialNumber || '',
      department: device.department,
      type: device.deviceType
    });

    QRCode.toDataURL(payload, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    }).then(url => {
      setQrDataUrl(url);
    }).catch(err => {
      console.error('Error generating asset QR code:', err);
    });
  }, [device]);

  if (!device) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(device.deviceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${device.deviceCode}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div 
        className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
        dir={dir}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <QrCodeIcon className="w-4 h-4 mx-0.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {language === 'ar' ? 'ملصق كود الأصل (Asset QR Tag)' : 'Asset Tag & QR Sticker'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {device.deviceCode} • {device.brand} {device.model}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STICKER PREVIEW (PRINTABLE BADGE) */}
        <div className="p-6 flex flex-col items-center justify-center bg-slate-950/40">
          <div 
            id="printable-asset-tag"
            className="bg-white text-slate-900 p-5 rounded-2xl border-2 border-slate-300 shadow-xl w-full max-w-[280px] flex flex-col items-center text-center space-y-3"
          >
            {/* Tag Header */}
            <div className="w-full pb-2 border-b border-slate-200 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                PROPERTY OF ORG
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                IT ASSET
              </span>
            </div>

            {/* QR Code */}
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
              {qrDataUrl ? (
                <img 
                  src={qrDataUrl} 
                  alt={`QR Code for ${device.deviceCode}`} 
                  className="w-44 h-44 object-contain"
                />
              ) : (
                <div className="w-44 h-44 flex items-center justify-center text-slate-400">
                  <QrCodeIcon className="w-10 h-10 animate-pulse" />
                </div>
              )}
            </div>

            {/* Tag Details */}
            <div className="w-full space-y-1">
              <div className="text-base font-black tracking-tight text-slate-900 font-mono">
                {device.deviceCode}
              </div>
              <div className="text-xs font-bold text-slate-800 truncate">
                {device.brand} {device.model}
              </div>
              <div className="text-[11px] text-slate-600 flex items-center justify-center gap-1">
                <span>{device.department}</span>
              </div>
              {device.serialNumber && (
                <div className="text-[10px] font-mono text-slate-500 truncate pt-1">
                  SN: {device.serialNumber}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? (language === 'ar' ? 'تم النسخ!' : 'Copied!') : device.deviceCode}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              title="Download QR Image"
            >
              <Download className="w-3.5 h-3.5 mx-0.5" />
              <span>{language === 'ar' ? 'تنزيل' : 'Download'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-600/30 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 mx-0.5" />
              <span>{language === 'ar' ? 'طباعة الملصق' : 'Print Sticker'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
