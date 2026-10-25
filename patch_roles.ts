import fs from 'fs';

const file = 'src/server/routes/roleRoutes.ts';
let content = fs.readFileSync(file, 'utf8');

// Add logger import if not present
if (!content.includes('../utils/logger.ts')) {
    content = content.replace("import { eq } from 'drizzle-orm';", "import { eq } from 'drizzle-orm';\nimport { logger } from '../utils/logger.ts';");
}

// POST /api/roles
content = content.replace(
    /res\.status\(201\)\.json\(\{ success: true, data: newRole \}\);/,
    `logger.information('Role created: {RoleName} by {AdminUser}', {
      RoleName: newRole.name,
      AdminUser: req.user?.name || req.user?.email || 'System',
      Action: 'CreateRole'
    });
    res.status(201).json({ success: true, data: newRole });`
);

// PUT /api/roles/:id
content = content.replace(
    /res\.json\(\{ success: true, data: updatedRole \}\);/,
    `logger.information('Role edited: {RoleName} by {AdminUser}', {
      RoleName: updatedRole.name,
      AdminUser: req.user?.name || req.user?.email || 'System',
      Action: 'EditRole'
    });
    res.json({ success: true, data: updatedRole });`
);

// DELETE /api/roles/:id
content = content.replace(
    /res\.json\(\{ success: true \}\);/,
    `logger.information('Role deleted: {RoleName} by {AdminUser}', {
      RoleName: updatedRole.name,
      AdminUser: req.user?.name || req.user?.email || 'System',
      Action: 'DeleteRole'
    });
    res.json({ success: true });`
);

fs.writeFileSync(file, content);
