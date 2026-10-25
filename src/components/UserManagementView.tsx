import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ShieldCheck, Edit, Trash2, Plus, X, Info, CheckSquare, Square, Building2, HardDrive, Shield } from 'lucide-react';

interface AuditLog {
  action: string;
  details: string;
  createdAt: string;
  performedBy: { fullName: string; email: string } | null;
}

interface Role {
  id: number;
  name: string;
  permissions: string[];
  assignedUsers?: { id: number; fullName: string; email: string; avatarColor?: string }[];
  createdBy?: { fullName: string; email: string } | null;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: { fullName: string; email: string } | null;
  auditLogs?: AuditLog[];
}

const APPS = [
  'Ticket Management',
  'Team Management',
  'Electronic Archiving',
  'Employee Management',
  'User & Role Management',
  'Identity & Access Policy',
  'Organization Structure',
  'Asset Management'
];

const ACTIONS = ['View', 'Create', 'Edit', 'Delete'];

interface UserManagementViewProps {
  onOpenCreateModal?: () => void;
}

export function UserManagementView({ onOpenCreateModal }: UserManagementViewProps) {
  const { language, dir } = useLanguage();
  const { isAdmin, hasPermission } = useAuth();
  const canManageRoles = isAdmin || hasPermission('Identity & Access Policy.Create') || hasPermission('User & Role Management.Create') || hasPermission('roles.manage');
  const canEditRoles = isAdmin || hasPermission('Identity & Access Policy.Edit') || hasPermission('User & Role Management.Edit') || hasPermission('roles.manage');
  const canDeleteRoles = isAdmin || hasPermission('Identity & Access Policy.Delete') || hasPermission('User & Role Management.Delete') || hasPermission('roles.manage');
  const canViewRoles = isAdmin || hasPermission('Identity & Access Policy.View') || hasPermission('User & Role Management.View') || hasPermission('roles.manage');
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState<{name: string, permissions: string[]}>({ name: '', permissions: [] });
  const [formError, setFormError] = useState<string | null>(null);
  
  const [viewingUsersRole, setViewingUsersRole] = useState<Role | null>(null);
  const [viewingInfoRole, setViewingInfoRole] = useState<Role | null>(null);
  const [showSaveWarning, setShowSaveWarning] = useState<boolean>(false);
  const [roleToDelete, setRoleToDelete] = useState<number | null>(null);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/roles', {
        headers: { 
          Authorization: `Bearer ${token}`,
          'X-App-Action': 'strict-client-action'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRoles(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingRole(null);
    setFormData({ name: '', permissions: [] });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({ name: role.name, permissions: role.permissions || [] });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    setRoleToDelete(id);
  };

  const confirmDelete = async () => {
    if (roleToDelete === null) return;
    try {
      const id = roleToDelete;
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/roles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchRoles();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete role');
      }
    } catch (err) {
      console.error('Failed to delete role:', err);
    } finally {
      setRoleToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameRegex = /^[\u0600-\u06FFa-zA-Z\s]+$/;
    if (!nameRegex.test(formData.name)) {
      setFormError(language === 'ar' ? 'يسمح فقط بالحروف الإنجليزية والعربية والمسافات.' : 'Only English and Arabic letters (and spaces) are allowed.');
      return;
    }
    if (formData.name.trim().length === 0 || formData.name.length > 20) {
      setFormError(language === 'ar' ? 'الحد الأقصى للاسم هو 20 حرفاً' : 'Name length must be between 1 and 20 characters.');
      return;
    }

    if (editingRole && editingRole.assignedUsers && editingRole.assignedUsers.length > 0) {
      setShowSaveWarning(true);
      return;
    }
    await processSubmit();
  };

  const processSubmit = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles';
      const method = editingRole ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-App-Action': 'strict-client-action'
        },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        setShowSaveWarning(false);
        fetchRoles();
      } else {
        const errData = await res.json();
        setFormError(errData.error || 'Failed to save role');
      }
    } catch (err) {
      console.error('Failed to save role:', err);
    }
  };

  const togglePermission = (perm: string) => {
    setFormData(prev => {
      const isSelected = prev.permissions.includes(perm);
      if (isSelected) {
        return { ...prev, permissions: prev.permissions.filter(p => p !== perm) };
      } else {
        return { ...prev, permissions: [...prev.permissions, perm] };
      }
    });
  };

  const toggleAllAppPermissions = (app: string) => {
    const appPerms = ACTIONS.map(a => `${app}.${a}`);
    setFormData(prev => {
      const allSelected = appPerms.every(p => prev.permissions.includes(p));
      if (allSelected) {
        return { ...prev, permissions: prev.permissions.filter(p => !appPerms.includes(p)) };
      } else {
        const remaining = prev.permissions.filter(p => !appPerms.includes(p));
        return { ...prev, permissions: [...remaining, ...appPerms] };
      }
    });
  };

  const selectAllPermissions = () => {
    const all = APPS.flatMap(app => ACTIONS.map(act => `${app}.${act}`));
    setFormData(prev => ({ ...prev, permissions: all }));
  };

  const clearAllPermissions = () => {
    setFormData(prev => ({ ...prev, permissions: [] }));
  };

  if (!canViewRoles) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center" dir={dir}>
        <ShieldCheck className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-rose-900">Access Denied (403 Forbidden)</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      {/* Action Bar */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-900">
          {language === 'ar' ? 'أدوار النظام' : 'System Roles'}
        </h2>
        {canManageRoles && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4 mx-1" />
            <span>{language === 'ar' ? 'إنشاء دور' : 'Create Role'}</span>
          </button>
        )}
      </div>

      {/* Roles Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-xs">
              <tr>
                <th className="py-4 px-6 text-center">{language === 'ar' ? 'معرف الدور' : 'Role ID'}</th>
                <th className="py-4 px-6">{language === 'ar' ? 'اسم الدور' : 'Role Name'}</th>
                <th className="py-4 px-6">{language === 'ar' ? 'الصلاحيات' : 'Permissions'}</th>
                <th className="py-4 px-6 text-center">{language === 'ar' ? 'المستخدمين المعينين' : 'Users Assigned To'}</th>
                <th className="py-4 px-6 text-center">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Loading roles...
                  </td>
                </tr>
              ) : roles.map((role) => (
                <tr key={role.id} className={`transition ${role.isDeleted ? 'bg-slate-50/80' : 'hover:bg-slate-50/60'}`}>
                  <td className="py-4 px-6 text-center font-mono text-xs text-slate-400">
                    #{role.id}
                  </td>
                  <td className={`py-4 px-6 font-bold ${role.isDeleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                    {role.name}
                    {role.isDeleted && (
                      <span className="block mt-1 text-[10px] uppercase font-bold tracking-wider text-rose-500">Deleted</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className={`flex flex-col space-y-1.5 ${role.isDeleted ? 'opacity-50' : ''}`}>
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
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    {role.assignedUsers && role.assignedUsers.length > 0 ? (
                      <div className="relative group inline-block">
                        <button 
                          className={`font-bold hover:underline cursor-pointer ${role.isDeleted ? 'text-slate-400' : 'text-blue-600'}`}
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
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-center space-x-2 rtl:space-x-reverse">
                      <button 
                        onClick={() => setViewingInfoRole(role)}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition cursor-pointer" 
                        title="Role Info"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      {canEditRoles && (
                        <button 
                          onClick={() => handleOpenEdit(role)}
                          disabled={role.isDeleted}
                          className={`p-1.5 rounded-lg transition ${role.isDeleted ? 'text-slate-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50 cursor-pointer'}`} 
                          title="Edit Role"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {canDeleteRoles && (
                        <button 
                          onClick={() => handleDelete(role.id)}
                          disabled={role.isDeleted || (role.assignedUsers && role.assignedUsers.length > 0)}
                          className={`p-1.5 rounded-lg transition ${(role.isDeleted || (role.assignedUsers && role.assignedUsers.length > 0)) ? 'text-slate-300 cursor-not-allowed' : 'text-rose-600 hover:bg-rose-50 cursor-pointer'}`} 
                          title={(role.assignedUsers && role.assignedUsers.length > 0) ? "Cannot delete while assigned to users" : "Delete Role"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && roles.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No roles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Users Modal */}
      {viewingUsersRole && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
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
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${u.avatarColor || 'bg-slate-700 text-white'}`}>
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

      {/* Info / Audit Log Modal */}
      {viewingInfoRole && (
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

      {roleToDelete !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center animate-in zoom-in-95" dir={dir}>
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Deletion'}
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              {language === 'ar' ? 'هل أنت متأكد أنك تريد حذف هذا الدور؟ لا يمكن تعيينه للمستخدمين بعد ذلك.' : 'Are you sure you want to delete this role? It will remain in the records but cannot be assigned to users anymore.'}
            </p>
            <div className="flex items-center space-x-3 rtl:space-x-reverse w-full">
              <button 
                onClick={() => setRoleToDelete(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-500 shadow-md shadow-rose-500/20 transition cursor-pointer"
              >
                {language === 'ar' ? 'تأكيد الحذف' : 'Delete Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Warning Modal */}
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
                className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={processSubmit}
                className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 shadow-md shadow-blue-500/20 transition cursor-pointer"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" dir={dir}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingRole 
                      ? (language === 'ar' ? 'تعديل الدور والصلاحيات' : 'Edit Role & Permissions') 
                      : (language === 'ar' ? 'إنشاء دور جديد في النظام' : 'Create New System Role')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'ar'
                      ? 'حدد اسم الدور والصلاحيات الممنوحة لجميع الأنظمة بما فيها الهيكل التنظيمي وإدارة الأصول'
                      : 'Define role name and assign permissions across all modules including Org Structure & Asset Management'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language === 'ar' ? 'اسم الدور' : 'Role Name'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  maxLength={20}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Asset & Org Manager"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700">
                    {language === 'ar' ? 'جدول الصلاحيات للتطبيقات والأنظمة' : 'Application Permissions Matrix'}
                    <span className="mx-2 text-slate-400 font-normal">
                      ({formData.permissions.length} / {APPS.length * ACTIONS.length} {language === 'ar' ? 'صلاحية محددة' : 'selected'})
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllPermissions}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      {language === 'ar' ? 'تحديد الكل' : 'Select All'}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={clearAllPermissions}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                    >
                      {language === 'ar' ? 'إلغاء التحديد' : 'Clear All'}
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 max-h-80 overflow-y-auto">
                  <table className="w-full text-xs text-left rtl:text-right">
                    <thead className="bg-slate-100/90 border-b border-slate-200 sticky top-0 backdrop-blur-xs z-10">
                      <tr>
                        <th className="py-2.5 px-3 text-slate-700 font-bold">{language === 'ar' ? 'التطبيق / النظام' : 'Application / Module'}</th>
                        {ACTIONS.map(action => (
                          <th key={action} className="py-2.5 px-2 text-center text-slate-600 font-semibold text-[11px]">{action}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {APPS.map(app => {
                        const isOrgOrAsset = app === 'Organization Structure' || app === 'Asset Management';
                        const appPerms = ACTIONS.map(a => `${app}.${a}`);
                        const allAppSelected = appPerms.every(p => formData.permissions.includes(p));

                        return (
                          <tr 
                            key={app} 
                            className={`transition-colors ${
                              isOrgOrAsset 
                                ? 'bg-blue-50/40 hover:bg-blue-50/70 font-semibold' 
                                : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-medium text-slate-800">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="flex items-center gap-1.5">
                                  {app === 'Organization Structure' && <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                  {app === 'Asset Management' && <HardDrive className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                  {language === 'ar' ? (
                                    app === 'Ticket Management' ? 'إدارة البلاغات والتذاكر' :
                                    app === 'Team Management' ? 'إدارة الفرق والكوادر الفنية' :
                                    app === 'Electronic Archiving' ? 'الأرشفة الإلكترونية' :
                                    app === 'Employee Management' ? 'إدارة الموظفين والكوادر' :
                                    app === 'User & Role Management' ? 'إدارة المستخدمين والأدوار' :
                                    app === 'Identity & Access Policy' ? 'سياسات الهوية والأمان' :
                                    app === 'Organization Structure' ? 'الهيكل التنظيمي (Organizational Structure)' :
                                    app === 'Asset Management' ? 'إدارة الأصول والأجهزة (Asset Management)' : app
                                  ) : app}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleAllAppPermissions(app)}
                                  title={allAppSelected ? (language === 'ar' ? 'إلغاء صف هذا التطبيق' : 'Deselect row') : (language === 'ar' ? 'تحديد صف هذا التطبيق' : 'Select row')}
                                  className={`text-[10px] px-1.5 py-0.5 rounded transition cursor-pointer border ${
                                    allAppSelected
                                      ? 'bg-blue-100 text-blue-700 border-blue-200 font-bold'
                                      : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                  }`}
                                >
                                  {allAppSelected ? '✓' : '+'}
                                </button>
                              </div>
                            </td>
                            {ACTIONS.map(action => {
                              const permString = `${app}.${action}`;
                              const isChecked = formData.permissions.includes(permString);
                              return (
                                <td key={action} className="py-2.5 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => togglePermission(permString)}
                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-3 rtl:space-x-reverse border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/20 rounded-xl transition cursor-pointer"
                >
                  {editingRole ? (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : (language === 'ar' ? 'إنشاء الدور' : 'Create Role')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
