import BaseModel from './BaseModel.js';
import { query } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Chat Model
 * Handles chat threads and messages
 */
class Chat extends BaseModel {
  constructor() {
    super('chat_threads');
  }

  /**
   * Get thread by job ID
   * @param {string} jobId - Job ID
   * @returns {object|null} - Thread or null
   */
  async getThreadByJobId(jobId) {
    const result = await query(
      `SELECT ct.*, j.hirer_id, ja.caregiver_id
       FROM chat_threads ct
       JOIN jobs j ON j.id = ct.job_id
       LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       WHERE ct.job_id = $1`,
      [jobId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get thread with participants info
   * @param {string} threadId - Thread ID
   * @returns {object|null} - Thread with details
   */
  async getThreadWithDetails(threadId) {
    const result = await query(
      `SELECT
        ct.*,
        j.id as job_id,
        j.hirer_id,
        ja.caregiver_id,
        jp.title as job_title,
        jp.status as job_post_status,
        j.status as job_status,
        hp.display_name as hirer_name,
        cp.display_name as caregiver_name
       FROM chat_threads ct
       JOIN jobs j ON j.id = ct.job_id
       JOIN job_posts jp ON jp.id = j.job_post_id
       LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       LEFT JOIN hirer_profiles hp ON hp.user_id = j.hirer_id
       LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
       WHERE ct.id = $1`,
      [threadId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get threads for a user
   * @param {string} userId - User ID
   * @param {string} role - User role (hirer or caregiver)
   * @param {object} options - Pagination options
   * @returns {object} - Paginated threads
   */
  async getThreadsForUser(userId, role, options = {}) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let whereClause;
    if (role === 'hirer') {
      whereClause = 'j.hirer_id = $1';
    } else {
      whereClause = 'ja.caregiver_id = $1';
    }

    if (status) {
      whereClause += ` AND ct.status = '${status}'`;
    }

    const result = await query(
      `SELECT
        ct.*,
        jp.title as job_title,
        j.status as job_status,
        hp.display_name as hirer_name,
        cp.display_name as caregiver_name,
        (SELECT content FROM chat_messages WHERE thread_id = ct.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM chat_messages WHERE thread_id = ct.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM chat_messages WHERE thread_id = ct.id) as message_count
       FROM chat_threads ct
       JOIN jobs j ON j.id = ct.job_id
       JOIN job_posts jp ON jp.id = j.job_post_id
       LEFT JOIN job_assignments ja ON ja.job_id = j.id
       LEFT JOIN hirer_profiles hp ON hp.user_id = j.hirer_id
       LEFT JOIN caregiver_profiles cp ON cp.user_id = ja.caregiver_id
       WHERE ${whereClause}
       ORDER BY (SELECT created_at FROM chat_messages WHERE thread_id = ct.id ORDER BY created_at DESC LIMIT 1) DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(DISTINCT ct.id) as total
       FROM chat_threads ct
       JOIN jobs j ON j.id = ct.job_id
       LEFT JOIN job_assignments ja ON ja.job_id = j.id
       WHERE ${whereClause}`,
      [userId]
    );

    const total = parseInt(countResult.rows[0].total, 10);

    return {
      data: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new message
   * @param {object} messageData - Message data
   * @returns {object} - Created message
   */
  async createMessage(messageData) {
    const {
      thread_id,
      sender_id,
      type = 'text',
      content,
      attachment_key,
      is_system_message = false,
      metadata,
    } = messageData;

    const result = await query(
      `INSERT INTO chat_messages (id, thread_id, sender_id, type, content, attachment_key, is_system_message, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [uuidv4(), thread_id, sender_id, type, content, attachment_key || null, is_system_message, metadata ? JSON.stringify(metadata) : null]
    );

    // Update thread updated_at
    await query(
      `UPDATE chat_threads SET updated_at = NOW() WHERE id = $1`,
      [thread_id]
    );

    return result.rows[0];
  }

  /**
   * Get messages for a thread
   * @param {string} threadId - Thread ID
   * @param {object} options - Pagination options
   * @returns {object} - Paginated messages
   */
  async getMessages(threadId, options = {}) {
    const { page = 1, limit = 50, before, after } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'cm.thread_id = $1';
    const values = [threadId];
    let paramIndex = 2;

    if (before) {
      whereClause += ` AND cm.created_at < $${paramIndex++}`;
      values.push(before);
    }

    if (after) {
      whereClause += ` AND cm.created_at > $${paramIndex++}`;
      values.push(after);
    }

    const result = await query(
      `SELECT
        cm.*,
        CASE
          WHEN cm.sender_id IS NULL THEN 'System'
          WHEN hp.display_name IS NOT NULL THEN hp.display_name
          WHEN cp.display_name IS NOT NULL THEN cp.display_name
          ELSE 'Unknown'
        END as sender_name,
        CASE
          WHEN cm.sender_id IS NULL THEN NULL
          WHEN hp.user_id IS NOT NULL THEN 'hirer'
          WHEN cp.user_id IS NOT NULL THEN 'caregiver'
          ELSE NULL
        END as sender_role
       FROM chat_messages cm
       LEFT JOIN hirer_profiles hp ON hp.user_id = cm.sender_id
       LEFT JOIN caregiver_profiles cp ON cp.user_id = cm.sender_id
       WHERE ${whereClause}
       ORDER BY cm.created_at ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM chat_messages WHERE thread_id = $1`,
      [threadId]
    );

    const total = parseInt(countResult.rows[0].total, 10);

    return {
      data: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get message by ID
   * @param {string} messageId - Message ID
   * @returns {object|null} - Message or null
   */
  async getMessageById(messageId) {
    const result = await query(
      `SELECT cm.*,
        CASE
          WHEN cm.sender_id IS NULL THEN 'System'
          WHEN hp.display_name IS NOT NULL THEN hp.display_name
          WHEN cp.display_name IS NOT NULL THEN cp.display_name
          ELSE 'Unknown'
        END as sender_name
       FROM chat_messages cm
       LEFT JOIN hirer_profiles hp ON hp.user_id = cm.sender_id
       LEFT JOIN caregiver_profiles cp ON cp.user_id = cm.sender_id
       WHERE cm.id = $1`,
      [messageId]
    );
    return result.rows[0] || null;
  }

  /**
   * Check if user can access thread
   * @param {string} threadId - Thread ID
   * @param {string} userId - User ID
   * @returns {boolean} - True if user can access
   */
  async canAccessThread(threadId, userId) {
    const result = await query(
      `SELECT ct.id
       FROM chat_threads ct
       JOIN jobs j ON j.id = ct.job_id
       LEFT JOIN job_assignments ja ON ja.job_id = j.id
       WHERE ct.id = $1 AND (j.hirer_id = $2 OR ja.caregiver_id = $2)`,
      [threadId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Close thread
   * @param {string} threadId - Thread ID
   * @returns {object} - Updated thread
   */
  async closeThread(threadId) {
    const result = await query(
      `UPDATE chat_threads
       SET status = 'closed', closed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [threadId]
    );
    return result.rows[0];
  }

  /**
   * Get recent messages count for notification
   * @param {string} threadId - Thread ID
   * @param {string} userId - User ID (to exclude own messages)
   * @param {Date} since - Since timestamp
   * @returns {number} - Unread message count
   */
  async getUnreadCount(threadId, userId, since) {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM chat_messages
       WHERE thread_id = $1
       AND (sender_id != $2 OR sender_id IS NULL)
       AND created_at > $3`,
      [threadId, userId, since]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Add system message to thread
   * @param {string} threadId - Thread ID
   * @param {string} content - Message content
   * @param {object} metadata - Optional metadata
   * @returns {object} - Created message
   */
  async addSystemMessage(threadId, content, metadata = null) {
    return await this.createMessage({
      thread_id: threadId,
      sender_id: null,
      type: 'system',
      content,
      is_system_message: true,
      metadata,
    });
  }
}

export default new Chat();
