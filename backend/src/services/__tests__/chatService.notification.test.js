import { jest } from '@jest/globals';

await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: jest.fn(),
}));

await jest.unstable_mockModule('../../models/Chat.js', () => ({
  default: {
    canAccessThread: jest.fn(),
    getThreadWithDetails: jest.fn(),
    createMessage: jest.fn(),
  },
}));

await jest.unstable_mockModule('../notificationService.js', () => ({
  notifyChatMessage: jest.fn(),
}));

const { default: chatService } = await import('../chatService.js');
const { default: Chat } = await import('../../models/Chat.js');
const { notifyChatMessage } = await import('../notificationService.js');

describe('chatService sendMessage notifications', () => {
  beforeEach(() => {
    Chat.canAccessThread.mockReset();
    Chat.getThreadWithDetails.mockReset();
    Chat.createMessage.mockReset();
    notifyChatMessage.mockReset();

    Chat.canAccessThread.mockResolvedValue(true);
    Chat.getThreadWithDetails.mockResolvedValue({
      id: 'thread-1',
      status: 'open',
      job_status: 'assigned',
      job_post_status: 'posted',
      hirer_id: 'hirer-1',
      caregiver_id: 'caregiver-1',
      hirer_name: 'Hirer Name',
      caregiver_name: 'Caregiver Name',
      job_title: 'Elderly care',
      job_id: 'job-1',
    });
    Chat.createMessage.mockResolvedValue({
      id: 'msg-1',
      thread_id: 'thread-1',
      sender_id: 'hirer-1',
      type: 'text',
      content: 'hello',
    });
  });

  test('notifies caregiver when hirer sends a message', async () => {
    await chatService.sendMessage('thread-1', 'hirer-1', {
      type: 'text',
      content: 'hello',
    });

    expect(notifyChatMessage).toHaveBeenCalledWith(
      'caregiver-1',
      'Hirer Name',
      'Elderly care',
      'job-1'
    );
  });

  test('notifies hirer when caregiver sends a message', async () => {
    Chat.createMessage.mockResolvedValueOnce({
      id: 'msg-2',
      thread_id: 'thread-1',
      sender_id: 'caregiver-1',
      type: 'text',
      content: 'ack',
    });

    await chatService.sendMessage('thread-1', 'caregiver-1', {
      type: 'text',
      content: 'ack',
    });

    expect(notifyChatMessage).toHaveBeenCalledWith(
      'hirer-1',
      'Caregiver Name',
      'Elderly care',
      'job-1'
    );
  });

  test('skips notification when recipient is not available', async () => {
    Chat.getThreadWithDetails.mockResolvedValueOnce({
      id: 'thread-1',
      status: 'open',
      job_status: 'assigned',
      job_post_status: 'posted',
      hirer_id: 'hirer-1',
      caregiver_id: null,
      hirer_name: 'Hirer Name',
      caregiver_name: null,
      job_title: 'Elderly care',
      job_id: 'job-1',
    });

    await chatService.sendMessage('thread-1', 'hirer-1', {
      type: 'text',
      content: 'hello',
    });

    expect(notifyChatMessage).not.toHaveBeenCalled();
  });

  test('does not fail sendMessage when notification creation fails', async () => {
    notifyChatMessage.mockRejectedValueOnce(new Error('notification unavailable'));

    const message = await chatService.sendMessage('thread-1', 'hirer-1', {
      type: 'text',
      content: 'hello',
    });

    expect(message).toEqual(expect.objectContaining({
      id: 'msg-1',
      thread_id: 'thread-1',
    }));
  });
});
