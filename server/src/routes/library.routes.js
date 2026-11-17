import { Router } from 'express';
import { getMyLibrary } from '../controllers/library.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getMyLibrary);

export default router;

