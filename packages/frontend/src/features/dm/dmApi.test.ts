import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getThreads, getMessages, startThread, editMessage, deleteMessage } from './dmApi';
import type { DmThreadPayload, DmMessagePayload } from '@chatrix/shared';

const token = 'test-access-token';

const mockThread: DmThreadPayload = {
  id: 'thread-1',
  otherUserId: 'user-2',
  otherUsername: 'alice',
  lastMessage: null,
  unreadCount: 0,
};

const mockMessage: DmMessagePayload = {
  id: 'msg-1',
  threadId: 'thread-1',
  authorId: 'user-1',
  authorUsername: 'bob',
  content: 'Hello!',
  replyToId: null,
  editedAt: null,
  deletedAt: null,
  createdAt: '2026-04-20T12:00:00Z',
  reactions: [],
};

describe('dmApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getThreads', () => {
    it('calls GET /api/dm/threads with Authorization header', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [mockThread],
      } as Response);

      const result = await getThreads(token);

      expect(fetch).toHaveBeenCalledWith('/api/dm/threads', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      expect(result).toEqual([mockThread]);
    });

    it('throws when response is not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: 'Unauthorized', statusCode: 401 }),
      } as Response);

      await expect(getThreads(token)).rejects.toThrow();
    });
  });

  describe('getMessages', () => {
    it('calls GET /api/dm/threads/:threadId/messages with no cursor', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [mockMessage],
      } as Response);

      const result = await getMessages(token, 'thread-1');

      expect(fetch).toHaveBeenCalledWith('/api/dm/threads/thread-1/messages?limit=50', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      expect(result).toEqual([mockMessage]);
    });

    it('calls GET /api/dm/threads/:threadId/messages with cursor params', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [mockMessage],
      } as Response);

      await getMessages(token, 'thread-1', { before: '2026-04-20T12:00:00Z', beforeId: 'msg-1' });

      expect(fetch).toHaveBeenCalledWith(
        '/api/dm/threads/thread-1/messages?limit=50&before=2026-04-20T12%3A00%3A00Z&beforeId=msg-1',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        },
      );
    });

    it('throws when response is not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ message: 'Forbidden', statusCode: 403 }),
      } as Response);

      await expect(getMessages(token, 'thread-1')).rejects.toThrow();
    });
  });

  describe('startThread', () => {
    it('calls POST /api/dm/threads with recipientId in body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockThread,
      } as Response);

      const result = await startThread(token, 'user-2');

      expect(fetch).toHaveBeenCalledWith('/api/dm/threads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ recipientId: 'user-2' }),
      });
      expect(result).toEqual(mockThread);
    });

    it('throws when response is not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: 'User not found', statusCode: 404 }),
      } as Response);

      await expect(startThread(token, 'nonexistent')).rejects.toThrow();
    });
  });

  describe('editMessage', () => {
    it('calls PATCH /api/dm/messages/:messageId with content in body', async () => {
      const edited = { ...mockMessage, content: 'Updated!', editedAt: '2026-04-20T13:00:00Z' };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => edited,
      } as Response);

      const result = await editMessage(token, 'msg-1', 'Updated!');

      expect(fetch).toHaveBeenCalledWith('/api/dm/messages/msg-1', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ content: 'Updated!' }),
      });
      expect(result).toEqual(edited);
    });

    it('throws when response is not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: 'Message not found', statusCode: 404 }),
      } as Response);

      await expect(editMessage(token, 'msg-missing', 'hello')).rejects.toThrow();
    });
  });

  describe('deleteMessage', () => {
    it('calls DELETE /api/dm/messages/:messageId with Authorization header', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: async () => '',
      } as Response);

      await deleteMessage(token, 'msg-1');

      expect(fetch).toHaveBeenCalledWith('/api/dm/messages/msg-1', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
    });

    it('throws when response is not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ message: 'Forbidden', statusCode: 403 }),
      } as Response);

      await expect(deleteMessage(token, 'msg-1')).rejects.toThrow();
    });
  });
});
