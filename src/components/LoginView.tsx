import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getOtpAuthUrl, generateQrCodeDataUrl } from '../utils/totp';
import { 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  QrCode, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  Copy, 
  Check, 
  Languages, 
  Smartphone,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Eye,
  EyeOff
} from 'lucide-react';

export function LoginView() {
  const { 
    initiateLogin, 
    verify2FACode, 
    cancelPendingLogin, 
    pendingUser, 
    pending2FASecret, 
    isFirstTime2FA
  } = useAuth();
  const { t, language, toggleLanguage, dir } = useLanguage();

  // Step 1 Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [lockoutState, setLockoutState] = useState<{
    isLockedOut: boolean;
    periodEn: string;
    periodAr: string;
    messageEn: string;
    messageAr: string;
    remainingMinutes?: number;
    lockoutMinutes?: number;
  } | null>(null);
  const [isSubmittingCredentials, setIsSubmittingCredentials] = useState(false);

  // Step 2 2FA Form
  const [totpCode, setTotpCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const [showReturningQr, setShowReturningQr] = useState(false);

  // Load QR code whenever pending 2FA secret is established
  useEffect(() => {
    if (pendingUser && pending2FASecret) {
      const otpUrl = getOtpAuthUrl(pendingUser.email, pending2FASecret, 'CRPD APP');
      generateQrCodeDataUrl(otpUrl).then((url) => setQrDataUrl(url));
    } else {
      setQrDataUrl('');
    }
  }, [pendingUser, pending2FASecret]);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLockoutState(null);
    setTotpCode('');
    setIsSubmittingCredentials(true);

    try {
      const res = await initiateLogin(email, password);
      if (!res.success) {
        if (res.isLockedOut) {
          const pEn = res.periodEn || `${res.lockoutMinutes || res.remainingMinutes || 5} minutes`;
          const pAr = res.periodAr || `${res.lockoutMinutes || res.remainingMinutes || 5} دقائق`;
          const mEn = res.messageEn || `You are locked out for ${pEn}`;
          const mAr = res.messageAr || `تم قفل حسابك لمدة ${pAr}`;

          setLockoutState({
            isLockedOut: true,
            periodEn: pEn,
            periodAr: pAr,
            messageEn: mEn,
            messageAr: mAr,
            remainingMinutes: res.remainingMinutes,
            lockoutMinutes: res.lockoutMinutes
          });
        } else {
          setLoginError(res.error || 'Authentication failed');
        }
      }
    } finally {
      setIsSubmittingCredentials(false);
    }
  };

  const handleStep2Submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (totpCode.length !== 6 || isVerifying2FA) return;
    setTwoFactorError(null);
    setIsVerifying2FA(true);

    try {
      const res = await verify2FACode(totpCode);
      if (!res.success) {
        setTwoFactorError(res.error || t('auth.2faInvalidError'));
        setIsVerifying2FA(false);
      }
    } catch (err: any) {
      setTwoFactorError(err.message || t('auth.2faInvalidError'));
      setIsVerifying2FA(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setTotpCode(val);
    setTwoFactorError(null);
  };

  const copySecretKey = () => {
    if (!pending2FASecret) return;
    navigator.clipboard.writeText(pending2FASecret);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8" dir={dir}>
      
      {/* Top Header Controls */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg text-lg">
            PW
          </div>
          <div className="mx-2">
            <h1 className="text-base font-bold tracking-tight text-white">{t('app.title')}</h1>
          </div>
        </div>

        <button
          onClick={toggleLanguage}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition shadow-sm cursor-pointer"
        >
          <Languages className="w-4 h-4 text-blue-400 mx-1" />
          <span>{language === 'en' ? 'العربية' : 'English'}</span>
        </button>
      </div>

      {/* Main Login / 2FA Card */}
      <div className="max-w-md w-full mx-auto my-8">
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-800 p-6 sm:p-8 space-y-6">
          
          {!pendingUser ? (
            /* STEP 1: CREDENTIALS */
            <form onSubmit={handleStep1Submit} className="space-y-5" autoComplete="off">
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">{t('auth.loginTitle')}</h2>
              </div>

              {lockoutState ? (
                <div
                  id="lockout-alert-banner"
                  className="p-4 bg-rose-950/90 border-2 border-rose-500/80 text-rose-100 rounded-2xl shadow-xl shadow-rose-950/60 space-y-3 animate-in fade-in zoom-in-95 duration-200"
                >
                  <div className="flex items-center justify-between border-b border-rose-800/60 pb-2">
                    <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                      <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400 mx-1 animate-pulse" />
                      <span>{t('auth.lockoutAlertTitle')}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-rose-900/70 text-rose-200 font-mono text-[10px] font-bold border border-rose-700">
                      {lockoutState.periodEn} / {lockoutState.periodAr}
                    </span>
                  </div>

                  {/* English message */}
                  <div className="flex items-start justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-rose-800/50">
                    <div className="space-y-0.5">
                      <p className="font-bold text-sm text-white flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-rose-400 shrink-0 inline" />
                        <span>{lockoutState.messageEn}</span>
                      </p>
                      <p className="text-[11px] text-slate-300">
                        Temporary security lock enforced after 6 consecutive failed password attempts.
                      </p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-md bg-rose-900/60 text-[10px] font-mono font-bold text-rose-200 border border-rose-700">
                      EN
                    </span>
                  </div>

                  {/* Arabic message */}
                  <div className="flex items-start justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-rose-800/50 text-right" dir="rtl">
                    <div className="space-y-0.5">
                      <p className="font-bold text-sm text-white flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-rose-400 shrink-0 inline" />
                        <span>{lockoutState.messageAr}</span>
                      </p>
                      <p className="text-[11px] text-slate-300">
                        تم قفل الحساب مؤقتاً بسبب استنفاد 6 محاولات خاطئة لكلمة المرور.
                      </p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-md bg-rose-900/60 text-[10px] font-mono font-bold text-rose-200 border border-rose-700">
                      العربية
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-rose-300/90 font-mono pt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{language === 'ar' ? 'المدة المتبقية للفتح التلقائي:' : 'Lockout Duration:'}</span>
                    </span>
                    <span className="font-bold text-amber-300">
                      {language === 'ar' ? lockoutState.periodAr : lockoutState.periodEn}
                    </span>
                  </div>
                </div>
              ) : loginError ? (
                <div className="p-3 bg-rose-950/70 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400 mx-1" />
                  <span>{loginError}</span>
                </div>
              ) : null}

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1.5 text-sm">{t('auth.emailOrUser')}</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={language === 'ar' ? 'أدخل اسم المستخدم أو البريد الإلكتروني' : 'Enter username or email'}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 text-sm sm:text-base transition"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1.5 text-sm">{t('auth.password')}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-4 py-3 pr-12 rtl:pr-4 rtl:pl-12 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 text-sm sm:text-base transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-2 cursor-pointer transition"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingCredentials}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingCredentials ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-1" />
                ) : (
                  <Lock className="w-5 h-5 mx-1" />
                )}
                <span>{t('auth.signInBtn')}</span>
              </button>

              <div className="pt-1 flex items-center justify-center space-x-1.5 text-[11px] text-slate-400 text-center">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mx-1" />
                <span>{t('auth.lockoutWarning')}</span>
              </div>
            </form>
          ) : (
            /* STEP 2: 2-FACTOR AUTHENTICATION (AUTHENTICATOR APP) */
            <form onSubmit={handleStep2Submit} className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <button
                  type="button"
                  onClick={cancelPendingLogin}
                  className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <ArrowLeft className={`w-3.5 h-3.5 mx-1 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                  <span>{t('auth.2faBack')}</span>
                </button>
                <span className="text-[11px] font-mono text-emerald-400 font-medium">
                  {pendingUser.fullName}
                </span>
              </div>

              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-2 shadow-inner">
                  {isFirstTime2FA ? <QrCode className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
                </div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  {isFirstTime2FA ? t('auth.2faFirstTimeTitle') : t('auth.2faTitle')}
                </h2>
                <p className="text-xs text-slate-400">
                  {t('auth.2faSubtitle')}
                </p>
              </div>

              {twoFactorError && (
                <div className="p-3 bg-rose-950/70 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-start space-x-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400 mx-1" />
                  <span>{twoFactorError}</span>
                </div>
              )}

              {/* INSTRUCTION CARD */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2 text-xs text-slate-300">
                <div className="flex items-center space-x-2 text-emerald-400 font-medium text-[11px]">
                  <Smartphone className="w-4 h-4 shrink-0 mx-1" />
                  <span>{language === 'ar' ? 'تطبيق المصادقة (Authenticator App)' : 'Authenticator App Required'}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {t('auth.2faAppInstructions')}
                </p>
              </div>

              {/* FIRST-TIME SETUP OR RETURNING RE-SCAN QR CODE */}
              {(isFirstTime2FA || showReturningQr) && (
                <div className="space-y-3 p-4 bg-slate-950 rounded-2xl border border-slate-800 text-center animate-in fade-in">
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {t('auth.2faFirstTimeDesc')}
                  </p>

                  {/* QR Code Graphic Container */}
                  <div className="p-3 bg-white rounded-xl shadow-lg inline-block mx-auto border-2 border-slate-200">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="2FA Barcode / QR Code"
                        className="w-44 h-44 mx-auto rounded-sm block"
                      />
                    ) : (
                      <div className="w-44 h-44 flex items-center justify-center text-slate-500 text-xs font-mono">
                        {language === 'ar' ? 'جارٍ توليد الباركود...' : 'Generating Barcode...'}
                      </div>
                    )}
                  </div>

                  {/* Manual Key Display */}
                  <div className={`space-y-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      {t('auth.2faManualKey')}
                    </span>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-amber-300 font-mono text-xs tracking-wider font-semibold select-all text-center">
                        {pending2FASecret}
                      </code>
                      <button
                        type="button"
                        onClick={copySecretKey}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer mx-1"
                        title={language === 'ar' ? 'نسخ المفتاح السري' : 'Copy Secret'}
                      >
                        {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Setup Steps */}
                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1 text-left rtl:text-right">
                    <div>{t('auth.2faStep1')}</div>
                    <div>{t('auth.2faStep2')}</div>
                    <div>{t('auth.2faStep3')}</div>
                  </div>
                </div>
              )}

              {/* TOGGLE FOR RETURNING USERS TO VIEW QR CODE */}
              {!isFirstTime2FA && pending2FASecret && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowReturningQr(!showReturningQr)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 transition flex items-center justify-center space-x-1 mx-auto cursor-pointer"
                  >
                    <span>{showReturningQr ? t('auth.2faHideQr') : t('auth.2faShowQr')}</span>
                    {showReturningQr ? <ChevronUp className="w-3 h-3 mx-1" /> : <ChevronDown className="w-3 h-3 mx-1" />}
                  </button>
                </div>
              )}

              {/* 6-DIGIT CODE INPUT */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-200">
                    {t('auth.2faEnterCode')}
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {totpCode.length}/6
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  required
                  value={totpCode}
                  onChange={handleCodeChange}
                  placeholder="------"
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono font-bold py-3 bg-slate-950 border border-slate-700 rounded-xl text-emerald-400 placeholder-slate-600 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* SERVER TOLERANCE BADGE */}
              <div className="p-2 bg-blue-950/40 border border-blue-800/50 rounded-xl flex items-center space-x-2 text-[11px] text-blue-300">
                <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0 mx-1" />
                <span className="font-medium">{t('auth.2faToleranceNote')}</span>
              </div>

              <button
                type="submit"
                disabled={totpCode.length !== 6 || isVerifying2FA}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 shadow-md shadow-emerald-600/30 transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isVerifying2FA ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-1" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mx-1" />
                )}
                <span>{t('auth.2faVerifyBtn')}</span>
              </button>
            </form>
          )}

        </div>
      </div>

    </div>
  );
}
