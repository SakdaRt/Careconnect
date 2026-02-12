import jwt from 'jsonwebtoken';
import Chat from '../models/Chat.js';
import chatService from '../services/chatService.js';

/**
 * Chat Socket Handler
 * Handles real-time chat events via Socket.IO
 */

// Map of userId -> socket ids (user can have multiple connections)
const userSockets = new Map();

// Map of threadId -> Set of socket ids
const threadRooms = new Map();

/**
 * Initialize chat socket handlers
 * @param {Server} io - Socket.IO server instance
 */
export function initChatSocket(io) {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
      socket.userId = decoded.userId || decoded.id || decoded.sub;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Chat] User ${socket.userId} connected (socket: ${socket.id})`);

    // Track user socket
    if (!userSockets.has(socket.userId)) {
      userSockets.set(socket.userId, new Set());
    }
    userSockets.get(socket.userId).add(socket.id);

    // Join thread room
    socket.on('thread:join', async (threadId) => {
      try {
        // Verify access
        const hasAccess = await Chat.canAccessThread(threadId, socket.userId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to thread' });
          return;
        }

        // Join the room
        socket.join(`thread:${threadId}`);

        // Track in our map
        if (!threadRooms.has(threadId)) {
          threadRooms.set(threadId, new Set());
        }
        threadRooms.get(threadId).add(socket.id);

        console.log(`[Chat] User ${socket.userId} joined thread ${threadId}`);
        socket.emit('thread:joined', { threadId });
      } catch (error) {
        console.error('[Chat] Error joining thread:', error);
        socket.emit('error', { message: 'Failed to join thread' });
      }
    });

    // Leave thread room
    socket.on('thread:leave', (threadId) => {
      socket.leave(`thread:${threadId}`);

      if (threadRooms.has(threadId)) {
        threadRooms.get(threadId).delete(socket.id);
      }

      console.log(`[Chat] User ${socket.userId} left thread ${threadId}`);
      socket.emit('thread:left', { threadId });
    });

    // Send message
    socket.on('message:send', async (data) => {
      try {
        const { threadId, type, content, attachment_key, metadata } = data;

        // Create message via service (handles validation)
        const message = await chatService.sendMessage(threadId, socket.userId, {
          type: type || 'text',
          content,
          attachment_key,
          metadata,
        });

        // Emit to all users in the thread room
        io.to(`thread:${threadId}`).emit('message:new', message);

        console.log(`[Chat] Message sent in thread ${threadId} by user ${socket.userId}`);
      } catch (error) {
        console.error('[Chat] Error sending message:', error);
        socket.emit('error', { message: error.message || 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing:start', async (threadId) => {
      try {
        const hasAccess = await Chat.canAccessThread(threadId, socket.userId);
        if (!hasAccess) return;

        socket.to(`thread:${threadId}`).emit('typing:started', {
          threadId,
          userId: socket.userId,
        });
      } catch (error) {
        console.error('[Chat] Error with typing indicator:', error);
      }
    });

    socket.on('typing:stop', async (threadId) => {
      try {
        const hasAccess = await Chat.canAccessThread(threadId, socket.userId);
        if (!hasAccess) return;

        socket.to(`thread:${threadId}`).emit('typing:stopped', {
          threadId,
          userId: socket.userId,
        });
      } catch (error) {
        console.error('[Chat] Error with typing indicator:', error);
      }
    });

    // Mark messages as read
    socket.on('message:read', async (data) => {
      try {
        const { threadId, messageId } = data;

        await chatService.markAsRead(threadId, socket.userId, messageId);

        // Notify other users in the thread
        socket.to(`thread:${threadId}`).emit('message:read', {
          threadId,
          messageId,
          userId: socket.userId,
          readAt: new Date(),
        });
      } catch (error) {
        console.error('[Chat] Error marking message as read:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[Chat] User ${socket.userId} disconnected (socket: ${socket.id})`);

      // Remove from user sockets
      if (userSockets.has(socket.userId)) {
        userSockets.get(socket.userId).delete(socket.id);
        if (userSockets.get(socket.userId).size === 0) {
          userSockets.delete(socket.userId);
        }
      }

      // Remove from all thread rooms
      for (const [threadId, sockets] of threadRooms.entries()) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          threadRooms.delete(threadId);
        }
      }
    });
  });

  console.log('[Chat] Socket handler initialized');
}

/**
 * Send a message to all sockets of a specific user
 * @param {Server} io - Socket.IO server instance
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {any} data - Event data
 */
export function emitToUser(io, userId, event, data) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      io.to(socketId).emit(event, data);
    }
  }
}

/**
 * Broadcast a message to all users in a thread
 * @param {Server} io - Socket.IO server instance
 * @param {string} threadId - Thread ID
 * @param {string} event - Event name
 * @param {any} data - Event data
 */
export function emitToThread(io, threadId, event, data) {
  io.to(`thread:${threadId}`).emit(event, data);
}

export default { initChatSocket, emitToUser, emitToThread };
