import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTickets } from '../context/TicketContext';
import { SupportTeam, TeamType, isUserTechnical, isUserOperator } from '../types';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Search,
  Check,
  X,
  UserPlus,
  UserMinus,
  Shield,
  Layers,
  Wrench,
  Database,
  ShieldCheck,
  Cpu,
  Info,
  Building,
  Sparkles,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface TeamManagementViewProps {
  onNavigateToRoles?: () => void;
}

const TEAM_TYPE_PRESETS: { value: string; labelEn: string; labelAr: string; icon: any; color: string }[] = [
  {
    value: 'Technical Team',
    labelEn: 'Technical Team (Hardware & Infrastructure)',
    labelAr: 'الفريق الفني للعتاد والأجهزة والشبكات',
    icon: Wrench,
    color: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  {
    value: 'Database and Systems Admins',
    labelEn: 'Database & Systems Admins',
    labelAr: 'إدارة قواعد البيانات والأنظمة المركزية',
    icon: Database,
    color: 'bg-purple-100 text-purple-800 border-purple-200'
  },
  {
    value: 'Security Team',
    labelEn: 'Security & Compliance Team',
    labelAr: 'فريق أمن المعلومات والامتثال والسياسات',
    icon: ShieldCheck,
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  {
    value: 'Application & Software Support',
    labelEn: 'Application & Software Support',
    labelAr: 'فريق دعم البرمجيات والتطبيقات',
    icon: Cpu,
    color: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  {
    value: 'General Technical Support',
    labelEn: 'General Technical Support',
    labelAr: 'الدعم الفني العام وخدمة المستفيدين',
    icon: Layers,
    color: 'bg-slate-100 text-slate-800 border-slate-200'
  }
];

export function TeamManagementView({ onNavigateToRoles }: TeamManagementViewProps) {
  const { language, dir } = useLanguage();
  const { users, currentUser, isAdmin, hasPermission } = useAuth();
  const {
    teams,
    createTeam,
    updateTeam,
    deleteTeam,
    assignUserToTeam,
    removeUserFromTeam,
    refreshTeams
  } = useTickets();

  // Role Permissions
  const canCreate = isAdmin || hasPermission('Team Management.Create');
  const canEdit = isAdmin || hasPermission('Team Management.Edit');
  const canDelete = isAdmin || hasPermission('Team Management.Delete');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<SupportTeam | null>(null);
  const [quickAssignTeamId, setQuickAssignTeamId] = useState<string | null>(null);
  const [userToQuickAssign, setUserToQuickAssign] = useState<string>('');
  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState<SupportTeam | null>(null);

  // Form State for Create / Edit
  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    type: 'Technical Team',
    customType: '',
    description: '',
    descriptionAr: '',
    memberUserIds: [] as string[]
  });
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map each user to the teams they belong to (to visualize multi-team membership)
  const userTeamsMap = useMemo(() => {
    const map: Record<string, SupportTeam[]> = {};
    for (const team of teams) {
      for (const userId of team.memberUserIds || []) {
        if (!map[userId]) map[userId] = [];
        map[userId].push(team);
      }
    }
    return map;
  }, [teams]);

  // Filtered teams list
  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        team.name?.toLowerCase().includes(q) ||
        team.nameAr?.toLowerCase().includes(q) ||
        team.description?.toLowerCase().includes(q) ||
        team.descriptionAr?.toLowerCase().includes(q) ||
        team.type?.toLowerCase().includes(q) ||
        (team.memberUserIds || []).some((uid) => {
          const u = users.find((usr) => String(usr.id) === String(uid) || String(usr.uid) === String(uid));
          return u?.fullName?.toLowerCase().includes(q) || u?.email?.toLowerCase().includes(q);
        });

      const matchesType = selectedTypeFilter === 'all' || team.type === selectedTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [teams, searchQuery, selectedTypeFilter, users]);

  // Statistics
  const totalTeams = teams.length;
  const totalAssignedStaff = new Set(teams.flatMap((t) => t.memberUserIds || [])).size;
  const multiTeamUsersCount = Object.values(userTeamsMap).filter((tList: SupportTeam[]) => tList.length > 1).length;

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormData({
      name: '',
      nameAr: '',
      type: 'Technical Team',
      customType: '',
      description: '',
      descriptionAr: '',
      memberUserIds: []
    });
    setMemberSearchQuery('');
    setFormError('');
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (team: SupportTeam) => {
    const isPreset = TEAM_TYPE_PRESETS.some((p) => p.value === team.type);
    setFormData({
      name: team.name || '',
      nameAr: team.nameAr || '',
      type: isPreset ? team.type : 'Custom',
      customType: isPreset ? '' : team.type,
      description: team.description || '',
      descriptionAr: team.descriptionAr || '',
      memberUserIds: [...(team.memberUserIds || [])]
    });
    setMemberSearchQuery('');
    setFormError('');
    setEditingTeam(team);
  };

  // Toggle user membership in form (Only Technical users or Admins can join teams)
  const handleToggleMember = (userId: string) => {
    const targetUser = users.find((u) => String(u.id) === String(userId) || String(u.uid) === String(userId));
    const isTech = targetUser ? (isUserTechnical(targetUser) || targetUser.role === 'Admin') : false;

    setFormData((prev) => {
      const isIncluded = prev.memberUserIds.includes(userId);
      if (!isIncluded && !isTech) {
        setFormError(
          language === 'ar'
            ? `لا يمكن إضافة "${targetUser?.fullName || 'المستخدم'}": نوع المستخدم هو مشغل (Operator). فقط المستخدمون الفنيون (Technical) مسموح لهم بالانضمام لفرق الدعم الفني وحل التذاكر.`
            : `Cannot add "${targetUser?.fullName || 'User'}": User is an Operator. Only Technical users can join teams and solve tickets.`
        );
        return prev;
      }
      return {
        ...prev,
        memberUserIds: isIncluded
          ? prev.memberUserIds.filter((id) => id !== userId)
          : [...prev.memberUserIds, userId]
      };
    });
  };

  // Handle Create / Edit Submission
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError(language === 'ar' ? 'يرجى إدخال اسم الفريق باللغة الإنجليزية' : 'English team name is required');
      return;
    }
    if (!formData.nameAr.trim()) {
      setFormError(language === 'ar' ? 'يرجى إدخال اسم الفريق باللغة العربية' : 'Arabic team name is required');
      return;
    }

    const finalType = formData.type === 'Custom' ? (formData.customType.trim() || formData.name.trim()) : formData.type;

    setIsSubmitting(true);
    try {
      if (editingTeam) {
        // Update existing team
        const res = await updateTeam(editingTeam.id, {
          name: formData.name.trim(),
          nameAr: formData.nameAr.trim(),
          type: finalType,
          description: formData.description.trim(),
          descriptionAr: formData.descriptionAr.trim(),
          memberUserIds: formData.memberUserIds
        });

        if (res.success) {
          setEditingTeam(null);
          refreshTeams();
        } else {
          setFormError(res.error || 'Failed to update team');
        }
      } else {
        // Create new team
        const res = await createTeam({
          name: formData.name.trim(),
          nameAr: formData.nameAr.trim(),
          type: finalType,
          description: formData.description.trim(),
          descriptionAr: formData.descriptionAr.trim(),
          memberUserIds: formData.memberUserIds
        });

        if (res.success) {
          setIsCreateModalOpen(false);
          refreshTeams();
        } else {
          setFormError(res.error || 'Failed to create team');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Team
  const handleConfirmDelete = async () => {
    if (!deleteConfirmTeam) return;
    setIsSubmitting(true);
    try {
      const res = await deleteTeam(deleteConfirmTeam.id);
      if (res.success) {
        setDeleteConfirmTeam(null);
        refreshTeams();
      } else {
        alert(res.error || 'Failed to delete team');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete team');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Assign User to Team
  const handleQuickAssign = (teamId: string) => {
    if (!userToQuickAssign) return;
    const targetUser = getUserObj(userToQuickAssign);
    if (targetUser && !isUserTechnical(targetUser) && targetUser.role !== 'Admin') {
      alert(
        language === 'ar'
          ? 'لا يمكن إضافة هذا المستخدم: نوع المستخدم هو مشغل (Operator). فقط المستخدمون الفنيون (Technical) يمكنهم الانضمام لفرق الدعم وحل التذاكر.'
          : 'Cannot assign user: User is an Operator. Only Technical users can join teams and solve tickets.'
      );
      return;
    }
    assignUserToTeam(teamId, userToQuickAssign);
    setUserToQuickAssign('');
    setQuickAssignTeamId(null);
  };

  // Helper to get user object
  const getUserObj = (userId: string) => {
    return users.find((u) => String(u.id) === String(userId) || String(u.uid) === String(userId));
  };

  // Helper to get team type badge
  const getTeamTypeBadge = (type: string) => {
    const preset = TEAM_TYPE_PRESETS.find((p) => p.value === type);
    const IconComponent = preset ? preset.icon : Layers;
    const colorClass = preset ? preset.color : 'bg-slate-100 text-slate-800 border-slate-200';
    const label = language === 'ar' ? (preset ? preset.labelAr : type) : (preset ? preset.labelEn : type);

    return (
      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-xs font-semibold ${colorClass}`}>
        <IconComponent className="w-3.5 h-3.5 mx-1" />
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs mx-1">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {language === 'ar' ? 'إدارة فرق العمل وتوزيع الكوادر الفنية' : 'Support Teams & Staff Distribution'}
                </h1>
                <p className="text-xs text-slate-500">
                  {language === 'ar'
                    ? 'إدارة الفرق المتخصصة، تعيين الموظفين وتوزيعهم على فرق متعددة، وضبط مسارات معالجة البلاغات.'
                    : 'Manage specialized teams, assign personnel across multiple teams, and configure ticket routing.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && onNavigateToRoles && (
              <button
                type="button"
                onClick={onNavigateToRoles}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition cursor-pointer"
                title={language === 'ar' ? 'إدارة صلاحيات الأدوار' : 'Manage Role Permissions'}
              >
                <Shield className="w-3.5 h-3.5 text-blue-600 mx-1" />
                <span>{language === 'ar' ? 'صلاحيات الأدوار' : 'Role Permissions'}</span>
              </button>
            )}

            <button
              id="btn-create-team"
              type="button"
              disabled={!canCreate}
              onClick={handleOpenCreate}
              title={!canCreate ? (language === 'ar' ? 'ليس لديك صلاحية لإنشاء فريق جديد' : 'You do not have permission to create teams') : ''}
              className={`flex items-center space-x-1.5 px-4 py-2 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer ${
                canCreate
                  ? 'bg-blue-600 hover:bg-blue-500'
                  : 'bg-slate-400 opacity-60 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4 mx-1" />
              <span>{language === 'ar' ? 'إنشاء فريق عمل جديد' : 'Create New Team'}</span>
            </button>
          </div>
        </div>

        {/* Informational Multi-Team & Permissions Hint */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block">
                {language === 'ar' ? 'إجمالي فرق العمل' : 'Total Teams'}
              </span>
              <span className="text-lg font-bold text-slate-900">{totalTeams}</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block">
                {language === 'ar' ? 'الكوادر المعينة بالفرق' : 'Assigned Staff'}
              </span>
              <span className="text-lg font-bold text-slate-900">{totalAssignedStaff}</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block">
                {language === 'ar' ? 'أعضاء في أكثر من فريق' : 'Multi-Team Members'}
              </span>
              <span className="text-lg font-bold text-indigo-700">{multiTeamUsersCount}</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Feature info strip */}
        <div className="mt-3 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-blue-900 text-xs flex items-center space-x-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mx-1" />
          <span>
            {language === 'ar'
              ? 'ملاحظة تشغيلية: يدعم النظام انتساب الموظف الواحد لأكثر من فريق عمل دون أي قيود، مع دعم كامل للأسماء الثنائية (العربية والإنجليزية) وضبط الأذونات عبر صلاحيات الدور.'
              : 'Operational note: The system supports assigning users to multiple teams simultaneously with full bilingual naming (Arabic & English) and role-based permission control.'}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'ar' ? 'البحث باسم الفريق أو اسم العضو...' : 'Search by team or member name...'}
            className={`w-full py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
              dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'
            }`}
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-500 font-medium">
            {language === 'ar' ? 'التصنيف:' : 'Filter:'}
          </span>
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 text-slate-700"
          >
            <option value="all">{language === 'ar' ? 'كافة التصنيفات' : 'All Types'}</option>
            {TEAM_TYPE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {language === 'ar' ? p.labelAr : p.labelEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Current Teams Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-xs ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">{language === 'ar' ? 'الفريق (عربي / إنجليزي)' : 'Team (Arabic & English)'}</th>
                <th className="py-3.5 px-4">{language === 'ar' ? 'التخصص ونطاق العمل' : 'Specialization & Scope'}</th>
                <th className="py-3.5 px-4">{language === 'ar' ? 'المستخدمين المنتمين لهذا الفريق' : 'Assigned Team Members'}</th>
                <th className="py-3.5 px-4 text-center">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">
                      {language === 'ar' ? 'لم يتم العثور على أي فرق عمل' : 'No support teams found'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {language === 'ar' ? 'يمكنك إنشاء فريق عمل جديد أو تغيير معايير البحث.' : 'You can create a new team or adjust search filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTeams.map((team) => {
                  const memberIds = team.memberUserIds || [];
                  const memberObjects = memberIds
                    .map((id) => getUserObj(id))
                    .filter(Boolean);

                  return (
                    <tr key={team.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Team Names (Arabic & English) */}
                      <td className="py-4 px-4 align-top">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-slate-900 mx-1">
                              {team.nameAr}
                            </span>
                          </div>
                          <div className="text-xs font-medium text-slate-600 font-sans">
                            {team.name}
                          </div>
                          <div className="pt-1">
                            {getTeamTypeBadge(team.type)}
                          </div>
                        </div>
                      </td>

                      {/* Specialization & Scope Descriptions */}
                      <td className="py-4 px-4 align-top max-w-xs">
                        <div className="space-y-1 text-slate-600">
                          {team.descriptionAr && (
                            <p className="text-[11px] leading-relaxed text-slate-700">
                              {team.descriptionAr}
                            </p>
                          )}
                          {team.description && (
                            <p className="text-[11px] leading-relaxed text-slate-500 italic">
                              {team.description}
                            </p>
                          )}
                          {!team.descriptionAr && !team.description && (
                            <span className="text-slate-400 text-[11px] italic">
                              {language === 'ar' ? 'لا يوجد وصف مدخل' : 'No description provided'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Users Belonging to this Team */}
                      <td className="py-4 px-4 align-top">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                              <span>{language === 'ar' ? 'الأعضاء الحاليين:' : 'Members:'}</span>
                              <span className="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono text-[10px] mx-1">
                                {memberIds.length}
                              </span>
                            </span>

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickAssignTeamId(quickAssignTeamId === team.id ? null : team.id);
                                  setUserToQuickAssign('');
                                }}
                                className="inline-flex items-center space-x-1 text-[11px] text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5 mx-0.5" />
                                <span>{language === 'ar' ? '+ إضافة عضو' : '+ Add Member'}</span>
                              </button>
                            )}
                          </div>

                          {/* Quick Assign Dropdown Drawer */}
                          {quickAssignTeamId === team.id && (
                            <div className="p-2 bg-blue-50/80 border border-blue-200 rounded-lg flex items-center space-x-2">
                              <select
                                value={userToQuickAssign}
                                onChange={(e) => setUserToQuickAssign(e.target.value)}
                                className="px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 flex-1"
                              >
                                <option value="">{language === 'ar' ? '-- حدد موظفاً فنياً لإضافته --' : '-- Select technical user to add --'}</option>
                                {users
                                  .filter((u) => !memberIds.includes(String(u.id)) && !memberIds.includes(String(u.uid)))
                                  .map((u) => {
                                    const isTech = isUserTechnical(u) || u.role === 'Admin';
                                    const otherTeams = userTeamsMap[String(u.id)] || userTeamsMap[String(u.uid)] || [];
                                    const otherCount = otherTeams.length;
                                    const typeLabel = isTech
                                      ? (language === 'ar' ? 'فني' : 'Technical')
                                      : (language === 'ar' ? 'مشغل - غير مؤهل للفرق' : 'Operator - Ineligible');

                                    return (
                                      <option key={u.id} value={u.id} disabled={!isTech}>
                                        {u.fullName} ({typeLabel}) {otherCount > 0 ? (language === 'ar' ? `[في ${otherCount} فرق]` : `[in ${otherCount} teams]`) : ''}
                                      </option>
                                    );
                                  })}
                              </select>
                              <button
                                type="button"
                                disabled={!userToQuickAssign}
                                onClick={() => handleQuickAssign(team.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs disabled:opacity-50 transition cursor-pointer"
                              >
                                {language === 'ar' ? 'تأكيد' : 'Assign'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setQuickAssignTeamId(null)}
                                className="p-1 text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* Member Chips / Badges */}
                          {memberObjects.length === 0 ? (
                            <div className="p-3 text-center text-slate-400 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">
                              {language === 'ar' ? 'لا يوجد أعضاء في هذا الفريق بعد' : 'No members assigned yet'}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-w-md">
                              {memberObjects.map((member: any) => {
                                const allMemberTeams = userTeamsMap[String(member.id)] || userTeamsMap[String(member.uid)] || [];
                                const isMultiTeam = allMemberTeams.length > 1;

                                return (
                                  <div
                                    key={member.id}
                                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-800 text-[11px] group transition"
                                  >
                                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mx-0.5">
                                      {member.fullName.charAt(0)}
                                    </div>
                                    <div className="leading-tight">
                                      <span className="font-semibold">{member.fullName}</span>
                                      {isMultiTeam && (
                                        <span
                                          className="mx-1 px-1 py-0.2 text-[9px] rounded bg-indigo-100 text-indigo-700 font-bold"
                                          title={
                                            language === 'ar'
                                              ? `ينتمي أيضاً إلى: ${allMemberTeams.filter((t) => t.id !== team.id).map((t) => t.nameAr || t.name).join('، ')}`
                                              : `Also in: ${allMemberTeams.filter((t) => t.id !== team.id).map((t) => t.name).join(', ')}`
                                          }
                                        >
                                          {language === 'ar' ? `+${allMemberTeams.length - 1} فرق` : `+${allMemberTeams.length - 1} teams`}
                                        </span>
                                      )}
                                    </div>

                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => removeUserFromTeam(team.id, member.id)}
                                        className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition cursor-pointer"
                                        title={language === 'ar' ? 'إزالة الموظف من هذا الفريق' : 'Remove from team'}
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 align-top text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            id={`btn-edit-team-${team.id}`}
                            disabled={!canEdit}
                            onClick={() => handleOpenEdit(team)}
                            title={!canEdit ? (language === 'ar' ? 'ليس لديك صلاحية لتعديل الفريق' : 'No edit permission') : (language === 'ar' ? 'تعديل الفريق' : 'Edit Team')}
                            className={`p-2 rounded-lg transition cursor-pointer ${
                              canEdit
                                ? 'text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200'
                                : 'text-slate-300 cursor-not-allowed'
                            }`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            id={`btn-delete-team-${team.id}`}
                            disabled={!canDelete}
                            onClick={() => setDeleteConfirmTeam(team)}
                            title={!canDelete ? (language === 'ar' ? 'ليس لديك صلاحية لحذف الفريق' : 'No delete permission') : (language === 'ar' ? 'حذف الفريق' : 'Delete Team')}
                            className={`p-2 rounded-lg transition cursor-pointer ${
                              canDelete
                                ? 'text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200'
                                : 'text-slate-300 cursor-not-allowed'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT TEAM MODAL */}
      {(isCreateModalOpen || editingTeam) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 my-8" dir={dir}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold mx-1">
                  {editingTeam ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingTeam
                      ? (language === 'ar' ? 'تعديل فريق الدعم الفني' : 'Edit Support Team')
                      : (language === 'ar' ? 'إنشاء فريق عمل دعم فني جديد' : 'Create New Support Team')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'ar'
                      ? 'أدخل اسم الفريق باللغتين العربية والإنجليزية وحدد الأعضاء المنتمين له.'
                      : 'Enter team names in both Arabic & English and assign team staff.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingTeam(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mx-1" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Bilingual Team Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'اسم الفريق باللغة العربية *' : 'Team Name (Arabic) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nameAr}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    placeholder={language === 'ar' ? 'مثال: فريق دعم البنية التحتية والشبكات' : 'e.g. فريق دعم الشبكات'}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'اسم الفريق باللغة الإنجليزية *' : 'Team Name (English) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Network & Infrastructure Support Team"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-sans"
                  />
                </div>
              </div>

              {/* Specialization / Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ar' ? 'تخصص الفريق / التصنيف التشغيلي' : 'Team Specialization / Classification'}
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  {TEAM_TYPE_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {language === 'ar' ? preset.labelAr : preset.labelEn}
                    </option>
                  ))}
                  <option value="Custom">{language === 'ar' ? 'تصنيف مخصص...' : 'Custom Specialization...'}</option>
                </select>

                {formData.type === 'Custom' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={formData.customType}
                      onChange={(e) => setFormData({ ...formData, customType: e.target.value })}
                      placeholder={language === 'ar' ? 'أدخل اسم التخصص المخصص...' : 'Enter custom specialization name...'}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* Descriptions in Arabic and English */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'الوصف ونطاق المسؤولية (بالعربية)' : 'Description (Arabic)'}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.descriptionAr}
                    onChange={(e) => setFormData({ ...formData, descriptionAr: e.target.value })}
                    placeholder={language === 'ar' ? 'وصف للمهام المسندة لهذا الفريق...' : 'Arabic description...'}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'الوصف ونطاق المسؤولية (بالإنجليزية)' : 'Description (English)'}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="English description of responsibilities..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none font-sans"
                  />
                </div>
              </div>

              {/* Members Selection Section (Multi-User & Multi-Team support) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-900">
                      {language === 'ar' ? 'أعضاء الفريق (تحديد متعدد للمستخدمين)' : 'Assign Team Members (Multi-Select)'}
                    </label>
                    <span className="text-[11px] text-slate-500">
                      {language === 'ar'
                        ? 'يمكن للمستخدمين الانضمام لأكثر من فريق عمل دون أي تعارض.'
                        : 'Users can belong to multiple teams simultaneously.'}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                    {language === 'ar' ? `المحدد: ${formData.memberUserIds.length} عضو` : `Selected: ${formData.memberUserIds.length} members`}
                  </span>
                </div>

                {/* Search members input */}
                <div className="relative">
                  <Search className={`w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'}`} />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder={language === 'ar' ? 'بحث عن موظف بالاسم أو البريد أو القسم...' : 'Filter users by name, email, or department...'}
                    className={`w-full py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                      dir === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'
                    }`}
                  />
                </div>

                {/* Users List with Checkboxes */}
                <div className="border border-slate-200 rounded-xl bg-slate-50 max-h-52 overflow-y-auto divide-y divide-slate-200 p-1">
                  {users
                    .filter((u) => {
                      const q = memberSearchQuery.toLowerCase().trim();
                      return (
                        !q ||
                        u.fullName?.toLowerCase().includes(q) ||
                        u.email?.toLowerCase().includes(q) ||
                        u.department?.toLowerCase().includes(q) ||
                        u.role?.toLowerCase().includes(q)
                      );
                    })
                    .map((user) => {
                      const isSelected = formData.memberUserIds.includes(String(user.id)) || formData.memberUserIds.includes(String(user.uid));
                      const isTech = isUserTechnical(user) || user.role === 'Admin';
                      const otherTeams = userTeamsMap[String(user.id)] || userTeamsMap[String(user.uid)] || [];
                      const otherTeamsCount = otherTeams.filter((t) => t.id !== editingTeam?.id).length;

                      return (
                        <div
                          key={user.id}
                          onClick={() => handleToggleMember(String(user.id))}
                          className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition ${
                            isSelected
                              ? 'bg-blue-50/90 border border-blue-200'
                              : isTech
                              ? 'hover:bg-white'
                              : 'opacity-75 hover:bg-slate-100/70 bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!isTech && !isSelected}
                              onChange={() => {}} // handled by parent div
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer mx-1 disabled:opacity-40"
                            />
                            <div className={`w-6 h-6 rounded-full font-bold text-[10px] flex items-center justify-center ${isTech ? 'bg-blue-600 text-white' : 'bg-slate-400 text-white'}`}>
                              {user.fullName.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center space-x-1.5 flex-wrap">
                                <p className="text-xs font-bold text-slate-800 mx-1">{user.fullName}</p>
                                {isTech ? (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    {language === 'ar' ? 'فني / Technical' : 'Technical'}
                                  </span>
                                ) : (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                    {language === 'ar' ? 'مشغل / Operator' : 'Operator'}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500">{user.email} • {user.department || user.role}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1">
                            {!isTech && (
                              <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                                {language === 'ar' ? 'غير متاح للفرق' : 'Cannot join teams'}
                              </span>
                            )}
                            {otherTeamsCount > 0 && (
                              <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full font-medium">
                                {language === 'ar' ? `في ${otherTeamsCount} فرق أخرى` : `In ${otherTeamsCount} other teams`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingTeam(null);
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Check className="w-3.5 h-3.5 mx-1" />
                  <span>
                    {isSubmitting
                      ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...')
                      : (editingTeam
                          ? (language === 'ar' ? 'تحديث الفريق' : 'Update Team')
                          : (language === 'ar' ? 'إنشاء الفريق' : 'Create Team'))}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmTeam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4" dir={dir}>
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">
                {language === 'ar' ? 'تأكيد حذف فريق العمل' : 'Confirm Team Deletion'}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'ar'
                  ? `هل أنت متأكد من رغبتك في حذف فريق "${deleteConfirmTeam.nameAr}" (${deleteConfirmTeam.name})؟ لن يتم حذف المستخدمين ولكن سيتم إلغاء انتسابهم لهذا الفريق.`
                  : `Are you sure you want to delete team "${deleteConfirmTeam.name}"? Users will not be deleted, but their assignment to this team will be removed.`}
              </p>
            </div>

            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTeam(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (language === 'ar' ? 'جاري الحذف...' : 'Deleting...') : (language === 'ar' ? 'نعم، احذف الفريق' : 'Delete Team')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
