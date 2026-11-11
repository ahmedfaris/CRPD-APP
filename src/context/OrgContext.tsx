import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface TreeNode {
  id: string;
  nameEn: string;
  nameAr: string;
  type: 'org' | 'directorate' | 'department' | 'division';
  children: TreeNode[];
  managerId?: string | null;
  dbId?: number;
  parentId?: number | null;
}

export interface OrgDepartmentItem {
  id: string;
  dbId?: number;
  nameEn: string;
  nameAr: string;
  type: string;
}

export interface ResolvedOrgPath {
  organizationEn: string;
  organizationAr: string;
  directorateEn: string;
  directorateAr: string;
  departmentEn: string;
  departmentAr: string;
  divisionEn?: string;
  divisionAr?: string;
  availableDivisions: Array<{ id: string; nameEn: string; nameAr: string }>;
}

interface OrgContextType {
  orgData: TreeNode[];
  setOrgData: (data: TreeNode[]) => void;
  getAllDepartments: () => OrgDepartmentItem[];
  resolveHierarchyForDept: (deptName: string, divisionName?: string) => ResolvedOrgPath;
  fetchOrgData: () => Promise<void>;
  saveNode: (node: TreeNode, parentId?: string | number | null) => Promise<any>;
  deleteNode: (node: TreeNode) => Promise<any>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children }: { children: ReactNode }) {
  const [orgData, setOrgData] = useState<TreeNode[]>([]);

  const buildTree = (flatList: any[]) => {
    const nodeMap = new Map();
    const roots: TreeNode[] = [];

    // First pass
    flatList.forEach(item => {
      nodeMap.set(item.id, {
        id: `db_${item.id}`,
        dbId: item.id,
        parentId: item.parentId || null,
        nameEn: item.nameEn || item.name,
        nameAr: item.nameAr || item.name,
        type: item.orgType as any || 'department',
        managerId: item.managerId,
        children: []
      });
    });

    // A unit whose parent chain loops back to itself (possible in data saved before loop
    // checks existed) would never be reachable from a root and would vanish from the tree.
    // Show such units at the top level so they can still be found and fixed.
    const parentIdOf = new Map(flatList.map(item => [item.id, item.parentId || null]));
    const isInLoop = (id: any) => {
      const seen = new Set();
      let cursor = parentIdOf.get(id);
      while (cursor) {
        if (cursor === id) return true;
        if (seen.has(cursor)) return false;
        seen.add(cursor);
        cursor = parentIdOf.get(cursor);
      }
      return false;
    };

    // Second pass
    flatList.forEach(item => {
      const node = nodeMap.get(item.id);
      if (item.parentId && isInLoop(item.id)) {
        roots.push(node);
      } else if (item.parentId) {
        const parent = nodeMap.get(item.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node); // Parent missing
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const fetchOrgData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/departments', { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setOrgData(buildTree(json.data));
        }
      }
    } catch (e) {
      console.error('Failed to fetch org structure', e);
    }
  };

  const saveNode = async (node: TreeNode, parentId?: string | number | null) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const payload: any = {
        nameEn: node.nameEn,
        nameAr: node.nameAr,
        orgType: node.type,
        managerId: node.managerId || null
      };

      if (parentId !== undefined) {
        if (typeof parentId === 'string' && parentId.startsWith('db_')) {
          payload.parentId = parseInt(parentId.replace('db_', ''), 10);
        } else if (typeof parentId === 'number') {
          payload.parentId = parentId;
        } else if (parentId === null || parentId === '') {
          payload.parentId = null;
        }
      } else if (node.parentId !== undefined) {
        payload.parentId = node.parentId;
      }

      let res;
      if (node.dbId) {
        // Update
        res = await fetch(`/api/departments/${node.dbId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload)
        });
      } else {
        // Create
        res = await fetch('/api/departments', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (data.success) {
        await fetchOrgData();
        return { success: true, data: data.data };
      }
      return data;
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  };

  const deleteNode = async (node: TreeNode) => {
    if (!node.dbId) return { success: true }; // Not saved in DB yet
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`/api/departments/${node.dbId}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (data.success) {
        await fetchOrgData();
        return { success: true };
      }
      return data;
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  };

  // Load whenever a user signs in (the first request happens before login and is rejected);
  // clear on sign-out.
  const { currentUser } = useAuth();
  useEffect(() => {
    if (!currentUser) {
      setOrgData([]);
      return;
    }
    fetchOrgData();
  }, [currentUser?.uid]);

  const getAllDepartments = (): OrgDepartmentItem[] => {
    const depts: OrgDepartmentItem[] = [];
    const seenNames = new Set<string>();

    const traverse = (node: TreeNode) => {
      const nameKey = (node.nameEn || node.nameAr || '').trim().toLowerCase();
      if (nameKey && !seenNames.has(nameKey)) {
        seenNames.add(nameKey);
        depts.push({
          id: node.id,
          dbId: node.dbId,
          nameEn: node.nameEn || '',
          nameAr: node.nameAr || node.nameEn || '',
          type: node.type || 'department',
        });
      }
      if (Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };

    orgData.forEach(traverse);

    // Fallback if orgData has not finished loading from backend yet
    if (depts.length === 0) {
      return [
        { id: 'dept_it', dbId: 1, nameEn: 'Information Technology', nameAr: 'تكنولوجيا المعلومات', type: 'department' },
        { id: 'dept_ops', dbId: 2, nameEn: 'Operations', nameAr: 'العمليات والتنفيذ', type: 'department' },
        { id: 'dept_arch', dbId: 3, nameEn: 'Electronic Archiving & Records', nameAr: 'الأرشفة الإلكترونية والسجلات', type: 'department' },
        { id: 'dept_help', dbId: 4, nameEn: 'Customer Support & Helpdesk', nameAr: 'دعم العملاء ومكتب المساعدة', type: 'department' },
        { id: 'dept_hr', dbId: 5, nameEn: 'Human Resources', nameAr: 'الموارد البشرية', type: 'department' },
      ];
    }
    return depts;
  };

  /**
   * Resolves the full 4-level organizational hierarchy from the Org Structure:
   * Level 1: Organization (المنظمة)
   * Level 2: Directorate (الدائرة)
   * Level 3: Department (القسم)
   * Level 4: Division (الشعبة ان وجدت)
   */
  const resolveHierarchyForDept = (deptName: string, divisionName?: string): ResolvedOrgPath => {
    const norm = (deptName || '').trim().toLowerCase();

    // Default fallbacks
    let orgEn = 'General Telecommunications & Informatics Authority';
    let orgAr = 'الهيئة العامة للاتصالات والمعلوماتية';
    let dirEn = 'Directorate of Information Technology';
    let dirAr = 'دائرة تكنولوجيا المعلومات والاتصالات';
    let deptEn = deptName || 'Information Technology';
    let deptAr = deptName || 'تكنولوجيا المعلومات';
    let divEn = divisionName || '';
    let divAr = divisionName || '';
    const availableDivs: Array<{ id: string; nameEn: string; nameAr: string }> = [];

    // Helper: traverse tree to find a node and its ancestors
    let foundNode: TreeNode | null = null;
    let pathAncestors: TreeNode[] = [];

    const searchTree = (nodes: TreeNode[], parents: TreeNode[]): boolean => {
      for (const n of nodes) {
        const matchesName = 
          (n.nameEn && n.nameEn.toLowerCase() === norm) ||
          (n.nameAr && n.nameAr.toLowerCase() === norm) ||
          (n.nameEn && n.nameEn.toLowerCase().includes(norm)) ||
          (n.nameAr && n.nameAr.toLowerCase().includes(norm)) ||
          norm.includes((n.nameEn || '').toLowerCase()) ||
          norm.includes((n.nameAr || '').toLowerCase());

        if (matchesName) {
          foundNode = n;
          pathAncestors = parents;
          return true;
        }

        if (n.children && n.children.length > 0) {
          if (searchTree(n.children, [...parents, n])) {
            return true;
          }
        }
      }
      return false;
    };

    searchTree(orgData, []);

    // Also look for root org node in orgData
    const rootOrgNode = orgData.find(n => n.type === 'org') || (orgData.length > 0 ? orgData[0] : null);
    if (rootOrgNode) {
      orgEn = rootOrgNode.nameEn || orgEn;
      orgAr = rootOrgNode.nameAr || rootOrgNode.nameEn || orgAr;
    }

    if (foundNode) {
      const node = foundNode as TreeNode;
      if (node.type === 'division') {
        divEn = node.nameEn;
        divAr = node.nameAr || node.nameEn;
        // Immediate parent is department
        const parentDept = pathAncestors[pathAncestors.length - 1];
        if (parentDept) {
          deptEn = parentDept.nameEn;
          deptAr = parentDept.nameAr || parentDept.nameEn;
        }
        // Grandparent is directorate
        const parentDir = pathAncestors[pathAncestors.length - 2];
        if (parentDir) {
          dirEn = parentDir.nameEn;
          dirAr = parentDir.nameAr || parentDir.nameEn;
        }
        // Great-grandparent is organization
        const parentOrg = pathAncestors.find(a => a.type === 'org') || pathAncestors[0];
        if (parentOrg) {
          orgEn = parentOrg.nameEn;
          orgAr = parentOrg.nameAr || parentOrg.nameEn;
        }
      } else if (node.type === 'department') {
        deptEn = node.nameEn;
        deptAr = node.nameAr || node.nameEn;

        // Collect available child divisions under this department
        if (node.children && node.children.length > 0) {
          node.children.forEach(child => {
            if (child.type === 'division') {
              availableDivs.push({
                id: child.id,
                nameEn: child.nameEn,
                nameAr: child.nameAr || child.nameEn
              });
            }
          });
        }

        // Trace up to Directorate and Organization
        const parentDir = pathAncestors.find(a => a.type === 'directorate') || pathAncestors[pathAncestors.length - 1];
        if (parentDir) {
          dirEn = parentDir.nameEn;
          dirAr = parentDir.nameAr || parentDir.nameEn;
        }

        const parentOrg = pathAncestors.find(a => a.type === 'org');
        if (parentOrg) {
          orgEn = parentOrg.nameEn;
          orgAr = parentOrg.nameAr || parentOrg.nameEn;
        }
      } else if (node.type === 'directorate') {
        dirEn = node.nameEn;
        dirAr = node.nameAr || node.nameEn;
        const parentOrg = pathAncestors.find(a => a.type === 'org');
        if (parentOrg) {
          orgEn = parentOrg.nameEn;
          orgAr = parentOrg.nameAr || parentOrg.nameEn;
        }
      }
    } else {
      // If dept not explicitly found in tree, apply intelligent directorate grouping
      if (norm.includes('عمليات') || norm.includes('ops') || norm.includes('موارد') || norm.includes('hr') || norm.includes('دعم')) {
        dirAr = 'دائرة العمليات والدعم الإداري';
        dirEn = 'Directorate of Operations & Administrative Support';
      } else {
        dirAr = 'دائرة تكنولوجيا المعلومات والاتصالات';
        dirEn = 'Directorate of Information Technology';
      }
    }

    return {
      organizationEn: orgEn,
      organizationAr: orgAr,
      directorateEn: dirEn,
      directorateAr: dirAr,
      departmentEn: deptEn,
      departmentAr: deptAr,
      divisionEn: divEn || undefined,
      divisionAr: divAr || undefined,
      availableDivisions: availableDivs
    };
  };

  return (
    <OrgContext.Provider value={{
      orgData,
      setOrgData,
      getAllDepartments,
      resolveHierarchyForDept,
      fetchOrgData,
      saveNode,
      deleteNode
    }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (context === undefined) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
}
