import { Notification } from '../models/Notification.js';
import { emitToUserRoom } from '../sockets/realtimeHub.js';
import { query } from '../utils/db.js';

/**
 * Create an in-app notification
 */
const getMockProviderBaseUrl = () => process.env.MOCK_PROVIDER_BASE_URL || process.env.MOCK_PROVIDER_URL || 'http://mock-provider:4000';

const getEmailProvider = () => String(process.env.EMAIL_PROVIDER || 'mock').toLowerCase();

const ensureNotificationPreferences = async (userId) => {
  await query(
    `INSERT INTO notification_preferences (user_id, email_enabled, push_enabled, created_at, updated_at)
     VALUES ($1, false, false, NOW(), NOW())
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
};

const safeGetPreferences = async (userId) => {
  try {
    await ensureNotificationPreferences(userId);
    const result = await query(
      `SELECT email_enabled, push_enabled
       FROM notification_preferences
       WHERE user_id = $1`,
      [userId]
    );
    const row = result.rows[0] || {};
    return {
      email_enabled: Boolean(row.email_enabled),
      push_enabled: Boolean(row.push_enabled),
    };
  } catch (error) {
    if (error && typeof error === 'object' && String(error.code || '') === '42P01') {
      return {
        email_enabled: false,
        push_enabled: false,
      };
    }
    throw error;
  }
};

const sendEmailNotification = async ({ userId, title, body }) => {
  const userResult = await query(
    `SELECT email, is_email_verified
     FROM users
     WHERE id = $1`,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user?.email || user.is_email_verified !== true) {
    return { sent: false };
  }

  const provider = getEmailProvider();

  if (provider === 'smtp') {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@careconnect.local',
      to: user.email,
      subject: title,
      text: body,
      html: `<div style="font-family:Sarabun,'Noto Sans Thai',sans-serif;line-height:1.6"><h2 style="margin-bottom:12px">${title}</h2><p>${body}</p></div>`,
    });

    return { sent: true, provider: 'smtp' };
  }

  try {
    await fetch(`${getMockProviderBaseUrl()}/email/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        otp_code: String(Date.now()).slice(-6),
      }),
    });
  } catch {
    console.log(`[Notification] Mock email provider unavailable; fallback console send to ${user.email}`);
  }

  console.log(`[Notification] Email notification (mock) to ${user.email}: ${title}`);
  return { sent: true, provider: 'mock' };
};

export const createNotification = async ({ userId, templateKey, title, body, data, referenceType, referenceId }) => {
  let notification = null;
  try {
    notification = await Notification.create({
      userId,
      channel: 'in_app',
      templateKey,
      title,
      body,
      data,
      referenceType,
      referenceId,
    });
  } catch (dbErr) {
    console.error('[Notification] DB save failed, falling back to socket-only:', dbErr.message);
  }

  // Always emit to socket so real-time toast still shows even if DB is slow/failed
  emitToUserRoom(userId, 'notification:new', {
    notification: notification ?? {
      id: null,
      user_id: userId,
      channel: 'in_app',
      template_key: templateKey,
      title,
      body,
      data: data ?? null,
      reference_type: referenceType ?? null,
      reference_id: referenceId ?? null,
      status: 'sent',
      created_at: new Date().toISOString(),
    },
  });

  try {
    const preferences = await safeGetPreferences(userId);

    if (preferences.email_enabled) {
      await sendEmailNotification({ userId, title, body });
      await Notification.create({
        userId,
        channel: 'email',
        templateKey,
        title,
        body,
        data,
        referenceType,
        referenceId,
      });
    }

    if (preferences.push_enabled) {
      await Notification.create({
        userId,
        channel: 'push',
        templateKey,
        title,
        body,
        data,
        referenceType,
        referenceId,
      });

      emitToUserRoom(userId, 'notification:push', {
        notification: {
          id: null,
          user_id: userId,
          channel: 'push',
          template_key: templateKey,
          title,
          body,
          data: data ?? null,
          reference_type: referenceType ?? null,
          reference_id: referenceId ?? null,
          status: 'sent',
          created_at: new Date().toISOString(),
        },
      });
    }
  } catch (deliveryError) {
    console.error('[Notification] Multi-channel delivery failed:', deliveryError.message);
  }

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

export const getNotificationPreferences = async (userId) => {
  const preferences = await safeGetPreferences(userId);
  return {
    email_enabled: preferences.email_enabled,
    push_enabled: preferences.push_enabled,
  };
};

export const updateNotificationPreferences = async (userId, { email_enabled, push_enabled }) => {
  await ensureNotificationPreferences(userId);

  const result = await query(
    `UPDATE notification_preferences
     SET email_enabled = $2,
         push_enabled = $3,
         updated_at = NOW()
     WHERE user_id = $1
     RETURNING user_id, email_enabled, push_enabled, updated_at`,
    [userId, Boolean(email_enabled), Boolean(push_enabled)]
  );

  return result.rows[0];
};

export const savePushSubscription = async (userId, subscription, userAgent = null) => {
  const endpoint = String(subscription?.endpoint || '');
  const p256dh = String(subscription?.keys?.p256dh || '');
  const auth = String(subscription?.keys?.auth || '');

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Invalid push subscription payload');
  }

  const result = await query(
    `INSERT INTO push_subscriptions (
       user_id,
       endpoint,
       p256dh_key,
       auth_key,
       user_agent,
       is_active,
       created_at,
       updated_at,
       last_seen_at
     ) VALUES (
       $1, $2, $3, $4, $5, true, NOW(), NOW(), NOW()
     )
     ON CONFLICT (user_id, endpoint)
     DO UPDATE SET
       p256dh_key = EXCLUDED.p256dh_key,
       auth_key = EXCLUDED.auth_key,
       user_agent = EXCLUDED.user_agent,
       is_active = true,
       updated_at = NOW(),
       last_seen_at = NOW()
     RETURNING id, user_id, endpoint, is_active, updated_at, last_seen_at`,
    [userId, endpoint, p256dh, auth, userAgent]
  );

  return result.rows[0];
};

