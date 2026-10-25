import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Camera, 
  RefreshCw, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  ExternalLink, 
  ArrowRightLeft, 
  Wrench, 
  Building2, 
  HardDrive, 
  Laptop, 
  Network, 
  Calendar, 
  ShieldCheck, 
  Volume2, 
  VolumeX, 
  SwitchCamera,
  QrCode as QrCodeIcon
} from 'lucide-react';
import { Html5Qrcode, CameraDevice } from 'html5-qrcode';
import { ElectronicDevice } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface AssetQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: ElectronicDevice[];
  onSelectDevice: (device: ElectronicDevice) => void;
  onTransferDevice?: (device: ElectronicDevice) => void;
  onMaintenanceDevice?: (device: ElectronicDevice) => void;
  onRegisterWithCode?: (code: string) => void;
}

export const AssetQrScannerModal: React.FC<AssetQrScannerModalProps> = ({
  isOpen,
  onClose,
  devices,
  onSelectDevice,
  onTransferDevice,
  onMaintenanceDevice,
  onRegisterWithCode
}) => {
  const { language, dir } = useLanguage();
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanningActive, setIsScanningActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Scanned state
  const [rawScannedText, setRawScannedText] = useState<string | null>(null);
  const [matchedDevice, setMatchedDevice] = useState<ElectronicDevice | null>(null);
  const [scanTimestamp, setScanTimestamp] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState<string>('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef<boolean>(false);
  const containerId = 'asset-qr-camera-stream';

  // Sound Beep
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Audio not permitted
    }
  };

  // Match lookup function: searches deviceCode, id, serialNumber, or JSON/URL payloads
  const lookupDevice = (text: string): { device: ElectronicDevice | null; cleanCode: string } => {
    const raw = text.trim();
    let queryCode = raw;

    // Check if JSON
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const parsed = JSON.parse(raw);
        queryCode = parsed.deviceCode || parsed.code || parsed.id || parsed.serialNumber || raw;
      } catch {
        // keep queryCode
      }
    }

    // Check if URL (e.g. http://.../devices/DEV-2026-001 or ?asset=DEV-2026-001)
    if (raw.includes('://') || raw.includes('/devices/') || raw.includes('asset=')) {
      try {
        const url = new URL(raw.startsWith('http') ? raw : `http://example.com/${raw}`);
        const paramCode = url.searchParams.get('code') || url.searchParams.get('asset') || url.searchParams.get('id') || url.searchParams.get('device');
        if (paramCode) {
          queryCode = paramCode;
        } else {
          const pathSegments = url.pathname.split('/').filter(Boolean);
          if (pathSegments.length > 0) {
            queryCode = pathSegments[pathSegments.length - 1];
          }
        }
      } catch {
        // keep queryCode
      }
    }

    const clean = queryCode.trim();
    const cleanLower = clean.toLowerCase();

    // 1. Direct deviceCode match
    let found = devices.find(d => d.deviceCode.toLowerCase() === cleanLower);

    // 2. Direct ID match
    if (!found) {
      found = devices.find(d => d.id === clean || d.id.toLowerCase() === cleanLower);
    }

    // 3. Serial Number match
    if (!found && clean.length > 2) {
      found = devices.find(d => d.serialNumber && d.serialNumber.toLowerCase() === cleanLower);
    }

    // 4. Normalized code match (ignore dashes or spaces, e.g. DEV2026001 vs DEV-2026-001)
    if (!found) {
      const strippedClean = cleanLower.replace(/[^a-z0-9]/g, '');
      if (strippedClean.length > 3) {
        found = devices.find(d => {
          const strippedCode = d.deviceCode.toLowerCase().replace(/[^a-z0-9]/g, '');
          const strippedSerial = (d.serialNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return strippedCode === strippedClean || (strippedSerial && strippedSerial === strippedClean);
        });
      }
    }

    return { device: found || null, cleanCode: clean };
  };

  // Handle successful scan
  const handleScanSuccess = (decodedText: string) => {
    playBeep();
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch {
        // vibrate failed
      }
    }

    setRawScannedText(decodedText);
    setScanTimestamp(new Date().toLocaleTimeString());

    const { device } = lookupDevice(decodedText);
    setMatchedDevice(device);
  };

  // Stop camera safely
  const stopCamera = async () => {
    if (!html5QrCodeRef.current || isStoppingRef.current) return;
    try {
      if (html5QrCodeRef.current.isScanning) {
        isStoppingRef.current = true;
        await html5QrCodeRef.current.stop();
      }
      html5QrCodeRef.current.clear();
    } catch {
      // ignore stop errors
    } finally {
      isStoppingRef.current = false;
      setIsScanningActive(false);
    }
  };

  // Start camera
  const startCamera = async (cameraId?: string) => {
    try {
      setCameraError(null);
      await stopCamera();

      const scanner = new Html5Qrcode(containerId);
      html5QrCodeRef.current = scanner;

      const cameraConfig = cameraId 
        ? { deviceId: { exact: cameraId } } 
        : { facingMode: 'environment' };

      await scanner.start(
        cameraConfig,
        {
          fps: 12,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.floor(minEdge * 0.72);
            return { width: boxSize, height: boxSize };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Frame parse failure, normal during scanning
        }
      );

      setIsScanningActive(true);
    } catch (err: unknown) {
      console.warn('Camera start error:', err);
      setIsScanningActive(false);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission')) {
        setCameraError(
          language === 'ar'
            ? 'تم رفض إذن الوصول إلى الكاميرا. يرجى منح الإذن في المتصفح، أو يمكنك رفع صورة الباركود / QR أدناه.'
            : 'Camera permission denied. Please allow camera access in browser settings, or upload a QR image below.'
        );
      } else if (errMsg.includes('NotFoundError') || errMsg.includes('DevicesNotFoundError')) {
        setCameraError(
          language === 'ar'
            ? 'لم يتم العثور على كاميرا موصولة بالجهاز. يمكنك رفع صورة رمز QR أدناه.'
            : 'No video camera detected on this device. You can upload an asset QR image below.'
        );
      } else {
        setCameraError(
          language === 'ar'
            ? 'تعذر بدء بث الكاميرا. يمكنك استخدام فحص ملف الصورة أو البحث اليدوي.'
            : 'Unable to start camera stream. You can upload an image file or search manually.'
        );
      }
    }
  };

  // File Upload fallback / scan image
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCameraError(null);
      let scanner = html5QrCodeRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(containerId);
        html5QrCodeRef.current = scanner;
      }
      const decodedResult = await scanner.scanFile(file, true);
      handleScanSuccess(decodedResult);
    } catch {
      setCameraError(
        language === 'ar'
          ? 'لم يتم العثور على رمز QR صالح في الصورة المرفوعة. يرجى التأكد من وضوح الرمز وإعادة المحاولة.'
          : 'No valid QR code detected in this image. Please ensure the code is clear and try again.'
      );
    } finally {
      // Clear file input so the user can re-select the same file if needed
      e.target.value = '';
    }
  };

  // Initialize camera when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    // Detect cameras
    Html5Qrcode.getCameras()
      .then(availableCameras => {
        if (!isMounted) return;
        setCameras(availableCameras);
        if (availableCameras.length > 0) {
          // Prefer back/environment camera if available
          const backCam = availableCameras.find(c => 
            c.label.toLowerCase().includes('back') || 
            c.label.toLowerCase().includes('rear') || 
            c.label.toLowerCase().includes('environment')
          );
          const chosenId = backCam ? backCam.id : availableCameras[0].id;
          setSelectedCameraId(chosenId);
          startCamera(chosenId);
        } else {
          startCamera(); // try with facingMode
        }
      })
      .catch(() => {
        if (!isMounted) return;
        startCamera(); // try generic
      });

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen]);

  // Switch camera dropdown
  const handleCameraChange = (cameraId: string) => {
    setSelectedCameraId(cameraId);
    startCamera(cameraId);
  };

  // Manual query submit
  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuery.trim()) return;
    const { device } = lookupDevice(manualQuery.trim());
    setRawScannedText(manualQuery.trim());
    setScanTimestamp(new Date().toLocaleTimeString());
    setMatchedDevice(device);
  };

  // Quick reset to scan another
  const handleResetScan = () => {
    setRawScannedText(null);
    setMatchedDevice(null);
    setManualQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div 
        className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        dir={dir}
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <QrCodeIcon className="w-5 h-5 mx-0.5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  {language === 'ar' ? 'فاحص رمز الاستجابة السريعة (QR)' : 'Asset QR Code Camera Scanner'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {language === 'ar' ? 'مسح فوري' : 'Instant Lookup'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === 'ar'
                  ? 'وجّه كاميرا الجهاز نحو ملصق كود الأصل لعرض بياناته وسجلاته فوراً'
                  : 'Point camera at the physical asset QR sticker to inspect specs & logs'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                soundEnabled 
                  ? 'bg-slate-800 text-cyan-400 border-slate-700' 
                  : 'bg-slate-800/50 text-slate-500 border-slate-800'
              }`}
              title={soundEnabled ? 'Mute Beep' : 'Enable Beep'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          
          {/* CAMERA FEED & VIEWFINDER */}
          <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-inner flex flex-col items-center justify-center min-h-[280px]">
            {/* HTML5 QR Code Mount Node */}
            <div id={containerId} className="w-full max-w-[420px] aspect-square overflow-hidden" />

            {/* Overlaid Animated Scanner Box (when active and no match yet) */}
            {isScanningActive && !matchedDevice && !rawScannedText && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="relative w-56 h-56 border-2 border-cyan-400/80 rounded-2xl shadow-[0_0_25px_rgba(6,182,212,0.35)] overflow-hidden">
                  {/* Glowing Laser Scan Line */}
                  <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-pulse top-1/2 -translate-y-1/2" />
                  
                  {/* Corner Reticles */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-cyan-300 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-cyan-300 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-cyan-300 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-cyan-300 rounded-br-lg" />
                </div>
                <div className="mt-3 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-700 text-cyan-300 text-[11px] font-semibold flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block mx-1" />
                  <span>{language === 'ar' ? 'جاري الفحص المباشر بالكاميرا...' : 'Live camera scanning...'}</span>
                </div>
              </div>
            )}

            {/* Camera Controls Bar (Overlaid at top or bottom) */}
            <div className="absolute bottom-2 inset-x-2 flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px]">
              <div className="flex items-center space-x-2">
                <Camera className="w-3.5 h-3.5 text-cyan-400 mx-1" />
                {cameras.length > 1 ? (
                  <select
                    value={selectedCameraId}
                    onChange={(e) => handleCameraChange(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-[11px] focus:outline-hidden focus:border-cyan-500 cursor-pointer"
                  >
                    {cameras.map((c, idx) => (
                      <option key={c.id} value={c.id}>
                        {c.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-slate-300 font-medium">
                    {cameras[0]?.label || (language === 'ar' ? 'كاميرا الجهاز الأساسية' : 'Primary Device Camera')}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => startCamera(selectedCameraId)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center space-x-1 cursor-pointer"
                  title="Restart Camera"
                >
                  <RefreshCw className="w-3 h-3 mx-0.5" />
                  <span>{language === 'ar' ? 'إعادة تشغيل' : 'Restart'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ERROR ALERT IF PERMISSION DENIED OR NO CAMERA */}
          {cameraError && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 mx-1" />
              <div className="flex-1 text-[11px] leading-relaxed">
                <p className="font-semibold text-amber-200">{cameraError}</p>
              </div>
            </div>
          )}

          {/* ALTERNATIVE OPTIONS: FILE UPLOAD OR MANUAL CODE LOOKUP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Option A: Upload QR Image file */}
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Upload className="w-4 h-4 text-blue-400 mx-1" />
                <div>
                  <span className="font-bold text-slate-200 block text-xs">
                    {language === 'ar' ? 'فحص صورة رمز QR' : 'Upload QR Image'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {language === 'ar' ? 'اختر صورة من جهازك لفحصها' : 'Scan code from saved image'}
                  </span>
                </div>
              </div>
              <label className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition shadow-xs cursor-pointer">
                <span>{language === 'ar' ? 'رفع صورة' : 'Select File'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Option B: Manual Search / Code Entry */}
            <form onSubmit={handleManualSearch} className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'أدخل كود الأصل أو السيريال...' : 'Enter Asset Code or Serial...'}
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-[11px] border border-slate-600 transition flex items-center space-x-1 cursor-pointer"
              >
                <Search className="w-3 h-3 mx-0.5" />
                <span>{language === 'ar' ? 'بحث' : 'Lookup'}</span>
              </button>
            </form>
          </div>

          {/* SCANNED RESULT CARD */}
          {rawScannedText && (
            <div className="space-y-3 pt-2">
              {matchedDevice ? (
                /* MATCH FOUND */
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border-2 border-emerald-500/60 shadow-lg shadow-emerald-950/30 animate-scaleUp">
                  <div className="flex items-start justify-between pb-3 border-b border-emerald-500/30">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        {matchedDevice.category === 'network' ? (
                          <Network className="w-6 h-6" />
                        ) : (
                          <Laptop className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-500/40">
                            {matchedDevice.deviceCode}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                            {matchedDevice.deviceType}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1">
                          {matchedDevice.brand} {matchedDevice.model}
                        </h4>
                      </div>
                    </div>

                    <div className="text-end">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {language === 'ar' ? 'أصل مسجل ومطابق' : 'Asset Verified'}
                      </span>
                      {scanTimestamp && (
                        <span className="block text-[10px] text-slate-400 mt-1 font-mono">
                          {scanTimestamp}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick specs grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 py-3 text-[11px]">
                    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-purple-400" />
                        {language === 'ar' ? 'القسم المخصص له:' : 'Department:'}
                      </span>
                      <span className="font-bold text-slate-200 truncate block mt-0.5">
                        {language === 'ar' ? (matchedDevice.departmentAr || matchedDevice.department) : matchedDevice.department}
                      </span>
                    </div>

                    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-cyan-400" />
                        {language === 'ar' ? 'حالة التشغيل:' : 'Status:'}
                      </span>
                      <span className="font-bold text-emerald-400 block mt-0.5">
                        {matchedDevice.status}
                      </span>
                    </div>

                    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-amber-400" />
                        {language === 'ar' ? 'الرقم التسلسلي (SN):' : 'Serial Number:'}
                      </span>
                      <span className="font-mono font-bold text-slate-200 truncate block mt-0.5">
                        {matchedDevice.serialNumber || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Actions for matched asset */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDevice(matchedDevice);
                        onClose();
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-600/30 transition flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mx-1" />
                      <span>{language === 'ar' ? 'عرض السجلات والمواصفات الكاملة' : 'View Full Details & History'}</span>
                    </button>

                    {onTransferDevice && (
                      <button
                        type="button"
                        onClick={() => {
                          onTransferDevice(matchedDevice);
                          onClose();
                        }}
                        className="py-2 px-3 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 font-bold text-xs border border-purple-500/40 transition flex items-center space-x-1 cursor-pointer"
                        title={language === 'ar' ? 'تحويل لقسم آخر' : 'Transfer Department'}
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 mx-0.5" />
                        <span>{language === 'ar' ? 'تحويل قسم' : 'Transfer'}</span>
                      </button>
                    )}

                    {onMaintenanceDevice && (
                      <button
                        type="button"
                        onClick={() => {
                          onMaintenanceDevice(matchedDevice);
                          onClose();
                        }}
                        className="py-2 px-3 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 font-bold text-xs border border-amber-500/40 transition flex items-center space-x-1 cursor-pointer"
                        title={language === 'ar' ? 'تسجيل صيانة' : 'Log Maintenance'}
                      >
                        <Wrench className="w-3.5 h-3.5 mx-0.5" />
                        <span>{language === 'ar' ? 'صيانة' : 'Maintenance'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleResetScan}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition cursor-pointer"
                    >
                      {language === 'ar' ? 'مسح رمز آخر' : 'Scan Another'}
                    </button>
                  </div>
                </div>
              ) : (
                /* NO MATCH IN REGISTRY */
                <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/50 space-y-3 animate-scaleUp">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 mx-1" />
                    <div className="flex-1">
                      <h4 className="font-bold text-white text-xs">
                        {language === 'ar' ? 'الرمز غير مسجل في قاعدة بيانات الأصول' : 'No Asset Found with this Code'}
                      </h4>
                      <p className="text-[11px] text-amber-200/90 mt-1">
                        {language === 'ar'
                          ? `تم قراءة الرمز بنجاح، لكن لا يوجد أصل يطابق الكود المسحوب: "${rawScannedText}"`
                          : `Successfully scanned QR code, but no registered asset matches: "${rawScannedText}"`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-500/20">
                    {onRegisterWithCode && (
                      <button
                        type="button"
                        onClick={() => {
                          onRegisterWithCode(rawScannedText);
                          onClose();
                        }}
                        className="py-1.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                      >
                        {language === 'ar' ? 'تسجيل أصل جديد بهذا الكود' : 'Register New Asset with this Code'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleResetScan}
                      className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition cursor-pointer"
                    >
                      {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QUICK DEMO SAMPLES (FOR INSTANT PREVIEW & TESTING) */}
          <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              {language === 'ar' ? 'أمثلة تجريبية سريعة لفحص الأصول:' : 'Quick Demo Asset Tags for Testing:'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {devices.slice(0, 5).map(dev => (
                <button
                  key={dev.id}
                  type="button"
                  onClick={() => {
                    playBeep();
                    setRawScannedText(dev.deviceCode);
                    setScanTimestamp(new Date().toLocaleTimeString());
                    setMatchedDevice(dev);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-950/60 hover:border-cyan-500 text-cyan-300 border border-slate-700 font-mono text-[11px] transition cursor-pointer"
                  title={`${dev.brand} ${dev.model}`}
                >
                  {dev.deviceCode}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            {language === 'ar'
              ? 'يدعم قراءة باركود الأجهزة، رموز QR، ومعرفات JSON'
              : 'Supports standard asset 2D QR codes, barcodes, and serials'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
          >
            {language === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
