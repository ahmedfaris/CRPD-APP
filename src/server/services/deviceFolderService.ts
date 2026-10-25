// src/server/services/deviceFolderService.ts
import fs from 'fs';
import path from 'path';
import { db } from '../../db/index.ts';
import { departments, electronicDevices } from '../../db/schema.ts';
import { eq } from 'drizzle-orm';
import { DeviceFolderHierarchy, DeviceReceiptAttachment } from '../../types.ts';

// Root directory for all asset folders according to user specification: "asset archive"
export const ASSET_ARCHIVE_STORAGE_DIR_NAME = 'asset archive';
export const ASSET_ARCHIVE_STORAGE_DIR = path.join(process.cwd(), ASSET_ARCHIVE_STORAGE_DIR_NAME);

// Legacy backward compatibility alias
export const ORGANIZATION_STORAGE_DIR_NAME = ASSET_ARCHIVE_STORAGE_DIR_NAME;
export const ORGANIZATION_STORAGE_DIR = ASSET_ARCHIVE_STORAGE_DIR;

/**
 * Sanitizes folder and file names to prevent path traversal and remove OS-illegal characters,
 * while preserving Arabic, English, digits, spaces, and hyphens.
 */
export function sanitizePathSegment(name: string): string {
  if (!name || typeof name !== 'string') return 'Unit';
  // Remove dangerous chars: / \ : * ? " < > | \0
  let clean = name.replace(/[/\\:*?"<>|\x00-\x1F]/g, '_').trim();
  // Collapse multiple underscores or spaces
  clean = clean.replace(/\s+/g, ' ').replace(/_+/g, '_');
  return clean || 'Unit';
}

/**
 * Device code prefix mapping according to user requirement:
 * printer -> PR, Computer (PC) -> PC
 */
export function getDeviceCodePrefix(deviceType?: string, category?: string): string {
  const typeStr = (deviceType || '').trim().toLowerCase();
  const catStr = (category || '').trim().toLowerCase();

  // Printer -> PR
  if (typeStr.includes('printer') || typeStr.includes('طابعة') || typeStr.includes('barcode')) {
    return 'PR';
  }

  // Computer (PC) -> PC (includes Laptop, Desktop, PC, Workstation)
  if (
    typeStr.includes('computer') ||
    typeStr.includes('laptop') ||
    typeStr.includes('desktop') ||
    typeStr.includes('pc') ||
    typeStr.includes('حاسوب') ||
    typeStr.includes('كمبيوتر') ||
    typeStr.includes('محمول') ||
    typeStr.includes('مكتبي') ||
    typeStr.includes('workstation')
  ) {
    return 'PC';
  }

  // Scanner -> SC
  if (typeStr.includes('scanner') || typeStr.includes('ماسح') || typeStr.includes('سكانر')) {
    return 'SC';
  }

  // Screen / Monitor -> MN
  if (typeStr.includes('screen') || typeStr.includes('monitor') || typeStr.includes('display') || typeStr.includes('شاشة')) {
    return 'MN';
  }

  // Fingerprint Device -> FP
  if (typeStr.includes('fingerprint') || typeStr.includes('بصمة') || typeStr.includes('biometric')) {
    return 'FP';
  }

  // Router -> RT
  if (typeStr.includes('router') || typeStr.includes('راوتر')) {
    return 'RT';
  }

  // Switch -> SW
  if (typeStr.includes('switch') || typeStr.includes('سويتش')) {
    return 'SW';
  }

  // Access Point -> AP
  if (typeStr.includes('access point') || typeStr.includes('access_point') || typeStr.includes('نقطة وصول') || typeStr.includes('wifi') || typeStr.includes('وايفاي')) {
    return 'AP';
  }

  // Server -> SR
  if (typeStr.includes('server') || typeStr.includes('خادم') || typeStr.includes('سيرفر')) {
    return 'SR';
  }

  // Phone / VoIP -> PH
  if (typeStr.includes('phone') || typeStr.includes('voip') || typeStr.includes('هاتف')) {
    return 'PH';
  }

  if (catStr === 'network') {
    return 'NW';
  }

  return 'DEV';
}

/**
 * Generates the sequential Asset ID code for a department:
 * Formatted as: devicecode (printer -> PR, Computer (PC))- device number create a sequence for each department
 * e.g. PR-001, PR-002, PC-001, PC-002
 */
export async function generateNextDeviceCode(
  department: string,
  deviceType?: string,
  category?: string
): Promise<string> {
  const prefix = getDeviceCodePrefix(deviceType, category);
  const normDept = (department || '').trim().toLowerCase();

  const allDevices = await db.select().from(electronicDevices);
  const deptDevices = allDevices.filter(d => {
    const dDept = (d.department || '').trim().toLowerCase();
    const dDeptAr = (d.departmentAr || '').trim().toLowerCase();
    return (
      dDept === normDept ||
      dDeptAr === normDept ||
      (normDept && (dDept.includes(normDept) || normDept.includes(dDept)))
    );
  });

  let maxSeq = 0;
  const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  for (const d of deptDevices) {
    if (!d.deviceCode) continue;
    const match = d.deviceCode.trim().match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `${prefix}-${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Ensures standard Organization -> Directorate -> Department -> Division hierarchy exists in DB
 */
export async function ensureOrgHierarchySeeded(): Promise<void> {
  try {
    const allUnits = await db.select().from(departments);
    const hasOrg = allUnits.some(u => {
      try {
        if (u.description && u.description.includes('"orgType":"org"')) return true;
      } catch (_) {}
      return false;
    });

    if (!hasOrg) {
      console.log('⚡ Initializing full organizational hierarchy in DB...');
      
      const [rootOrg] = await db.insert(departments).values({
        name: 'General Telecommunications & Informatics Authority',
        description: JSON.stringify({
          nameAr: 'الهيئة العامة للاتصالات والمعلوماتية',
          orgType: 'org',
          description: 'الهيئة المركزية للاتصالات وتقنية المعلومات والتحول الرقمي للأصول والمؤسسات.'
        }),
        parentId: null,
        managerId: 'admin_uid_seed'
      }).returning();

      const [dirIT] = await db.insert(departments).values({
        name: 'Directorate of Information Technology & Cybersecurity',
        description: JSON.stringify({
          nameAr: 'دائرة تكنولوجيا المعلومات والأمن السيبراني',
          orgType: 'directorate',
          description: 'الإشراف على البنية التحتية للحوسبة والشبكات وأمن المعلومات وإدارة الأجهزة الإلكترونية.'
        }),
        parentId: rootOrg.id,
        managerId: 'admin_uid_seed'
      }).returning();

      const [dirOps] = await db.insert(departments).values({
        name: 'Directorate of Operations & Administrative Support',
        description: JSON.stringify({
          nameAr: 'دائرة العمليات والخدمات المساندة',
          orgType: 'directorate',
          description: 'إدارة العمليات الميدانية والخدمات اللوجستية والموارد البشرية ودعم العملاء.'
        }),
        parentId: rootOrg.id,
        managerId: 'admin_uid_seed'
      }).returning();

      for (const unit of allUnits) {
        let parentToAssign = dirOps.id;
        if (unit.name === 'Information Technology' || unit.name.includes('Technology') || unit.name.includes('Archiving')) {
          parentToAssign = dirIT.id;
        }
        await db.update(departments).set({ parentId: parentToAssign }).where(eq(departments.id, unit.id));
      }
    }
  } catch (err) {
    console.error('Error in ensureOrgHierarchySeeded:', err);
  }
}

/**
 * Ensures root storage directory "asset archive" exists
 */
export function ensureStorageRootExists(): string {
  if (!fs.existsSync(ASSET_ARCHIVE_STORAGE_DIR)) {
    fs.mkdirSync(ASSET_ARCHIVE_STORAGE_DIR, { recursive: true });
  }
  return ASSET_ARCHIVE_STORAGE_DIR;
}

/**
 * Resolve Directorate and Department Hierarchy from Database given a Department Name or ID.
 * Follows the user requirement:
 * 1. Root: Asset Archive (مجلد asset archive)
 * 2. Directorate Name (اسم الدائرة التابع لها القسم)
 * 3. Department Name (اسم القسم التابع له الموظف)
 * 4. Asset Folder (اسم المجلد حسب معرّف الأصل Asset ID)
 */
export async function resolveOrgHierarchyForDepartment(
  deptInput: string,
  divisionInput?: string,
  explicitOrg?: string,
  explicitDir?: string
): Promise<DeviceFolderHierarchy> {
  const normInput = (deptInput || '').trim().toLowerCase();
  
  let orgName = explicitOrg || 'الهيئة العامة للاتصالات والمعلوماتية';
  let orgNameEn = 'General Telecommunications & Informatics Authority';
  let dirName = explicitDir || 'دائرة تكنولوجيا المعلومات والأمن السيبراني';
  let dirNameEn = 'Directorate of Information Technology & Cybersecurity';
  let deptName = deptInput || 'تكنولوجيا المعلومات';
  let deptNameEn = 'Information Technology';
  let divName = divisionInput || '';
  let divNameEn = '';

  try {
    const allUnits = await db.select().from(departments);
    
    const parsedUnits = allUnits.map(u => {
      let descObj: any = {};
      try {
        if (u.description && u.description.startsWith('{')) {
          descObj = JSON.parse(u.description);
        }
      } catch (_) {}
      return {
        ...u,
        nameEn: u.name,
        nameAr: descObj.nameAr || u.name,
        orgType: descObj.orgType || 'department',
        parentId: u.parentId
      };
    });

    const unitMap = new Map<number, typeof parsedUnits[0]>();
    parsedUnits.forEach(u => unitMap.set(u.id, u));

    const matched = parsedUnits.find(u => 
      u.name.toLowerCase() === normInput || 
      u.nameAr.toLowerCase() === normInput ||
      u.name.toLowerCase().includes(normInput) ||
      normInput.includes(u.name.toLowerCase()) ||
      normInput.includes(u.nameAr.toLowerCase())
    );

    if (matched) {
      if (matched.orgType === 'division') {
        divName = matched.nameAr || matched.name;
        divNameEn = matched.name;
        if (matched.parentId && unitMap.has(matched.parentId)) {
          const parentDept = unitMap.get(matched.parentId)!;
          deptName = parentDept.nameAr || parentDept.name;
          deptNameEn = parentDept.name;
          
          if (parentDept.parentId && unitMap.has(parentDept.parentId)) {
            const parentDir = unitMap.get(parentDept.parentId)!;
            dirName = parentDir.nameAr || parentDir.name;
            dirNameEn = parentDir.name;
          }
        }
      } else if (matched.orgType === 'department') {
        deptName = matched.nameAr || matched.name;
        deptNameEn = matched.name;

        if (divisionInput) {
          divName = divisionInput;
        }

        if (matched.parentId && unitMap.has(matched.parentId)) {
          const parentDir = unitMap.get(matched.parentId)!;
          if (parentDir.orgType === 'directorate') {
            dirName = parentDir.nameAr || parentDir.name;
            dirNameEn = parentDir.name;
          }
        } else {
          // Contextual directorate fallback
          if (deptName.includes('عمليات') || deptName.includes('موارد') || deptName.includes('دعم') || deptNameEn.toLowerCase().includes('operations') || deptNameEn.toLowerCase().includes('human')) {
            dirName = 'دائرة العمليات والخدمات المساندة';
            dirNameEn = 'Directorate of Operations & Administrative Support';
          } else {
            dirName = 'دائرة تكنولوجيا المعلومات والأمن السيبراني';
            dirNameEn = 'Directorate of Information Technology & Cybersecurity';
          }
        }
      } else if (matched.orgType === 'directorate') {
        dirName = matched.nameAr || matched.name;
        dirNameEn = matched.name;
      }
    } else {
      if (normInput.includes('operat') || normInput.includes('عمليات') || normInput.includes('resource') || normInput.includes('موارد')) {
        dirName = 'دائرة العمليات والخدمات المساندة';
        dirNameEn = 'Directorate of Operations & Administrative Support';
        deptName = deptInput || 'العمليات والتنفيذ';
        deptNameEn = deptInput || 'Operations';
      } else {
        dirName = 'دائرة تكنولوجيا المعلومات والأمن السيبراني';
        dirNameEn = 'Directorate of Information Technology & Cybersecurity';
        deptName = deptInput || 'تكنولوجيا المعلومات';
        deptNameEn = deptInput || 'Information Technology';
      }
    }
  } catch (err) {
    console.error('Error resolving org hierarchy from DB:', err);
  }

  return {
    organization: orgName,
    organizationAr: orgName,
    directorate: dirName,
    directorateAr: dirName,
    department: deptName,
    departmentAr: deptName,
    division: divName || undefined,
    divisionAr: divName || undefined,
    deviceFolderName: '',
    relativePath: ''
  };
}

/**
 * Constructs the device folder name: strictly according to the Asset ID!
 * Requirement: "the asset folder name code is according to the asset ID"
 * e.g. "PR-001" or "PC-001"
 */
export function buildDeviceFolderName(deviceCode: string): string {
  const code = (deviceCode || 'ASSET').trim();
  return sanitizePathSegment(code);
}

/**
 * Computes the relative and absolute disk path for the device folder inside "asset archive".
 * Structure according to user brief:
 * [asset archive] / [Directorate Name] / [Department Name] / [Asset ID Folder]
 * Re-uses existing directorate and department folders if they already exist on disk.
 */
export function computeDeviceFolderPath(
  hierarchy: DeviceFolderHierarchy,
  deviceCode: string
): { relativePath: string; fullPath: string; deviceFolderName: string; segments: string[] } {
  ensureStorageRootExists();

  const deviceFolderName = buildDeviceFolderName(deviceCode);
  const rootDir = ASSET_ARCHIVE_STORAGE_DIR;

  // 1. Resolve Directorate folder: Check if existing folder exists on disk (Arabic or English)
  let dirSegment = sanitizePathSegment(hierarchy.directorateAr || hierarchy.directorate || 'Directorate');
  if (fs.existsSync(rootDir)) {
    const existingDirs = fs.readdirSync(rootDir);
    const candidateDirs = [hierarchy.directorateAr, hierarchy.directorate, hierarchy.directorate?.replace(/Directorate of /i, '')].filter(Boolean);
    const matched = existingDirs.find(d => 
      candidateDirs.some(c => c && d.toLowerCase() === sanitizePathSegment(c).toLowerCase())
    );
    if (matched) {
      dirSegment = matched;
    }
  }

  const dirFullPath = path.join(rootDir, dirSegment);

  // 2. Resolve Department folder: Check if existing department folder exists inside directorate folder
  let deptSegment = sanitizePathSegment(hierarchy.departmentAr || hierarchy.department || 'Department');
  if (fs.existsSync(dirFullPath)) {
    const existingDepts = fs.readdirSync(dirFullPath);
    const candidateDepts = [hierarchy.departmentAr, hierarchy.department].filter(Boolean);
    const matched = existingDepts.find(d => 
      candidateDepts.some(c => c && d.toLowerCase() === sanitizePathSegment(c).toLowerCase())
    );
    if (matched) {
      deptSegment = matched;
    }
  }

  const segments = [dirSegment, deptSegment, deviceFolderName];
  const relativePath = segments.join('/');
  const fullPath = path.join(rootDir, ...segments);

  return { relativePath, fullPath, deviceFolderName, segments };
}

/**
 * Creates the physical folders on disk according to:
 * asset archive -> directorate -> department -> asset folder
 * If directorate and department folders already exist, only creates the asset folder!
 * Stores purchase receipt, device specifications JSON, passport, and attachments inside.
 */
export async function createOrUpdateDeviceFolder(
  device: {
    id?: number | string;
    deviceCode: string;
    category?: string;
    deviceType?: string;
    brand: string;
    model: string;
    serialNumber?: string | null;
    dateOfPurchase?: string;
    warrantyStartDate?: string;
    warrantyPeriod?: string;
    department: string;
    departmentAr?: string | null;
    organization?: string | null;
    directorate?: string | null;
    division?: string | null;
    status?: string;
    ipAddress?: string | null;
    macAddress?: string | null;
    location?: string | null;
    assignedEmployee?: string | null;
    notes?: string | null;
    purchaseReceipt?: any;
  },
  existingReceiptDataUrl?: string
): Promise<{
  success: boolean;
  folderPath: string;
  relativePath: string;
  hierarchy: DeviceFolderHierarchy;
  files: string[];
}> {
  ensureStorageRootExists();

  // Resolve Directorate according to user's department
  const hierarchy = await resolveOrgHierarchyForDepartment(
    device.department,
    device.division || undefined,
    device.organization || undefined,
    device.directorate || undefined
  );

  const { relativePath, fullPath, deviceFolderName } = computeDeviceFolderPath(
    hierarchy,
    device.deviceCode
  );

  hierarchy.deviceFolderName = deviceFolderName;
  hierarchy.relativePath = relativePath;
  hierarchy.fullPath = fullPath;

  // 1. Check & create folders: if directorate & department exist, it only creates the asset folder inside
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }

  // 2. Save device specifications and metadata JSON inside the asset folder
  const deviceInfo = {
    assetId: device.deviceCode,
    deviceCode: device.deviceCode,
    category: device.category,
    deviceType: device.deviceType,
    brand: device.brand,
    model: device.model,
    serialNumber: device.serialNumber,
    dateOfPurchase: device.dateOfPurchase,
    warrantyStartDate: device.warrantyStartDate,
    warrantyPeriod: device.warrantyPeriod,
    status: device.status || 'Operational',
    ipAddress: device.ipAddress,
    macAddress: device.macAddress,
    location: device.location,
    assignedEmployee: device.assignedEmployee,
    hierarchy: {
      directorate: hierarchy.directorate,
      department: hierarchy.department,
      assetFolder: deviceFolderName,
      storageRoot: ASSET_ARCHIVE_STORAGE_DIR_NAME,
      relativePath
    },
    notes: device.notes,
    hasReceiptAttached: !!device.purchaseReceipt,
    lastSynchronizedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(fullPath, 'device_info.json'),
    JSON.stringify(deviceInfo, null, 2),
    'utf-8'
  );

  // 3. Save Device Asset Identification Passport
  const passportContent = `=====================================================
بطاقة الأصل والوثائق الرسمية | ASSET ARCHIVE PASSPORT
=====================================================
معرف الأصل / رمز الجهاز (Asset ID): ${device.deviceCode}
نوع الجهاز (Device Type): ${device.deviceType || 'Hardware'} (${device.category || 'electronic'})
العلامة التجارية والموديل: ${device.brand} ${device.model}
الرقم التسلسلي (Serial Number): ${device.serialNumber || 'N/A'}
حالة التشغيل (Status): ${device.status || 'Operational'}

مسار التخزين في أرشيف الأصول (Asset Archive Storage):
- الجذر (Root Archive): ${ASSET_ARCHIVE_STORAGE_DIR_NAME}
- الدائرة (Directorate): ${hierarchy.directorate}
- القسم (Department): ${hierarchy.department}
- مجلد الأصل (Asset Folder): ${deviceFolderName}
- المسار النسبي الكامل: ${relativePath}

بيانات الضمان والتشغيل:
- تاريخ الشراء: ${device.dateOfPurchase || 'N/A'}
- بداية الضمان: ${device.warrantyStartDate || 'N/A'}
- مدة الضمان: ${device.warrantyPeriod || 'N/A'}
- عنوان IP: ${device.ipAddress || 'N/A'}
- عنوان MAC: ${device.macAddress || 'N/A'}
- الموقع الفيزيائي: ${device.location || 'N/A'}
- الموظف المعين: ${device.assignedEmployee || 'Unassigned'}

المستندات المحفوظة:
- فاتورة الشراء الرسمية (Purchase Receipt)
- بطاقة المواصفات الرقمية (device_info.json)
=====================================================
`;
  fs.writeFileSync(path.join(fullPath, 'device_passport.txt'), passportContent, 'utf-8');

  // 4. Save purchase receipt and any documents inside the asset folder
  const receipt = device.purchaseReceipt;
  const dataUrl = existingReceiptDataUrl || (receipt && receipt.dataUrl);

  if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
    try {
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        let ext = '.pdf';
        if (mimeType.includes('png')) ext = '.png';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
        else if (mimeType.includes('webp')) ext = '.webp';

        const originalName = (receipt && receipt.name) ? receipt.name : `purchase_receipt${ext}`;
        const sanitizedReceiptName = sanitizePathSegment(originalName);
        const receiptFileName = sanitizedReceiptName.endsWith(ext) ? sanitizedReceiptName : `${sanitizedReceiptName}${ext}`;

        fs.writeFileSync(path.join(fullPath, receiptFileName), buffer);
      }
    } catch (receiptErr) {
      console.error('Failed to write purchase receipt in asset folder:', receiptErr);
    }
  }

  // 5. Read back list of files in folder
  const files = fs.readdirSync(fullPath);

  return {
    success: true,
    folderPath: fullPath,
    relativePath,
    hierarchy,
    files
  };
}

/**
 * List files inside an asset's physical folder
 */
export function listDeviceFolderFiles(folderFullPath: string): Array<{
  name: string;
  sizeBytes: number;
  sizeFormatted: string;
  modifiedAt: string;
  isReceipt: boolean;
  isMetadata: boolean;
  isPassport: boolean;
  downloadUrl: string;
}> {
  if (!fs.existsSync(folderFullPath)) {
    return [];
  }

  const fileNames = fs.readdirSync(folderFullPath);
  return fileNames.map(name => {
    const filePath = path.join(folderFullPath, name);
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (_) {
      stat = { size: 0, mtime: new Date() };
    }

    const isReceipt = name.toLowerCase().includes('receipt') || name.toLowerCase().includes('فاتورة');
    const isMetadata = name.toLowerCase() === 'device_info.json';
    const isPassport = name.toLowerCase() === 'device_passport.txt';

    const bytes = stat.size || 0;
    let sizeFormatted = `${bytes} B`;
    if (bytes >= 1024 * 1024) sizeFormatted = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    else if (bytes >= 1024) sizeFormatted = `${(bytes / 1024).toFixed(1)} KB`;

    return {
      name,
      sizeBytes: bytes,
      sizeFormatted,
      modifiedAt: stat.mtime ? stat.mtime.toISOString() : new Date().toISOString(),
      isReceipt,
      isMetadata,
      isPassport,
      downloadUrl: `/api/devices/folders/download?path=${encodeURIComponent(filePath)}`
    };
  });
}

/**
 * Sync all existing devices from the database into "asset archive" disk folders
 */
export async function syncAllExistingDevicesToDisk(): Promise<{ count: number; paths: string[] }> {
  ensureStorageRootExists();
  const allDevices = await db.select().from(electronicDevices);
  const paths: string[] = [];

  for (const dev of allDevices) {
    try {
      const res = await createOrUpdateDeviceFolder({
        id: dev.id,
        deviceCode: dev.deviceCode,
        category: dev.category,
        deviceType: dev.deviceType,
        brand: dev.brand,
        model: dev.model,
        serialNumber: dev.serialNumber,
        dateOfPurchase: dev.dateOfPurchase,
        warrantyStartDate: dev.warrantyStartDate,
        warrantyPeriod: dev.warrantyPeriod,
        department: dev.department,
        departmentAr: dev.departmentAr,
        organization: dev.organization,
        directorate: dev.directorate,
        division: dev.division,
        status: dev.status,
        ipAddress: dev.ipAddress,
        macAddress: dev.macAddress,
        location: dev.location,
        assignedEmployee: dev.assignedEmployee,
        notes: dev.notes,
        purchaseReceipt: dev.purchaseReceipt
      });

      if (!dev.folderPath || dev.folderPath !== res.relativePath) {
        await db.update(electronicDevices).set({
          directorate: res.hierarchy.directorate,
          folderPath: res.relativePath,
          folderHierarchy: res.hierarchy as any
        }).where(eq(electronicDevices.id, dev.id));
      }

      paths.push(res.relativePath);
    } catch (e) {
      console.error(`Failed to sync asset archive folder for device ${dev.deviceCode}:`, e);
    }
  }

  return { count: paths.length, paths };
}
