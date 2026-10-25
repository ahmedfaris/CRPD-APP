import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  FileText, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  CloudCheck, 
  Sparkles,
  ShieldCheck,
  FileCheck
} from 'lucide-react';
import { 
  signInWithGoogleWorkspace, 
  getWorkspaceAccessToken, 
  signOutGoogleWorkspace,
  initGoogleAuth 
} from '../services/googleAuth';
import { 
  createGoogleDocWithDocumentation, 
  CRPD_LOGIN_DOCUMENTATION_TEXT, 
  GoogleDocResult 
} from '../services/googleDocsService';

interface ExportDocsModalProps {
  onClose: () => void;
}

export function ExportDocsModal({ onClose }: ExportDocsModalProps) {
  const { language, dir } = useLanguage();

  const [accessToken, setAccessToken] = useState<string | null>(getWorkspaceAccessToken());
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [createdDoc, setCreatedDoc] = useState<GoogleDocResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('CRPD APP - Authentication & Login Process Documentation');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const res = await signInWithGoogleWorkspace();
      setAccessToken(res.accessToken);
      setGoogleUser(res.user);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(err.message || (language === 'ar' ? 'فشل تسجيل الدخول باستخدام Google' : 'Failed to authenticate with Google'));
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const executeExport = async () => {
    setShowConfirmModal(false);
    if (!accessToken) {
      setErrorMessage(language === 'ar' ? 'يرجى ربط حساب Google أولاً' : 'Please connect your Google account first');
      return;
    }

    setIsCreatingDoc(true);
    setErrorMessage(null);
    setCreatedDoc(null);

    try {
      const result = await createGoogleDocWithDocumentation(
        docTitle.trim() || 'CRPD APP - Authentication Documentation',
        CRPD_LOGIN_DOCUMENTATION_TEXT,
        accessToken
      );
      setCreatedDoc(result);
    } catch (err: any) {
      setErrorMessage(err.message || (language === 'ar' ? 'فشل إنشاء مستند Google' : 'Failed to create Google Doc'));
    } finally {
      setIsCreatingDoc(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in" dir={dir}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner mx-1">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {language === 'ar' ? 'تصدير التوثيق إلى Google Docs' : 'Export Documentation to Google Docs'}
              </h2>
              <p className="text-xs text-blue-100/80">
                {language === 'ar' ? 'إنشاء مستند جديد مباشرة في حساب Google Drive الخاص بك' : 'Create a new Google Doc directly in your Google Drive'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 mx-1" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Banner */}
          {createdDoc && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mx-1" />
                <span className="font-bold text-sm">
                  {language === 'ar' ? 'تم إنشاء مستند Google Docs بنجاح!' : 'Google Doc created successfully!'}
                </span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                {language === 'ar'
                  ? `تم حفظ التوثيق الكامل لعملية تسجيل الدخول في مستند: "${createdDoc.title}". يمكنك الآن فتحه وتعديله أو مشاركته مع فريق العمل.`
                  : `Complete login architecture documentation has been written to "${createdDoc.title}". You can now view and edit it in Google Docs.`}
              </p>
              <div className="pt-2 flex items-center gap-3">
                <a
                  href={createdDoc.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  <span>{language === 'ar' ? 'فتح المستند في Google Docs' : 'Open in Google Docs'}</span>
                  <ExternalLink className="w-3.5 h-3.5 mx-1" />
                </a>
              </div>
            </div>
          )}

          {/* Step 1: Google Account Connection */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold mx-1">
                  1
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {language === 'ar' ? 'حساب Google المتصل' : 'Google Account Connection'}
                </span>
              </div>

              {accessToken ? (
                <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-full flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 mx-1" />
                  <span>{language === 'ar' ? 'متصل' : 'Connected'}</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full">
                  {language === 'ar' ? 'مطلوب تسجيل الدخول' : 'Sign-in required'}
                </span>
              )}
            </div>

            {googleUser ? (
              <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-3">
                  {googleUser.photoURL ? (
                    <img src={googleUser.photoURL} alt="Avatar" className="w-8 h-8 rounded-full mx-1" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs mx-1">
                      {googleUser.email?.[0]?.toUpperCase() || 'G'}
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-bold">{googleUser.displayName || 'Google User'}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{googleUser.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={signOutGoogleWorkspace}
                  className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-medium cursor-pointer"
                >
                  {language === 'ar' ? 'تبديل الحساب' : 'Switch account'}
                </button>
              </div>
            ) : (
              <div className="pt-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                  {language === 'ar'
                    ? 'قم بربط حساب Google الخاص بك لمنح الإذن بإنشاء مستند التوثيق في Google Drive.'
                    : 'Connect your Google account with permission to create the documentation file in Google Drive.'}
                </p>

                {/* Google Sign-in standard button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isAuthenticating}
                  className="w-full flex items-center justify-center space-x-3 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isAuthenticating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  ) : (
                    <svg className="w-4 h-4 mx-1" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                  )}
                  <span>
                    {isAuthenticating
                      ? (language === 'ar' ? 'جارٍ الاتصال...' : 'Connecting...')
                      : (language === 'ar' ? 'تسجيل الدخول باستخدام Google' : 'Sign in with Google')}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Document Configuration */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold mx-1">
                2
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {language === 'ar' ? 'عنوان المستند ومحتوياته' : 'Document Title & Content'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                {language === 'ar' ? 'عنوان ملف Google Doc:' : 'Google Doc File Title:'}
              </label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                <FileCheck className="w-3.5 h-3.5 text-blue-500 mx-1" />
                <span>{language === 'ar' ? 'أقسام التوثيق المضمنة:' : 'Included Sections:'}</span>
              </div>
              <ul className="list-disc list-inside pl-2 space-y-0.5 text-[11px]">
                <li>{language === 'ar' ? 'نظرة عامة على هيكلية تسجيل الدخول والرموز المميزة (JWT).' : 'Authentication overview & JWT token structures.'}</li>
                <li>{language === 'ar' ? 'تفاصيل الحسابات الافتراضية وصلاحيات المسؤول والموظف.' : 'Default admin and employee seeded accounts.'}</li>
                <li>{language === 'ar' ? 'خطوات التحقق وسياسة الإغلاق التصاعدي للحساب (Lockout).' : 'Step-by-step auth flow & progressive account lockout.'}</li>
                <li>{language === 'ar' ? 'المصادقة الثنائية (2FA / TOTP) وسماحية التوقيت (Tolerance).' : 'TOTP Two-factor auth & clock-skew tolerance.'}</li>
                <li>{language === 'ar' ? 'إجراءات انتهاء الجلسات ومهلة عدم النشاط (Idle Timeout 15m).' : 'Session maintenance & 15m idle inactivity controls.'}</li>
              </ul>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            disabled={!accessToken || isCreatingDoc}
            className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isCreatingDoc ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mx-1" />
                <span>{language === 'ar' ? 'جارٍ إنشاء المستند...' : 'Creating Google Doc...'}</span>
              </>
            ) : (
              <>
                <CloudCheck className="w-4 h-4 mx-1" />
                <span>{language === 'ar' ? 'إنشاء المستند في Google Docs' : 'Create Google Doc'}</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Mandatory User Confirmation Dialog before calling mutating Workspace API */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full space-y-4 animate-in zoom-in-95">
            <div className="flex items-center space-x-3 text-blue-600 dark:text-blue-400">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mx-1">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'تأكيد إنشاء مستند في Google Drive' : 'Confirm Google Doc Creation'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'إجراء كتابة إلى حساب Google الخاص بك' : 'Write action to your Google Drive'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {language === 'ar'
                ? `هل توافق على إنشاء ملف Google Doc جديد بعنوان "${docTitle}" في حساب Google Drive الخاص بك وإدراج التوثيق الكامل لعملية تسجيل الدخول؟`
                : `Are you sure you want to create a new Google Doc titled "${docTitle}" in your Google Drive and write the complete login documentation into it?`}
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={executeExport}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                {language === 'ar' ? 'تأكيد وإنشاء' : 'Confirm & Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
