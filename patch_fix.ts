import fs from 'fs';

const file = 'src/components/UserPolicyControlView.tsx';
let content = fs.readFileSync(file, 'utf8');

// The ApplicationUser is imported, let's make sure it is in the imports.
if (!content.includes('import { ApplicationUser }')) {
    content = content.replace(
      `import { ApplicationRole } from '../types';`,
      `import { ApplicationRole, ApplicationUser } from '../types';`
    );
}

const showNotificationRegex = /const showNotification = \(message: string, type: 'success' \| 'info' = 'success'\) => \{/;

const savePolicyFn = `
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPolicy) return;
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(\`/api/users/\${selectedUserForPolicy.id}\`, {
        method: 'PATCH',
        headers: {
          Authorization: \`Bearer \${token}\`,
          'Content-Type': 'application/json',
          'X-App-Action': 'strict-client-action'
        },
        body: JSON.stringify(policyData)
      });
      if (res.ok) {
        setSelectedUserForPolicy(null);
        window.location.reload(); // Quick refresh to reflect the changes from the backend
      } else {
        const data = await res.json();
        console.error("Failed to save policy:", data);
        alert(data.error || "Failed to save policy");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {`;

content = content.replace(showNotificationRegex, savePolicyFn);

fs.writeFileSync(file, content);
