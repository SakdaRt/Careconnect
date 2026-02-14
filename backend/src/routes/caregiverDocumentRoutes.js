import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import caregiverDocumentController from '../controllers/caregiverDocumentController.js';

const router = express.Router();

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
const docDir = path.join(uploadDir, 'caregiver-docs');
if (!fs.existsSync(docDir)) {
  fs.mkdirSync(docDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, docDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพ (JPEG, PNG, WebP) หรือ PDF'));
    }
  },
});

// Caregiver: list own documents
router.get('/', requireAuth, caregiverDocumentController.listMine);

// Caregiver: upload new document
router.post('/', requireAuth, upload.single('file'), caregiverDocumentController.upload);

// Caregiver: delete own document
router.delete('/:id', requireAuth, caregiverDocumentController.remove);

// Hirer/Admin: view caregiver's documents (gated by job assignment)
router.get('/by-caregiver/:caregiverId', requireAuth, caregiverDocumentController.listByCaregiver);

export default router;
