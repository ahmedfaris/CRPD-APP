// src/server/controllers/maintenanceController.ts
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { maintenance, assets, tickets, users, electronicDevices } from '../../db/schema.ts';
import { eq, desc, and } from 'drizzle-orm';
import { logger } from '../utils/logger.ts';
import { TicketRequestFileService } from '../services/ticketRequestFileService.ts';

function getParam(val: string | string[] | undefined): string {
  if (!val) return '';
  return Array.isArray(val) ? val[0] : val;
}


export const MAINTENANCE_TYPES = [
  'Routine Maintenance', 'Hardware Repair', 'Component Replacement', 'Upgrade',
  'Inspection', 'Emergency Service', 'Software Service',
];
export const MAINTENANCE_STATUSES = ['Scheduled', 'In Progress', 'Pending Parts', 'Completed', 'Cancelled'];
const OPEN_STATUSES = ['In Progress', 'Pending Parts'];
const MAX_MONEY = 10_000_000_000;

type Part = { name: string; quantity: number; unitCost: number };

const isDateOnly = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v).getTime());

/**
 * Validate the maintenance fields in a request. With `partial`, missing fields are left out
 * (updates). Returns the values to store or an error message.
 */
function readMaintenanceFields(body: any, partial: boolean): { values: Record<string, any> } | { error: string } {
  const v: Record<string, any> = {};
  try {
    const text = (key: string, label: string, max: number, required = false) => {
      const raw = body?.[key];
      if (raw === undefined) {
        if (required && !partial) throw new Error(`${label} is required`);
        return;
      }
      if (raw !== null && typeof raw !== 'string') throw new Error(`Invalid ${label}`);
      const t = String(raw ?? '').trim();
      if (required && !t) throw new Error(`${label} is required`);
      if (t.length > max) throw new Error(`${label} must be at most ${max} characters`);
      v[key] = t || null;
    };
    const money = (key: string, label: string) => {
      const raw = body?.[key];
      if (raw === undefined || raw === null || raw === '') return undefined;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > MAX_MONEY) throw new Error(`${label} must be a number of 0 or more`);
      return Math.round(n * 100) / 100;
    };

    if (body?.maintenanceType !== undefined || !partial) {
      const t = String(body?.maintenanceType ?? '').trim();
      if (!MAINTENANCE_TYPES.includes(t)) throw new Error(`Maintenance type must be one of: ${MAINTENANCE_TYPES.join(', ')}`);
      v.maintenanceType = t;
    }
    if (body?.status !== undefined) {
      const st = String(body.status).trim();
      if (!MAINTENANCE_STATUSES.includes(st)) throw new Error(`Status must be one of: ${MAINTENANCE_STATUSES.join(', ')}`);
      v.status = st;
    }
    if (body?.maintenanceDate !== undefined) {
      const d = new Date(body.maintenanceDate);
      if (isNaN(d.getTime())) throw new Error('Invalid maintenance date');
      v.maintenanceDate = d;
    }
    text('maintenanceDescription', 'Problem description', 2000, true);
    text('maintenanceRequesterName', 'Requester name', 120);
    text('diagnosis', 'Diagnosis', 2000);
    text('actionTaken', 'Action taken', 2000);
    text('vendor', 'Service provider', 150);
    text('performedBy', 'Technician', 120);
    text('notes', 'Notes', 2000);
    text('ticketNo', 'Ticket number', 40);

    if (body?.nextMaintenanceDate !== undefined) {
      const nd = String(body.nextMaintenanceDate ?? '').trim();
      if (nd && !isDateOnly(nd)) throw new Error('Next maintenance date must be a date (YYYY-MM-DD)');
      v.nextMaintenanceDate = nd || null;
    }
    if (body?.completedAt !== undefined) {
      if (body.completedAt === null || body.completedAt === '') v.completedAt = null;
      else {
        const c = new Date(body.completedAt);
        if (isNaN(c.getTime())) throw new Error('Invalid completion date');
        v.completedAt = c;
      }
    }
    if (body?.underWarranty !== undefined) {
      if (typeof body.underWarranty !== 'boolean') throw new Error('underWarranty must be true or false');
      v.underWarranty = body.underWarranty;
    }
    if (body?.partsUsed !== undefined) {
      if (!Array.isArray(body.partsUsed)) throw new Error('partsUsed must be a list');
      if (body.partsUsed.length > 50) throw new Error('At most 50 parts per record');
      const parts: Part[] = body.partsUsed.map((p: any, i: number) => {
        const name = String(p?.name ?? '').trim();
        const quantity = Number(p?.quantity ?? 1);
        const unitCost = Number(p?.unitCost ?? 0);
        if (!name || name.length > 100) throw new Error(`Part ${i + 1}: name is required (max 100 characters)`);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) throw new Error(`Part ${i + 1}: quantity must be a whole number from 1`);
        if (!Number.isFinite(unitCost) || unitCost < 0 || unitCost > MAX_MONEY) throw new Error(`Part ${i + 1}: unit cost must be 0 or more`);
        return { name, quantity, unitCost: Math.round(unitCost * 100) / 100 };
      });
      v.partsUsed = parts;
    }
    const labor = money('laborCost', 'Labor cost');
    if (labor !== undefined) v.laborCost = labor;
    const total = money('costOfMaintenance', 'Cost');
    if (total !== undefined) v.costOfMaintenance = total;
  } catch (e: any) {
    return { error: e.message };
  }
  return { values: v };
}

