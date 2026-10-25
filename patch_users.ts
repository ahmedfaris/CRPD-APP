import fs from 'fs';

const file = 'src/server/controllers/userController.ts';
let content = fs.readFileSync(file, 'utf8');

// POST /api/users
content = content.replace(
    /res\.status\(201\)\.json\(\{ success: true, data: newUser \}\);/,
    `logger.information('User created: {TargetUser} by {AdminUser}', {
        TargetUser: newUser.email,
        AdminUser: req.user?.name || req.user?.email || 'System',
        Action: 'CreateUser'
      });
      res.status(201).json({ success: true, data: newUser });`
);

// DELETE /api/users/:uid
content = content.replace(
    /await db\.delete\(users\)\.where\(eq\(users\.uid, uid\)\);\s*res\.status\(200\)\.json\(\{ success: true \}\);/,
    `await db.delete(users).where(eq(users.uid, uid));
      logger.information('User deleted: {TargetUID} by {AdminUser}', {
        TargetUID: uid,
        AdminUser: req.user?.name || req.user?.email || 'System',
        Action: 'DeleteUser'
      });
      res.status(200).json({ success: true });`
);

// PATCH /api/users/:uid -> general edit
if (!content.includes("Action: 'EditUser'")) {
    content = content.replace(
        /res\.status\(200\)\.json\(\{ success: true, data: updated \}\);/,
        `logger.information('User profile edited: {TargetUser} by {AdminUser}', {
          TargetUser: updated.email,
          AdminUser: adminEmail,
          Action: 'EditUser'
        });
        res.status(200).json({ success: true, data: updated });`
    );
}

fs.writeFileSync(file, content);
