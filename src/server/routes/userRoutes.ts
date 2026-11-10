// src/server/routes/userRoutes.ts
import { Router } from 'express';
import { UserController } from '../controllers/userController.ts';
import { requireAuth, requirePermission } from '../../middleware/auth.ts';

// The ROUTES layer maps specific HTTP verbs and URL paths to Controller methods.
const router = Router();

router.get('/', requireAuth, UserController.getAllUsers);
router.post('/', requireAuth, requirePermission('users.create'), UserController.createUser);
router.delete('/:id', requireAuth, requirePermission('users.delete'), UserController.deleteUser);
router.patch('/:id', requireAuth, requirePermission('users.update'), UserController.updateUser);

export default router;