/**
 * Work out costs and completion time for the stored record (`merged` = current row + changes).
 * When labor or parts are given, the total is labor + parts; otherwise a plain total is kept.
 */
function finalizeRecord(merged: any, changes: Record<string, any>) {
  const out: Record<string, any> = {};
  const parts: Part[] = Array.isArray(merged.partsUsed) ? merged.partsUsed : [];
  const partsCost = Math.round(parts.reduce((sum, p) => sum + p.quantity * p.unitCost, 0) * 100) / 100;
  const labor = Number(merged.laborCost || 0);
  if (changes.partsUsed !== undefined || changes.laborCost !== undefined) {
    out.partsCost = partsCost.toFixed(2);
    out.laborCost = labor.toFixed(2);
    out.costOfMaintenance = (labor + partsCost).toFixed(2);
  } else if (changes.costOfMaintenance !== undefined) {
    out.costOfMaintenance = Number(changes.costOfMaintenance).toFixed(2);
  }
  if (changes.status !== undefined) {
    if (changes.status === 'Completed' && !merged.completedAt) out.completedAt = new Date();
    if (changes.status !== 'Completed' && changes.completedAt === undefined) out.completedAt = null;
  }
  return out;
}

/**
 * Keep the device status in step with its maintenance: a device with work in progress (or
 * waiting for parts) is "Under Maintenance"; when no open work remains it returns to
 * "Operational". Retired and in-storage devices are left alone.
 */
export async function syncDeviceStatus(assetId: number) {
  const [device] = await db.select({ status: electronicDevices.status }).from(electronicDevices).where(eq(electronicDevices.id, assetId));
  if (!device || device.status === 'Retired' || device.status === 'Storage') return;
  const records = await db.select({ status: maintenance.status }).from(maintenance).where(eq(maintenance.assetId, assetId));
  const hasOpen = records.some(r => OPEN_STATUSES.includes(r.status));
  const next = hasOpen ? 'Under Maintenance' : (device.status === 'Under Maintenance' ? 'Operational' : device.status);
  if (next !== device.status) {
    await db.update(electronicDevices).set({ status: next, updatedAt: new Date() }).where(eq(electronicDevices.id, assetId));
  }
}

