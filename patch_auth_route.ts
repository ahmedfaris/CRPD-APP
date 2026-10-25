import fs from 'fs';

const file = 'src/server/routes/authRoutes.ts';
let content = fs.readFileSync(file, 'utf8');

const route = `
// POST /api/auth/reset-password-admin
router.post('/reset-password-admin', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { uid, newPassword } = req.body;
    if (!uid || !newPassword) {
      return res.status(400).json({ error: 'UID and newPassword are required.' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ passwordHash: hash, mustChangePassword: true }).where(eq(users.uid, uid));
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to reset password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});
`;

content = content.replace("export default router;", route + "\nexport default router;");
fs.writeFileSync(file, content);
