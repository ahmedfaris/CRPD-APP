import { Router, Request, Response } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { getDeviceAccess, forbid, requireDeviceManager, requireDeviceDeleter } from '../utils/deviceAccess.ts';
import { db } from '../../db/index.ts';
import { electronicDevices } from '../../db/schema.ts';
import { eq, desc, ilike, or } from 'drizzle-orm';
import { logger } from '../utils/logger.ts';
import path from 'path';
import fs from 'fs';
import {
  createOrUpdateDeviceFolder,
  listDeviceFolderFiles,
  syncAllExistingDevicesToDisk,
  generateNextDeviceCode,
  ASSET_ARCHIVE_STORAGE_DIR,
  ASSET_ARCHIVE_STORAGE_DIR_NAME,
  ORGANIZATION_STORAGE_DIR,
  sanitizePathSegment
} from '../services/deviceFolderService.ts';

const router = Router();

/** Parse a numeric :id route parameter; responds 400 and returns null when invalid. */
function parseDeviceId(req: AuthRequest, res: Response): number | null {
  const raw = String(req.params.id ?? '');
  if (!/^\d+$/.test(raw)) {
    res.status(400).json({ error: 'Invalid device ID' });
    return null;
  }
  return parseInt(raw, 10);
}

const isUniqueViolation = (err: any) =>
  err?.code === '23505' || err?.cause?.code === '23505' || /duplicate key|unique constraint/i.test(String(err?.cause?.message || err?.message || ''));

// Startup initialization: sync device folders in background
let isInitialized = false;
async function initializeDeviceFolders() {
  if (isInitialized) return;
  isInitialized = true;
  try {
    await syncAllExistingDevicesToDisk();
  } catch (e) {
    console.error('Initialization error for device folders:', e);
  }
}
setTimeout(initializeDeviceFolders, 500);

// GET /api/devices/next-code - Preview next Asset ID code for a department
router.get('/next-code', requireAuth, async (req: AuthRequest, res) => {
  try {
    const department = (req.query.department as string) || req.user?.department || 'Information Technology';
    const deviceType = req.query.deviceType as string;
    const category = req.query.category as string;
    const nextCode = await generateNextDeviceCode(department, deviceType, category);
    res.json({ success: true, code: nextCode });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate asset code', details: error.message });
  }
});

