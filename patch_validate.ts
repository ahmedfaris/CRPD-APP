import fs from 'fs';

const file = 'src/components/UserManagementView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update input attributes
content = content.replace(
  `value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. IT Support"`,
  `value={formData.name}
                  maxLength={20}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. IT Support"`
);

// Add validation to handleSubmit
const handleSubmitRegex = /const handleSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?if \(editingRole && editingRole\.assignedUsers/m;
const handleSubmitReplacement = `const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameRegex = /^[\\u0600-\\u06FFa-zA-Z\\s]+$/;
    if (!nameRegex.test(formData.name)) {
      alert(language === 'ar' ? 'يسمح فقط بالحروف الإنجليزية والعربية والمسافات.' : 'Only English and Arabic letters (and spaces) are allowed.');
      return;
    }
    if (formData.name.trim().length === 0 || formData.name.length > 20) {
      alert(language === 'ar' ? 'الحد الأقصى للاسم هو 20 حرفاً' : 'Name length must be between 1 and 20 characters.');
      return;
    }

    if (editingRole && editingRole.assignedUsers`;

content = content.replace(handleSubmitRegex, handleSubmitReplacement);

fs.writeFileSync(file, content);
