import fs from 'fs';

const file = 'src/components/UserManagementView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update imports
if (!content.includes("import { ShieldCheck, Edit, Trash2, Plus, X, Info }")) {
  content = content.replace("ShieldCheck, Edit, Trash2, Plus, X", "ShieldCheck, Edit, Trash2, Plus, X, Info");
}

// Update Role interface
content = content.replace(
  "assignedUsers?: { id: number; fullName: string; email: string; avatarColor?: string }[];\n}",
  `assignedUsers?: { id: number; fullName: string; email: string; avatarColor?: string }[];
  createdBy?: { fullName: string; email: string } | null;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: { fullName: string; email: string } | null;
  auditLogs?: { action: string; details: string; createdAt: string; performedBy: { fullName: string; email: string } | null }[];
}`
);

// State for viewing info modal and warning modal
content = content.replace(
  "const [viewingUsersRole, setViewingUsersRole] = useState<Role | null>(null);",
  `const [viewingUsersRole, setViewingUsersRole] = useState<Role | null>(null);
  const [viewingInfoRole, setViewingInfoRole] = useState<Role | null>(null);
  const [showSaveWarning, setShowSaveWarning] = useState<boolean>(false);`
);

// Update table headers
const tableHeaders = `<th className="py-4 px-6 text-center">{language === 'ar' ? 'معرف الدور' : 'Role ID'}</th>
                <th className="py-4 px-6">{language === 'ar' ? 'اسم الدور' : 'Role Name'}</th>`;
content = content.replace(
  /<th className="py-4 px-6">\{language === 'ar' \? 'اسم الدور' : 'Role Name'\}<\/th>/m,
  tableHeaders
);

content = content.replace(/colSpan=\{4\}/g, 'colSpan={5}');

// Update table row rendering
const tableRowRegex = /<tr key=\{role\.id\} className="hover:bg-slate-50\/60 transition">[\s\S]*?<td className="py-4 px-6 font-bold text-slate-900">/m;
const tableRowReplacement = `<tr key={role.id} className={\`transition \${role.isDeleted ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50/60'}\`}>
                  <td className="py-4 px-6 text-center font-mono text-xs text-slate-500">
                    #{role.id}
                  </td>
                  <td className={\`py-4 px-6 font-bold \${role.isDeleted ? 'text-slate-500 line-through' : 'text-slate-900'}\`}>`;
content = content.replace(tableRowRegex, tableRowReplacement);

// Update actions column
const actionsRegex = /<td className="py-4 px-6">\s*<div className="flex items-center justify-center space-x-2 rtl:space-x-reverse">\s*<button\s*onClick=\{\(\) => handleOpenEdit\(role\)\}/m;
const actionsReplacement = `<td className="py-4 px-6">
                    <div className="flex items-center justify-center space-x-2 rtl:space-x-reverse">
                      <button 
                        onClick={() => setViewingInfoRole(role)}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition" 
                        title="Role Info"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleOpenEdit(role)}
                        disabled={role.isDeleted}
                        className={\`p-1.5 rounded-lg transition \${role.isDeleted ? 'text-slate-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50 cursor-pointer'}\`} 
                        title="Edit Role"
                      >`;
content = content.replace(actionsRegex, actionsReplacement);

// Update Delete button
const deleteRegex = /<button\s*onClick=\{\(\) => handleDelete\(role\.id\)\}\s*className="p-1\.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"\s*title="Delete Role"\s*>/m;
const deleteReplacement = `<button 
                        onClick={() => handleDelete(role.id)}
                        disabled={role.isDeleted || (role.assignedUsers && role.assignedUsers.length > 0)}
                        className={\`p-1.5 rounded-lg transition \${(role.isDeleted || (role.assignedUsers && role.assignedUsers.length > 0)) ? 'text-slate-300 cursor-not-allowed' : 'text-rose-600 hover:bg-rose-50 cursor-pointer'}\`} 
                        title={(role.assignedUsers && role.assignedUsers.length > 0) ? "Cannot delete while assigned to users" : "Delete Role"}
                      >`;
content = content.replace(deleteRegex, deleteReplacement);

