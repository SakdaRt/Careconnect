import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';
import { requireAuth, requirePolicy } from '../middleware/auth.js';
import { validateParams, validateBody, commonSchemas } from '../utils/validation.js';
import {
  createDispute,
  getDisputeByJob,
  getDispute,
  postMessage,
  requestClose,
  uploadDisputeImage,
} from '../controllers/disputeController.js';

const router = express.Router();

const disputeUploadDir = path.join(process.env.UPLOAD_DIR || '/app/uploads', 'disputes');
if (!fs.existsSync(disputeUploadDir)) fs.mkdirSync(disputeUploadDir, { recursive: true });

const disputeImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, disputeUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.bin';
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const uuidParams = Joi.object({ id: commonSchemas.uuid });
const jobIdParams = Joi.object({ jobId: commonSchemas.uuid });

const createDisputeBody = Joi.object({
  job_id: Joi.string().uuid().required(),
  reason: Joi.string().trim().min(1).max(2000).required(),
});

const postMessageBody = Joi.object({
  content: Joi.string().trim().max(2000).allow('').default(''),
  attachment_key: Joi.string().max(500).allow('', null),
  type: Joi.string().valid('text', 'image').default('text'),
});

const requestCloseBody = Joi.object({
  reason: Joi.string().trim().max(2000).allow(''),
});

router.post('/', requireAuth, requirePolicy('dispute:access'), validateBody(createDisputeBody), createDispute);
router.get('/by-job/:jobId', requireAuth, requirePolicy('dispute:access'), validateParams(jobIdParams), getDisputeByJob);
router.get('/:id', requireAuth, requirePolicy('dispute:access'), validateParams(uuidParams), getDispute);
router.post('/:id/messages', requireAuth, requirePolicy('dispute:access'), validateParams(uuidParams), validateBody(postMessageBody), postMessage);
router.post('/:id/request-close', requireAuth, requirePolicy('dispute:access'), validateParams(uuidParams), validateBody(requestCloseBody), requestClose);
router.post('/:id/upload', requireAuth, requirePolicy('dispute:access'), validateParams(uuidParams), (req, res, next) => {
  disputeImageUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message || 'อัปโหลดไฟล์ไม่สำเร็จ' });
    next();
  });
}, uploadDisputeImage);

export default router;

