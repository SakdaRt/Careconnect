import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import chatController from '../controllers/chatController.js';
import { requireAuth, requirePolicy } from '../middleware/auth.js';

const router = express.Router();

const chatUploadDir = path.join(process.env.UPLOAD_DIR || '/app/uploads', 'chat');
if (!fs.existsSync(chatUploadDir)) fs.mkdirSync(chatUploadDir, { recursive: true });

const chatImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, chatUploadDir),
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

/**
 * Chat Routes
 * Base path: /api/chat
 */

// ============================================================================
// Protected Routes (Authentication required)
// ============================================================================

/**
 * Get user's chat threads
 * GET /api/chat/threads
 * Headers: Authorization: Bearer <token>
 * Query: { page?, limit?, status? }
 */
router.get('/threads', requireAuth, requirePolicy('chat:access'), chatController.getThreads);

/**
 * Get thread by ID
 * GET /api/chat/threads/:threadId
 * Headers: Authorization: Bearer <token>
 */
router.get('/threads/:threadId', requireAuth, requirePolicy('chat:access'), chatController.getThread);

/**
 * Get messages for a thread
 * GET /api/chat/threads/:threadId/messages
 * Headers: Authorization: Bearer <token>
 * Query: { page?, limit?, before?, after? }
 */
router.get('/threads/:threadId/messages', requireAuth, requirePolicy('chat:access'), chatController.getMessages);

/**
 * Send a message
 * POST /api/chat/threads/:threadId/messages
 * Headers: Authorization: Bearer <token>
 * Body: { type?: 'text'|'image'|'file'|'location', content, attachment_key?, metadata? }
 */
router.post('/threads/:threadId/messages', requireAuth, requirePolicy('chat:access'), chatController.sendMessage);

/**
 * Mark messages as read
 * POST /api/chat/threads/:threadId/read
 * Headers: Authorization: Bearer <token>
 * Body: { message_id }
 */
router.post('/threads/:threadId/read', requireAuth, requirePolicy('chat:access'), chatController.markAsRead);

/**
 * Get unread count for a thread
 * GET /api/chat/threads/:threadId/unread
 * Headers: Authorization: Bearer <token>
 * Query: { since? }
 */
router.get('/threads/:threadId/unread', requireAuth, requirePolicy('chat:access'), chatController.getUnreadCount);

/**
 * Close a chat thread
 * POST /api/chat/threads/:threadId/close
 * Headers: Authorization: Bearer <token>
 */
router.post('/threads/:threadId/close', requireAuth, requirePolicy('chat:access'), chatController.closeThread);

/**
 * Upload an image to a chat thread
 * POST /api/chat/threads/:threadId/upload
 * Headers: Authorization: Bearer <token>
 * Body: multipart/form-data, field: file
 */
router.post('/threads/:threadId/upload', requireAuth, requirePolicy('chat:access'), (req, res, next) => {
  chatImageUpload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'อัปโหลดไฟล์ไม่สำเร็จ' });
    }
    next();
  });
}, chatController.uploadImage);

/**
 * Get or create thread for a job
 * POST /api/chat/job/:jobId/thread
 * Headers: Authorization: Bearer <token>
 */
router.post('/job/:jobId/thread', requireAuth, requirePolicy('chat:access'), chatController.getOrCreateJobThread);

/**
 * Get thread for a job
 * GET /api/chat/job/:jobId/thread
 * Headers: Authorization: Bearer <token>
 */
router.get('/job/:jobId/thread', requireAuth, requirePolicy('chat:access'), chatController.getJobThread);

export default router;
