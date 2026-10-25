import fs from 'fs';

const file = 'src/components/UserPolicyControlView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix API URL to use uid instead of id
content = content.replace(
  /fetch\(\`\/api\/users\/\$\{selectedUserForPolicy\.id\}\`, \{/,
  "fetch(`/api/users/${(selectedUserForPolicy as any).uid}`, {"
);

// Fix parseInt NaN issue
content = content.replace(
  /value=\{policyData\.passwordMinLength\}/,
  "value={policyData.passwordMinLength || ''}"
);
content = content.replace(
  /onChange=\{\(e\) => setPolicyData\(\{\.\.\.policyData, passwordMinLength: parseInt\(e\.target\.value\)\}\)\}/,
  "onChange={(e) => setPolicyData({...policyData, passwordMinLength: parseInt(e.target.value) || 0})}"
);

fs.writeFileSync(file, content);
