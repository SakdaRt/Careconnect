import express from 'express';
import careRecipientController from '../controllers/careRecipientController.js';
import { requireAuth, requirePolicy } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, requirePolicy('care-recipient:manage'), careRecipientController.listCareRecipients);
router.post('/', requireAuth, requirePolicy('care-recipient:manage'), careRecipientController.createCareRecipient);
router.get('/:id', requireAuth, requirePolicy('care-recipient:manage'), careRecipientController.getCareRecipient);
router.put('/:id', requireAuth, requirePolicy('care-recipient:manage'), careRecipientController.updateCareRecipient);
router.delete('/:id', requireAuth, requirePolicy('care-recipient:manage'), careRecipientController.deactivateCareRecipient);

export default router;