function formatRecord(r: { maintenance: any; asset: any }) {
  let parsedDoc: any = null;
  if (r.maintenance.maintenanceRequestDocument) {
    try {
      parsedDoc = JSON.parse(r.maintenance.maintenanceRequestDocument);
    } catch {
      parsedDoc = r.maintenance.maintenanceRequestDocument;
    }
  }
  const m = r.maintenance;
  const iso = (d: any) => (d ? new Date(d).toISOString() : null);
  return {
    id: m.id,
    assetId: m.assetId,
    assetName: r.asset ? `${r.asset.brand} ${r.asset.model}`.trim() : `Asset #${m.assetId}`,
    assetCode: r.asset?.deviceCode || `AST-${m.assetId}`,
    deviceType: r.asset?.deviceType || 'Hardware',
    deviceStatus: r.asset?.status,
    brand: r.asset?.brand,
    model: r.asset?.model,
    serialNumber: r.asset?.serialNumber,
    department: r.asset?.department,
    maintenanceType: m.maintenanceType,
    maintenanceDate: iso(m.maintenanceDate) || new Date().toISOString(),
    maintenanceRequesterName: m.maintenanceRequesterName,
    maintenanceDescription: m.maintenanceDescription,
    maintenanceRequestDocument: parsedDoc,
    costOfMaintenance: parseFloat(String(m.costOfMaintenance || '0')),
    laborCost: parseFloat(String(m.laborCost || '0')),
    partsCost: parseFloat(String(m.partsCost || '0')),
    partsUsed: Array.isArray(m.partsUsed) ? m.partsUsed : [],
    diagnosis: m.diagnosis || '',
    actionTaken: m.actionTaken || '',
    vendor: m.vendor || '',
    underWarranty: !!m.underWarranty,
    completedAt: iso(m.completedAt),
    nextMaintenanceDate: m.nextMaintenanceDate || '',
    requesterId: m.requesterId,
    ticketId: m.ticketId,
    ticketNo: m.ticketNo,
    status: m.status,
    performedBy: m.performedBy,
    notes: m.notes,
    createdAt: iso(m.createdAt) || new Date().toISOString(),
    updatedAt: iso(m.updatedAt) || new Date().toISOString(),
  };
}

/** Insert a maintenance record (shared by the maintenance table and the per-device form). */
export async function insertMaintenanceRecord(assetId: number, values: Record<string, any>, actor: { uid: string; fullName: string }, doc: any) {
  const status = values.status || 'Completed';
  const base: Record<string, any> = {
    assetId,
    maintenanceType: values.maintenanceType,
    maintenanceDate: values.maintenanceDate || new Date(),
    maintenanceRequesterName: values.maintenanceRequesterName || actor.fullName || 'System User',
    maintenanceDescription: values.maintenanceDescription,
    maintenanceRequestDocument: doc,
    costOfMaintenance: '0.00',
    requesterId: actor.uid || null,
    ticketNo: values.ticketNo || null,
    status,
    performedBy: values.performedBy || 'Technical Support Team',
    notes: values.notes || null,
    diagnosis: values.diagnosis || null,
    actionTaken: values.actionTaken || null,
    vendor: values.vendor || null,
    partsUsed: values.partsUsed || [],
    laborCost: '0.00',
    partsCost: '0.00',
    underWarranty: values.underWarranty || false,
    completedAt: values.completedAt ?? null,
    nextMaintenanceDate: values.nextMaintenanceDate || null,
  };
  const changes: Record<string, any> = { ...values, status };
  if (values.partsUsed === undefined && values.laborCost === undefined && values.costOfMaintenance === undefined) {
    changes.costOfMaintenance = 0;
  }
  Object.assign(base, finalizeRecord({ ...base, laborCost: values.laborCost ?? 0 }, changes));
  const [inserted] = await db.insert(maintenance).values(base as any).returning();
  await syncDeviceStatus(assetId);
  return inserted;
}

export class MaintenanceController {
  private static getActor(req: AuthRequest) {
    if (req.user) {
      return {
        uid: req.user.uid || req.user.id || 'usr_current',
        id: req.user.id || req.user.uid || 'usr_current',
        fullName: req.user.fullName || req.user.displayName || req.user.name || 'System User',
        email: req.user.email || 'user@company.gov',
        role: req.user.role || 'Employee',
        userType: req.user.userType || 'Operational User',
        department: req.user.department || 'IT Service Desk',
      };
    }
    // Routes are behind requireAuth, so req.user is always set. Never fall back to a
    // client-supplied actor or a default admin identity.
    return {
      uid: '',
      id: '',
      fullName: 'Unknown User',
      email: '',
      role: 'Employee',
      userType: 'Operational User',
      department: 'Unassigned',
    };
  }

