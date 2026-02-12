import express from 'express';
import { requireAuth, requirePolicy } from '../middleware/auth.js';
import {
  createDispute,
  getDisputeByJob,
  getDispute,
  postMessage,
  requestClose,
} from '../controllers/disputeController.js';

const router = express.Router();

router.post('/', requireAuth, requirePolicy('dispute:access'), createDispute);
router.get('/by-job/:jobId', requireAuth, requirePolicy('dispute:access'), getDisputeByJob);
router.get('/:id', requireAuth, requirePolicy('dispute:access'), getDispute);
router.post('/:id/messages', requireAuth, requirePolicy('dispute:access'), postMessage);
router.post('/:id/request-close', requireAuth, requirePolicy('dispute:access'), requestClose);

export default router;

