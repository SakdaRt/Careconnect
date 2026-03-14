import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  createComplaint,
  getMyComplaints,
  getComplaint,
  adminListComplaints,
  adminUpdateComplaint,
} from '../controllers/complaintController.js';

const router = express.Router();

const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, 'complaints');
    import('fs').then((fs) => {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    });
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});

router.post('/', requireAuth, upload.array('attachments', 5), createComplaint);
router.get('/', requireAuth, getMyComplaints);
router.get('/:id', requireAuth, getComplaint);

router.get('/admin/list', requireAuth, requireRole('admin'), adminListComplaints);
router.post('/admin/:id', requireAuth, requireRole('admin'), adminUpdateComplaint);

export default router;
