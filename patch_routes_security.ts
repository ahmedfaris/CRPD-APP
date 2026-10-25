import fs from 'fs';

const file = 'src/server/routes/roleRoutes.ts';
let content = fs.readFileSync(file, 'utf8');

// Imports for Zod and sanitize-html
const newImports = `import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';

const roleSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(20, 'Name maximum length is 20 characters')
    .regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, 'Only English, Arabic letters, and spaces are allowed'),
  permissions: z.array(z.string()).optional().default([])
});

// CSRF Protection Middleware
const requireCsrfToken = (req: any, res: any, next: any) => {
  const csrfHeader = req.headers['x-app-action'];
  if (!csrfHeader || csrfHeader !== 'strict-client-action') {
    return res.status(403).json({ error: 'CSRF token validation failed.' });
  }
  next();
};
`;

content = content.replace("const router = Router();", "const router = Router();\n\n" + newImports);

// Update POST route
const postRegex = /router\.post\('\/', requireAuth, requireAdmin, async \(req: AuthRequest, res\) => \{[\s\S]*?try \{[\s\S]*?const \{ name, permissions \} = req\.body;[\s\S]*?if \(!name\) return res\.status\(400\)\.json\(\{ error: 'Role name is required' \}\);/m;
const postReplacement = `router.post('/', requireAuth, requireAdmin, requireCsrfToken, async (req: AuthRequest, res) => {
  try {
    // 1. Sanitize HTML
    const rawName = req.body.name || '';
    const sanitizedName = sanitizeHtml(rawName, { allowedTags: [], allowedAttributes: {} });
    
    // 2. Validate using Zod
    const validation = roleSchema.safeParse({ name: sanitizedName, permissions: req.body.permissions });
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0].message });
    }
    
    const { name, permissions } = validation.data;`;
content = content.replace(postRegex, postReplacement);

// Update PUT route
const putRegex = /router\.put\('\/:id', requireAuth, requireAdmin, async \(req: AuthRequest, res\) => \{[\s\S]*?try \{[\s\S]*?const id = parseInt\(req\.params\.id\);[\s\S]*?const \{ name, permissions \} = req\.body;/m;
const putReplacement = `router.put('/:id', requireAuth, requireAdmin, requireCsrfToken, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // 1. Sanitize HTML
    const rawName = req.body.name || '';
    const sanitizedName = sanitizeHtml(rawName, { allowedTags: [], allowedAttributes: {} });
    
    // 2. Validate using Zod
    const validation = roleSchema.safeParse({ name: sanitizedName, permissions: req.body.permissions });
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0].message });
    }
    
    const { name, permissions } = validation.data;`;
content = content.replace(putRegex, putReplacement);

// Update DELETE route
const deleteRegex = /router\.delete\('\/:id', requireAuth, requireAdmin, async \(req: AuthRequest, res\) => \{/m;
const deleteReplacement = `router.delete('/:id', requireAuth, requireAdmin, requireCsrfToken, async (req: AuthRequest, res) => {`;
content = content.replace(deleteRegex, deleteReplacement);

fs.writeFileSync(file, content);
