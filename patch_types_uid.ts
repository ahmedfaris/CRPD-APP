import fs from 'fs';
const file = 'src/types.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /export interface ApplicationUser \{/,
  "export interface ApplicationUser {\n  uid: string;"
);

fs.writeFileSync(file, content);
