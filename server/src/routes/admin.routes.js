import { Router } from 'express';
import { lowStock } from '../controllers/books.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.get('/low-stock', authenticate, requireRole('admin'), lowStock);

export default router;

