// src/server/routes/assetTypeRoutes.ts
// Asset types (Computer, Printer, Scanner, ...) managed from the Asset Management app.
import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { requireDeviceManager } from '../utils/deviceAccess.ts';
import { db } from '../../db/index.ts';
import { assetTypes, electronicDevices } from '../../db/schema.ts';
import { logger } from '../utils/logger.ts';

const router = Router();

export const ASSET_TYPE_ICONS = [
  'computer', 'laptop', 'printer', 'monitor', 'scanner', 'fingerprint', 'server', 'router', 'switch',
  'wifi', 'phone', 'tablet', 'camera', 'projector', 'storage', 'ups', 'keyboard', 'device',
] as const;
const CATEGORIES = ['electronic', 'network'];

const norm = (v: unknown) => String(v ?? '').trim();

/** How many devices use a type (devices store the type key, compared case-insensitively). */
async function usageCount(key: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(electronicDevices)
    .where(sql`lower(${electronicDevices.deviceType}) = lower(${key})`);
  return Number(row?.n || 0);
}

/** Validate the editable fields. `partial` allows fields to be left out (updates). */
function readTypeFields(body: any, partial: boolean): { values: Record<string, any> } | { error: string } {
  const values: Record<string, any> = {};
  const text = (key: string, label: string, max: number, required: boolean) => {
    const raw = body?.[key];
    if (raw === undefined) {
      if (required && !partial) throw new Error(`${label} is required`);
      return;
    }
    if (raw !== null && typeof raw !== 'string') throw new Error(`Invalid ${label}`);
    const v = norm(raw);
    if (required && !v) throw new Error(`${label} is required`);
    if (v.length > max) throw new Error(`${label} must be at most ${max} characters`);
    values[key] = v;
  };
  try {
    text('nameEn', 'English name', 60, true);
    text('nameAr', 'Arabic name', 60, true);
    text('description', 'Description', 300, false);
    if (body?.codePrefix !== undefined || !partial) {
      const prefix = norm(body?.codePrefix).toUpperCase();
      if (!/^[A-Z][A-Z0-9]{1,3}$/.test(prefix)) {
        throw new Error('Code prefix must be 2-4 letters or digits and start with a letter (e.g. PC, UPS)');
      }
      values.codePrefix = prefix;
    }
    if (body?.category !== undefined || !partial) {
      const category = norm(body?.category || 'electronic');
      if (!CATEGORIES.includes(category)) throw new Error('Category must be electronic or network');
      values.category = category;
    }
    if (body?.icon !== undefined || !partial) {
      const icon = norm(body?.icon || 'device');
      if (!(ASSET_TYPE_ICONS as readonly string[]).includes(icon)) throw new Error('Unknown icon');
      values.icon = icon;
    }
    if (body?.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') throw new Error('isActive must be true or false');
      values.isActive = body.isActive;
    }
  } catch (e: any) {
    return { error: e.message };
  }
  return { values };
}

/** Name or prefix already used by another type? Returns an error message or null. */
async function findConflict(values: Record<string, any>, exceptId?: number): Promise<string | null> {
  const all = await db.select().from(assetTypes);
  const others = all.filter(t => t.id !== exceptId);
  if (values.codePrefix && others.some(t => t.codePrefix.toUpperCase() === values.codePrefix)) {
    return `Code prefix ${values.codePrefix} is already used by another asset type`;
  }
  const clash = (field: 'nameEn' | 'nameAr') =>
    values[field] && others.some(t => norm(t[field]).toLowerCase() === values[field].toLowerCase());
  if (clash('nameEn') || clash('nameAr')) return 'An asset type with this name already exists';
  if (values.nameEn && others.some(t => t.key.toLowerCase() === values.nameEn.toLowerCase())) {
    return 'An asset type with this name already exists';
  }
  return null;
}

const parseId = (raw: unknown): number | null => (/^\d+$/.test(String(raw ?? '')) ? Number(raw) : null);