// GET /api/devices/folders/hierarchy - Get asset archive folders tree
router.get('/folders/hierarchy', requireAuth, async (req: AuthRequest, res) => {
  try {
    const devices = await db.select().from(electronicDevices).orderBy(desc(electronicDevices.createdAt));
    
    // Group devices into hierarchy: Directorate -> Department -> Asset Folder
    const dirMap: Record<string, any> = {};

    for (const dev of devices) {
      const dir = dev.directorate || 'دائرة تكنولوجيا المعلومات والأمن السيبراني';
      const dept = dev.department || 'تكنولوجيا المعلومات';
      const folderName = dev.folderHierarchy?.deviceFolderName || dev.deviceCode;

      if (!dirMap[dir]) {
        dirMap[dir] = { name: dir, type: 'directorate', departments: {} };
      }
      if (!dirMap[dir].departments[dept]) {
        dirMap[dir].departments[dept] = { name: dept, type: 'department', devices: [] };
      }

      dirMap[dir].departments[dept].devices.push({
        id: dev.id,
        deviceCode: dev.deviceCode,
        brand: dev.brand,
        model: dev.model,
        deviceType: dev.deviceType,
        folderName,
        folderPath: dev.folderPath,
        status: dev.status
      });
    }

    res.json({ 
      success: true, 
      tree: dirMap, 
      rootFolder: ASSET_ARCHIVE_STORAGE_DIR, 
      rootName: ASSET_ARCHIVE_STORAGE_DIR_NAME 
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to build folder tree', details: error.message });
  }
});

// GET /api/devices/folders/download - Secure file download/view from device folder
router.get('/folders/download', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rawPath = req.query.path as string;
    if (!rawPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const resolved = path.resolve(rawPath);
    const archiveRoot = path.resolve(ASSET_ARCHIVE_STORAGE_DIR);
    const legacyRoot = path.resolve(path.join(process.cwd(), 'organization_devices'));
    
    // Security check: must reside inside ASSET_ARCHIVE_STORAGE_DIR or the legacy folder.
    // (A plain startsWith() also matched sibling folders such as "asset archive-other".)
    const isInside = (root: string) => {
      const rel = path.relative(root, resolved);
      return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
    };
    if (!isInside(archiveRoot) && !isInside(legacyRoot)) {
      return res.status(403).json({ error: 'Access forbidden: Path outside asset archive storage' });
    }

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const filename = path.basename(resolved);
    const ext = path.extname(filename).toLowerCase();
    
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.json') contentType = 'application/json';
    else if (ext === '.txt') contentType = 'text/plain; charset=utf-8';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    fs.createReadStream(resolved).pipe(res);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to read file', details: e.message });
  }
});

// POST /api/devices/sync-folders - Trigger disk folder synchronization for all devices
router.post('/sync-folders', requireAuth, requireDeviceManager, async (req: AuthRequest, res) => {
  try {
    const result = await syncAllExistingDevicesToDisk();
    res.json({ success: true, count: result.count, paths: result.paths });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to sync folders', details: e.message });
  }
});

// GET /api/devices - List all electronic and network devices
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { category, type, search, department } = req.query;

    let devices = await db.select().from(electronicDevices).orderBy(desc(electronicDevices.createdAt));

    if (category && typeof category === 'string' && category !== 'ALL') {
      devices = devices.filter(d => d.category.toLowerCase() === category.toLowerCase());
    }

    if (type && typeof type === 'string' && type !== 'ALL') {
      devices = devices.filter(d => d.deviceType.toLowerCase() === type.toLowerCase());
    }

    if (department && typeof department === 'string' && department !== 'ALL') {
      devices = devices.filter(d => d.department.toLowerCase() === department.toLowerCase());
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      devices = devices.filter(d => 
        d.deviceCode.toLowerCase().includes(q) ||
        d.brand.toLowerCase().includes(q) ||
        d.model.toLowerCase().includes(q) ||
        (d.serialNumber && d.serialNumber.toLowerCase().includes(q)) ||
        d.department.toLowerCase().includes(q) ||
        (d.ipAddress && d.ipAddress.toLowerCase().includes(q)) ||
        (d.assignedEmployee && d.assignedEmployee.toLowerCase().includes(q))
      );
    }

    // Parse JSON fields safely if stringified
    const mapped = devices.map(d => ({
      ...d,
      departmentHistory: typeof d.departmentHistory === 'string' ? JSON.parse(d.departmentHistory) : (d.departmentHistory || []),
      maintenanceHistory: typeof d.maintenanceHistory === 'string' ? JSON.parse(d.maintenanceHistory) : (d.maintenanceHistory || [])
    }));

    res.json({ success: true, count: mapped.length, data: mapped });
  } catch (error: any) {
    logger.error('Error fetching devices', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch devices', details: error.message });
  }
});

// GET /api/devices/:id - Get single device
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseDeviceId(req, res);
    if (id === null) return;
    const [device] = await db.select().from(electronicDevices).where(eq(electronicDevices.id, id));

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const mapped = {
      ...device,
      departmentHistory: typeof device.departmentHistory === 'string' ? JSON.parse(device.departmentHistory) : (device.departmentHistory || []),
      maintenanceHistory: typeof device.maintenanceHistory === 'string' ? JSON.parse(device.maintenanceHistory) : (device.maintenanceHistory || [])
    };

    res.json({ success: true, data: mapped });
  } catch (error: any) {
    logger.error('Error fetching device', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch device', details: error.message });
  }
});

