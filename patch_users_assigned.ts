import fs from 'fs';

const file = 'src/components/UserManagementView.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update interface
content = content.replace(
  '  permissions: string[];\n}',
  '  permissions: string[];\n  assignedUsers?: { id: number; fullName: string; email: string; avatarColor?: string }[];\n}'
);

// 2. Add state for viewing users
content = content.replace(
  'const [formData, setFormData] = useState<{name: string, permissions: string[]}>({ name: \'\', permissions: [] });',
  `const [formData, setFormData] = useState<{name: string, permissions: string[]}>({ name: '', permissions: [] });
  const [viewingUsersRole, setViewingUsersRole] = useState<Role | null>(null);`
);

// 3. Update table headers
const tableHeaders = `<th className="py-4 px-6">{language === 'ar' ? 'الصلاحيات' : 'Permissions'}</th>
                <th className="py-4 px-6 text-center">{language === 'ar' ? 'المستخدمين المعينين' : 'Users Assigned To'}</th>
                <th className="py-4 px-6 text-center">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>`;
content = content.replace(
  /<th className="py-4 px-6">\{language === 'ar' \? 'الصلاحيات' : 'Permissions'\}<\/th>\s*<th className="py-4 px-6 text-center">\{language === 'ar' \? 'الإجراءات' : 'Actions'\}<\/th>/m,
  tableHeaders
);

// 4. Update colSpan in loading states
content = content.replace(/colSpan=\{3\}/g, 'colSpan={4}');

// 5. Update table row
const rowRegex = /<\/div>\s*<\/td>\s*<td className="py-4 px-6">/m;
const rowReplacement = `</div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    {role.assignedUsers && role.assignedUsers.length > 0 ? (
                      <div className="relative group inline-block">
                        <button 
                          className="text-blue-600 font-bold hover:underline cursor-pointer"
                          onClick={() => setViewingUsersRole(role)}
                        >
                          {role.assignedUsers.length}
                        </button>
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-slate-800 text-white text-xs rounded-lg shadow-xl p-2.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                          <div className="font-semibold text-slate-200 mb-1 border-b border-slate-700 pb-1">{language === 'ar' ? 'المستخدمين المعينين' : 'Assigned Users:'}</div>
                          {role.assignedUsers.slice(0, 2).map(u => (
                            <div key={u.id} className="truncate py-0.5">{u.fullName}</div>
                          ))}
                          {role.assignedUsers.length > 2 && (
                            <div className="text-slate-400 text-[10px] mt-1 pt-1 border-t border-slate-700">+{role.assignedUsers.length - 2} {language === 'ar' ? 'أكثر' : 'more'}</div>
                          )}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400 font-medium">0</span>
                    )}
                  </td>
                  <td className="py-4 px-6">`;
content = content.replace(rowRegex, rowReplacement);

// 6. Add modal for viewing users
const modalRegex = /\{isModalOpen && \(/m;
const modalReplacement = `{viewingUsersRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" dir={dir}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {language === 'ar' ? 'المستخدمين المعينين لـ' : 'Users Assigned To'} {viewingUsersRole.name}
              </h3>
              <button
                onClick={() => setViewingUsersRole(null)}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 max-h-96 overflow-y-auto">
              {viewingUsersRole.assignedUsers && viewingUsersRole.assignedUsers.length > 0 ? (
                <ul className="space-y-3">
                  {viewingUsersRole.assignedUsers.map(u => (
                    <li key={u.id} className="flex items-center space-x-3 rtl:space-x-reverse p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className={\`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs \${u.avatarColor || 'bg-slate-700 text-white'}\`}>
                        {u.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{u.fullName}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center text-slate-500 py-4">
                  {language === 'ar' ? 'لا يوجد مستخدمين' : 'No users assigned.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (`
content = content.replace(modalRegex, modalReplacement);

fs.writeFileSync(file, content);
