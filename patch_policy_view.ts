import fs from 'fs';

const file = 'src/components/UserPolicyControlView.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state for password policy modal
content = content.replace(
  `const [selectedUserForPassword, setSelectedUserForPassword] = useState<string | null>(null);`,
  `const [selectedUserForPassword, setSelectedUserForPassword] = useState<string | null>(null);
  const [selectedUserForPolicy, setSelectedUserForPolicy] = useState<ApplicationUser | null>(null);
  const [policyData, setPolicyData] = useState({
    passwordMinLength: 8,
    passwordRequireSpecial: false,
    passwordRequireNumber: false,
    passwordRequireUppercase: false,
    passwordRequireLowercase: false
  });`
);

// 2. Remove role and dept column headers
content = content.replace(
  `<th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                    {language === 'ar' ? 'الوظيفة و القسم' : 'Role & Dept'}
                  </th>`,
  `<th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                    {language === 'ar' ? 'سياسة كلمة المرور' : 'Password Policy'}
                  </th>`
);

// 3. Replace the table cell for Role & Dept with Password Policy
const cellRegex = /<td className="py-3\.5 px-4">[\s\S]*?<\/td>/m; // Note: this might match the first td, we need to be careful
// Better to search for the specific content of the td
const roleDeptTdRegex = /<td className="py-3\.5 px-4">\s*<div className="flex flex-col space-y-1">\s*<span className="text-slate-900 dark:text-slate-100 font-medium text-xs">\s*\{user\.role\}\s*<\/span>\s*<span className="text-\[11px\] text-slate-500 dark:text-slate-400 flex items-center space-x-1">\s*<Building2 className="w-3 h-3" \/>\s*<span>\{user\.department\}<\/span>\s*<\/span>\s*<\/div>\s*<\/td>/;

const newPolicyCell = `<td className="py-3.5 px-4">
                        <div 
                          onClick={() => {
                            setSelectedUserForPolicy(user);
                            setPolicyData({
                              passwordMinLength: user.passwordMinLength || 8,
                              passwordRequireSpecial: user.passwordRequireSpecial || false,
                              passwordRequireNumber: user.passwordRequireNumber || false,
                              passwordRequireUppercase: user.passwordRequireUppercase || false,
                              passwordRequireLowercase: user.passwordRequireLowercase || false
                            });
                          }}
                          className="flex flex-col space-y-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-1.5 rounded-lg transition"
                          title="Click to edit password policy"
                        >
                          <div className="flex items-center space-x-1">
                            <span className="text-slate-900 dark:text-slate-100 font-medium text-xs">
                              {language === 'ar' ? 'الطول الأدنى:' : 'Min Length:'} {user.passwordMinLength || 8}
                            </span>
                          </div>
                          <div className="flex space-x-1 mt-0.5">
                            {(user.passwordRequireSpecial || user.passwordRequireNumber || user.passwordRequireUppercase || user.passwordRequireLowercase) ? (
                              <>
                                {user.passwordRequireUppercase && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded text-[9px] font-bold">A-Z</span>}
                                {user.passwordRequireLowercase && <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 rounded text-[9px] font-bold">a-z</span>}
                                {user.passwordRequireNumber && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 rounded text-[9px] font-bold">0-9</span>}
                                {user.passwordRequireSpecial && <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 rounded text-[9px] font-bold">!@#</span>}
                              </>
                            ) : (
                               <span className="text-[10px] text-slate-500">Standard</span>
                            )}
                          </div>
                        </div>
                      </td>`;

content = content.replace(roleDeptTdRegex, newPolicyCell);

