import express from 'express';
import careRecipientController from '../controllers/careRecipientController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, requireRole('hirer'), careRecipientController.listCareRecipients);
router.post('/', requireAuth, requireRole('hirer'), careRecipientController.createCareRecipient);
router.get('/:id', requireAuth, requireRole('hirer'), careRecipientController.getCareRecipient);
router.put('/:id', requireAuth, requireRole('hirer'), careRecipientController.updateCareRecipient);
router.delete('/:id', requireAuth, requireRole('hirer'), careRecipientController.deactivateCareRecipient);

export default router;

