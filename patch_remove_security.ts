import fs from 'fs';

const file = 'src/components/UserPolicyControlView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Remove header
content = content.replace(
  /<th className="py-3 px-4">\{language === 'ar' \? 'أمان الحساب' : 'Account Security'\}<\/th>/,
  ""
);

// Remove the Account Security td block
const tdRegex = /\{\/\* Account Security \(Lockout \/ Password\) \*\/\}[\s\S]*?\{\/\* Other Actions Column \*\/}/m;
content = content.replace(
  tdRegex,
  "{/* Other Actions Column */}"
);

// Adjust colspan
content = content.replace(
  /<td colSpan=\{4\}/g,
  "<td colSpan={3}"
);

fs.writeFileSync(file, content);