// Update handleSubmit to show warning
const handleSubmitRegex = /const handleSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?try \{/m;
const handleSubmitReplacement = `const processSubmit = async () => {
    try {`;
content = content.replace(handleSubmitRegex, handleSubmitReplacement);

content = content.replace("e.preventDefault();\n    try {", "    // try {");

// We need to properly wrap the handleSubmit
const handleOpenCreateRegex = /const handleOpenCreate = \(\) => \{/m;
const customHandleSubmit = `const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRole && editingRole.assignedUsers && editingRole.assignedUsers.length > 0) {
      setShowSaveWarning(true);
      return;
    }
    await processSubmit();
  };

  const processSubmit = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const url = editingRole ? \`/api/roles/\${editingRole.id}\` : '/api/roles';
      const method = editingRole ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          Authorization: \`Bearer \${token}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        setShowSaveWarning(false);
        fetchRoles();
      }
    } catch (err) {
      console.error('Failed to save role:', err);
    }
  };

  const handleOpenCreate = () => {`;

// Replace the old handleSubmit completely with the new one
// First, find where handleSubmit starts and ends
content = content.replace(/const handleSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?const togglePermission/m, `const togglePermission`);

content = content.replace("const togglePermission", customHandleSubmit + "\n\n  const togglePermission");

// Add info modal and warning modal before the end of the file
const modalsRegex = /\{isModalOpen && \(/m;
const newModals = `{viewingInfoRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200" dir={dir}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-500" />
                {language === 'ar' ? 'معلومات الدور' : 'Role Information'}
              </h3>
              <button onClick={() => setViewingInfoRole(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-6">
              
              {/* Creator Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Creation Details</h4>
                <div className="flex flex-col gap-1">
                  <p className="text-sm"><span className="font-semibold text-slate-700">Created By:</span> {viewingInfoRole.createdBy?.fullName || 'System'}</p>
                  <p className="text-sm"><span className="font-semibold text-slate-700">Date:</span> {new Date(viewingInfoRole.auditLogs?.find(l => l.action === 'CREATE')?.createdAt || Date.now()).toLocaleString()}</p>
                </div>
              </div>

              {/* Deletion Info */}
              {viewingInfoRole.isDeleted && (
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-200">
                  <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-2">Deletion Details</h4>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-rose-900"><span className="font-semibold">Deleted By:</span> {viewingInfoRole.deletedBy?.fullName || 'Unknown'}</p>
                    <p className="text-sm text-rose-900"><span className="font-semibold">Date:</span> {viewingInfoRole.deletedAt ? new Date(viewingInfoRole.deletedAt).toLocaleString() : 'N/A'}</p>
                  </div>
                </div>
              )}

              {/* Audit History */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Edit History</h4>
                {viewingInfoRole.auditLogs && viewingInfoRole.auditLogs.filter(l => l.action === 'EDIT').length > 0 ? (
                  <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                    {viewingInfoRole.auditLogs.filter(l => l.action === 'EDIT').map((log, idx) => (
                      <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-4 h-4 rounded-full border border-white bg-blue-300 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2" />
                        <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 text-sm">{log.performedBy?.fullName || 'Unknown'}</span>
                            <time className="text-xs text-slate-500 mb-1">{new Date(log.createdAt).toLocaleString()}</time>
                            <span className="text-slate-700 text-xs">{log.details}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No edit history available.</p>
                )}
              </div>
              
            </div>
          </div>
        </div>
      )}
      
      {showSaveWarning && editingRole && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center animate-in zoom-in-95" dir={dir}>
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Info className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Warning: Users Affected
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              You are about to change the permissions for <strong>{editingRole.name}</strong>. This role is currently assigned to <strong>{editingRole.assignedUsers?.length || 0} users</strong>. The changes will take effect immediately.
            </p>
            <div className="flex items-center space-x-3 rtl:space-x-reverse w-full">
              <button 
                onClick={() => setShowSaveWarning(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button 
                onClick={processSubmit}
                className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 shadow-md shadow-blue-500/20 transition"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (`

content = content.replace(modalsRegex, newModals);

fs.writeFileSync(file, content);
