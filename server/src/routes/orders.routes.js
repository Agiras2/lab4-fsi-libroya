import { Router } from 'express';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  listAdminOrders,
  updateShipmentStatus,
} from '../controllers/orders.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

// Rutas de cliente
router.post('/', authenticate, requireRole('cliente', 'admin'), createOrder);
router.get('/me', authenticate, getMyOrders);
router.get('/:id', authenticate, getOrderById);

// Rutas de admin
router.get('/', authenticate, requireRole('admin'), listAdminOrders);
router.patch('/:id/shipment-status', authenticate, requireRole('admin'), updateShipmentStatus);

export default router;

