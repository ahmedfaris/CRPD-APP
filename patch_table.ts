import fs from 'fs';

const file = 'src/components/UserManagementView.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<div className="flex flex-wrap gap-2">[\s\S]*?<\/div>/m;

const newContent = `<div className="flex flex-col space-y-1.5">
                      {role.permissions && role.permissions.length > 0 ? (
                        Array.from(new Set(role.permissions.map(p => p.split('.')[0]))).map(app => {
                          const appPerms = role.permissions.filter(p => p.startsWith(app + '.')).map(p => p.split('.')[1]);
                          return (
                            <div key={app} className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {app}
                              </span>
                              {appPerms.map(action => (
                                <span key={action} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 uppercase tracking-wider">
                                  {action}
                                </span>
                              ))}
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-slate-400 text-xs italic">No permissions assigned</span>
                      )}
                    </div>`;

content = content.replace(regex, newContent);
fs.writeFileSync(file, content);
