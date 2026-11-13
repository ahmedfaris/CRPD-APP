// src/server/utils/assetTypes.ts
import { db } from '../../db/index.ts';
import { assetTypes } from '../../db/schema.ts';

/**
 * Find an asset type by its key or one of its names (case-insensitive). Devices store the key,
 * older clients may send a display name.
 */
export async function findAssetType(value: unknown) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return null;
  const all = await db.select().from(assetTypes);
  return all.find(t => t.key.toLowerCase() === v)
    || all.find(t => t.nameEn.trim().toLowerCase() === v || t.nameAr.trim().toLowerCase() === v)
    || null;
}
