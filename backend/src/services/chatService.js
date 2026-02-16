import Chat from '../models/Chat.js';
import { query } from '../utils/db.js';
import { notifyChatMessage } from './notificationService.js';

/**
 * Chat Service
 * Handles business logic for chat threads and messages
 */
class ChatService {
  /**
   * Get or create chat thread for a job
   * @param {string} jobId - Job ID
   * @param {string} userId - User ID (must be hirer or caregiver)
   * @returns {object} - Thread with details
   */
  async getOrCreateThreadForJob(jobId, userId) {
    // jobId can be either jobs.id or job_posts.id
    // First try to find job by jobs.id, then by job_posts.id
    let assignmentResult = await query(
      `SELECT ja.caregiver_id, j.hirer_id, j.id as job_id
       FROM jobs j
       LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
       WHERE j.id = $1`,
      [jobId]
    );

    // If not found by jobs.id, try job_posts.id
    if (assignmentResult.rows.length === 0) {
      assignmentResult = await query(
        `SELECT ja.caregiver_id, j.hirer_id, j.id as job_id
         FROM jobs j
         LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status = 'active'
         WHERE j.job_post_id = $1`,
        [jobId]
      );
    }

    if (assignmentResult.rows.length === 0) {
      throw { status: 404, message: 'Job not found' };
    }

    const { hirer_id, caregiver_id, job_id: actualJobId } = assignmentResult.rows[0];

    // Check if user is hirer or caregiver
    if (userId !== hirer_id && userId !== caregiver_id) {
      throw { status: 403, message: 'You do not have access to this job chat' };
    }

    // Get existing thread or create new one (use actual job_id)
    let thread = await Chat.getThreadByJobId(actualJobId);

    if (!thread) {
      // Create new thread
      const threadResult = await query(
        `INSERT INTO chat_threads (id, job_id, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'open', NOW(), NOW())
         RETURNING *`,
        [actualJobId]
      );
      thread = threadResult.rows[0];

      // Add system message for thread creation
      await Chat.addSystemMessage(
        thread.id,
        'Chat thread created for this job.'
      );
    }

    // Return thread with details
    return await Chat.getThreadWithDetails(thread.id);
  }

  /**
   * Get user's chat threads
   * @param {string} userId - User ID
   * @param {string} role - User role
   * @param {object} options - Pagination options
   * @returns {object} - Paginated threads
   */
  async getUserThreads(userId, role, options = {}) {
    return await Chat.getThreadsForUser(userId, role, options);
  }

  /**
   * Get thread by ID with access check
   * @param {string} threadId - Thread ID
   * @param {string} userId - User ID
   * @returns {object} - Thread with details
   */
  async getThread(threadId, userId) {
    // Check access
    const hasAccess = await Chat.canAccessThread(threadId, userId);
    if (!hasAccess) {
      throw { status: 403, message: 'You do not have access to this chat' };
    }

    const thread = await Chat.getThreadWithDetails(threadId);
    if (!thread) {
      throw { status: 404, message: 'Thread not found' };
    }

    return thread;
  }

  /**
   * Send a message in a thread
   * @param {string} threadId - Thread ID
   * @param {string} senderId - Sender user ID
   * @param {object} messageData - Message data
   * @returns {object} - Created message
   */
  async sendMessage(threadId, senderId, messageData) {
    // Check access
    const hasAccess = await Chat.canAccessThread(threadId, senderId);
    if (!hasAccess) {
      throw { status: 403, message: 'You do not have access to this chat' };
    }

    // Check thread is active
    const thread = await Chat.getThreadWithDetails(threadId);
    if (!thread) {
      throw { status: 404, message: 'Thread not found' };
    }

    if (thread.status === 'closed') {
      throw { status: 400, message: 'Cannot send messages to a closed chat' };
    }

    if (thread.job_status === 'cancelled' || thread.job_post_status === 'cancelled') {
      throw { status: 400, message: 'Cannot send messages for a cancelled job' };
    }

    // Validate message type
    const validTypes = ['text', 'image', 'file', 'location'];
    const type = messageData.type || 'text';
    if (!validTypes.includes(type)) {
      throw { status: 400, message: `Invalid message type. Must be one of: ${validTypes.join(', ')}` };
    }

    // Validate content
    if (type === 'text' && (!messageData.content || messageData.content.trim().length === 0)) {
      throw { status: 400, message: 'Message content is required' };
    }

    if (type === 'text' && messageData.content.length > 5000) {
      throw { status: 400, message: 'Message content exceeds maximum length of 5000 characters' };
    }

    // Create message
    const message = await Chat.createMessage({
      thread_id: threadId,
      sender_id: senderId,
      type,
      content: messageData.content,
      attachment_key: messageData.attachment_key,
      metadata: messageData.metadata,
    });

    try {
      const isSenderHirer = thread.hirer_id === senderId;
      const recipientId = isSenderHirer ? thread.caregiver_id : thread.hirer_id;

      if (recipientId && recipientId !== senderId) {
        const senderDisplayName = isSenderHirer
          ? (thread.hirer_name || 'ผู้ว่าจ้าง')
          : (thread.caregiver_name || 'ผู้ดูแล');

        await notifyChatMessage(
          recipientId,
          senderDisplayName,
          thread.job_title,
          thread.job_id
        );
      }
    } catch (error) {
      console.error('Failed to send chat_message notification:', error?.message || error);
    }

    return message;
  }

