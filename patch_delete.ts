import fs from 'fs';

const file = 'src/components/OrgStructureApp.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  `const node = findNode(orgData);\n    if (!node) return;`,
  `const node = findNode(orgData);\n    console.log("Delete button clicked for ID", id, "Found node:", node);\n    if (!node) return;`
);

fs.writeFileSync(file, content);
