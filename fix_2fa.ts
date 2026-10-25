import fs from 'fs';

const file = 'src/components/UserPolicyControlView.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\{\/\* Other Actions Column \*\/\}\s*<td className="py-3\.5 px-4 text-right">/m;

const new2FATd = `{/* 2FA Policy Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center space-x-2">
                            {isEffective2FA ? (
                              <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400">
                                <ShieldCheck className="w-4 h-4 shrink-0" />
                                <span className="font-semibold text-xs">{t('policy.twoFactorActive')}</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1.5 text-amber-500 dark:text-amber-400">
                                <ShieldOff className="w-4 h-4 shrink-0" />
                                <span className="font-semibold text-xs">{t('policy.twoFactorDisabled')}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2 mt-1">
                            <button
                              type="button"
                              onClick={() => handleToggle2FA((user as any).uid || user.id, !!user.twoFactorEnabled, user.email)}
                              className={\`px-2.5 py-1 rounded-md font-bold text-[10px] transition flex items-center space-x-1 border shadow-sm \${
                                user.twoFactorEnabled
                                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-900'
                                  : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-900'
                              }\`}
                              title={user.twoFactorEnabled ? t('policy.deactivate') : t('policy.activate')}
                            >
                              {user.twoFactorEnabled ? (
                                <>
                                  <ShieldOff className="w-3 h-3" />
                                  <span>{t('policy.deactivate')}</span>
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>{t('policy.activate')}</span>
                                </>
                              )}
                            </button>
                            
                            {hasSecret && (
                              <button
                                type="button"
                                onClick={() => handleResetSecret((user as any).uid || user.id, user.email)}
                                className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition border border-slate-200 dark:border-slate-700"
                                title={t('policy.resetSecret')}
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="text-[9px] text-slate-500 dark:text-slate-400">
                            {hasSecret ? (
                              <span className="text-emerald-600 dark:text-emerald-400/90">
                                • {t('policy.secretSet')}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 italic">
                                • {t('policy.noSecret')}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Other Actions Column */}
                      <td className="py-3.5 px-4 text-right">`;

content = content.replace(regex, new2FATd);

fs.writeFileSync(file, content);
