import fs from 'fs';

const file = 'src/components/OrgStructureApp.tsx';
let content = fs.readFileSync(file, 'utf8');

// Use the new save/delete functions from Context
content = content.replace(
  'const { orgData, setOrgData } = useOrg();',
  'const { orgData, setOrgData, saveNode, deleteNode } = useOrg();\n  const [errorMsg, setErrorMsg] = useState("");'
);

// handleSaveEdit
content = content.replace(
  /const handleSaveEdit = \([\s\S]*?setEditingNodeId\(null\);\n  };/g,
  `const handleSaveEdit = async (e: React.MouseEvent | React.FormEvent, id: string) => {
    e.stopPropagation();
    if (!editName.trim()) return;

    // find node
    const findNode = (nodes: TreeNode[]): {node: TreeNode, parentId?: string} | null => {
      for (const n of nodes) {
        if (n.id === id) return {node: n};
        for (const child of n.children) {
          if (child.id === id) return {node: child, parentId: n.id};
          const deeper = findNode(n.children);
          if (deeper) return deeper;
        }
      }
      return null;
    };
    
    const found = findNode(orgData);
    if (!found) return;
    
    const updatedNode = { 
      ...found.node, 
      nameEn: language === 'en' ? editName.trim() : found.node.nameEn,
      nameAr: language === 'ar' ? editName.trim() : found.node.nameAr
    };

    const res = await saveNode(updatedNode, found.parentId);
    if (res.success) {
      setEditingNodeId(null);
    } else {
      alert(res.error || 'Failed to save');
    }
  };`
);

// handleAddNode - when we add, we just push locally. 
// BUT we want to add an unsaved node and save it when Enter is pressed.
// Wait, the logic above automatically saves local state. We need a way to support newly added (unsaved) nodes.
// Let's modify handleAddNode to do a fast create!
content = content.replace(
  /const handleAddNode = \([\s\S]*?setEditName\(''\);\n  };/g,
  `const handleAddNode = async (e: React.MouseEvent, parentId: string, parentType: string) => {
    e.stopPropagation();
    
    let newType: 'org' | 'directorate' | 'department' | 'division' = 'division';
    if (parentType === 'org') newType = 'directorate';
    else if (parentType === 'directorate') newType = 'department';
    else if (parentType === 'department') newType = 'division';
    
    const newNode: TreeNode = {
      id: '',
      nameEn: 'New Item',
      nameAr: 'عنصر جديد',
      type: newType,
      children: []
    };

    const res = await saveNode(newNode, parentId);
    if (res.success && res.data) {
      const newExpanded = new Set(expandedNodes);
      newExpanded.add(parentId);
      setExpandedNodes(newExpanded);
      setEditingNodeId(\`db_\$\{res.data.id\}\`);
      setEditName(language === 'ar' ? newNode.nameAr : newNode.nameEn);
    }
  };`
);

// confirmAddOrg
content = content.replace(
  /const confirmAddOrg = \(\) => \{[\s\S]*?setEditName\(''\);\n  \};/g,
  `const confirmAddOrg = async () => {
    const newOrg: TreeNode = {
      id: '',
      nameEn: 'New Organization',
      nameAr: 'منظمة جديدة',
      type: 'org',
      children: []
    };
    
    const res = await saveNode(newOrg);
    if (res.success && res.data) {
      setShowAddConfirm(false);
      setEditingNodeId(\`db_\$\{res.data.id\}\`);
      setEditName('');
    } else {
       alert(res.error || 'Failed to create organization');
    }
  };`
);

// handleDeleteNode
content = content.replace(
  /const handleDeleteNode = \([\s\S]*?setOrgData\(removeNode\(orgData\)\);\n  \};/g,
  `const handleDeleteNode = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    const findNode = (nodes: TreeNode[]): TreeNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n;
        const deeper = findNode(n.children);
        if (deeper) return deeper;
      }
      return null;
    };
    
    const node = findNode(orgData);
    if (!node) return;

    if (confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا العنصر؟' : 'Are you sure you want to delete this item?')) {
      const res = await deleteNode(node);
      if (!res.success) {
        alert(res.error || 'Failed to delete');
      }
    }
  };`
);

fs.writeFileSync(file, content);
