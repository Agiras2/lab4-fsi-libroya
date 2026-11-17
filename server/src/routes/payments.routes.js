import { Router } from 'express';
import {
  createPayPalOrder,
  capturePayPalOrder,
} from '../controllers/payments.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/paypal/order', authenticate, createPayPalOrder);
router.post('/paypal/capture', authenticate, capturePayPalOrder);

export default router;