// POST /api/devices - Register new device
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body;
    if (!body.category || !body.deviceType || !body.brand || !body.model || !body.department) {
      return res.status(400).json({ error: 'Required fields missing: category, deviceType, brand, model, department' });
    }

    // Ordinary users may only register devices for their own department.
    const access = await getDeviceAccess(req);
    if (!access.canManage) {
      const own = (access.department || '').trim().toLowerCase();
      const requested = String(body.department || '').trim().toLowerCase();
      const requestedAr = String(body.departmentAr || '').trim().toLowerCase();
      if (!own || (requested !== own && requestedAr !== own)) {
        return forbid(res, 'register assets for another department');
      }
    }

    const effectiveDept = body.department || req.user?.department || 'Information Technology';
    // Standard-format codes (e.g. "PC-004") sent by the form are only a preview: the server
    // always allocates those itself. Any other non-placeholder value is a custom code.
    const requestedCode = String(body.deviceCode || '').trim();
    const isAutoFormat = /^[A-Z]{2,4}-\d+$/i.test(requestedCode);
    const customCode = requestedCode && !isAutoFormat && !requestedCode.startsWith('DEV-') && !requestedCode.includes('XXX')
      ? requestedCode
      : null;
    if (customCode) {
      const [clash] = await db.select({ id: electronicDevices.id }).from(electronicDevices).where(eq(electronicDevices.deviceCode, customCode));
      if (clash) {
        return res.status(409).json({ error: `Asset code ${customCode} is already in use.`, code: 'DUPLICATE_CODE' });
      }
    }

    // Codes are unique across the whole organization; retry if another request took the same code.
    let created: any;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const generatedCode = customCode || await generateNextDeviceCode(effectiveDept, body.deviceType, body.category);
      try {
        [created] = await db.insert(electronicDevices).values({
      deviceCode: generatedCode,
      category: body.category,
      deviceType: body.deviceType,
      brand: body.brand,
      model: body.model,
      serialNumber: body.serialNumber || null,
      dateOfPurchase: body.dateOfPurchase || new Date().toISOString().split('T')[0],
      warrantyStartDate: body.warrantyStartDate || body.dateOfPurchase || new Date().toISOString().split('T')[0],
      warrantyPeriod: body.warrantyPeriod || '24 Months',
      department: body.department,
      departmentAr: body.departmentAr || null,
      organization: body.organization || null,
      directorate: body.directorate || null,
      division: body.division || null,
      status: body.status || 'Operational',
      ipAddress: body.ipAddress || null,
      macAddress: body.macAddress || null,
      location: body.location || null,
      assignedEmployee: body.assignedEmployee || null,
      departmentHistory: body.departmentHistory || [],
      maintenanceHistory: body.maintenanceHistory || [],
      notes: body.notes || null,
      purchaseReceipt: body.purchaseReceipt || null,
    }).returning();
      } catch (insertErr: any) {
        if (isUniqueViolation(insertErr) && !customCode) continue;
        if (isUniqueViolation(insertErr)) {
          return res.status(409).json({ error: `Asset code ${generatedCode} is already in use.`, code: 'DUPLICATE_CODE' });
        }
        throw insertErr;
      }
    }
    if (!created) {
      return res.status(409).json({ error: 'Could not allocate a unique asset code. Please try again.', code: 'DUPLICATE_CODE' });
    }

    // Automatically create folder for this device on disk:
    // Root / Organization / Directorate / Department / [Division] / DeviceFolder (begins with device code)
    try {
      const folderRes = await createOrUpdateDeviceFolder({
        id: created.id,
        deviceCode: created.deviceCode,
        category: created.category,
        deviceType: created.deviceType,
        brand: created.brand,
        model: created.model,
        serialNumber: created.serialNumber,
        dateOfPurchase: created.dateOfPurchase,
        warrantyStartDate: created.warrantyStartDate,
        warrantyPeriod: created.warrantyPeriod,
        department: created.department,
        departmentAr: created.departmentAr,
        organization: body.organization,
        directorate: body.directorate,
        division: body.division,
        status: created.status,
        ipAddress: created.ipAddress,
        macAddress: created.macAddress,
        location: created.location,
        assignedEmployee: created.assignedEmployee,
        notes: created.notes,
        purchaseReceipt: created.purchaseReceipt
      });

      const [updatedWithFolder] = await db.update(electronicDevices).set({
        organization: folderRes.hierarchy.organization,
        directorate: folderRes.hierarchy.directorate,
        division: folderRes.hierarchy.division || null,
        folderPath: folderRes.relativePath,
        folderHierarchy: folderRes.hierarchy as any
      }).where(eq(electronicDevices.id, created.id)).returning();

      logger.info('Device registered and folder created', { 
        deviceCode: created.deviceCode, 
        folderPath: folderRes.relativePath, 
        user: req.user?.email 
      });

      return res.status(201).json({ success: true, data: updatedWithFolder, folder: folderRes });
    } catch (folderErr: any) {
      console.error('Folder creation warning:', folderErr);
      return res.status(201).json({ success: true, data: created });
    }
  } catch (error: any) {
    logger.error('Error creating device', { error: error.message });
    res.status(500).json({ error: 'Failed to create device', details: error.message });
  }
});