// 4. Add Policy Save Handler
const fetchUsersRegex = /const fetchUsers = async \(\) => \{/;
const savePolicyHandler = `
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPolicy) return;
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(\`/api/users/\${selectedUserForPolicy.uid}\`, {
        method: 'PATCH',
        headers: {
          Authorization: \`Bearer \${token}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(policyData)
      });
      if (res.ok) {
        setSelectedUserForPolicy(null);
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {`;
content = content.replace(fetchUsersRegex, savePolicyHandler);

// 5. Add Modal JSX
const modalJsx = `
      {/* Password Policy Modal */}
      {selectedUserForPolicy && (
        <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4" dir={dir}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400 mx-1" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mx-1">
                  {language === 'ar' ? 'سياسة كلمة المرور للحساب' : 'Account Password Policy'}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedUserForPolicy(null)}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePolicy} className="space-y-5 text-xs">
              
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium">
                  {language === 'ar' ? 'الحد الأدنى لطول كلمة المرور (8 - 64)' : 'Minimum Password Length (8 - 64)'}
                </label>
                <input
                  type="number"
                  min={8}
                  max={64}
                  required
                  value={policyData.passwordMinLength}
                  onChange={(e) => setPolicyData({...policyData, passwordMinLength: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-slate-700 dark:text-slate-300 font-medium">
                  {language === 'ar' ? 'متطلبات التعقيد' : 'Complexity Requirements'}
                </label>
                
                <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" checked={policyData.passwordRequireUppercase} onChange={(e) => setPolicyData({...policyData, passwordRequireUppercase: e.target.checked})} className="peer sr-only" />
                    <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 peer-checked:bg-cyan-500 peer-checked:border-cyan-500 transition"></div>
                    <CheckCircle2 className="w-3 h-3 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition" />
                  </div>
                  <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition">
                     {language === 'ar' ? 'تتطلب أحرف كبيرة (A-Z)' : 'Require Uppercase Letters (A-Z)'}
                  </span>
                </label>

                <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" checked={policyData.passwordRequireLowercase} onChange={(e) => setPolicyData({...policyData, passwordRequireLowercase: e.target.checked})} className="peer sr-only" />
                    <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 peer-checked:bg-cyan-500 peer-checked:border-cyan-500 transition"></div>
                    <CheckCircle2 className="w-3 h-3 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition" />
                  </div>
                  <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition">
                     {language === 'ar' ? 'تتطلب أحرف صغيرة (a-z)' : 'Require Lowercase Letters (a-z)'}
                  </span>
                </label>

                <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" checked={policyData.passwordRequireNumber} onChange={(e) => setPolicyData({...policyData, passwordRequireNumber: e.target.checked})} className="peer sr-only" />
                    <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 peer-checked:bg-cyan-500 peer-checked:border-cyan-500 transition"></div>
                    <CheckCircle2 className="w-3 h-3 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition" />
                  </div>
                  <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition">
                     {language === 'ar' ? 'تتطلب أرقام (0-9)' : 'Require Numbers (0-9)'}
                  </span>
                </label>

                <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" checked={policyData.passwordRequireSpecial} onChange={(e) => setPolicyData({...policyData, passwordRequireSpecial: e.target.checked})} className="peer sr-only" />
                    <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 peer-checked:bg-cyan-500 peer-checked:border-cyan-500 transition"></div>
                    <CheckCircle2 className="w-3 h-3 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition" />
                  </div>
                  <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition">
                     {language === 'ar' ? 'تتطلب رموز خاصة (!@#)' : 'Require Special Characters (!@#)'}
                  </span>
                </label>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="text-slate-500 flex items-center space-x-1.5">
                   <Clock className="w-3.5 h-3.5" />
                   <span>
                      {language === 'ar' ? 'آخر تغيير لكلمة المرور:' : 'Last password change:'} 
                      {selectedUserForPolicy.passwordLastChangedAt 
                        ? new Date(selectedUserForPolicy.passwordLastChangedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')
                        : (language === 'ar' ? ' لم يتم التغيير قط' : ' Never changed')}
                   </span>
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPolicy(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer mx-1"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition shadow-sm cursor-pointer mx-1"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}`;

content = content.replace('{/* Password Reset Modal */}', modalJsx);

// Add missing icon
content = content.replace(
  `import { Users, Info, Building2, Server, Globe2, ScanFace, Lock, Mail, Phone, Calendar, KeyRound, Save, Plus, Sliders, CheckCircle2, AlertTriangle, ShieldCheck, X, Search, RotateCcw } from 'lucide-react';`,
  `import { Users, Info, Building2, Server, Globe2, ScanFace, Lock, Mail, Phone, Calendar, KeyRound, Save, Plus, Sliders, CheckCircle2, AlertTriangle, ShieldCheck, X, Search, RotateCcw, Clock } from 'lucide-react';`
);


fs.writeFileSync(file, content);
