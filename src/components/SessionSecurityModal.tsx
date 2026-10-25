import React from 'react';
import { ShieldAlert, LogOut, Clock, Laptop, KeyRound, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export interface SessionSecurityAlert {
  isOpen: boolean;
  type: 'CONCURRENT_LOGIN' | 'IDLE_TIMEOUT' | 'ABSOLUTE_TIMEOUT' | 'PRIVILEGE_CHANGE' | 'PASSWORD_CHANGE' | 'IDLE_WARNING';
  messageEn?: string;
  messageAr?: string;
  remainingSeconds?: number;
  onConfirm: () => void;
  onStayLoggedIn?: () => void;
}

export const SessionSecurityModal: React.FC<SessionSecurityAlert> = ({
  isOpen,
  type,
  messageEn,
  messageAr,
  remainingSeconds,
  onConfirm,
  onStayLoggedIn
}) => {
  const { isRTL } = useLanguage();

  if (!isOpen) return null;

  const isWarning = type === 'IDLE_WARNING';

  const getIcon = () => {
    switch (type) {
      case 'CONCURRENT_LOGIN':
        return <Laptop className="w-10 h-10 text-amber-500" />;
      case 'IDLE_TIMEOUT':
      case 'IDLE_WARNING':
        return <Clock className="w-10 h-10 text-amber-500" />;
      case 'PASSWORD_CHANGE':
        return <KeyRound className="w-10 h-10 text-blue-500" />;
      case 'PRIVILEGE_CHANGE':
        return <ShieldCheck className="w-10 h-10 text-indigo-500" />;
      default:
        return <ShieldAlert className="w-10 h-10 text-red-500" />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'CONCURRENT_LOGIN':
        return {
          en: 'Concurrent Login Detected',
          ar: 'تم رصد تسجيل دخول متزامن'
        };
      case 'IDLE_WARNING':
        return {
          en: 'Session Inactivity Warning',
          ar: 'تنبيه عدم نشاط الجلسة'
        };
      case 'IDLE_TIMEOUT':
        return {
          en: 'Session Idle Timeout Expired',
          ar: 'انتهت مهلة عدم نشاط الجلسة'
        };
      case 'ABSOLUTE_TIMEOUT':
        return {
          en: 'Absolute Session Timeout Limit',
          ar: 'تم بلوغ الحد الأقصى للجلسة'
        };
      case 'PASSWORD_CHANGE':
        return {
          en: 'Password Changed - Session Terminated',
          ar: 'تم تغيير كلمة المرور - إنهاء الجلسة'
        };
      case 'PRIVILEGE_CHANGE':
        return {
          en: 'Security Privilege Updated',
          ar: 'تم تحديث الصلاحيات الأمنية'
        };
      default:
        return {
          en: 'Session Invalidation Notice',
          ar: 'إشعار إلغاء صلاحية الجلسة'
        };
    }
  };

  const title = getTitle();

  return (
    <div
      id="session-security-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div
        id="session-security-modal-card"
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-50 rounded-xl flex-shrink-0">
              {getIcon()}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-900 leading-tight">
                {isRTL ? title.ar : title.en}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isRTL ? title.en : title.ar}
              </p>

              {/* Warning with Countdown */}
              {isWarning && remainingSeconds !== undefined && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm font-medium flex items-center justify-between">
                  <span>{isRTL ? 'الوقت المتبقي حتى تسجيل الخروج التلقائي:' : 'Time remaining until auto-logout:'}</span>
                  <span className="font-mono text-base font-bold bg-amber-200/80 px-2.5 py-0.5 rounded-lg text-amber-950">
                    {Math.floor(remainingSeconds / 60)}:{(remainingSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}

              {/* Detailed Bilingual Message */}
              <div className="mt-3 space-y-2 text-sm text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <p className="leading-relaxed font-medium text-slate-800">
                  {messageAr || 'تم إنهاء الجلسة لحماية بياناتك وفقاً لسياسات الأمان المعمول بها.'}
                </p>
                <div className="border-t border-slate-200/70 pt-2 text-xs text-slate-600">
                  <p>{messageEn || 'Session was invalidated to protect your account under institutional security policies.'}</p>
                </div>
              </div>

              {type === 'CONCURRENT_LOGIN' && (
                <div className="mt-3 text-xs text-slate-500 bg-blue-50/60 p-2.5 rounded-lg border border-blue-100">
                  <span className="font-semibold text-blue-900">
                    {isRTL ? 'سياسة تسجيل الدخول الفردي:' : 'Single Device Policy:'}
                  </span>{' '}
                  {isRTL
                    ? 'يُسمح للمستخدم بتسجيل الدخول من جهاز حاسوب واحد فقط في نفس الوقت. تم إنهاء الجلسة القديمة تلقائياً.'
                    : 'Users are permitted to log in to only one computer at a time. The previous session has been securely closed.'}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          {isWarning ? (
            <>
              <button
                type="button"
                id="session-logout-btn"
                onClick={onConfirm}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                {isRTL ? 'تسجيل الخروج الآن' : 'Log Out Now'}
              </button>
              <button
                type="button"
                id="session-stay-logged-in-btn"
                onClick={onStayLoggedIn}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
              >
                {isRTL ? 'البقاء متصلاً' : 'Stay Logged In'}
              </button>
            </>
          ) : (
            <button
              type="button"
              id="session-confirm-relogin-btn"
              onClick={onConfirm}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>{isRTL ? 'تسجيل الدخول مجدداً' : 'Log In Again'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