export const removePushSubscription = async (userId, endpoint) => {
  const result = await query(
    `UPDATE push_subscriptions
     SET is_active = false,
         updated_at = NOW()
     WHERE user_id = $1
       AND endpoint = $2
     RETURNING id, user_id, endpoint, is_active, updated_at`,
    [userId, endpoint]
  );

  return result.rows[0] || null;
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
 * Notify caregiver when a hirer directly assigns a job to them
 */
export const notifyJobAssigned = async (caregiverId, jobTitle, hirerName, jobPostId) => {
  return await createNotification({
    userId: caregiverId,
    templateKey: 'job_assigned',
    title: 'มีงานมอบหมายมาให้คุณ',
    body: `${hirerName || 'ผู้ว่าจ้าง'} มอบหมายงาน "${jobTitle}" ให้คุณ กรุณาตอบรับหรือปฏิเสธ`,
    data: { jobPostId, hirerName },
    referenceType: 'job',
    referenceId: jobPostId,
  });
};

/**
 * Notify hirer when caregiver requests early checkout
 */
export const notifyEarlyCheckoutRequest = async (hirerId, jobTitle, caregiverName, jobPostId) => {
  return await createNotification({
    userId: hirerId,
    templateKey: 'early_checkout_request',
    title: 'ผู้ดูแลขอส่งงานก่อนเวลา',
    body: `${caregiverName} ขอส่งงาน "${jobTitle}" ก่อนเวลาสิ้นสุด กรุณาตรวจสอบและอนุมัติ`,
    data: { jobPostId },
    referenceType: 'job',
    referenceId: jobPostId,
  });
};

/**
 * Notify caregiver when hirer approves early checkout
 */
export const notifyEarlyCheckoutApproved = async (caregiverId, jobTitle, jobId) => {
  return await createNotification({
    userId: caregiverId,
    templateKey: 'early_checkout_approved',
    title: 'อนุมัติส่งงานก่อนเวลาแล้ว',
    body: `ผู้ว่าจ้างอนุมัติให้ส่งงาน "${jobTitle}" ก่อนเวลาแล้ว ระบบดำเนินการเช็คเอาต์ให้เรียบร้อย`,
    data: { jobId },
    referenceType: 'job',
    referenceId: jobId,
  });
};

/**
 * Notify caregiver when hirer rejects early checkout
 */
export const notifyEarlyCheckoutRejected = async (caregiverId, jobTitle, jobPostId, reason) => {
  return await createNotification({
    userId: caregiverId,
    templateKey: 'early_checkout_rejected',
    title: 'ไม่อนุมัติส่งงานก่อนเวลา',
    body: `ผู้ว่าจ้างไม่อนุมัติให้ส่งงาน "${jobTitle}" ก่อนเวลา${reason ? ': ' + reason : ''} กรุณาดูแลต่อจนถึงเวลาสิ้นสุด`,
    data: { jobPostId, reason },
    referenceType: 'job',
    referenceId: jobPostId,
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

/**
 * Notify user when top-up succeeds
 */
export const notifyTopupSuccess = async (userId, amount, topupId) => {
  return await createNotification({
    userId,
    templateKey: 'topup_success',
    title: 'เติมเงินสำเร็จ',
    body: `เติมเงิน ฿${Number(amount).toLocaleString()} เข้า wallet เรียบร้อยแล้ว`,
    data: { amount, topupId },
    referenceType: 'topup',
    referenceId: topupId ?? null,
  });
};

/**
 * Notify user when top-up fails or expires
 */
export const notifyTopupFailed = async (userId, amount, topupId) => {
  return await createNotification({
    userId,
    templateKey: 'topup_failed',
    title: 'เติมเงินไม่สำเร็จ',
    body: `การเติมเงิน ฿${Number(amount).toLocaleString()} ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง`,
    data: { amount, topupId },
    referenceType: 'topup',
    referenceId: topupId ?? null,
  });
};

/**
 * Notify both parties when a dispute is settled by admin
 */
export const notifyDisputeSettled = async (hirerId, caregiverId, refundAmount, payoutAmount, disputeId) => {
  const promises = [
    createNotification({
      userId: hirerId,
      templateKey: 'dispute_settled',
      title: 'การระงับข้อพิพาทเสร็จสิ้น',
      body: `Admin ตัดสินข้อพิพาทแล้ว${refundAmount > 0 ? ` คืนเงิน ฿${Number(refundAmount).toLocaleString()} เข้า wallet` : ''}`,
      data: { refundAmount, disputeId },
      referenceType: 'dispute',
      referenceId: disputeId,
    }),
    createNotification({
      userId: caregiverId,
      templateKey: 'dispute_settled',
      title: 'การระงับข้อพิพาทเสร็จสิ้น',
      body: `Admin ตัดสินข้อพิพาทแล้ว${payoutAmount > 0 ? ` โอนเงิน ฿${Number(payoutAmount).toLocaleString()} เข้า wallet` : ''}`,
      data: { payoutAmount, disputeId },
      referenceType: 'dispute',
      referenceId: disputeId,
    }),
  ];
  await Promise.allSettled(promises);
};

/**
 * Notify both parties when admin manually settles a job
 */
export const notifyJobSettled = async (hirerId, caregiverId, refundAmount, payoutAmount, jobId) => {
  const promises = [
    createNotification({
      userId: hirerId,
      templateKey: 'job_settled',
      title: 'Admin ตัดสินงานเสร็จสิ้น',
      body: `งานของคุณได้รับการตัดสินโดย admin${refundAmount > 0 ? ` คืนเงิน ฿${Number(refundAmount).toLocaleString()} เข้า wallet` : ''}`,
      data: { refundAmount, jobId },
      referenceType: 'job',
      referenceId: jobId,
    }),
    createNotification({
      userId: caregiverId,
      templateKey: 'job_settled',
      title: 'Admin ตัดสินงานเสร็จสิ้น',
      body: `งานของคุณได้รับการตัดสินโดย admin${payoutAmount > 0 ? ` โอนเงิน ฿${Number(payoutAmount).toLocaleString()} เข้า wallet` : ''}`,
      data: { payoutAmount, jobId },
      referenceType: 'job',
      referenceId: jobId,
    }),
  ];
  await Promise.allSettled(promises);
};

/**
 * Notify user when account is banned or suspended by admin
 */
export const notifyAccountBanned = async (userId, banType, reason) => {
  const messages = {
    suspend: { title: 'บัญชีถูกระงับชั่วคราว', body: `บัญชีของคุณถูกระงับชั่วคราว${reason ? ': ' + reason : ''} กรุณาติดต่อทีมงาน` },
    ban_job_create: { title: 'ถูกระงับการสร้างประกาศงาน', body: `บัญชีของคุณถูกระงับสิทธิ์สร้างประกาศงาน${reason ? ': ' + reason : ''}` },
    ban_job_accept: { title: 'ถูกระงับการรับงาน', body: `บัญชีของคุณถูกระงับสิทธิ์รับงาน${reason ? ': ' + reason : ''}` },
    ban_withdraw: { title: 'ถูกระงับการถอนเงิน', body: `บัญชีของคุณถูกระงับสิทธิ์ถอนเงิน${reason ? ': ' + reason : ''}` },
    delete: { title: 'บัญชีถูกปิด', body: `บัญชีของคุณถูกปิดโดย admin${reason ? ': ' + reason : ''}` },
  };
  const msg = messages[banType];
  if (!msg) return;
  return await createNotification({
    userId,
    templateKey: 'account_banned',
    title: msg.title,
    body: msg.body,
    data: { banType, reason: reason || null },
    referenceType: 'account',
    referenceId: userId,
  });
};

/**
 * Notify caregiver when their assigned job is cancelled due to score-based ban
 */
export const notifyScoreBanCancel = async (caregiverId, jobTitle, jobId) => {
  return await createNotification({
    userId: caregiverId,
    templateKey: 'job_cancelled',
    title: 'งานถูกยกเลิกเนื่องจากคะแนนต่ำ',
    body: `งาน "${jobTitle}" ถูกยกเลิกเนื่องจากคะแนนของคุณต่ำกว่าเกณฑ์`,
    data: { jobId, reason: 'score_ban' },
    referenceType: 'job',
    referenceId: jobId,
  });
};

/**
 * Notify caregiver when a hirer submits a review
 */
export const notifyReviewReceived = async (caregiverId, hirerName, rating, jobTitle) => {
  return await createNotification({
    userId: caregiverId,
    templateKey: 'review_received',
    title: 'มีรีวิวใหม่',
    body: `${hirerName || 'ผู้ว่าจ้าง'} ให้คะแนนคุณ ${rating}/5 สำหรับงาน "${jobTitle || 'งาน'}"`,
    data: { hirerName, rating, jobTitle },
    referenceType: 'review',
    referenceId: null,
  });
};

/**
 * Notify complaint reporter when admin updates complaint status
 */
export const notifyComplaintUpdated = async (reporterId, status, subject, complaintId) => {
  const statusLabels = {
    in_review: { title: 'เรื่องร้องเรียนอยู่ระหว่างพิจารณา', body: `เรื่องร้องเรียน "${subject}" กำลังได้รับการพิจารณาโดย admin` },
    resolved: { title: 'เรื่องร้องเรียนได้รับการแก้ไขแล้ว', body: `เรื่องร้องเรียน "${subject}" ได้รับการแก้ไขเรียบร้อยแล้ว` },
    dismissed: { title: 'เรื่องร้องเรียนถูกปิด', body: `เรื่องร้องเรียน "${subject}" ถูกปิดโดย admin` },
  };
  const msg = statusLabels[status];
  if (!msg) return;
  return await createNotification({
    userId: reporterId,
    templateKey: 'complaint_updated',
    title: msg.title,
    body: msg.body,
    data: { status, complaintId },
    referenceType: 'complaint',
    referenceId: complaintId,
  });
};

/**
 * Notify both parties when caregiver no-show triggers auto-cancel
 */
export const notifyNoShow = async (hirerId, caregiverId, jobTitle, jobId) => {
  const promises = [
    createNotification({
      userId: hirerId,
      templateKey: 'job_cancelled',
      title: 'ผู้ดูแลไม่มาตามนัด',
      body: `งาน "${jobTitle}" ถูกยกเลิกอัตโนมัติเนื่องจากผู้ดูแลไม่ check-in ภายใน 30 นาที คืนเงินเต็มจำนวนแล้ว`,
      data: { jobId, reason: 'caregiver_no_show' },
      referenceType: 'job',
      referenceId: jobId,
    }),
    createNotification({
      userId: caregiverId,
      templateKey: 'job_cancelled',
      title: 'งานถูกยกเลิกเนื่องจากไม่ check-in',
      body: `งาน "${jobTitle}" ถูกยกเลิกอัตโนมัติเนื่องจากไม่ check-in ภายใน 30 นาทีหลังเวลานัด`,
      data: { jobId, reason: 'caregiver_no_show' },
      referenceType: 'job',
      referenceId: jobId,
    }),
  ];
  await Promise.allSettled(promises);
};
