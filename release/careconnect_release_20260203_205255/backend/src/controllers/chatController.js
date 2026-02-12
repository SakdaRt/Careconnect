import chatService from '../services/chatService.js';

/**
 * Chat Controller
 * Handles HTTP requests for chat operations
 */
const chatController = {
  /**
   * Get user's chat threads
   * GET /api/chat/threads
   */
  async getThreads(req, res, next) {
    try {
      const userId = req.user.id;
      const role = req.user.role;
      const { page, limit, status } = req.query;

      const threads = await chatService.getUserThreads(userId, role, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status,
      });

      res.json({
        success: true,
        ...threads,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get thread by ID
   * GET /api/chat/threads/:threadId
   */
  async getThread(req, res, next) {
    try {
      const userId = req.user.id;
      const { threadId } = req.params;

      const thread = await chatService.getThread(threadId, userId);

      res.json({
        success: true,
        thread,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Get or create thread for a job
   * POST /api/chat/job/:jobId/thread
   */
  async getOrCreateJobThread(req, res, next) {
    try {
      const userId = req.user.id;
      const { jobId } = req.params;

      const thread = await chatService.getOrCreateThreadForJob(jobId, userId);

      res.json({
        success: true,
        thread,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Get thread for a job
   * GET /api/chat/job/:jobId/thread
   */
  async getJobThread(req, res, next) {
    try {
      const userId = req.user.id;
      const { jobId } = req.params;

      const thread = await chatService.getThreadByJob(jobId, userId);

      if (!thread) {
        return res.status(404).json({
          success: false,
          error: 'No chat thread exists for this job',
        });
      }

      res.json({
        success: true,
        thread,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Get messages for a thread
   * GET /api/chat/threads/:threadId/messages
   */
  async getMessages(req, res, next) {
    try {
      const userId = req.user.id;
      const { threadId } = req.params;
      const { page, limit, before, after } = req.query;

      const messages = await chatService.getMessages(threadId, userId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        before,
        after,
      });

      res.json({
        success: true,
        ...messages,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Send a message
   * POST /api/chat/threads/:threadId/messages
   */
  async sendMessage(req, res, next) {
    try {
      const userId = req.user.id;
      const { threadId } = req.params;
      const { type, content, attachment_key, metadata } = req.body;

      const message = await chatService.sendMessage(threadId, userId, {
        type,
        content,
        attachment_key,
        metadata,
      });

      res.status(201).json({
        success: true,
        message,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Mark messages as read
   * POST /api/chat/threads/:threadId/read
   */
  async markAsRead(req, res, next) {
    try {
      const userId = req.user.id;
      const { threadId } = req.params;
      const { message_id } = req.body;

      if (!message_id) {
        return res.status(400).json({
          success: false,
          error: 'message_id is required',
        });
      }

      const result = await chatService.markAsRead(threadId, userId, message_id);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Get unread count for a thread
   * GET /api/chat/threads/:threadId/unread
   */
  async getUnreadCount(req, res, next) {
    try {
      const userId = req.user.id;
      const { threadId } = req.params;
      const { since } = req.query;

      const sinceDate = since ? new Date(since) : new Date(0);
      const count = await chatService.getUnreadCount(threadId, userId, sinceDate);

      res.json({
        success: true,
        unread_count: count,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * Close a chat thread
   * POST /api/chat/threads/:threadId/close
   */
  async closeThread(req, res, next) {
    try {
      const userId = req.user.id;
      const { threadId } = req.params;

      const thread = await chatService.closeThread(threadId, userId);

      res.json({
        success: true,
        thread,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  },
};

export default chatController;
