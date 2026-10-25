import fs from 'fs';

const file = 'src/components/UserManagementView.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add form error state
content = content.replace(
  `const [formData, setFormData] = useState<{name: string, permissions: string[]}>({ name: '', permissions: [] });`,
  `const [formData, setFormData] = useState<{name: string, permissions: string[]}>({ name: '', permissions: [] });
  const [formError, setFormError] = useState<string | null>(null);`
);

// 2. Clear error on modal open
content = content.replace(
  `const handleOpenCreate = () => {
    setEditingRole(null);
    setFormData({ name: '', permissions: [] });
    setIsModalOpen(true);
  };`,
  `const handleOpenCreate = () => {
    setEditingRole(null);
    setFormData({ name: '', permissions: [] });
    setFormError(null);
    setIsModalOpen(true);
  };`
);

content = content.replace(
  `const handleOpenEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({ name: role.name, permissions: role.permissions || [] });
    setIsModalOpen(true);
  };`,
  `const handleOpenEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({ name: role.name, permissions: role.permissions || [] });
    setFormError(null);
    setIsModalOpen(true);
  };`
);

// 3. Update handleSubmit to use setFormError instead of alert
content = content.replace(
  `alert(language === 'ar' ? 'يسمح فقط بالحروف الإنجليزية والعربية والمسافات.' : 'Only English and Arabic letters (and spaces) are allowed.');`,
  `setFormError(language === 'ar' ? 'يسمح فقط بالحروف الإنجليزية والعربية والمسافات.' : 'Only English and Arabic letters (and spaces) are allowed.');`
);

content = content.replace(
  `alert(language === 'ar' ? 'الحد الأقصى للاسم هو 20 حرفاً' : 'Name length must be between 1 and 20 characters.');`,
  `setFormError(language === 'ar' ? 'الحد الأقصى للاسم هو 20 حرفاً' : 'Name length must be between 1 and 20 characters.');`
);

content = content.replace(
  `alert(errData.error || 'Failed to save role');`,
  `setFormError(errData.error || 'Failed to save role');`
);

// 4. Inject formError into the form UI
const formStartRegex = /<form onSubmit=\{handleSubmit\} className="p-5 space-y-5">/m;
const formStartReplacement = `<form onSubmit={handleSubmit} className="p-5 space-y-5">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium">
                  {formError}
                </div>
              )}`;
content = content.replace(formStartRegex, formStartReplacement);

fs.writeFileSync(file, content);
