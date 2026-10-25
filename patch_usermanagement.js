const fs = require('fs');
const file = 'src/components/UserManagementView.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `const APPS = [
  'User Management',
  'Archive',
  'Ticket Management',
  'System Settings'
];

const ACTIONS = ['View', 'Create', 'Edit', 'Delete'];`;

content = content.replace(/const AVAILABLE_PERMISSIONS = \[\n\s+'User Management',\n\s+'Archive',\n\s+'Ticket Management',\n\s+'System Settings'\n\];/m, replacement);

fs.writeFileSync(file, content);
