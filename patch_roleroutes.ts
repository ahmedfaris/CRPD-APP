import fs from 'fs';

const file = 'src/server/routes/roleRoutes.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /const allRoles = await db\.select\(\)\.from\(roles\);\n\s+res\.json\(\{ success: true, data: allRoles \}\);/m;
const replacement = `const allRoles = await db.select().from(roles);
    const allUsers = await db.select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role, avatarColor: users.avatarColor }).from(users);
    
    const enrichedRoles = allRoles.map(role => {
      const assignedUsers = allUsers.filter(u => u.role === role.name);
      return {
        ...role,
        assignedUsers: assignedUsers.map(u => ({ id: u.id, fullName: u.fullName, email: u.email, avatarColor: u.avatarColor }))
      };
    });
    
    res.json({ success: true, data: enrichedRoles });`;

if (!content.includes("import { users } from '../../db/schema.ts';")) {
  content = content.replace("import { roles } from '../../db/schema.ts';", "import { roles, users } from '../../db/schema.ts';");
}

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
