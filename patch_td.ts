import fs from 'fs';

const file = 'src/components/UserPolicyControlView.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldTd = `{/* Role & Dept Column */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className={\`inline-block px-2 py-0.5 rounded text-[10px] font-bold border \${
                            user.role === 'Admin'
                              ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                              : user.role === 'Agent'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }\`}>
                            {user.role}
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{user.department}</p>
                        </div>
                      </td>`;

const newTd = `{/* Password Policy Column */}
                      <td className="py-3.5 px-4">
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
                          className="flex flex-col space-y-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-1.5 -ml-1.5 rounded-lg transition group"
                          title="Click to edit password policy"
                        >
                          <div className="flex items-center space-x-1">
                            <span className="text-slate-900 dark:text-slate-100 font-medium text-xs group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition">
                              {language === 'ar' ? 'الطول الأدنى:' : 'Min Length:'} {user.passwordMinLength || 8}
                            </span>
                          </div>
                          <div className="flex space-x-1 mt-0.5">
                            {(user.passwordRequireSpecial || user.passwordRequireNumber || user.passwordRequireUppercase || user.passwordRequireLowercase) ? (
                              <>
                                {user.passwordRequireUppercase && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded text-[9px] font-bold border border-blue-200 dark:border-blue-800">A-Z</span>}
                                {user.passwordRequireLowercase && <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 rounded text-[9px] font-bold border border-sky-200 dark:border-sky-800">a-z</span>}
                                {user.passwordRequireNumber && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 rounded text-[9px] font-bold border border-amber-200 dark:border-amber-800">0-9</span>}
                                {user.passwordRequireSpecial && <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 rounded text-[9px] font-bold border border-rose-200 dark:border-rose-800">!@#</span>}
                              </>
                            ) : (
                               <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">Standard</span>
                            )}
                          </div>
                        </div>
                      </td>`;

content = content.replace(oldTd, newTd);
fs.writeFileSync(file, content);
