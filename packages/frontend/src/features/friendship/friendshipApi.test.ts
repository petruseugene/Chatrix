import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getFriends,
  getPendingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  searchUsers,
} from './friendshipApi';
import type { FriendDto, FriendRequestDto } from './friendshipApi';

const mockFriends: FriendDto[] = [
  { friendId: 'user-1', username: 'alice', createdAt: '2026-01-01T00:00:00Z' },
];
const mockRequests: FriendRequestDto[] = [
  {
    id: 'req-1',
    fromUserId: 'user-2',
    fromUsername: 'bob',
    fromUserCreatedAt: '2025-06-01T00:00:00Z',
    createdAt: '2026-01-02T00:00:00Z',
  },
];

describe('friendshipApi', () => {
  const token = 'test-access-token';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getFriends', () => {
    it('calls GET /api/friends with Authorization header', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockFriends,
      } as Response);

      const result = await getFriends(token);

      expect(fetch).toHaveBeenCalledWith('/api/friends', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      expect(result).toEqual(mockFriends);
    });

    it('throws an error when response is not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: 'Unauthorized', statusCode: 401 }),
      } as Response);

      await expect(getFriends(token)).rejects.toThrow();
    });
  });

  describe('getPendingRequests', () => {
    it('calls GET /api/friends/requests with Authorization header', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRequests,
      } as Response);

      const result = await getPendingRequests(token);

      expect(fetch).toHaveBeenCalledWith('/api/friends/requests', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      expect(result).toEqual(mockRequests);
    });
  });

  describe('sendFriendRequest', () => {
    it('calls POST /api/friends/request with username in body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: async () => '',
      } as Response);

      await sendFriendRequest(token, 'charlie');

      expect(fetch).toHaveBeenCalledWith('/api/friends/request', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username: 'charlie' }),
      });
    });

    it('throws when response is not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: 'User not found', statusCode: 404 }),
      } as Response);

      await expect(sendFriendRequest(token, 'nobody')).rejects.toThrow();
    });
  });

  describe('acceptFriendRequest', () => {
    it('calls POST /api/friends/accept/:requestId with Authorization header', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: async () => '',
      } as Response);

      await acceptFriendRequest(token, 'req-1');

      expect(fetch).toHaveBeenCalledWith('/api/friends/accept/req-1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
    });
  });

  describe('declineFriendRequest', () => {
    it('calls DELETE /api/friends/decline/:requestId with Authorization header', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: async () => '',
      } as Response);

      await declineFriendRequest(token, 'req-1');

      expect(fetch).toHaveBeenCalledWith('/api/friends/decline/req-1', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
    });
  });

  describe('removeFriend', () => {
    it('calls DELETE /api/friends/:friendId with Authorization header', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: async () => '',
      } as Response);

      await removeFriend(token, 'user-1');

      expect(fetch).toHaveBeenCalledWith('/api/friends/user-1', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
    });
  });

  describe('searchUsers', () => {
    it('calls GET /api/users/search?q=<query> with Authorization header and returns results', async () => {
      const mockResults = [
        { id: 'user-1', username: 'alice', relationshipStatus: 'friend' as const },
        {
          id: 'user-2',
          username: 'bob',
          relationshipStatus: 'pending_sent' as const,
          friendRequestId: 'req-42',
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults,
      } as Response);

      const result = await searchUsers(token, 'ali');

      expect(fetch).toHaveBeenCalledWith('/api/users/search?q=ali', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      expect(result).toEqual(mockResults);
    });

    it('throws a friendly error when response is not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: 'Unauthorized', statusCode: 401 }),
      } as Response);

      await expect(searchUsers(token, 'ali')).rejects.toThrow();
    });
  });
});
