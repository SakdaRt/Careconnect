import express from 'express';
import Joi from 'joi';
import { requireAuth, requirePolicy } from '../middleware/auth.js';
import { validateParams, validateBody, commonSchemas } from '../utils/validation.js';
import {
  createDispute,
  getDisputeByJob,
  getDispute,
  postMessage,
  requestClose,
} from '../controllers/disputeController.js';

const router = express.Router();

const uuidParams = Joi.object({ id: commonSchemas.uuid });
const jobIdParams = Joi.object({ jobId: commonSchemas.uuid });

const createDisputeBody = Joi.object({
  job_id: Joi.string().uuid().required(),
  reason: Joi.string().trim().min(1).max(2000).required(),
});

const postMessageBody = Joi.object({
  content: Joi.string().trim().min(1).max(2000).required(),
});

const requestCloseBody = Joi.object({
  reason: Joi.string().trim().max(2000).allow(''),
});

router.post('/', requireAuth, requirePolicy('dispute:access'), validateBody(createDisputeBody), createDispute);
router.get('/by-job/:jobId', requireAuth, requirePolicy('dispute:access'), validateParams(jobIdParams), getDisputeByJob);
router.get('/:id', requireAuth, requirePolicy('dispute:access'), validateParams(uuidParams), getDispute);
router.post('/:id/messages', requireAuth, requirePolicy('dispute:access'), validateParams(uuidParams), validateBody(postMessageBody), postMessage);
router.post('/:id/request-close', requireAuth, requirePolicy('dispute:access'), validateParams(uuidParams), validateBody(requestCloseBody), requestClose);

export default router;