// GET /api/asset-types — every signed-in user (the device forms need the list); with usage counts.
router.get('/', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const all = await db.select().from(assetTypes).orderBy(assetTypes.category, assetTypes.nameEn);
    const counts = await db
      .select({ type: sql<string>`lower(${electronicDevices.deviceType})`, n: sql<number>`count(*)::int` })
      .from(electronicDevices)
      .groupBy(sql`lower(${electronicDevices.deviceType})`);
    const byKey = new Map(counts.map(c => [c.type, Number(c.n)]));
    res.json({ success: true, data: all.map(t => ({ ...t, deviceCount: byKey.get(t.key.toLowerCase()) || 0 })) });
  } catch (err: any) {
    logger.error('Failed to list asset types: {Error}', { Error: err.message });
    res.status(500).json({ success: false, error: 'Failed to load asset types' });
  }
});

// POST /api/asset-types
router.post('/', requireAuth, requireDeviceManager, async (req: AuthRequest, res) => {
  try {
    const read = readTypeFields(req.body, false);
    if ('error' in read) return res.status(400).json({ success: false, error: read.error });
    const conflict = await findConflict(read.values);
    if (conflict) return res.status(409).json({ success: false, error: conflict });

    const [created] = await db.insert(assetTypes).values({
      key: read.values.nameEn, // permanent key stored on devices
      nameEn: read.values.nameEn,
      nameAr: read.values.nameAr,
      category: read.values.category,
      codePrefix: read.values.codePrefix,
      icon: read.values.icon,
      description: read.values.description || null,
      isActive: read.values.isActive ?? true,
      isBuiltIn: false,
    }).returning();
    logger.information('Asset type created: {Type} ({Prefix}) by {User}', { Type: created.nameEn, Prefix: created.codePrefix, User: req.user?.email });
    res.status(201).json({ success: true, data: { ...created, deviceCount: 0 } });
  } catch (err: any) {
    logger.error('Failed to create asset type: {Error}', { Error: err.message });
    res.status(500).json({ success: false, error: 'Failed to create asset type' });
  }
});

// PUT /api/asset-types/:id — names, prefix, category, icon, description, active flag. The key never changes.
router.put('/:id', requireAuth, requireDeviceManager, async (req: AuthRequest, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ success: false, error: 'Invalid asset type ID' });
    const [current] = await db.select().from(assetTypes).where(eq(assetTypes.id, id));
    if (!current) return res.status(404).json({ success: false, error: 'Asset type not found' });

    const read = readTypeFields(req.body, true);
    if ('error' in read) return res.status(400).json({ success: false, error: read.error });
    const conflict = await findConflict(read.values, id);
    if (conflict) return res.status(409).json({ success: false, error: conflict });

    const [updated] = await db.update(assetTypes)
      .set({ ...read.values, description: read.values.description ?? current.description, updatedAt: new Date() })
      .where(eq(assetTypes.id, id))
      .returning();
    res.json({ success: true, data: { ...updated, deviceCount: await usageCount(updated.key) } });
  } catch (err: any) {
    logger.error('Failed to update asset type: {Error}', { Error: err.message });
    res.status(500).json({ success: false, error: 'Failed to update asset type' });
  }
});

// DELETE /api/asset-types/:id — only custom types that no device uses; otherwise deactivate.
router.delete('/:id', requireAuth, requireDeviceManager, async (req: AuthRequest, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ success: false, error: 'Invalid asset type ID' });
    const [current] = await db.select().from(assetTypes).where(eq(assetTypes.id, id));
    if (!current) return res.status(404).json({ success: false, error: 'Asset type not found' });
    if (current.isBuiltIn) {
      return res.status(400).json({ success: false, error: 'Built-in asset types cannot be deleted. Deactivate it instead.' });
    }
    const used = await usageCount(current.key);
    if (used > 0) {
      return res.status(409).json({ success: false, error: `${used} device(s) use this type. Deactivate it instead of deleting.` });
    }
    await db.delete(assetTypes).where(eq(assetTypes.id, id));
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Failed to delete asset type: {Error}', { Error: err.message });
    res.status(500).json({ success: false, error: 'Failed to delete asset type' });
  }
});

export default router;
