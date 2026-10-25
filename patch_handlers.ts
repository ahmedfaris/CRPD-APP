import fs from 'fs';

const file = 'src/components/UserPolicyControlView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the handleToggle2FA, handleResetSecret, handleUnlock, handlePasswordSubmit
const handlersRegex = /const handleToggle2FA = [\s\S]*?const handlePasswordSubmit = \(e: React\.FormEvent\) => \{[\s\S]*?showNotification\([\s\S]*?\);\n  \};/m;

const newHandlers = `  const updateUserStatus = async (userId: string, updates: any) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(\`/api/users/\${userId}\`, {
        method: 'PATCH',
        headers: {
          Authorization: \`Bearer \${token}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("Failed to update user");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating user");
    }
  };

  const handleToggle2FA = (userId: string, currentStatus: boolean, email: string) => {
    updateUserStatus(userId, { twoFactorEnabled: !currentStatus });
  };

  const handleResetSecret = (userId: string, email: string) => {
    updateUserStatus(userId, { twoFactorSecret: null });
  };

  const handleUnlock = (userId: string, email: string) => {
    updateUserStatus(userId, { isLockedOut: false, failedAccessCount: 0 });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword) return;
    
    // In a real app we'd hash this or send it to a specialized endpoint
    // For now we simulate updating the force change flag.
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(\`/api/auth/reset-password-admin\`, {
        method: 'POST',
        headers: {
          Authorization: \`Bearer \${token}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uid: selectedUserForPassword, newPassword: tempPassword })
      });
      if (res.ok) {
        setTempPassError(null);
        setSelectedUserForPassword(null);
        showNotification('Password updated successfully');
      } else {
        const err = await res.json();
        setTempPassError(err.error || 'Failed to update password');
      }
    } catch (err) {
      setTempPassError('Network error');
    }
  };`;

content = content.replace(handlersRegex, newHandlers);

fs.writeFileSync(file, content);
