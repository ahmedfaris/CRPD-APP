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

      const formatted = records.map(r => {
        let parsedDoc: any = null;
        if (r.maintenance.maintenanceRequestDocument) {
          try {
            parsedDoc = JSON.parse(r.maintenance.maintenanceRequestDocument);
          } catch {
            parsedDoc = r.maintenance.maintenanceRequestDocument;
          }
        }

        return {
          id: r.maintenance.id,
          assetId: r.maintenance.assetId,
          assetName: r.asset ? `${r.asset.brand} ${r.asset.model}`.trim() : `Asset #${r.maintenance.assetId}`,
          assetCode: r.asset?.deviceCode || `AST-${r.maintenance.assetId}`,
          deviceType: r.asset?.deviceType || 'Hardware',
          brand: r.asset?.brand,
          model: r.asset?.model,
          department: r.asset?.department,
          maintenanceType: r.maintenance.maintenanceType,
          maintenanceDate: r.maintenance.maintenanceDate ? new Date(r.maintenance.maintenanceDate).toISOString() : new Date().toISOString(),
          maintenanceRequesterName: r.maintenance.maintenanceRequesterName,
          maintenanceDescription: r.maintenance.maintenanceDescription,
          maintenanceRequestDocument: parsedDoc,
          costOfMaintenance: parseFloat(String(r.maintenance.costOfMaintenance || '0')),
          requesterId: r.maintenance.requesterId,
          ticketId: r.maintenance.ticketId,
          ticketNo: r.maintenance.ticketNo,
          status: r.maintenance.status,
          performedBy: r.maintenance.performedBy,
          notes: r.maintenance.notes,
          createdAt: r.maintenance.createdAt ? new Date(r.maintenance.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: r.maintenance.updatedAt ? new Date(r.maintenance.updatedAt).toISOString() : new Date().toISOString(),
        };
      });

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

      const r = rows[0];
      let parsedDoc: any = null;
      if (r.maintenance.maintenanceRequestDocument) {
        try {
          parsedDoc = JSON.parse(r.maintenance.maintenanceRequestDocument);
        } catch {
          parsedDoc = r.maintenance.maintenanceRequestDocument;
        }
      }

      const formatted = {
        id: r.maintenance.id,
        assetId: r.maintenance.assetId,
        assetName: r.asset ? `${r.asset.brand} ${r.asset.model}`.trim() : `Asset #${r.maintenance.assetId}`,
        assetCode: r.asset?.deviceCode || `AST-${r.maintenance.assetId}`,
        deviceType: r.asset?.deviceType || 'Hardware',
        brand: r.asset?.brand,
        model: r.asset?.model,
        department: r.asset?.department,
        maintenanceType: r.maintenance.maintenanceType,
        maintenanceDate: r.maintenance.maintenanceDate ? new Date(r.maintenance.maintenanceDate).toISOString() : new Date().toISOString(),
        maintenanceRequesterName: r.maintenance.maintenanceRequesterName,
        maintenanceDescription: r.maintenance.maintenanceDescription,
        maintenanceRequestDocument: parsedDoc,
        costOfMaintenance: parseFloat(String(r.maintenance.costOfMaintenance || '0')),
        requesterId: r.maintenance.requesterId,
        ticketId: r.maintenance.ticketId,
        ticketNo: r.maintenance.ticketNo,
        status: r.maintenance.status,
        performedBy: r.maintenance.performedBy,
        notes: r.maintenance.notes,
        createdAt: r.maintenance.createdAt ? new Date(r.maintenance.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: r.maintenance.updatedAt ? new Date(r.maintenance.updatedAt).toISOString() : new Date().toISOString(),
      };

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
      const {
        assetId,
        maintenanceType,
        maintenanceDate,
        maintenanceRequesterName,
        maintenanceDescription,
        maintenanceRequestDocument,
        costOfMaintenance,
        ticketId,
        ticketNo,
        status,
        performedBy,
        notes,
      } = req.body;

      if (!assetId || isNaN(Number(assetId))) {
        return res.status(400).json({ success: false, error: 'Valid assetId is required' });
      }

      if (!maintenanceType) {
        return res.status(400).json({ success: false, error: 'maintenanceType is required' });
      }

      if (!maintenanceDescription) {
        return res.status(400).json({ success: false, error: 'maintenanceDescription is required' });
      }

      const [device] = await db.select({ id: electronicDevices.id }).from(electronicDevices).where(eq(electronicDevices.id, Number(assetId)));
      if (!device) {
        return res.status(404).json({ success: false, error: 'Asset not found' });
      }

      const requesterName = maintenanceRequesterName || actor.fullName || 'System User';
      let docString = null;
      if (maintenanceRequestDocument) {
        docString = await TicketRequestFileService.processMaintenanceDoc(maintenanceRequestDocument, `MNT-${assetId}`);
      }

      const [inserted] = await db.insert(maintenance).values({
        assetId: Number(assetId),
        maintenanceType: String(maintenanceType),
        maintenanceDate: maintenanceDate ? new Date(maintenanceDate) : new Date(),
        maintenanceRequesterName: requesterName,
        maintenanceDescription: String(maintenanceDescription),
        maintenanceRequestDocument: docString,
        costOfMaintenance: String(costOfMaintenance ?? '0.00'),
        requesterId: actor.uid || actor.id,
        ticketId: ticketId ? Number(ticketId) : null,
        ticketNo: ticketNo ? String(ticketNo) : null,
        status: status || 'Completed',
        performedBy: performedBy || 'Technical Support Team',
        notes: notes || null,
      }).returning();

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

      const updates: any = {};
      if (req.body.maintenanceType !== undefined) updates.maintenanceType = req.body.maintenanceType;
      if (req.body.maintenanceDate !== undefined) updates.maintenanceDate = new Date(req.body.maintenanceDate);
      if (req.body.maintenanceRequesterName !== undefined) updates.maintenanceRequesterName = req.body.maintenanceRequesterName;
      if (req.body.maintenanceDescription !== undefined) updates.maintenanceDescription = req.body.maintenanceDescription;
      if (req.body.costOfMaintenance !== undefined) updates.costOfMaintenance = String(req.body.costOfMaintenance);
      if (req.body.status !== undefined) updates.status = req.body.status;
      if (req.body.performedBy !== undefined) updates.performedBy = req.body.performedBy;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      if (req.body.maintenanceRequestDocument !== undefined) {
        updates.maintenanceRequestDocument = await TicketRequestFileService.processMaintenanceDoc(req.body.maintenanceRequestDocument, `MNT-${id}`);
      }
      updates.updatedAt = new Date();

      const [updated] = await db.update(maintenance)
        .set(updates)
        .where(eq(maintenance.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Maintenance record not found' });
      }

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

      await db.delete(maintenance).where(eq(maintenance.id, id));
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
