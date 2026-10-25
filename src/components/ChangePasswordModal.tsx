import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { validatePasswordPolicy } from '../utils/security';
import { ShieldAlert, Check, X, Lock } from 'lucide-react';

export function ChangePasswordModal() {
  const { currentUser, changePassword } = useAuth();
  const { language, dir } = useLanguage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!currentUser?.mustChangePassword) return null;

  const policy = validatePasswordPolicy(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsMatch) {
      setError(language === 'ar' ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
      return;
    }

    const res = await changePassword(newPassword);
    if (!res.success) {
      setError(res.error || (language === 'ar' ? 'فشل تحديث كلمة المرور' : 'Failed to update password'));
    } else {
      setError(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" dir={dir}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in">
        
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-1 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="mx-1">
            <h3 className="text-base font-bold text-slate-900">
              {language === 'ar' ? 'مطلوب تغيير كلمة المرور' : 'Password Change Required'}
            </h3>
            <p className="text-xs text-slate-500">
              {language === 'ar' ? 'تم التفعيل بواسطة ' : 'Triggered by '}
              <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">ForcePasswordChangeFilter</code>
            </p>
          </div>
        </div>

        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
          {language === 'ar'
            ? 'تم وضع علامة على حسابك لإجراء تحديث إلزامي لكلمة المرور قبل المتابعة. يجب عليك إنشاء بيانات اعتماد جديدة تفي بمعايير أمان المؤسسة.'
            : 'Your account has been flagged for a mandatory password update before continuing. You must establish a new credential meeting enterprise security criteria.'}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={language === 'ar' ? 'أدخل كلمة مرور تتكون من 12+ حرفاً' : 'Enter 12+ character password'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {language === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={language === 'ar' ? 'أعد إدخال كلمة المرور للتأكيد' : 'Confirm new password'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>

          {/* ASP.NET Identity Security Policy Checklist */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
              {language === 'ar' ? 'سياسة تعقيد ASP.NET Core Identity' : 'ASP.NET Core Identity Complexity Policy'}
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className={`flex items-center space-x-1.5 ${policy.hasLength ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                {policy.hasLength ? <Check className="w-3.5 h-3.5 text-emerald-600 mx-1" /> : <X className="w-3.5 h-3.5 text-slate-300 mx-1" />}
                <span>{language === 'ar' ? '12 حرفاً على الأقل' : 'At least 12 characters'}</span>
              </div>
              <div className={`flex items-center space-x-1.5 ${policy.hasDigit ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                {policy.hasDigit ? <Check className="w-3.5 h-3.5 text-emerald-600 mx-1" /> : <X className="w-3.5 h-3.5 text-slate-300 mx-1" />}
                <span>{language === 'ar' ? 'رقم واحد (0-9)' : 'Requires Digit (0-9)'}</span>
              </div>
              <div className={`flex items-center space-x-1.5 ${policy.hasLower ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                {policy.hasLower ? <Check className="w-3.5 h-3.5 text-emerald-600 mx-1" /> : <X className="w-3.5 h-3.5 text-slate-300 mx-1" />}
                <span>{language === 'ar' ? 'حرف صغير (a-z)' : 'Lowercase (a-z)'}</span>
              </div>
              <div className={`flex items-center space-x-1.5 ${policy.hasUpper ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                {policy.hasUpper ? <Check className="w-3.5 h-3.5 text-emerald-600 mx-1" /> : <X className="w-3.5 h-3.5 text-slate-300 mx-1" />}
                <span>{language === 'ar' ? 'حرف كبير (A-Z)' : 'Uppercase (A-Z)'}</span>
              </div>
              <div className={`flex items-center space-x-1.5 ${policy.hasSpecial ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                {policy.hasSpecial ? <Check className="w-3.5 h-3.5 text-emerald-600 mx-1" /> : <X className="w-3.5 h-3.5 text-slate-300 mx-1" />}
                <span>{language === 'ar' ? 'رمز خاص غير أبجدي' : 'Non-alphanumeric'}</span>
              </div>
              <div className={`flex items-center space-x-1.5 ${policy.hasUniqueChars ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                {policy.hasUniqueChars ? <Check className="w-3.5 h-3.5 text-emerald-600 mx-1" /> : <X className="w-3.5 h-3.5 text-slate-300 mx-1" />}
                <span>{language === 'ar' ? '≥ 4 أحرف فريدة' : '≥ 4 distinct chars'}</span>
              </div>
            </div>
            {newPassword && !passwordsMatch && (
              <p className="text-[11px] text-rose-600 font-medium pt-1">
                {language === 'ar' ? 'يجب أن تتطابق كلمتا المرور' : 'Passwords must match'}
              </p>
            )}
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-semibold">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!policy.isValid || !passwordsMatch}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Lock className="w-4 h-4 mx-1" />
            <span>{language === 'ar' ? 'تحديث كلمة المرور وإلغاء القفل' : 'Update Password & Unlock App'}</span>
          </button>
        </form>

      </div>
    </div>
  );
}
