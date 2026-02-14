import { query } from '../utils/db.js';

class NotificationModel {
  /**
   * Create a new notification
   */
  async create({ userId, channel = 'in_app', templateKey, title, body, data, referenceType, referenceId }) {
    const result = await query(
      `INSERT INTO notifications (user_id, channel, template_key, title, body, data, reference_type, reference_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sent', NOW())
       RETURNING *`,
      [userId, channel, templateKey, title, body, data ? JSON.stringify(data) : null, referenceType || null, referenceId || null]
    );
    return result.rows[0];
  }

  /**
   * Get notifications for a user (paginated)
   */
  async getByUserId(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    const offset = (page - 1) * limit;
    let whereClause = 'user_id = $1';
    const values = [userId];
    let paramIndex = 2;

    if (unreadOnly) {
      whereClause += ` AND status != 'read'`;
    }

    const result = await query(
      `SELECT * FROM notifications
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM notifications WHERE ${whereClause}`,
      values
    );

    const unreadResult = await query(
      `SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND status != 'read'`,
      [userId]
    );

    const total = parseInt(countResult.rows[0].total, 10);
    const unreadCount = parseInt(unreadResult.rows[0].unread, 10);

    return {
      data: result.rows,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId, userId) {
    const result = await query(
      `UPDATE notifications SET status = 'read', read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
      [notificationId, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    await query(
      `UPDATE notifications SET status = 'read', read_at = NOW() WHERE user_id = $1 AND status != 'read'`,
      [userId]
    );
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId) {
    const result = await query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND status != 'read'`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }
}

export const Notification = new NotificationModel();
export default Notification;
