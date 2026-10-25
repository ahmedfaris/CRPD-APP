import fs from 'fs';

const file = 'src/components/UserManagementView.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50 max-h-60 overflow-y-auto">[\s\S]*?<\/div>\s+<\/div>\s+<div className="pt-2 flex justify-end/m;

const newFormContent = `<div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 max-h-80 overflow-y-auto">
                  <table className="w-full text-sm text-left rtl:text-right">
                    <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2 px-3 text-slate-600 font-semibold">{language === 'ar' ? 'التطبيق' : 'Application'}</th>
                        {ACTIONS.map(action => (
                          <th key={action} className="py-2 px-3 text-center text-slate-600 font-semibold text-xs">{action}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {APPS.map(app => (
                        <tr key={app} className="hover:bg-white transition-colors">
                          <td className="py-2 px-3 font-medium text-slate-700">{app}</td>
                          {ACTIONS.map(action => {
                            const permString = \`\${app}.\${action}\`;
                            return (
                              <td key={action} className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={formData.permissions.includes(permString)}
                                  onChange={() => togglePermission(permString)}
                                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2 flex justify-end`;

content = content.replace(regex, newFormContent);

fs.writeFileSync(file, content);
