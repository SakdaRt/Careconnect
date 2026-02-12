import express from 'express';
import kycController from '../controllers/kycController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/status', requireAuth, kycController.getStatus);
router.post('/mock/submit', requireAuth, kycController.submitMock);

export default router;
