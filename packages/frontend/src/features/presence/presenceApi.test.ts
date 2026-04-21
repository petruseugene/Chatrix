import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getFriendPresences } from './presenceApi';
import type { FriendPresence } from '@chatrix/shared';

const token = 'test-access-token';

const mockPresences: FriendPresence[] = [
  { userId: 'user-2', username: 'alice', status: 'online' },
  { userId: 'user-3', username: 'bob', status: 'offline' },
];

describe('presenceApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getFriendPresences', () => {
    it('calls GET /api/presence/friends with Authorization header', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPresences,
      } as Response);

      const result = await getFriendPresences(token);

      expect(fetch).toHaveBeenCalledWith('/api/presence/friends', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      expect(result).toEqual(mockPresences);
    });

    it('throws a meaningful error when response is 401', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: 'Unauthorized', statusCode: 401 }),
      } as Response);

      await expect(getFriendPresences(token)).rejects.toThrow('Unauthorized');
    });

    it('throws a meaningful error when response is 403', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ message: 'Forbidden', statusCode: 403 }),
      } as Response);

      await expect(getFriendPresences(token)).rejects.toThrow('Forbidden');
    });

    it('throws a fallback error message when response body is not JSON', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      await expect(getFriendPresences(token)).rejects.toThrow('Internal Server Error');
    });

    it('throws fallback error when response body is empty', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => '',
      } as Response);

      await expect(getFriendPresences(token)).rejects.toThrow(
        'Something went wrong. Please try again.',
      );
    });

    it('returns an empty array when no friends have presence data', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      const result = await getFriendPresences(token);

      expect(result).toEqual([]);
    });
  });
});
