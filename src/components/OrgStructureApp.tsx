import React, { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  GitMerge, 
  GitBranch, 
  Users, 
  Plus, 
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  Edit3,
  Check,
  X,
  Trash2,
  Search,
  Info,
  MapPin,
  Phone,
  Mail,
  UserCircle2
} from 'lucide-react';

interface OrgStructureAppProps {
  onBackToMetro: () => void;
}

import { useOrg, TreeNode } from '../context/OrgContext';

type UnitType = 'org' | 'directorate' | 'department' | 'division';

/** Brief information kept for every unit; edited in the add and edit forms. */
interface UnitDetailsForm {
  shortName: string;
  description: string;
  location: string;
  phone: string;
  email: string;
  managerId: string;
}

const EMPTY_DETAILS: UnitDetailsForm = { shortName: '', description: '', location: '', phone: '', email: '', managerId: '' };

const detailsFromNode = (node: TreeNode): UnitDetailsForm => ({
  shortName: node.shortName || '',
  description: node.description || '',
  location: node.location || '',
  phone: node.phone || '',
  email: node.email || '',
  managerId: node.managerId || ''
});

/** Same checks as the server, so mistakes are shown before saving. */
const detailsError = (d: UnitDetailsForm, ar: boolean): string => {
  if (d.phone.trim() && !/^[0-9+\-\s()]+$/.test(d.phone.trim())) {
    return ar ? 'رقم الهاتف يجب أن يحتوي على أرقام فقط (ويُسمح بـ + و - والمسافات)' : 'Phone may only contain digits, spaces, + and -';
  }
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) {
    return ar ? 'البريد الإلكتروني غير صحيح' : 'Invalid email address';
  }
  return '';
};

const UNIT_TYPE_LABELS: Record<UnitType, { ar: string; en: string }> = {
  org: { ar: 'منظمة', en: 'Organization' },
  directorate: { ar: 'دائرة', en: 'Directorate' },
  department: { ar: 'قسم', en: 'Department' },
  division: { ar: 'شعبة', en: 'Division' }
};