  /**
   * GET /api/maintenance
   * Returns all maintenance records with asset information
   */
  static async getMaintenanceList(req: AuthRequest, res: Response) {
    try {
      const assetIdParam = req.query.assetId as string;
      const ticketIdParam = req.query.ticketId as string;

      let records;
      if (assetIdParam && !isNaN(Number(assetIdParam))) {
        records = await db.select({
          maintenance: maintenance,
          asset: electronicDevices,
        })
        .from(maintenance)
        .leftJoin(electronicDevices, eq(maintenance.assetId, electronicDevices.id))
        .where(eq(maintenance.assetId, Number(assetIdParam)))
        .orderBy(desc(maintenance.maintenanceDate));
      } else if (ticketIdParam && !isNaN(Number(ticketIdParam))) {
        records = await db.select({
          maintenance: maintenance,
          asset: electronicDevices,
        })
        .from(maintenance)
        .leftJoin(electronicDevices, eq(maintenance.assetId, electronicDevices.id))
        .where(eq(maintenance.ticketId, Number(ticketIdParam)))
        .orderBy(desc(maintenance.maintenanceDate));
      } else {
        records = await db.select({
          maintenance: maintenance,
          asset: electronicDevices,
        })
        .from(maintenance)
        .leftJoin(electronicDevices, eq(maintenance.assetId, electronicDevices.id))
        .orderBy(desc(maintenance.maintenanceDate));
      }

      const formatted = records.map(formatRecord);

      res.json({
        success: true,
        count: formatted.length,
        data: formatted,
      });
    } catch (err: any) {
      logger.error('Error fetching maintenance records: {Error}', { Error: err.message });
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch maintenance records' });
    }
  }

  /**
   * GET /api/maintenance/:id
   */
  static async getMaintenanceById(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(getParam(req.params.id), 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid maintenance ID' });
      }

      const rows = await db.select({
        maintenance: maintenance,
        asset: electronicDevices,
      })
      .from(maintenance)
      .leftJoin(electronicDevices, eq(maintenance.assetId, electronicDevices.id))
      .where(eq(maintenance.id, id))
      .limit(1);

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Maintenance record not found' });
      }

      const formatted = formatRecord(rows[0]);

