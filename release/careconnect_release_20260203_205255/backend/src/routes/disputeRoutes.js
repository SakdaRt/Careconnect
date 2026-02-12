import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createDispute,
  getDisputeByJob,
  getDispute,
  postMessage,
  requestClose,
} from '../controllers/disputeController.js';

const router = express.Router();

router.post('/', requireAuth, createDispute);
router.get('/by-job/:jobId', requireAuth, getDisputeByJob);
router.get('/:id', requireAuth, getDispute);
router.post('/:id/messages', requireAuth, postMessage);
router.post('/:id/request-close', requireAuth, requestClose);

export default router;