export function OrgStructureApp({ onBackToMetro }: OrgStructureAppProps) {
  const { t, language, dir } = useLanguage();
  const { isAdmin, hasPermission, users } = useAuth();
  const canManageOrg = isAdmin || hasPermission('Organization Structure.Create') || hasPermission('Organization Structure.Edit') || hasPermission('Organization Structure.Delete') || hasPermission('Organization Structure.*') || hasPermission('org.manage');
  const { orgData, setOrgData, saveNode, deleteNode } = useOrg();
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState('dashboard');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [nodeToDelete, setNodeToDelete] = useState<TreeNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [infoNode, setInfoNode] = useState<TreeNode | null>(null);

  // Add unit modal state
  const [addModal, setAddModal] = useState<{
    open: boolean;
    type: 'org' | 'directorate' | 'department' | 'division';
    parentId: string;
    nameEn: string;
    nameAr: string;
    details: UnitDetailsForm;
  }>({
    open: false,
    type: 'department',
    parentId: '',
    nameEn: '',
    nameAr: '',
    details: EMPTY_DETAILS
  });
  const closeAddModal = () => setAddModal({ open: false, type: 'department', parentId: '', nameEn: '', nameAr: '', details: EMPTY_DETAILS });

  // Edit unit modal state
  const [editModal, setEditModal] = useState<{
    open: boolean;
    node: TreeNode | null;
    nameEn: string;
    nameAr: string;
    parentId: string;
    type: 'org' | 'directorate' | 'department' | 'division';
    details: UnitDetailsForm;
  }>({
    open: false,
    node: null,
    nameEn: '',
    nameAr: '',
    parentId: '',
    type: 'department',
    details: EMPTY_DETAILS
  });
  const closeEditModal = () => setEditModal({ open: false, node: null, nameEn: '', nameAr: '', parentId: '', type: 'department', details: EMPTY_DETAILS });

  // Helper to determine primary name based on site language
  const getNodePrimaryName = (node: TreeNode): string => {
    if (language === 'ar') {
      return (node.nameAr && node.nameAr.trim()) ? node.nameAr : (node.nameEn || '');
    }
    return (node.nameEn && node.nameEn.trim()) ? node.nameEn : (node.nameAr || '');
  };

  // Helper to determine secondary name based on site language
  const getNodeSecondaryName = (node: TreeNode): string => {
    if (language === 'ar') {
      return (node.nameEn && node.nameEn.trim()) ? node.nameEn : '';
    }
    return (node.nameAr && node.nameAr.trim()) ? node.nameAr : '';
  };

  // Helper to highlight matching substrings in unit names
  const highlightText = (text: string, query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return text;
    try {
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
      return parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark key={i} className="bg-amber-200 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100 px-0.5 rounded font-semibold">
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  };

  // Real-time filter: matches unit by English or Arabic name, keeping matching hierarchy
  const filteredOrgData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return orgData;

    const filterNode = (node: TreeNode): TreeNode | null => {
      const nameEnMatch = (node.nameEn || '').toLowerCase().includes(query);
      const nameArMatch = (node.nameAr || '').toLowerCase().includes(query);
      const shortMatch = (node.shortName || '').toLowerCase().includes(query);
      const matchesSelf = nameEnMatch || nameArMatch || shortMatch;

      const filteredChildren: TreeNode[] = [];
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          const filteredChild = filterNode(child);
          if (filteredChild) {
            filteredChildren.push(filteredChild);
          }
        }
      }

      if (matchesSelf || filteredChildren.length > 0) {
        return {
          ...node,
          children: matchesSelf && filteredChildren.length === 0 ? node.children : filteredChildren,
        };
      }
      return null;
    };

    return orgData
      .map(filterNode)
      .filter((n): n is TreeNode => n !== null);
  }, [orgData, searchQuery]);

  // Total count of matching units
  const matchingCount = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return 0;
    let count = 0;
    const countNodes = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if ((n.nameEn || '').toLowerCase().includes(query) || (n.nameAr || '').toLowerCase().includes(query) || (n.shortName || '').toLowerCase().includes(query)) {
          count++;
        }
        if (n.children && n.children.length > 0) countNodes(n.children);
      }
    };
    countNodes(orgData);
    return count;
  }, [orgData, searchQuery]);

  // Auto-expand all matching branches when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      const matchingIds = new Set<string>();
      const collect = (nodes: TreeNode[]) => {
        nodes.forEach(n => {
          matchingIds.add(n.id);
          if (n.children && n.children.length > 0) collect(n.children);
        });
      };
      collect(filteredOrgData);
      setExpandedNodes(prev => {
        const next = new Set(prev);
        matchingIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [searchQuery, filteredOrgData]);

  const expandAll = () => {
    const allIds = new Set<string>();
    const collect = (nodes: TreeNode[]) => {
      nodes.forEach(n => {
        allIds.add(n.id);
        if (n.children && n.children.length > 0) collect(n.children);
      });
    };
    collect(filteredOrgData);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Expand all nodes initially when data is loaded
  React.useEffect(() => {
    if (orgData.length > 0) {
      const allIds = new Set<string>();
      const collect = (nodes: TreeNode[]) => {
        nodes.forEach(n => {
          allIds.add(n.id);
          if (n.children && n.children.length > 0) collect(n.children);
        });
      };
      collect(orgData);
      setExpandedNodes(prev => {
        const next = new Set(prev);
        allIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [orgData]);

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  // Helper to extract units of a specific type
  const getUnitsByType = (type: 'org' | 'directorate' | 'department' | 'division'): TreeNode[] => {
    const results: TreeNode[] = [];
    const traverse = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.type === type) results.push(n);
        if (n.children && n.children.length > 0) traverse(n.children);
      }
    };
    traverse(orgData);
    return results;
  };

  // Helper to get potential parents for a given unit type
  const getPotentialParents = (
    type: 'org' | 'directorate' | 'department' | 'division',
    excludeId?: string
  ): TreeNode[] => {
    const results: TreeNode[] = [];
    const traverse = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (excludeId && n.id === excludeId) continue;
        if (type === 'directorate') {
          if (n.type === 'org') results.push(n);
        } else if (type === 'department') {
          if (n.type === 'directorate' || n.type === 'org') results.push(n);
        } else if (type === 'division') {
          if (n.type === 'department' || n.type === 'directorate' || n.type === 'org') results.push(n);
        }
        if (n.children && n.children.length > 0) traverse(n.children);
      }
    };
    traverse(orgData);
    return results;
  };

  const openAddModal = (
    type: 'org' | 'directorate' | 'department' | 'division',
    parentId?: string
  ) => {
    let resolvedParent = parentId || '';
    if (!resolvedParent && type !== 'org') {
      const potential = getPotentialParents(type);
      resolvedParent = potential[0]?.id || '';
    }

    setErrorMsg('');
    setAddModal({
      open: true,
      type,
      parentId: type === 'org' ? '' : resolvedParent,
      nameEn: '',
      nameAr: '',
      details: EMPTY_DETAILS
    });
  };

  const handleModalAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addModal.nameEn.trim()) {
      setErrorMsg(language === 'ar' ? 'يرجى إدخال الاسم باللغة الإنجليزية' : 'Please enter English name');
      return;
    }
    if (!addModal.nameAr.trim()) {
      setErrorMsg(language === 'ar' ? 'يرجى إدخال الاسم باللغة العربية' : 'Please enter Arabic name');
      return;
    }
    const addDetailsProblem = detailsError(addModal.details, language === 'ar');
    if (addDetailsProblem) {
      setErrorMsg(addDetailsProblem);
      return;
    }

    const newNode: TreeNode = {
      id: '',
      nameEn: addModal.nameEn.trim(),
      nameAr: addModal.nameAr.trim(),
      type: addModal.type,
      children: [],
      shortName: addModal.details.shortName.trim(),
      description: addModal.details.description.trim(),
      location: addModal.details.location.trim(),
      phone: addModal.details.phone.trim(),
      email: addModal.details.email.trim(),
      managerId: addModal.details.managerId || null
    };

    const res = await saveNode(newNode, addModal.type === 'org' ? null : (addModal.parentId || null));
    if (res.success && res.data) {
      if (addModal.parentId) {
        setExpandedNodes(prev => new Set([...prev, addModal.parentId, `db_${res.data.id}`]));
      } else {
        setExpandedNodes(prev => new Set([...prev, `db_${res.data.id}`]));
      }
      closeAddModal();
      setErrorMsg('');
    } else {
      setErrorMsg(res.error || (language === 'ar' ? 'فشل إنشاء الوحدة التنظيمية' : 'Failed to create unit'));
    }
  };

  const handleStartEdit = (e: React.MouseEvent, node: TreeNode) => {
    e.stopPropagation();
    
    // Find parent id if exists
    const findParentId = (nodes: TreeNode[], targetId: string, currentParentId?: string): string => {
      for (const n of nodes) {
        if (n.id === targetId) return currentParentId || (n.parentId ? `db_${n.parentId}` : '');
        if (n.children && n.children.length > 0) {
          const found = findParentId(n.children, targetId, n.id);
          if (found) return found;
        }
      }
      return '';
    };

    const parentId = findParentId(orgData, node.id);

    setErrorMsg('');
    setEditModal({
      open: true,
      node,
      nameEn: node.nameEn || '',
      nameAr: node.nameAr || '',
      parentId: parentId || '',
      type: node.type,
      details: detailsFromNode(node)
    });
  };

  const handleSaveEditModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal.node) return;

    if (!editModal.nameEn.trim()) {
      setErrorMsg(language === 'ar' ? 'يرجى إدخال الاسم باللغة الإنجليزية' : 'Please enter English name');
      return;
    }
    if (!editModal.nameAr.trim()) {
      setErrorMsg(language === 'ar' ? 'يرجى إدخال الاسم باللغة العربية' : 'Please enter Arabic name');
      return;
    }
    const editDetailsProblem = detailsError(editModal.details, language === 'ar');
    if (editDetailsProblem) {
      setErrorMsg(editDetailsProblem);
      return;
    }

    const updatedNode: TreeNode = {
      ...editModal.node,
      nameEn: editModal.nameEn.trim(),
      nameAr: editModal.nameAr.trim(),
      shortName: editModal.details.shortName.trim(),
      description: editModal.details.description.trim(),
      location: editModal.details.location.trim(),
      phone: editModal.details.phone.trim(),
      email: editModal.details.email.trim(),
      managerId: editModal.details.managerId || null
    };

    const res = await saveNode(updatedNode, editModal.type === 'org' ? null : (editModal.parentId || null));
    if (res.success) {
      closeEditModal();
      setErrorMsg('');
    } else {
      setErrorMsg(res.error || (language === 'ar' ? 'فشل حفظ التعديلات' : 'Failed to save changes'));
    }
  };

  const handleAddNode = (e: React.MouseEvent, parentId: string, parentType: string) => {
    e.stopPropagation();
    let newType: 'org' | 'directorate' | 'department' | 'division' = 'division';
    if (parentType === 'org') newType = 'directorate';
    else if (parentType === 'directorate') newType = 'department';
    else if (parentType === 'department') newType = 'division';

    openAddModal(newType, parentId);
  };

  const handleDeleteNode = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    const findNode = (nodes: TreeNode[], targetId: string): TreeNode | null => {
      for (const n of nodes) {
        if (n.id === targetId) return n;
        if (n.children && n.children.length > 0) {
          const deeper = findNode(n.children, targetId);
          if (deeper) return deeper;
        }
      }
      return null;
    };
    
    const node = findNode(orgData, id);
    if (!node) return;
    
    setNodeToDelete(node);
  };

  const confirmDelete = async () => {
    if (!nodeToDelete) return;
    const res = await deleteNode(nodeToDelete);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to delete');
    }
    setNodeToDelete(null);
  };

  const typeLabel = (type: UnitType) => (language === 'ar' ? UNIT_TYPE_LABELS[type]?.ar : UNIT_TYPE_LABELS[type]?.en) || type;

  const managerName = (node: TreeNode): string => {
    if (node.manager?.fullName) return node.manager.fullName;
    const u = (users || []).find((x: any) => x.uid === node.managerId);
    return u?.fullName || '';
  };

  const findParentNode = (nodes: TreeNode[], targetId: string, parent: TreeNode | null = null): TreeNode | null => {
    for (const n of nodes) {
      if (n.id === targetId) return parent;
      const found = findParentNode(n.children || [], targetId, n);
      if (found) return found;
    }
    return null;
  };

  const countDescendants = (node: TreeNode): number =>
    (node.children || []).reduce((sum, c) => sum + 1 + countDescendants(c), 0);

  /** Brief-information inputs shared by the add and edit forms. */
  const renderDetailFields = (details: UnitDetailsForm, onChange: (next: UnitDetailsForm) => void, accent: 'amber' | 'blue') => {
    const ring = accent === 'amber' ? 'focus:ring-amber-500/20 focus:border-amber-500' : 'focus:ring-blue-500/20 focus:border-blue-500';
    const input = `w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none transition focus:ring-2 ${ring}`;
    const label = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5';
    const set = (key: keyof UnitDetailsForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange({ ...details, [key]: e.target.value });
    return (
      <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {language === 'ar' ? 'بيانات مختصرة (اختيارية)' : 'Brief information (optional)'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={label}>{language === 'ar' ? 'الرمز / الاسم المختصر' : 'Code / short name'}</label>
            <input type="text" value={details.shortName} onChange={set('shortName')} maxLength={20} className={input} data-field="shortName" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>{language === 'ar' ? 'المسؤول' : 'Manager'}</label>
            <select value={details.managerId} onChange={set('managerId')} className={input} data-field="managerId">
              <option value="">{language === 'ar' ? '— بدون —' : '— None —'}</option>
              {(users || []).map((u: any) => (
                <option key={u.uid} value={u.uid}>{u.fullName} ({u.email})</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={label}>{language === 'ar' ? 'نبذة مختصرة عن المهام' : 'Short description of responsibilities'}</label>
          <textarea value={details.description} onChange={set('description')} maxLength={500} rows={2} className={`${input} resize-none`} data-field="description" />
          <p className="text-[10px] text-slate-400 mt-0.5 text-end">{details.description.length}/500</p>
        </div>
        <div>
          <label className={label}>{language === 'ar' ? 'الموقع' : 'Location'}</label>
          <input type="text" value={details.location} onChange={set('location')} maxLength={150} className={input} data-field="location" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>{language === 'ar' ? 'رقم الهاتف' : 'Phone'}</label>
            <input type="tel" value={details.phone} onChange={set('phone')} maxLength={30} dir="ltr" className={input} data-field="phone" />
          </div>
          <div>
            <label className={label}>{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
            <input type="email" value={details.email} onChange={set('email')} maxLength={120} dir="ltr" className={input} data-field="email" />
          </div>
        </div>
      </div>
    );
  };

  const renderTree = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    
    let Icon = Building2;
    if (node.type === 'directorate') Icon = GitMerge;
    if (node.type === 'department') Icon = GitBranch;
    if (node.type === 'division') Icon = Users;

    const primaryName = getNodePrimaryName(node);
    const secondaryName = getNodeSecondaryName(node);

    return (
      <div key={node.id} className="select-none">
        <div 
          className={`group flex items-center py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors ${depth === 0 ? 'bg-slate-50 dark:bg-slate-800/30' : ''}`}
          style={{ paddingLeft: dir === 'ltr' ? `${depth * 1.5 + 0.75}rem` : '0.75rem', paddingRight: dir === 'rtl' ? `${depth * 1.5 + 0.75}rem` : '0.75rem' }}
          onClick={() => hasChildren && toggleNode(node.id)}
        >
          <div className="w-5 h-5 flex items-center justify-center mr-2 rtl:mr-0 rtl:ml-2">
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className={`w-4 h-4 text-slate-500 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            ) : (
              <span className="w-4 h-4" />
            )}
          </div>
          <Icon className="w-4 h-4 text-amber-500 mr-2 rtl:mr-0 rtl:ml-2 shrink-0" />
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center flex-wrap gap-x-2">
              <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                {highlightText(primaryName, searchQuery)}
              </span>
              {node.shortName && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60" data-role="short-name">
                  {highlightText(node.shortName, searchQuery)}
                </span>
              )}
              {secondaryName && secondaryName !== primaryName && (
                <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                  ({highlightText(secondaryName, searchQuery)})
                </span>
              )}
            </div>
            {(node.description || managerName(node)) && (
              <div className="flex items-center flex-wrap gap-x-3 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {node.description && <span className="truncate max-w-xl" data-role="description">{node.description}</span>}
                {managerName(node) && (
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <UserCircle2 className="w-3 h-3" />
                    {managerName(node)}
                  </span>
                )}
              </div>
            )}
          </div>

          <span className="mx-2 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 shrink-0">
            {typeLabel(node.type)}
          </span>

          <button
            onClick={(e) => { e.stopPropagation(); setInfoNode(node); }}
            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
            title={language === 'ar' ? 'عرض البيانات المختصرة' : 'View brief information'}
            data-role="info"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {canManageOrg && (
            <div className="flex items-center space-x-1 rtl:space-x-reverse opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button 
                onClick={(e) => handleStartEdit(e, node)} 
                className="p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mx-0.5"
                title={language === 'ar' ? 'تعديل الوحدة وبياناتها' : 'Edit unit and its information'}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={(e) => handleAddNode(e, node.id, node.type)} 
                className="p-1 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/40 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors mx-0.5"
                title={language === 'ar' ? 'إضافة عنصر فرعي' : 'Add Subunit'}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={(e) => {
                  if (!hasChildren) handleDeleteNode(e, node.id);
                  else e.stopPropagation();
                }}
                disabled={hasChildren}
                className={`p-1 rounded-md transition-colors mx-0.5 ${
                  hasChildren 
                    ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' 
                    : 'hover:bg-red-50 dark:hover:bg-red-900/40 text-slate-400 hover:text-red-600 dark:hover:text-red-400'
                }`}
                title={hasChildren 
                  ? (language === 'ar' ? 'لا يمكن حذف عنصر يحتوي على عناصر فرعية' : 'Cannot delete item with subitems')
                  : (language === 'ar' ? 'حذف العنصر' : 'Delete Item')
                }
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        {isExpanded && hasChildren && (
          <div className="mt-1 relative">
            <div className={`absolute top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-800 ${dir === 'ltr' ? 'left-5' : 'right-5'}`} style={{ [dir === 'ltr' ? 'left' : 'right']: `${depth * 1.5 + 1.2}rem` }} />
            {node.children.map(child => renderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* App Navbar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 space-y-3 sm:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-inner text-white">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="mx-2">
                <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  {language === 'ar' ? 'الهيكل التنظيمي' : 'Organizational Structure'}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'إدارة التكوين الهرمي للشركة' : 'Manage Company Hierarchy'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm ${
                  activeTab === 'dashboard'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 mx-1" />
                <span>{language === 'ar' ? 'لوحة المعلومات' : 'Dashboard'}</span>
              </button>
              
              {canManageOrg && (
                <>
                  <button 
                    onClick={() => openAddModal('org')}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5 mx-1" />
                    <span>{language === 'ar' ? 'إضافة منظمة' : 'Add Org'}</span>
                  </button>
                  <button 
                    onClick={() => openAddModal('directorate')}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5 mx-1" />
                    <span>{language === 'ar' ? 'إضافة دائرة' : 'Add Directorate'}</span>
                  </button>
                  <button 
                    onClick={() => openAddModal('department')}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5 mx-1" />
                    <span>{language === 'ar' ? 'إضافة قسم' : 'Add Department'}</span>
                  </button>
                  <button 
                    onClick={() => openAddModal('division')}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5 mx-1" />
                    <span>{language === 'ar' ? 'إضافة شعبة' : 'Add Division'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 relative">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6">
          
        {errorMsg && !addModal.open && !editModal.open && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl flex items-center justify-between">
            <div className="flex items-center text-red-600 dark:text-red-400 text-sm">
              <svg className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {errorMsg}
            </div>
            <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                <Building2 className="w-5 h-5 text-amber-500 mr-2 rtl:mr-0 rtl:ml-2" />
                {language === 'ar' ? 'عرض الهيكل التنظيمي' : 'Structure Overview'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'ar' ? 'تصفح وإدارة الوحدات التنظيمية: الدوائر والأقسام والشعب' : 'Browse and manage organizational units, directorates, departments, and divisions'}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {canManageOrg && (
                <button 
                  onClick={() => openAddModal('org')}
                  className="flex items-center space-x-1 rtl:space-x-reverse px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors border border-amber-200/50 dark:border-amber-800/50 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mx-1" />
                  <span>{language === 'ar' ? 'إضافة منظمة' : 'Add Organization'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Search and Filter Toolbar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4 p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            {/* Real-time Search Input */}
            <div className="relative flex-1 max-w-lg">
              <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="org-structure-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'ar' ? 'البحث عن وحدة تنظيمية بالاسم (عربي أو إنجليزي)...' : 'Search organizational units by name (English or Arabic)...'}
                className="w-full ps-9 pe-9 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title={language === 'ar' ? 'مسح البحث' : 'Clear search'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Actions & Status */}
            <div className="flex items-center justify-between md:justify-end gap-2 shrink-0">
              {searchQuery.trim() && (
                <div className="inline-flex items-center text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1 rounded-md">
                  <span>
                    {matchingCount} {language === 'ar' ? 'وحدة مطابقة' : 'matching units'}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={expandAll}
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md transition shadow-2xs"
                  title={language === 'ar' ? 'توسيع كل الفروع' : 'Expand all nodes'}
                >
                  {language === 'ar' ? 'توسيع الكل' : 'Expand All'}
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md transition shadow-2xs"
                  title={language === 'ar' ? 'طي كل الفروع' : 'Collapse all nodes'}
                >
                  {language === 'ar' ? 'طي الكل' : 'Collapse All'}
                </button>
              </div>
            </div>
          </div>

          <div className="border border-slate-100 dark:border-slate-800/60 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col gap-2">
            {orgData.length === 0 ? (
              <div className="py-12 px-4 text-center" data-role="empty-structure">
                <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-500 mb-3">
                  <Building2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                  {language === 'ar' ? 'لا توجد وحدات تنظيمية بعد' : 'No organizational units yet'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {canManageOrg
                    ? (language === 'ar' ? 'ابدأ بإضافة المنظمة، ثم أضف الدوائر والأقسام والشعب التابعة لها.' : 'Start by adding the organization, then its directorates, departments and divisions.')
                    : (language === 'ar' ? 'لم يقم المسؤول بإضافة الهيكل التنظيمي بعد.' : 'An administrator has not added the structure yet.')}
                </p>
                {canManageOrg && (
                  <button
                    type="button"
                    onClick={() => openAddModal('org')}
                    className="mt-4 inline-flex items-center space-x-1 rtl:space-x-reverse px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 mx-1" />
                    <span>{language === 'ar' ? 'إضافة منظمة' : 'Add organization'}</span>
                  </button>
                )}
              </div>
            ) : filteredOrgData.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
                  <Search className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                  {language === 'ar' ? 'لا توجد نتائج مطابقة للبحث' : 'No matching organizational units'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {language === 'ar'
                    ? `لم يتم العثور على أي وحدة تطابق "${searchQuery}". يمكنك تجربة كلمات أخرى بالعربية أو الإنجليزية.`
                    : `No organizational units match "${searchQuery}". You can try searching with other keywords in English or Arabic.`}
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-4 inline-flex items-center space-x-1 rtl:space-x-reverse px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition shadow-sm cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 mx-1" />
                  <span>{language === 'ar' ? 'مسح البحث' : 'Clear search'}</span>
                </button>
              </div>
            ) : (
              filteredOrgData.map(node => renderTree(node))
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {nodeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center space-x-3 rtl:space-x-reverse mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Deletion'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'ar' ? 'حذف وحدة من الهيكل التنظيمي' : 'Remove organizational unit'}
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                {language === 'ar' 
                  ? `هل أنت متأكد من رغبتك في حذف "${nodeToDelete.nameAr || nodeToDelete.nameEn}"؟ هذه العملية لا يمكن التراجع عنها.`
                  : `Are you sure you want to delete "${nodeToDelete.nameEn || nodeToDelete.nameAr}"? This action cannot be undone.`}
              </p>
              
              <div className="flex items-center justify-end space-x-3 rtl:space-x-reverse">
                <button
                  onClick={() => setNodeToDelete(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm shadow-red-600/20 transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'حذف' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Brief information card */}
        {infoNode && (() => {
          const parent = findParentNode(orgData, infoNode.id);
          const rows: Array<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = [
            { icon: <Building2 className="w-4 h-4" />, label: language === 'ar' ? 'تتبع لـ' : 'Part of', value: parent ? getNodePrimaryName(parent) : '' },
            { icon: <UserCircle2 className="w-4 h-4" />, label: language === 'ar' ? 'المسؤول' : 'Manager', value: managerName(infoNode) },
            { icon: <MapPin className="w-4 h-4" />, label: language === 'ar' ? 'الموقع' : 'Location', value: infoNode.location },
            { icon: <Phone className="w-4 h-4" />, label: language === 'ar' ? 'الهاتف' : 'Phone', value: infoNode.phone ? <span dir="ltr">{infoNode.phone}</span> : '' },
            { icon: <Mail className="w-4 h-4" />, label: language === 'ar' ? 'البريد الإلكتروني' : 'Email', value: infoNode.email ? <a href={`mailto:${infoNode.email}`} className="text-blue-600 hover:underline" dir="ltr">{infoNode.email}</a> : '' },
            { icon: <GitBranch className="w-4 h-4" />, label: language === 'ar' ? 'الوحدات التابعة' : 'Sub-units', value: String(countDescendants(infoNode)) }
          ];
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setInfoNode(null)}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden" onClick={(e) => e.stopPropagation()} data-role="info-card">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                        {typeLabel(infoNode.type)}
                      </span>
                      {infoNode.shortName && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{infoNode.shortName}</span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">{getNodePrimaryName(infoNode)}</h3>
                    {getNodeSecondaryName(infoNode) && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{getNodeSecondaryName(infoNode)}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => setInfoNode(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {infoNode.description || (
                      <span className="text-slate-400 italic">{language === 'ar' ? 'لا توجد نبذة مختصرة لهذه الوحدة.' : 'No short description for this unit.'}</span>
                    )}
                  </p>
                  <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {rows.map((r, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 py-2">
                        <dt className="flex items-center gap-2 text-slate-500 dark:text-slate-400 shrink-0">{r.icon}{r.label}</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-100 text-end min-w-0 break-words">{r.value || <span className="text-slate-300 dark:text-slate-600">—</span>}</dd>
                      </div>
                    ))}
                  </dl>
                  {canManageOrg && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={(e) => { const n = infoNode; setInfoNode(null); handleStartEdit(e, n); }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                        {language === 'ar' ? 'تعديل البيانات' : 'Edit information'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Add Unit Modal - Bilingual Creation */}
        {addModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-[92vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {addModal.type === 'org' && (language === 'ar' ? 'إضافة منظمة جديدة' : 'Add New Organization')}
                      {addModal.type === 'directorate' && (language === 'ar' ? 'إضافة دائرة جديدة' : 'Add New Directorate')}
                      {addModal.type === 'department' && (language === 'ar' ? 'إضافة قسم جديد' : 'Add New Department')}
                      {addModal.type === 'division' && (language === 'ar' ? 'إضافة شعبة جديدة' : 'Add New Division')}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {language === 'ar' ? 'أدخل الاسم باللغتين والبيانات المختصرة' : 'Enter both names and brief information'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleModalAddSubmit} className="p-6 space-y-4">
                {/* Type Selector Tabs */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'ar' ? 'المستوى التنظيمي' : 'Hierarchy Level'}
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    {(['org', 'directorate', 'department', 'division'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          let defaultParent = '';
                          if (t !== 'org') {
                            const potential = getPotentialParents(t);
                            defaultParent = potential[0]?.id || '';
                          }
                          setAddModal(prev => ({ ...prev, type: t, parentId: defaultParent }));
                        }}
                        className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition capitalize cursor-pointer ${
                          addModal.type === t
                            ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {t === 'org' && (language === 'ar' ? 'منظمة' : 'Org')}
                        {t === 'directorate' && (language === 'ar' ? 'دائرة' : 'Directorate')}
                        {t === 'department' && (language === 'ar' ? 'قسم' : 'Dept')}
                        {t === 'division' && (language === 'ar' ? 'شعبة' : 'Division')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Parent Dropdown if not Org */}
                {addModal.type !== 'org' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {addModal.type === 'directorate' && (language === 'ar' ? 'المنظمة التابعة لها' : 'Parent Organization')}
                      {addModal.type === 'department' && (language === 'ar' ? 'الدائرة أو المنظمة التابع لها' : 'Parent Directorate / Org')}
                      {addModal.type === 'division' && (language === 'ar' ? 'القسم أو الإدارة التابع لها' : 'Parent Department / Directorate')}
                      <span className="text-red-500"> *</span>
                    </label>
                    <select
                      value={addModal.parentId}
                      onChange={(e) => setAddModal(prev => ({ ...prev, parentId: e.target.value }))}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition"
                      required
                    >
                      {getPotentialParents(addModal.type).map((u) => (
                        <option key={u.id} value={u.id}>
                          {language === 'ar' ? (u.nameAr || u.nameEn) : (u.nameEn || u.nameAr)} ({typeLabel(u.type)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* English Name Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'ar' ? 'الاسم باللغة الإنجليزية (English Name)' : 'English Name'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addModal.nameEn}
                    onChange={(e) => setAddModal(prev => ({ ...prev, nameEn: e.target.value }))}
                    placeholder={
                      addModal.type === 'org'
                        ? 'e.g. Central Technology Organization'
                        : addModal.type === 'directorate'
                        ? 'e.g. Information Technology Directorate'
                        : addModal.type === 'department'
                        ? 'e.g. Software Systems Department'
                        : 'e.g. User Interface Division'
                    }
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition"
                    required
                    autoFocus
                  />
                </div>

                {/* Arabic Name Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'ar' ? 'الاسم باللغة العربية (Arabic Name)' : 'Arabic Name'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addModal.nameAr}
                    onChange={(e) => setAddModal(prev => ({ ...prev, nameAr: e.target.value }))}
                    placeholder={
                      addModal.type === 'org'
                        ? 'مثال: الهيئة المركزية للتكنولوجيا'
                        : addModal.type === 'directorate'
                        ? 'مثال: دائرة تكنولوجيا المعلومات'
                        : addModal.type === 'department'
                        ? 'مثال: قسم نظم البرمجيات'
                        : 'مثال: شعبة واجهات المستخدم'
                    }
                    dir="rtl"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition"
                    required
                  />
                </div>

                {renderDetailFields(addModal.details, (details) => setAddModal(prev => ({ ...prev, details })), 'amber')}

                {errorMsg && (
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg px-3 py-2" role="alert" data-role="form-error">
                    {errorMsg}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end space-x-3 rtl:space-x-reverse pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={closeAddModal}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm shadow-amber-600/20 transition flex items-center space-x-1.5 rtl:space-x-reverse cursor-pointer"
                  >
                    <Plus className="w-4 h-4 mx-1" />
                    <span>{language === 'ar' ? 'إنشاء الوحدة' : 'Create Unit'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Unit Modal - Bilingual Editing */}
        {editModal.open && editModal.node && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-[92vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {language === 'ar' ? 'تعديل الوحدة التنظيمية' : 'Edit Organizational Unit'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {language === 'ar' ? 'تعديل الاسمين والبيانات المختصرة' : 'Edit names and brief information'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveEditModal} className="p-6 space-y-4">
                {/* Unit Type Badge */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {language === 'ar' ? 'نوع الوحدة التنظيمية:' : 'Unit Type:'}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                    {typeLabel(editModal.type)}
                  </span>
                </div>

                {/* English Name Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'ar' ? 'الاسم باللغة الإنجليزية (English Name)' : 'English Name'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editModal.nameEn}
                    onChange={(e) => setEditModal(prev => ({ ...prev, nameEn: e.target.value }))}
                    placeholder="e.g. Information Technology Directorate"
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    required
                    autoFocus
                  />
                </div>

                {/* Arabic Name Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'ar' ? 'الاسم باللغة العربية (Arabic Name)' : 'Arabic Name'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editModal.nameAr}
                    onChange={(e) => setEditModal(prev => ({ ...prev, nameAr: e.target.value }))}
                    placeholder="مثال: دائرة تكنولوجيا المعلومات"
                    dir="rtl"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    required
                  />
                </div>

                {/* Parent Selector if not Root Org */}
                {editModal.type !== 'org' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {language === 'ar' ? 'الوحدة الرئيسية التابعة لها' : 'Parent Organizational Unit'}
                    </label>
                    <select
                      value={editModal.parentId}
                      onChange={(e) => setEditModal(prev => ({ ...prev, parentId: e.target.value }))}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    >
                      {getPotentialParents(editModal.type, editModal.node.id).map((p) => (
                        <option key={p.id} value={p.id}>
                          {language === 'ar' ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr)} ({typeLabel(p.type)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {renderDetailFields(editModal.details, (details) => setEditModal(prev => ({ ...prev, details })), 'blue')}

                {errorMsg && (
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg px-3 py-2" role="alert" data-role="form-error">
                    {errorMsg}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end space-x-3 rtl:space-x-reverse pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-600/20 transition flex items-center space-x-1.5 rtl:space-x-reverse cursor-pointer"
                  >
                    <Check className="w-4 h-4 mx-1" />
                    <span>{language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
