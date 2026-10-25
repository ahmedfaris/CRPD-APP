import fs from 'fs';

const file = 'src/components/UserManagementView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update DELETE request
content = content.replace(
  `headers: { Authorization: \`Bearer \${token}\` }`,
  `headers: { 
          Authorization: \`Bearer \${token}\`,
          'X-App-Action': 'strict-client-action'
        }`
);

// Update POST/PUT request
content = content.replace(
  `headers: { 
          Authorization: \`Bearer \${token}\`,
          'Content-Type': 'application/json'
        }`,
  `headers: { 
          Authorization: \`Bearer \${token}\`,
          'Content-Type': 'application/json',
          'X-App-Action': 'strict-client-action'
        }`
);

fs.writeFileSync(file, content);
