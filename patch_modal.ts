import fs from 'fs';

const file = 'src/components/OrgStructureApp.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add state for delete confirm
content = content.replace(
  'const [showAddConfirm, setShowAddConfirm] = useState(false);',
  'const [showAddConfirm, setShowAddConfirm] = useState(false);\n  const [nodeToDelete, setNodeToDelete] = useState<TreeNode | null>(null);'
);

// Update handleDeleteNode to just set the node to delete
content = content.replace(
  /const handleDeleteNode = async \(e: React\.MouseEvent, id: string\) => \{[\s\S]*?    if \(!node\) return;[\s\S]*?    \}(\n  \};)/g,
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
    
    setNodeToDelete(node);
  };`
);

// Add confirmDelete function
content = content.replace(
  'const renderTree = (node: TreeNode, depth: number = 0) => {',
  `const confirmDelete = async () => {
    if (!nodeToDelete) return;
    const res = await deleteNode(nodeToDelete);
    if (!res.success) {
      alert(res.error || 'Failed to delete');
    }
    setNodeToDelete(null);
  };

  const renderTree = (node: TreeNode, depth: number = 0) => {`
);

// Add the modal JSX right after showAddConfirm modal
const deleteModalJSX = `
        {/* Delete Confirmation Modal */}
        {nodeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Deletion'}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                {language === 'ar' 
                  ? \`هل أنت متأكد من رغبتك في حذف "\$\{nodeToDelete.nameAr\}"؟ هذه العملية لا يمكن التراجع عنها.\`
                  : \`Are you sure you want to delete "\$\{nodeToDelete.nameEn\}"? This action cannot be undone.\`}
              </p>
              
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => setNodeToDelete(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors rtl:ml-3"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm shadow-red-600/20 transition-colors"
                >
                  {language === 'ar' ? 'حذف' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
`;

content = content.replace(
  /(\s*)<\/div>\s*<\/div>\s*\)\s*\}\s*<\/div>\s*<\/div>\s*\);\s*\}/,
  `$1</div>\n          </div>\n        )}\n${deleteModalJSX}\n      </div>\n    </div>\n  );\n}`
);

fs.writeFileSync(file, content);
