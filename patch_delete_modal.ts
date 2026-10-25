import fs from 'fs';

const file = 'src/components/UserManagementView.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state for delete confirmation
content = content.replace(
  `const [showSaveWarning, setShowSaveWarning] = useState<boolean>(false);`,
  `const [showSaveWarning, setShowSaveWarning] = useState<boolean>(false);
  const [roleToDelete, setRoleToDelete] = useState<number | null>(null);`
);

// 2. Change handleDelete to set the role to delete
content = content.replace(
  /const handleDelete = async \(id: number\) => \{[\s\S]*?try \{/m,
  `const handleDelete = (id: number) => {
    setRoleToDelete(id);
  };

  const confirmDelete = async () => {
    if (roleToDelete === null) return;
    try {
      const id = roleToDelete;`
);

// 3. Fix the catch block of the new confirmDelete
content = content.replace(
  `} catch (err) {
      console.error('Failed to delete role:', err);
    }
  };`,
  `} catch (err) {
      console.error('Failed to delete role:', err);
    } finally {
      setRoleToDelete(null);
    }
  };`
);

// 4. Add the delete confirmation modal JSX
const deleteModalJSX = `{roleToDelete !== null && (
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

      {/* Save Warning Modal */}`;

content = content.replace('{/* Save Warning Modal */}', deleteModalJSX);

fs.writeFileSync(file, content);
