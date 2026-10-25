import fs from 'fs';
const file = 'src/types.ts';
let content = fs.readFileSync(file, 'utf8');

// Update ApplicationUser interface
content = content.replace(
  `  createdAt: string;`,
  `  passwordMinLength?: number;
  passwordRequireSpecial?: boolean;
  passwordRequireNumber?: boolean;
  passwordRequireUppercase?: boolean;
  passwordRequireLowercase?: boolean;
  passwordLastChangedAt?: string;
  createdAt: string;`
);

fs.writeFileSync(file, content);
