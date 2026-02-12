import express from 'express';
import chatController from '../controllers/chatController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

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
router.get('/threads', requireAuth, chatController.getThreads);

/**
 * Get thread by ID
 * GET /api/chat/threads/:threadId
 * Headers: Authorization: Bearer <token>
 */
router.get('/threads/:threadId', requireAuth, chatController.getThread);

/**
 * Get messages for a thread
 * GET /api/chat/threads/:threadId/messages
 * Headers: Authorization: Bearer <token>
 * Query: { page?, limit?, before?, after? }
 */
router.get('/threads/:threadId/messages', requireAuth, chatController.getMessages);

/**
 * Send a message
 * POST /api/chat/threads/:threadId/messages
 * Headers: Authorization: Bearer <token>
 * Body: { type?: 'text'|'image'|'file'|'location', content, attachment_key?, metadata? }
 */
router.post('/threads/:threadId/messages', requireAuth, chatController.sendMessage);

/**
 * Mark messages as read
 * POST /api/chat/threads/:threadId/read
 * Headers: Authorization: Bearer <token>
 * Body: { message_id }
 */
router.post('/threads/:threadId/read', requireAuth, chatController.markAsRead);

/**
 * Get unread count for a thread
 * GET /api/chat/threads/:threadId/unread
 * Headers: Authorization: Bearer <token>
 * Query: { since? }
 */
router.get('/threads/:threadId/unread', requireAuth, chatController.getUnreadCount);

/**
 * Close a chat thread
 * POST /api/chat/threads/:threadId/close
 * Headers: Authorization: Bearer <token>
 */
router.post('/threads/:threadId/close', requireAuth, chatController.closeThread);

/**
 * Get or create thread for a job
 * POST /api/chat/job/:jobId/thread
 * Headers: Authorization: Bearer <token>
 */
router.post('/job/:jobId/thread', requireAuth, chatController.getOrCreateJobThread);

/**
 * Get thread for a job
 * GET /api/chat/job/:jobId/thread
 * Headers: Authorization: Bearer <token>
 */
router.get('/job/:jobId/thread', requireAuth, chatController.getJobThread);

export default router;
