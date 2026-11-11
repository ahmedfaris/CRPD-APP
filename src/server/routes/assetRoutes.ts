// src/server/routes/assetRoutes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { requireDeviceManager } from '../utils/deviceAccess.ts';
import { MaintenanceController } from '../controllers/maintenanceController.ts';

const router = Router();

router.use(requireAuth);

router.get('/', MaintenanceController.getAssetsList);
router.post('/', requireDeviceManager, MaintenanceController.createAsset);

export default router;
