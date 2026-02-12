// Chat Messages Mock Data
export type MessageType = 'text' | 'system' | 'proposal' | 'image';

export interface ChatMessage {
  id: string;
  job_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'hirer' | 'caregiver' | 'system';
  message_type: MessageType;
  content: string;
  metadata?: {
    proposal_id?: string;
    pay_amount?: number;
    image_url?: string;
    system_event?: string;
  };
  is_read: boolean;
  created_at: string;
}

export const mockChatMessages: Record<string, ChatMessage[]> = {
  // Job 4 (assigned) - conversation history
  'job-4': [
    {
      id: 'msg-4-1',
      job_id: 'job-4',
      sender_id: 'caregiver-1',
      sender_name: 'สมหญิง ดูแล',
      sender_role: 'caregiver',
      message_type: 'text',
      content: 'สวัสดีค่ะ สนใจงานนี้มากเลยค่ะ มีประสบการณ์ดูแลผู้สูงอายุมา 3 ปีแล้วค่ะ',
      is_read: true,
      created_at: '2026-01-09T13:00:00Z',
    },
    {
      id: 'msg-4-2',
      job_id: 'job-4',
      sender_id: 'hirer-1',
      sender_name: 'สมชาย ใจดี',
      sender_role: 'hirer',
      message_type: 'text',
      content: 'สวัสดีครับ ขอบคุณที่สนใจครับ คุณยายอายุ 75 ปี ต้องการความช่วยเหลือในการอาบน้ำและให้อาหารครับ',
      is_read: true,
      created_at: '2026-01-09T13:15:00Z',
    },
    {
      id: 'msg-4-3',
      job_id: 'job-4',
      sender_id: 'caregiver-1',
      sender_name: 'สมหญิง ดูแล',
      sender_role: 'caregiver',
      message_type: 'proposal',
      content: 'ส่งข้อเสนอ: ค่าแรง 400 บาท สำหรับ 4 ชั่วโมง',
      metadata: {
        proposal_id: 'proposal-1',
        pay_amount: 400,
      },
      is_read: true,
      created_at: '2026-01-09T13:30:00Z',
    },
    {
      id: 'msg-4-4',
      job_id: 'job-4',
      sender_id: 'system',
      sender_name: 'ระบบ',
      sender_role: 'system',
      message_type: 'system',
      content: '✅ ข้อเสนอได้รับการยอมรับแล้ว งานถูกมอบหมายเรียบร้อย',
      metadata: {
        system_event: 'proposal_accepted',
      },
      is_read: true,
      created_at: '2026-01-09T14:00:00Z',
    },
    {
      id: 'msg-4-5',
      job_id: 'job-4',
      sender_id: 'hirer-1',
      sender_name: 'สมชาย ใจดี',
      sender_role: 'hirer',
      message_type: 'text',
      content: 'ขอบคุณมากครับ พรุ่งนี้เจอกันนะครับ',
      is_read: true,
      created_at: '2026-01-09T14:05:00Z',
    },
  ],

  // Job 5 (in_progress) - active conversation
  'job-5': [
    {
      id: 'msg-5-1',
      job_id: 'job-5',
      sender_id: 'caregiver-1',
      sender_name: 'สมหญิง ดูแล',
      sender_role: 'caregiver',
      message_type: 'text',
      content: 'สวัสดีค่ะ สนใจดูแลคุณยายค่ะ',
      is_read: true,
      created_at: '2026-01-08T19:00:00Z',
    },
    {
      id: 'msg-5-2',
      job_id: 'job-5',
      sender_id: 'hirer-1',
      sender_name: 'สมชาย ใจดี',
      sender_role: 'hirer',
      message_type: 'text',
      content: 'สวัสดีครับ ต้องดูแลคุณยายตลอดวัน ให้อาหาร และช่วยเหลือกิจกรรมต่างๆ ครับ',
      is_read: true,
      created_at: '2026-01-08T19:30:00Z',
    },
    {
      id: 'msg-5-3',
      job_id: 'job-5',
      sender_id: 'caregiver-1',
      sender_name: 'สมหญิง ดูแล',
      sender_role: 'caregiver',
      message_type: 'proposal',
      content: 'ส่งข้อเสนอ: ค่าแรง 1,500 บาท สำหรับทั้งวัน',
      metadata: {
        proposal_id: 'proposal-2',
        pay_amount: 1500,
      },
      is_read: true,
      created_at: '2026-01-08T20:00:00Z',
    },
    {
      id: 'msg-5-4',
      job_id: 'job-5',
      sender_id: 'system',
      sender_name: 'ระบบ',
      sender_role: 'system',
      message_type: 'system',
      content: '✅ ข้อเสนอได้รับการยอมรับแล้ว',
      metadata: {
        system_event: 'proposal_accepted',
      },
      is_read: true,
      created_at: '2026-01-09T06:00:00Z',
    },
    {
      id: 'msg-5-5',
      job_id: 'job-5',
      sender_id: 'system',
      sender_name: 'ระบบ',
      sender_role: 'system',
      message_type: 'system',
      content: '✅ ผู้ดูแลเช็คอินแล้ว - งานเริ่มต้น',
      metadata: {
        system_event: 'checked_in',
      },
      is_read: true,
      created_at: '2026-01-09T08:05:00Z',
    },
    {
      id: 'msg-5-6',
      job_id: 'job-5',
      sender_id: 'caregiver-1',
      sender_name: 'สมหญิง ดูแล',
      sender_role: 'caregiver',
      message_type: 'text',
      content: 'เช็คอินเรียบร้อยค่ะ กำลังดูแลคุณยายอยู่ค่ะ',
      is_read: true,
      created_at: '2026-01-09T08:10:00Z',
    },
    {
      id: 'msg-5-7',
      job_id: 'job-5',
      sender_id: 'hirer-1',
      sender_name: 'สมชาย ใจดี',
      sender_role: 'hirer',
      message_type: 'text',
      content: 'ขอบคุณครับ ฝากคุณยายด้วยนะครับ',
      is_read: true,
      created_at: '2026-01-09T08:15:00Z',
    },
  ],

  // Job 2 (posted) - initial interest
  'job-2': [
    {
      id: 'msg-2-1',
      job_id: 'job-2',
      sender_id: 'caregiver-1',
      sender_name: 'สมหญิง ดูแล',
      sender_role: 'caregiver',
      message_type: 'text',
      content: 'สวัสดีค่ะ สนใจงานนี้ค่ะ อยากทราบรายละเอียดเพิ่มเติมค่ะ',
      is_read: false,
      created_at: '2026-01-09T15:00:00Z',
    },
  ],
};

// Helper functions
export function getChatMessages(jobId: string): ChatMessage[] {
  return mockChatMessages[jobId] || [];
}

export function addChatMessage(jobId: string, message: Omit<ChatMessage, 'id' | 'created_at'>): ChatMessage {
  const newMessage: ChatMessage = {
    ...message,
    id: `msg-${jobId}-${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  if (!mockChatMessages[jobId]) {
    mockChatMessages[jobId] = [];
  }

  mockChatMessages[jobId].push(newMessage);
  return newMessage;
}

export function markMessageAsRead(messageId: string, jobId: string): void {
  const messages = mockChatMessages[jobId];
  if (messages) {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      message.is_read = true;
    }
  }
}
