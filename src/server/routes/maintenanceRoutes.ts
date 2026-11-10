// src/server/routes/maintenanceRoutes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { MaintenanceController } from '../controllers/maintenanceController.ts';

const router = Router();

router.use(requireAuth);

// Maintenance routes
router.get('/', MaintenanceController.getMaintenanceList);
router.get('/:id', MaintenanceController.getMaintenanceById);
router.post('/', MaintenanceController.createMaintenance);
router.put('/:id', MaintenanceController.updateMaintenance);
router.delete('/:id', MaintenanceController.deleteMaintenance);

export default router;