      res.json({ success: true, data: formatted });
    } catch (err: any) {
      logger.error('Error fetching maintenance record: {Error}', { Error: err.message });
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch maintenance record' });
    }
  }

  /**
   * POST /api/maintenance
   * Creates a new maintenance record
   */
  static async createMaintenance(req: AuthRequest, res: Response) {
    try {
      const actor = MaintenanceController.getActor(req);
      const { assetId, maintenanceRequestDocument, ticketId } = req.body;

      if (!assetId || isNaN(Number(assetId))) {
        return res.status(400).json({ success: false, error: 'Valid assetId is required' });
      }
      const read = readMaintenanceFields(req.body, false);
      if ('error' in read) {
        return res.status(400).json({ success: false, error: read.error });
      }

      const [device] = await db.select({ id: electronicDevices.id }).from(electronicDevices).where(eq(electronicDevices.id, Number(assetId)));
      if (!device) {
        return res.status(404).json({ success: false, error: 'Asset not found' });
      }

      let docString = null;
      if (maintenanceRequestDocument) {
        docString = await TicketRequestFileService.processMaintenanceDoc(maintenanceRequestDocument, `MNT-${assetId}`);
      }

      const inserted = await insertMaintenanceRecord(Number(assetId), read.values, { uid: actor.uid || actor.id, fullName: actor.fullName }, docString);
      if (ticketId && !isNaN(Number(ticketId))) {
        await db.update(maintenance).set({ ticketId: Number(ticketId) }).where(eq(maintenance.id, inserted.id));
      }

      logger.information('Maintenance record created: ID {Id} for Asset {AssetId} by {Requester}', {
        Id: inserted.id,
        AssetId: inserted.assetId,
        Requester: inserted.maintenanceRequesterName,
      });

      res.status(201).json({ success: true, data: inserted });
    } catch (err: any) {
      logger.error('Error creating maintenance record: {Error}', { Error: err.message });
      res.status(500).json({ success: false, error: err.message || 'Failed to create maintenance record' });
    }
  }

  /**
   * PUT /api/maintenance/:id
   */
  static async updateMaintenance(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(getParam(req.params.id), 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid maintenance ID' });
      }

      const [current] = await db.select().from(maintenance).where(eq(maintenance.id, id));
      if (!current) {
        return res.status(404).json({ success: false, error: 'Maintenance record not found' });
      }
      const read = readMaintenanceFields(req.body, true);
      if ('error' in read) {
        return res.status(400).json({ success: false, error: read.error });
      }
      const updates: any = { ...read.values };
      if (updates.laborCost !== undefined) updates.laborCost = Number(updates.laborCost).toFixed(2);
      delete updates.costOfMaintenance;
      if (req.body.maintenanceRequestDocument !== undefined) {
        updates.maintenanceRequestDocument = req.body.maintenanceRequestDocument
          ? await TicketRequestFileService.processMaintenanceDoc(req.body.maintenanceRequestDocument, `MNT-${id}`)
          : null;
      }
      const merged = { ...current, ...updates, partsUsed: updates.partsUsed ?? current.partsUsed, laborCost: read.values.laborCost ?? current.laborCost };
      Object.assign(updates, finalizeRecord(merged, read.values));
      updates.updatedAt = new Date();

      const [updated] = await db.update(maintenance)
        .set(updates)
        .where(eq(maintenance.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Maintenance record not found' });
      }
      await syncDeviceStatus(updated.assetId);

      res.json({ success: true, data: updated });
    } catch (err: any) {
      logger.error('Error updating maintenance record: {Error}', { Error: err.message });
      res.status(500).json({ success: false, error: err.message || 'Failed to update maintenance record' });
    }
  }

  /**
   * DELETE /api/maintenance/:id
   */
  static async deleteMaintenance(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(getParam(req.params.id), 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid maintenance ID' });
      }

      const [deleted] = await db.delete(maintenance).where(eq(maintenance.id, id)).returning();
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Maintenance record not found' });
      }
      await syncDeviceStatus(deleted.assetId);
      res.json({ success: true, message: `Maintenance record #${id} removed` });
    } catch (err: any) {
      logger.error('Error deleting maintenance record: {Error}', { Error: err.message });
      res.status(500).json({ success: false, error: err.message || 'Failed to delete maintenance record' });
    }
  }

  /**
   * GET /api/assets
   * Returns registered organizational assets
   */
  static async getAssetsList(_req: AuthRequest, res: Response) {
    try {
      const allAssets = await db.select().from(assets).orderBy(desc(assets.id));
      res.json({ success: true, count: allAssets.length, data: allAssets });
    } catch (err: any) {
      logger.error('Error fetching assets: {Error}', { Error: err.message });
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch assets' });
    }
  }

  /**
   * POST /api/assets
   * Register a new asset in assets table
   */
  static async createAsset(req: AuthRequest, res: Response) {
    try {
      const {
        assetCode,
        name,
        category,
        deviceType,
        brand,
        model,
        serialNumber,
        department,
        departmentAr,
        status,
        location,
        assignedEmployee,
        notes,
      } = req.body;

      if (!name || !deviceType || !brand || !model || !department) {
        return res.status(400).json({ success: false, error: 'name, deviceType, brand, model, and department are required' });
      }

      const generatedCode = assetCode || `AST-${Date.now().toString().slice(-6)}`;

      const [newAsset] = await db.insert(assets).values({
        assetCode: generatedCode,
        name,
        category: category || 'electronic',
        deviceType,
        brand,
        model,
        serialNumber: serialNumber || null,
        department,
        departmentAr: departmentAr || null,
        status: status || 'Operational',
        location: location || null,
        assignedEmployee: assignedEmployee || null,
        notes: notes || null,
      }).returning();

      res.status(201).json({ success: true, data: newAsset });
    } catch (err: any) {
      logger.error('Error creating asset: {Error}', { Error: err.message });
      res.status(500).json({ success: false, error: err.message || 'Failed to create asset' });
    }
  }
}
