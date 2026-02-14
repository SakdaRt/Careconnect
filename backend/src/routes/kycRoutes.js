import express from 'express';
import multer from 'multer';
import kycController from '../controllers/kycController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Multer config: store files in memory (we don't persist them — simulation only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพ (JPEG, PNG, WebP)'));
    }
  },
});

const kycUpload = upload.fields([
  { name: 'document_front', maxCount: 1 },
  { name: 'document_back', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
]);

router.get('/status', requireAuth, kycController.getStatus);
router.post('/mock/submit', requireAuth, kycController.submitMock);
router.post('/submit', requireAuth, kycUpload, kycController.submit);

export default router;
