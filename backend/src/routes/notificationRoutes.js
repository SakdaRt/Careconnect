import express from 'express';
import { requireAuth, requirePolicy } from '../middleware/auth.js';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../controllers/notificationController.js';

const router = express.Router();

/**
 * Notification Routes
 * Base path: /api/notifications
 */

// GET /api/notifications - Get notifications for current user
router.get('/', requireAuth, getNotifications);

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', requireAuth, getUnreadCount);

// PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', requireAuth, markAllAsRead);

// PATCH /api/notifications/:id/read - Mark one as read
router.patch('/:id/read', requireAuth, markAsRead);

export default router;