  /**
   * Get messages for a thread
   * @param {string} threadId - Thread ID
   * @param {string} userId - User ID
   * @param {object} options - Pagination options
   * @returns {object} - Paginated messages
   */
  async getMessages(threadId, userId, options = {}) {
    // Check access
    const hasAccess = await Chat.canAccessThread(threadId, userId);
    if (!hasAccess) {
      throw { status: 403, message: 'You do not have access to this chat' };
    }

    return await Chat.getMessages(threadId, options);
  }

  /**
   * Get thread for a job
   * @param {string} jobId - Job ID
   * @param {string} userId - User ID
   * @returns {object|null} - Thread or null
   */
  async getThreadByJob(jobId, userId) {
    // Try to find thread by jobs.id first
    let thread = await Chat.getThreadByJobId(jobId);

    // If not found, try by job_posts.id
    if (!thread) {
      const jobResult = await query(
        `SELECT j.id FROM jobs j WHERE j.job_post_id = $1`,
        [jobId]
      );
      if (jobResult.rows.length > 0) {
        thread = await Chat.getThreadByJobId(jobResult.rows[0].id);
      }
    }

    if (!thread) {
      return null;
    }

    // Check access
    const hasAccess = await Chat.canAccessThread(thread.id, userId);
    if (!hasAccess) {
      throw { status: 403, message: 'You do not have access to this job chat' };
    }

    return await Chat.getThreadWithDetails(thread.id);
  }

  /**
   * Close a chat thread
   * @param {string} threadId - Thread ID
   * @param {string} userId - User ID (must be hirer or admin)
   * @returns {object} - Updated thread
   */
  async closeThread(threadId, userId) {
    // Get thread details
    const thread = await Chat.getThreadWithDetails(threadId);
    if (!thread) {
      throw { status: 404, message: 'Thread not found' };
    }

    // Only hirer can close thread (or admin, but we'll handle that later)
    if (thread.hirer_id !== userId) {
      throw { status: 403, message: 'Only the hirer can close this chat' };
    }

    // Close thread
    const closedThread = await Chat.closeThread(threadId);

    // Add system message
    await Chat.addSystemMessage(
      threadId,
      'Chat has been closed.'
    );

    return closedThread;
  }

  /**
   * Get unread message count for a user
   * @param {string} threadId - Thread ID
   * @param {string} userId - User ID
   * @param {Date} since - Last read timestamp
   * @returns {number} - Unread count
   */
  async getUnreadCount(threadId, userId, since) {
    // Check access
    const hasAccess = await Chat.canAccessThread(threadId, userId);
    if (!hasAccess) {
      throw { status: 403, message: 'You do not have access to this chat' };
    }

    return await Chat.getUnreadCount(threadId, userId, since);
  }

  /**
   * Mark messages as read
   * @param {string} threadId - Thread ID
   * @param {string} userId - User ID
   * @param {string} messageId - Last read message ID
   * @returns {object} - Updated read status
   */
  async markAsRead(threadId, userId, messageId) {
    // Check access
    const hasAccess = await Chat.canAccessThread(threadId, userId);
    if (!hasAccess) {
      throw { status: 403, message: 'You do not have access to this chat' };
    }

    // Get the message to validate it exists and belongs to thread
    const message = await Chat.getMessageById(messageId);
    if (!message || message.thread_id !== threadId) {
      throw { status: 404, message: 'Message not found' };
    }

    // Update or insert read receipt
    const result = await query(
      `INSERT INTO chat_message_delivery (id, message_id, user_id, read_at)
       VALUES (gen_random_uuid(), $1, $2, NOW())
       ON CONFLICT (message_id, user_id) DO UPDATE SET read_at = NOW()
       RETURNING *`,
      [messageId, userId]
    );

    return {
      thread_id: threadId,
      message_id: messageId,
      read_at: result.rows[0]?.read_at || new Date(),
    };
  }

  /**
   * Add system message to a job's chat
   * @param {string} jobId - Job ID
   * @param {string} content - Message content
   * @param {object} metadata - Optional metadata
   * @returns {object|null} - Created message or null if no thread
   */
  async addJobSystemMessage(jobId, content, metadata = null) {
    const thread = await Chat.getThreadByJobId(jobId);
    if (!thread) {
      return null;
    }

    return await Chat.addSystemMessage(thread.id, content, metadata);
  }
}

export default new ChatService();
