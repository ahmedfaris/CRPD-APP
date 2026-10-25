import fs from 'fs';

const file = 'src/components/UserPolicyControlView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Insert header
content = content.replace(
  /<th className="py-3 px-4">\{language === 'ar' \? 'المصادقة الثنائية \(2FA\)' : '2FA Policy'\}<\/th>/,
  "<th className=\"py-3 px-4\">{language === 'ar' ? 'المصادقة الثنائية (2FA)' : '2FA Policy'}</th>\n                  <th className=\"py-3 px-4\">{language === 'ar' ? 'حالة الحساب' : 'Account Status'}</th>"
);

// Insert TD
const otherActionsRegex = /\{\/\* Other Actions Column \*\/\}\s*<td className="py-3\.5 px-4 text-right">/m;

const accountStatusTd = `{/* Account Status Column */}
                      <td className="py-3.5 px-4">
                        <div 
                          className={\`cursor-pointer inline-flex items-center space-x-1.5 px-2 py-1 rounded-md text-xs font-bold transition \${
                            user.isLockedOut 
                              ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800'
                              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800'
                          }\`}
                          onClick={() => {
                            if (user.isLockedOut) {
                              const reason = user.lockoutEnd 
                                ? \`Account locked due to multiple failed login attempts. Lockout expires at: \${new Date(user.lockoutEnd).toLocaleString()}\`
                                : 'Account locked by administrator.';
                              alert(reason);
                            } else {
                              alert('Account is active and operating normally.');
                            }
                          }}
                        >
                          {user.isLockedOut ? (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>{language === 'ar' ? 'مقفول' : 'Locked'}</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{language === 'ar' ? 'نشط' : 'Active'}</span>
                            </>
                          )}
                        </div>
                        {user.isLockedOut && (
                          <div className="mt-2">
                             <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnlock((user as any).uid || user.id, user.email);
                                }}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition border border-slate-200 dark:border-slate-700"
                              >
                                {t('policy.unlock')}
                              </button>
                          </div>
                        )}
                      </td>
                      {/* Other Actions Column */}
                      <td className="py-3.5 px-4 text-right">`;

content = content.replace(otherActionsRegex, accountStatusTd);

// Fix colSpan
content = content.replace(/<td colSpan=\{4\}/g, "<td colSpan={5}");

fs.writeFileSync(file, content);
