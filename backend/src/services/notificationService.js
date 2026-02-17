import { Notification } from '../models/Notification.js';
import { emitToUserRoom } from '../sockets/realtimeHub.js';

/**
 * Create an in-app notification
 */
export const createNotification = async ({ userId, templateKey, title, body, data, referenceType, referenceId }) => {
  const notification = await Notification.create({
    userId,
    channel: 'in_app',
    templateKey,
    title,
    body,
    data,
    referenceType,
    referenceId,
  });

  emitToUserRoom(userId, 'notification:new', { notification });
  return notification;
};

/**
 * Get notifications for a user
 */
export const getNotifications = async (userId, options = {}) => {
  return await Notification.getByUserId(userId, options);
};

/**
 * Mark notification as read
 */
export const markAsRead = async (notificationId, userId) => {
  return await Notification.markAsRead(notificationId, userId);
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (userId) => {
  return await Notification.markAllAsRead(userId);
};

/**
 * Clear notifications
 */
export const clearNotifications = async (userId, options = {}) => {
  return await Notification.clearByUserId(userId, options);
};

/**
 * Get unread count
 */
export const getUnreadCount = async (userId) => {
  return await Notification.getUnreadCount(userId);
};

// ============================================================================
// Notification triggers for job events
// ============================================================================

/**
 * Notify hirer when a caregiver accepts their job
 */
export const notifyJobAccepted = async (hirerId, jobTitle, caregiverName, jobId) => {
  return await createNotification({
    userId: hirerId,
    templateKey: 'job_accepted',
    title: 'มีผู้ดูแลรับงานแล้ว',
    body: `${caregiverName || 'ผู้ดูแล'} ได้รับงาน "${jobTitle}"`,
    data: { jobId, caregiverName },
    referenceType: 'job',
    referenceId: jobId,
  });
};

/**
 * Notify recipient when there is a new chat message
 */
export const notifyChatMessage = async (recipientId, senderName, jobTitle, jobId) => {
  const safeSenderName = senderName || 'คู่สนทนา';
  const safeJobTitle = jobTitle || 'งานของคุณ';

  return await createNotification({
    userId: recipientId,
    templateKey: 'chat_message',
    title: 'มีข้อความแชทใหม่',
    body: `${safeSenderName} ส่งข้อความใหม่เกี่ยวกับงาน "${safeJobTitle}"`,
    data: { jobId, senderName: safeSenderName },
    referenceType: 'job',
    referenceId: jobId,
  });
};

/**
 * Notify hirer when caregiver checks in
 */
export const notifyCheckIn = async (hirerId, jobTitle, caregiverName, jobId) => {
  return await createNotification({
    userId: hirerId,
    templateKey: 'job_started',
    title: 'ผู้ดูแลมาถึงที่หมายแล้ว',
    body: `${caregiverName || 'ผู้ดูแล'} มาถึงที่หมายแล้ว - งาน "${jobTitle}" เริ่มต้น`,
    data: { jobId, caregiverName },
    referenceType: 'job',
    referenceId: jobId,
  });
};

/**
 * Notify hirer when caregiver checks out
 */
export const notifyCheckOut = async (hirerId, jobTitle, caregiverName, jobId) => {
  return await createNotification({
    userId: hirerId,
    templateKey: 'job_completed',
    title: 'งานเสร็จสมบูรณ์',
    body: `${caregiverName || 'ผู้ดูแล'} ส่งงานเสร็จแล้ว - งาน "${jobTitle}" เสร็จสิ้น`,
    data: { jobId, caregiverName },
    referenceType: 'job',
    referenceId: jobId,
  });
};

/**
 * Notify caregiver when job is cancelled
 */
export const notifyJobCancelled = async (caregiverId, jobTitle, jobId, reason) => {
  return await createNotification({
    userId: caregiverId,
    templateKey: 'job_cancelled',
    title: 'งานถูกยกเลิก',
    body: `งาน "${jobTitle}" ถูกยกเลิก${reason ? ': ' + reason : ''}`,
    data: { jobId, reason },
    referenceType: 'job',
    referenceId: jobId,
  });
};
