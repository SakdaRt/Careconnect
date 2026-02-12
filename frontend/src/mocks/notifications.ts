// Notifications Mock Data
export type NotificationType =
  | 'job_posted'
  | 'job_accepted'
  | 'job_started'
  | 'job_completed'
  | 'job_cancelled'
  | 'message_received'
  | 'payment_received'
  | 'payment_sent'
  | 'profile_verified'
  | 'kyc_approved'
  | 'withdrawal_approved'
  | 'system_announcement';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string; // Navigate to this URL when clicked
  is_read: boolean;
  created_at: string;
}

export const mockNotifications: Record<string, Notification[]> = {
  'hirer-1': [
    {
      id: 'notif-h1-1',
      user_id: 'hirer-1',
      type: 'job_accepted',
      title: 'งานได้รับการยอมรับ',
      message: 'สมหญิง ดูแล ได้ยอมรับงาน "ดูแลคุณยายเช้า"',
      link: '/chat/job-4',
      is_read: true,
      created_at: '2026-01-09T14:00:00Z',
    },
    {
      id: 'notif-h1-2',
      user_id: 'hirer-1',
      type: 'job_started',
      title: 'งานเริ่มแล้ว',
      message: 'สมหญิง ดูแล เช็คอินแล้ว - งาน "ดูแลคุณยายวันนี้" เริ่มต้น',
      link: '/chat/job-5',
      is_read: true,
      created_at: '2026-01-09T08:05:00Z',
    },
    {
      id: 'notif-h1-3',
      user_id: 'hirer-1',
      type: 'message_received',
      title: 'ข้อความใหม่',
      message: 'สมหญิง ดูแล: กำลังดูแลคุณยายอยู่ค่ะ',
      link: '/chat/job-5',
      is_read: true,
      created_at: '2026-01-09T08:10:00Z',
    },
    {
      id: 'notif-h1-4',
      user_id: 'hirer-1',
      type: 'job_completed',
      title: 'งานเสร็จสมบูรณ์',
      message: 'งาน "ดูแลคุณยายเย็น (เสร็จแล้ว)" เสร็จสิ้นแล้ว',
      link: '/jobs/job-6',
      is_read: true,
      created_at: '2026-01-08T21:15:00Z',
    },
    {
      id: 'notif-h1-5',
      user_id: 'hirer-1',
      type: 'payment_sent',
      title: 'การชำระเงินสำเร็จ',
      message: 'จ่ายเงิน 400 บาท สำหรับงาน "ดูแลคุณยายเย็น"',
      link: '/wallet/transactions',
      is_read: true,
      created_at: '2026-01-08T21:15:00Z',
    },
    {
      id: 'notif-h1-6',
      user_id: 'hirer-1',
      type: 'message_received',
      title: 'ข้อความใหม่จากผู้ดูแล',
      message: 'สมหญิง ดูแล สนใจงาน "ดูแลคุณยายทั้งวัน"',
      link: '/chat/job-2',
      is_read: false,
      created_at: '2026-01-09T15:00:00Z',
    },
  ],

  'caregiver-1': [
    {
      id: 'notif-c1-1',
      user_id: 'caregiver-1',
      type: 'job_posted',
      title: 'งานใหม่ที่เหมาะกับคุณ',
      message: 'มีงานใหม่: "ดูแลคุณยายทั้งวัน" ที่บางนา',
      link: '/jobs/feed',
      is_read: true,
      created_at: '2026-01-09T11:00:00Z',
    },
    {
      id: 'notif-c1-2',
      user_id: 'caregiver-1',
      type: 'job_accepted',
      title: 'ข้อเสนอได้รับการยอมรับ',
      message: 'สมชาย ใจดี ยอมรับข้อเสนอของคุณสำหรับงาน "ดูแลคุณยายเช้า"',
      link: '/chat/job-4',
      is_read: true,
      created_at: '2026-01-09T14:00:00Z',
    },
    {
      id: 'notif-c1-3',
      user_id: 'caregiver-1',
      type: 'payment_received',
      title: 'รับเงินสำเร็จ',
      message: 'คุณได้รับเงิน 400 บาท จากงาน "ดูแลคุณยายเย็น"',
      link: '/wallet',
      is_read: true,
      created_at: '2026-01-08T21:15:00Z',
    },
    {
      id: 'notif-c1-4',
      user_id: 'caregiver-1',
      type: 'system_announcement',
      title: 'อย่าลืมเช็คอิน',
      message: 'งาน "ดูแลคุณยายเช้า" จะเริ่มในวันพรุ่งนี้ อย่าลืมเช็คอินตรงเวลานะคะ',
      link: '/jobs/my-jobs',
      is_read: true,
      created_at: '2026-01-09T18:00:00Z',
    },
    {
      id: 'notif-c1-5',
      user_id: 'caregiver-1',
      type: 'job_posted',
      title: 'งานใหม่ที่เหมาะกับคุณ',
      message: 'มีงานด่วน: "ดูแลคุณปู่ค้างคืน" ที่สุขุมวิท - ค่าแรงสูง',
      link: '/jobs/feed',
      is_read: false,
      created_at: '2026-01-09T12:00:00Z',
    },
  ],
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeNotifications(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitNotificationsChanged() {
  for (const listener of listeners) listener();
}

// Helper functions
export function getNotificationsByUserId(userId: string): Notification[] {
  return mockNotifications[userId] || [];
}

export function getUnreadCount(userId: string): number {
  const notifications = mockNotifications[userId] || [];
  return notifications.filter(n => !n.is_read).length;
}

export function markNotificationAsRead(notificationId: string, userId: string): void {
  const notifications = mockNotifications[userId];
  if (notifications) {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.is_read = true;
      emitNotificationsChanged();
    }
  }
}

export function markAllAsRead(userId: string): void {
  const notifications = mockNotifications[userId];
  if (notifications) {
    notifications.forEach(n => n.is_read = true);
    emitNotificationsChanged();
  }
}
