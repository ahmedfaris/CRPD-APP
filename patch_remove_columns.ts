import fs from 'fs';

const file = 'src/components/UserPolicyControlView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace headers
content = content.replace(
  /<th className="py-3 px-4">\{language === 'ar' \? 'الدور والقسم' : 'Role & Dept'\}<\/th>\s*<th className="py-3 px-4">\{language === 'ar' \? 'حالة المصادقة الثنائية \(2FA\)' : '2FA Policy Status'\}<\/th>\s*<th className="py-3 px-4">\{language === 'ar' \? 'التحكم في تفعيل 2FA' : '2FA Policy Action'\}<\/th>/m,
  "<th className=\"py-3 px-4\">{language === 'ar' ? 'سياسة كلمة المرور' : 'Password Policy'}</th>"
);

// Remove 2FA Status and 2FA Toggle Action columns
const tdRegex = /\{\/\* 2FA Status Column \*\/\}[\s\S]*?\{\/\* Account Security \(Lockout \/ Password\) \*\/}/m;
content = content.replace(
  tdRegex,
  "{/* Account Security (Lockout / Password) */}"
);

// We need to fix the colSpan from 6 to 4 for the empty state
content = content.replace(
  /<td colSpan=\{6\}/g,
  "<td colSpan={4}"
);

fs.writeFileSync(file, content);
