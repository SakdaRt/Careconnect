import {
  getNotifications as getNotificationsService,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
  getUnreadCount as getUnreadCountService,
} from '../services/notificationService.js';

/**
 * Get notifications for the current user
 * GET /api/notifications
 */
export const getNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const { page, limit, unread_only } = req.query;

    const result = await getNotificationsService(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      unreadOnly: unread_only === 'true',
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
  }
};

/**
 * Get unread count
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;
    const count = await getUnreadCountService(userId);
    res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    console.error('getUnreadCount error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
  }
};

/**
 * Mark a notification as read
 * PATCH /api/notifications/:id/read
 */
export const markAsRead = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const notification = await markAsReadService(id, userId);
    if (!notification) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found' } });
    }

    res.status(200).json({ success: true, data: { notification } });
  } catch (error) {
    console.error('markAsRead error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
  }
};

/**
 * Mark all notifications as read
 * PATCH /api/notifications/read-all
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.userId;
    await markAllAsReadService(userId);
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('markAllAsRead error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
  }
};

export default { getNotifications, getUnreadCount, markAsRead, markAllAsRead };
