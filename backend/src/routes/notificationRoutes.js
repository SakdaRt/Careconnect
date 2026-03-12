import express from 'express';
import { requireAuth, requirePolicy } from '../middleware/auth.js';
import { validateBody, notificationSchemas } from '../utils/validation.js';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  clearNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  savePushSubscription,
  removePushSubscription,
} from '../controllers/notificationController.js';

const router = express.Router();

/**
 * Notification Routes
 * Base path: /api/notifications
 */

// GET /api/notifications - Get notifications for current user
router.get('/', requireAuth, requirePolicy('notification:read'), getNotifications);

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', requireAuth, requirePolicy('notification:read'), getUnreadCount);

// PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', requireAuth, requirePolicy('notification:update'), markAllAsRead);

// DELETE /api/notifications - Clear notifications
router.delete('/', requireAuth, requirePolicy('notification:update'), clearNotifications);

// PATCH /api/notifications/:id/read - Mark one as read
router.patch('/:id/read', requireAuth, requirePolicy('notification:update'), markAsRead);

router.get('/preferences', requireAuth, requirePolicy('notification:read'), getNotificationPreferences);

router.put(
  '/preferences',
  requireAuth,
  requirePolicy('notification:update'),
  validateBody(notificationSchemas.preferences),
  updateNotificationPreferences
);

router.post(
  '/push-subscriptions',
  requireAuth,
  requirePolicy('notification:update'),
  validateBody(notificationSchemas.pushSubscription),
  savePushSubscription
);

router.delete(
  '/push-subscriptions',
  requireAuth,
  requirePolicy('notification:update'),
  validateBody(notificationSchemas.pushSubscriptionDelete),
  removePushSubscription
);

export default router;
