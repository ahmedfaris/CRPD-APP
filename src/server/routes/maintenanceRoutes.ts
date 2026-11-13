// src/server/routes/maintenanceRoutes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { requireDeviceManager, requireDeviceDeleter } from '../utils/deviceAccess.ts';
import { MaintenanceController } from '../controllers/maintenanceController.ts';

const router = Router();

router.use(requireAuth);

// Maintenance routes
router.get('/', MaintenanceController.getMaintenanceList);
router.get('/:id', MaintenanceController.getMaintenanceById);
router.post('/', requireDeviceManager, MaintenanceController.createMaintenance);
router.put('/:id', requireDeviceManager, MaintenanceController.updateMaintenance);
// Deleting a record needs the same right as deleting assets (matches the delete button in the UI).
router.delete('/:id', requireDeviceDeleter, MaintenanceController.deleteMaintenance);

export default router;
