import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ChatRoomPage from '../pages/shared/ChatRoomPage';

const mockNavigate = vi.fn();
const mockGetChatThread = vi.fn();
const mockGetOrCreateChatThread = vi.fn();
const mockGetChatMessages = vi.fn();
const mockGetJobById = vi.fn();
const mockGetDisputeByJob = vi.fn();
const mockGetCancelReason = vi.fn();

vi.mock('../layouts', () => ({
  ChatLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../contexts', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      role: 'hirer',
      email: 'hirer@example.com',
      trust_level: 'L1',
    },
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ jobId: 'job-post-1' }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../services/appApi', () => ({
  appApi: {
    getJobById: (...args: any[]) => mockGetJobById(...args),
    getDisputeByJob: (...args: any[]) => mockGetDisputeByJob(...args),
    getChatThread: (...args: any[]) => mockGetChatThread(...args),
    getOrCreateChatThread: (...args: any[]) => mockGetOrCreateChatThread(...args),
    getChatMessages: (...args: any[]) => mockGetChatMessages(...args),
    getCancelReason: (...args: any[]) => mockGetCancelReason(...args),
  },
}));

beforeEach(() => {
  mockGetJobById.mockResolvedValue({
    success: true,
    data: {
      job: {
        id: 'job-post-1',
        job_id: 'job-1',
        title: 'งานดูแล',
        status: 'assigned',
        scheduled_start_at: '2026-01-01T08:00:00.000Z',
        scheduled_end_at: '2026-01-01T16:00:00.000Z',
        address_line1: '123 ถนนหลัก',
        district: 'ดินแดง',
        province: 'กรุงเทพมหานคร',
      },
    },
  });
  mockGetDisputeByJob.mockResolvedValue({ success: true, data: { dispute: null } });
  mockGetCancelReason.mockResolvedValue({ success: true, data: { reason: '' } });
  mockGetChatThread
    .mockResolvedValueOnce({ success: true, data: { thread: null } })
    .mockResolvedValueOnce({ success: true, data: { thread: { id: 'thread-1', job_id: 'job-1' } } });
  mockGetOrCreateChatThread.mockResolvedValue({ success: true, data: { thread: null } });
  mockGetChatMessages.mockResolvedValue({ success: true, data: { data: [] } });
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(cb, 0);
  }
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
  }
});

describe('ChatRoomPage', () => {
  it('falls back to job_id when chat thread is not found for job_post id', async () => {
    render(<ChatRoomPage />);
    await screen.findByText('งานดูแล');
    await waitFor(() => {
      expect(mockGetChatThread).toHaveBeenCalledWith('job-post-1');
      expect(mockGetChatThread).toHaveBeenCalledWith('job-1');
    });
    expect(mockGetOrCreateChatThread).not.toHaveBeenCalled();
  });
});
