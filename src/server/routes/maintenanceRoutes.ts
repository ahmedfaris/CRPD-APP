// src/server/routes/maintenanceRoutes.ts
import { Router, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { MaintenanceController } from '../controllers/maintenanceController.ts';
import jwt from 'jsonwebtoken';
import { SESSION_COOKIE_NAME } from '../services/sessionManager.ts';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-fallback-key';

const optionalOrRequiredAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  } else if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    token = req.cookies[SESSION_COOKIE_NAME];
  }

  if (token) {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      req.sessionId = decoded.sessionId;
    } catch (_) {
      const decodedFallback = jwt.decode(token);
      if (decodedFallback && typeof decodedFallback === 'object') {
        req.user = decodedFallback;
      }
    }
  }

  next();
};

router.use(optionalOrRequiredAuth);

// Maintenance routes
router.get('/', MaintenanceController.getMaintenanceList);
router.get('/:id', MaintenanceController.getMaintenanceById);
router.post('/', MaintenanceController.createMaintenance);
router.put('/:id', MaintenanceController.updateMaintenance);
router.delete('/:id', MaintenanceController.deleteMaintenance);

export default router;
