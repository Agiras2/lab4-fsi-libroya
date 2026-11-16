import { Router } from 'express';
import {
  listBooks, getBook, createBook, updateBook, updateStock,
} from '../controllers/books.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { optionalAuth } from '../middleware/optionalAuth.js';

const router = Router();

// Públicas (con auth opcional para que el admin vea inactivos)
router.get('/', optionalAuth, listBooks);
router.get('/:id', optionalAuth, getBook);

// Solo admin
router.post('/', authenticate, requireRole('admin'), createBook);
router.patch('/:id', authenticate, requireRole('admin'), updateBook);
router.patch('/:id/stock', authenticate, requireRole('admin'), updateStock);

export default router;

