// src/server/routes/userRoutes.ts
import { Router } from 'express';
import { UserController } from '../controllers/userController.ts';
import { requireAuth } from '../../middleware/auth.ts';

// The ROUTES layer maps specific HTTP verbs and URL paths to Controller methods.
const router = Router();

router.get('/', requireAuth, UserController.getAllUsers);
router.post('/', requireAuth, UserController.createUser);
router.delete('/:id', requireAuth, UserController.deleteUser);
router.patch('/:id', requireAuth, UserController.updateUser);

export default router;