// PUT /api/devices/:id - Update device
router.put('/:id', requireAuth, requireDeviceManager, async (req: AuthRequest, res) => {
  try {
    const id = parseDeviceId(req, res);
    if (id === null) return;
    const body = req.body;

    const [existing] = await db.select().from(electronicDevices).where(eq(electronicDevices.id, id));
    if (!existing) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const [updated] = await db.update(electronicDevices).set({
      category: body.category !== undefined ? body.category : existing.category,
      deviceType: body.deviceType !== undefined ? body.deviceType : existing.deviceType,
      brand: body.brand !== undefined ? body.brand : existing.brand,
      model: body.model !== undefined ? body.model : existing.model,
      serialNumber: body.serialNumber !== undefined ? body.serialNumber : existing.serialNumber,
      dateOfPurchase: body.dateOfPurchase !== undefined ? body.dateOfPurchase : existing.dateOfPurchase,
      warrantyStartDate: body.warrantyStartDate !== undefined ? body.warrantyStartDate : existing.warrantyStartDate,
      warrantyPeriod: body.warrantyPeriod !== undefined ? body.warrantyPeriod : existing.warrantyPeriod,
      department: body.department !== undefined ? body.department : existing.department,
      departmentAr: body.departmentAr !== undefined ? body.departmentAr : existing.departmentAr,
      organization: body.organization !== undefined ? body.organization : existing.organization,
      directorate: body.directorate !== undefined ? body.directorate : existing.directorate,
      division: body.division !== undefined ? body.division : existing.division,
      status: body.status !== undefined ? body.status : existing.status,
      ipAddress: body.ipAddress !== undefined ? body.ipAddress : existing.ipAddress,
      macAddress: body.macAddress !== undefined ? body.macAddress : existing.macAddress,
      location: body.location !== undefined ? body.location : existing.location,
      assignedEmployee: body.assignedEmployee !== undefined ? body.assignedEmployee : existing.assignedEmployee,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      purchaseReceipt: body.purchaseReceipt !== undefined ? body.purchaseReceipt : existing.purchaseReceipt,
      updatedAt: new Date(),
    }).where(eq(electronicDevices.id, id)).returning();

    // Update physical folder as well
    try {
      const folderRes = await createOrUpdateDeviceFolder({
        id: updated.id,
        deviceCode: updated.deviceCode,
        category: updated.category,
        deviceType: updated.deviceType,
        brand: updated.brand,
        model: updated.model,
        serialNumber: updated.serialNumber,
        dateOfPurchase: updated.dateOfPurchase,
        warrantyStartDate: updated.warrantyStartDate,
        warrantyPeriod: updated.warrantyPeriod,
        department: updated.department,
        departmentAr: updated.departmentAr,
        organization: updated.organization,
        directorate: updated.directorate,
        division: updated.division,
        status: updated.status,
        ipAddress: updated.ipAddress,
        macAddress: updated.macAddress,
        location: updated.location,
        assignedEmployee: updated.assignedEmployee,
        notes: updated.notes,
        purchaseReceipt: updated.purchaseReceipt
      });

      await db.update(electronicDevices).set({
        organization: folderRes.hierarchy.organization,
        directorate: folderRes.hierarchy.directorate,
        division: folderRes.hierarchy.division || null,
        folderPath: folderRes.relativePath,
        folderHierarchy: folderRes.hierarchy as any
      }).where(eq(electronicDevices.id, id));
    } catch (e) {
      console.error('Folder sync warning on update:', e);
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Error updating device', { error: error.message });
    res.status(500).json({ error: 'Failed to update device', details: error.message });
  }
});

// POST /api/devices/:id/transfer - Transfer device to a different department
router.post('/:id/transfer', requireAuth, requireDeviceManager, async (req: AuthRequest, res) => {
  try {
    const id = parseDeviceId(req, res);
    if (id === null) return;
    const { newDepartment, newDepartmentAr, newDivision, reason, transferDate } = req.body;

    if (!newDepartment) {
      return res.status(400).json({ error: 'New department is required' });
    }

    const [device] = await db.select().from(electronicDevices).where(eq(electronicDevices.id, id));
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const currentHistory = Array.isArray(device.departmentHistory) 
      ? device.departmentHistory 
      : (typeof device.departmentHistory === 'string' ? JSON.parse(device.departmentHistory) : []);

    const effectiveDate = transferDate || new Date().toISOString().split('T')[0];
    
    // Add current department to historical records
    const historyEntry = {
      id: 'dh-' + Date.now(),
      department: device.department,
      departmentAr: device.departmentAr || device.department,
      assignedDate: device.dateOfPurchase,
      transferredDate: effectiveDate,
      transferredBy: req.user?.fullName || req.user?.email || 'System User',
      reason: reason || 'Departmental reorganization / equipment reassignment'
    };

    const updatedHistory = [...currentHistory, historyEntry];

    // Recreate / update device folder for the new department
    let folderPath = device.folderPath;
    let folderHierarchy = device.folderHierarchy;
    let organization = device.organization;
    let directorate = device.directorate;

    try {
      const folderRes = await createOrUpdateDeviceFolder({
        ...device,
        department: newDepartment,
        departmentAr: newDepartmentAr || null,
        division: newDivision !== undefined ? newDivision : device.division
      });
      folderPath = folderRes.relativePath;
      folderHierarchy = folderRes.hierarchy as any;
      organization = folderRes.hierarchy.organization;
      directorate = folderRes.hierarchy.directorate;
    } catch (e) {
      console.error('Folder transfer error:', e);
    }

    const [updated] = await db.update(electronicDevices).set({
      department: newDepartment,
      departmentAr: newDepartmentAr || null,
      division: newDivision !== undefined ? newDivision : device.division,
      organization,
      directorate,
      folderPath,
      folderHierarchy,
      departmentHistory: updatedHistory,
      updatedAt: new Date()
    }).where(eq(electronicDevices.id, id)).returning();

    logger.info('Device department transferred and folder updated', {
      deviceId: id,
      from: device.department,
      to: newDepartment,
      newFolder: folderPath,
      user: req.user?.email
    });

    res.json({ success: true, data: updated, historyEntry });
  } catch (error: any) {
    logger.error('Error transferring device department', { error: error.message });
    res.status(500).json({ error: 'Failed to transfer device', details: error.message });
  }
});

// GET /api/devices/:id/folder - Inspect folder hierarchy and files for a device
router.get('/:id/folder', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseDeviceId(req, res);
    if (id === null) return;
    const [device] = await db.select().from(electronicDevices).where(eq(electronicDevices.id, id));

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Ensure folder exists
    const folderRes = await createOrUpdateDeviceFolder({
      id: device.id,
      deviceCode: device.deviceCode,
      category: device.category,
      deviceType: device.deviceType,
      brand: device.brand,
      model: device.model,
      serialNumber: device.serialNumber,
      dateOfPurchase: device.dateOfPurchase,
      warrantyStartDate: device.warrantyStartDate,
      warrantyPeriod: device.warrantyPeriod,
      department: device.department,
      departmentAr: device.departmentAr,
      organization: device.organization,
      directorate: device.directorate,
      division: device.division,
      status: device.status,
      ipAddress: device.ipAddress,
      macAddress: device.macAddress,
      location: device.location,
      assignedEmployee: device.assignedEmployee,
      notes: device.notes,
      purchaseReceipt: device.purchaseReceipt
    });

    const files = listDeviceFolderFiles(folderRes.folderPath);

    res.json({
      success: true,
      deviceId: device.id,
      deviceCode: device.deviceCode,
      folderPath: folderRes.folderPath,
      relativePath: folderRes.relativePath,
      hierarchy: folderRes.hierarchy,
      files
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to inspect device folder', details: error.message });
  }
});

// POST /api/devices/:id/folder/upload - Upload a file directly into the device's folder
router.post('/:id/folder/upload', requireAuth, requireDeviceManager, async (req: AuthRequest, res) => {
  try {
    const id = parseDeviceId(req, res);
    if (id === null) return;
    const [device] = await db.select().from(electronicDevices).where(eq(electronicDevices.id, id));

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const { fileName, fileDataUrl } = req.body;
    if (!fileName || !fileDataUrl || !fileDataUrl.startsWith('data:')) {
      return res.status(400).json({ error: 'Valid fileName and Base64 fileDataUrl are required' });
    }

    const folderRes = await createOrUpdateDeviceFolder(device);
    // data:[<media type>][;param=value]*;base64,<data>  (media types may contain dots, e.g. .docx/.xlsx)
    const matches = fileDataUrl.match(/^data:([^;,]*)((?:;[^;,]*)*);base64,([\s\S]+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid data URL format' });
    }

    const base64Data = matches[3];
    const buffer = Buffer.from(base64Data, 'base64');
    const sanitizedName = sanitizePathSegment(fileName);
    const targetFilePath = path.join(folderRes.folderPath, sanitizedName);

    fs.writeFileSync(targetFilePath, buffer);

    const files = listDeviceFolderFiles(folderRes.folderPath);

    res.json({
      success: true,
      message: 'File uploaded directly to device folder',
      fileName: sanitizedName,
      files
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to upload file to folder', details: error.message });
  }
});

// POST /api/devices/:id/maintenance - Add a maintenance record
router.post('/:id/maintenance', requireAuth, requireDeviceManager, async (req: AuthRequest, res) => {
  try {
    const id = parseDeviceId(req, res);
    if (id === null) return;
    const { date, type, description, performedBy, cost, status, notes } = req.body;

    if (!description || !type) {
      return res.status(400).json({ error: 'Maintenance type and description are required' });
    }

    const [device] = await db.select().from(electronicDevices).where(eq(electronicDevices.id, id));
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const currentHistory = Array.isArray(device.maintenanceHistory) 
      ? device.maintenanceHistory 
      : (typeof device.maintenanceHistory === 'string' ? JSON.parse(device.maintenanceHistory) : []);

    const maintenanceEntry = {
      id: 'mh-' + Date.now(),
      date: date || new Date().toISOString().split('T')[0],
      type: type || 'Routine',
      description,
      performedBy: performedBy || req.user?.fullName || 'Internal IT Technician',
      cost: cost ? parseFloat(cost) : 0,
      status: status || 'Completed',
      notes: notes || ''
    };

    const updatedHistory = [...currentHistory, maintenanceEntry];

    // If maintenance status is 'In Progress', optionally mark device status
    const newDeviceStatus = status === 'In Progress' ? 'Under Maintenance' : device.status === 'Under Maintenance' ? 'Operational' : device.status;

    const [updated] = await db.update(electronicDevices).set({
      maintenanceHistory: updatedHistory,
      status: newDeviceStatus,
      updatedAt: new Date()
    }).where(eq(electronicDevices.id, id)).returning();

    logger.info('Maintenance record added to device', {
      deviceId: id,
      type,
      user: req.user?.email
    });

    res.json({ success: true, data: updated, maintenanceEntry });
  } catch (error: any) {
    logger.error('Error logging maintenance record', { error: error.message });
    res.status(500).json({ error: 'Failed to log maintenance record', details: error.message });
  }
});

// DELETE /api/devices/:id - Delete device
router.delete('/:id', requireAuth, requireDeviceDeleter, async (req: AuthRequest, res) => {
  try {
    const id = parseDeviceId(req, res);
    if (id === null) return;
    const [deleted] = await db.delete(electronicDevices).where(eq(electronicDevices.id, id)).returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Device not found' });
    }

    logger.info('Device deleted', { deviceId: id, code: deleted.deviceCode });
    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting device', { error: error.message });
    res.status(500).json({ error: 'Failed to delete device', details: error.message });
  }
});

export default router;
