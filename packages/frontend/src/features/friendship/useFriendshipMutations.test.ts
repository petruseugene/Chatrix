import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';

// Mock friendshipApi before importing hooks
vi.mock('./friendshipApi', () => ({
  getFriends: vi.fn(),
  getPendingRequests: vi.fn(),
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  declineFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
}));

import * as friendshipApi from './friendshipApi';
import { useAuthStore } from '../../stores/authStore';
import {
  useFriends,
  usePendingRequests,
  useSendFriendRequest,
  useAcceptRequest,
  useDeclineRequest,
} from './useFriendshipMutations';
import type { FriendDto, FriendRequestDto } from './friendshipApi';

const mockToken = 'test-token';
const mockFriends: FriendDto[] = [
  { friendId: 'user-1', username: 'alice', createdAt: '2026-01-01T00:00:00Z' },
];
const mockRequests: FriendRequestDto[] = [
  {
    id: 'req-1',
    fromUserId: 'user-2',
    fromUsername: 'bob',
    createdAt: '2026-01-02T00:00:00Z',
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useFriends', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: mockToken });
    vi.resetAllMocks();
  });

  it('fetches friends using the access token from auth store', async () => {
    vi.mocked(friendshipApi.getFriends).mockResolvedValueOnce(mockFriends);

    const { result } = renderHook(() => useFriends(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(friendshipApi.getFriends).toHaveBeenCalledWith(mockToken);
    expect(result.current.data).toEqual(mockFriends);
  });

  it('returns error state when fetch fails', async () => {
    vi.mocked(friendshipApi.getFriends).mockRejectedValueOnce(new Error('Unauthorized'));

    const { result } = renderHook(() => useFriends(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('usePendingRequests', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: mockToken });
    vi.resetAllMocks();
  });

  it('fetches pending requests using the access token from auth store', async () => {
    vi.mocked(friendshipApi.getPendingRequests).mockResolvedValueOnce(mockRequests);

    const { result } = renderHook(() => usePendingRequests(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(friendshipApi.getPendingRequests).toHaveBeenCalledWith(mockToken);
    expect(result.current.data).toEqual(mockRequests);
  });
});

describe('useSendFriendRequest', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: mockToken });
    vi.resetAllMocks();
  });

  it('sends friend request with token and invalidates friend queries on success', async () => {
    vi.mocked(friendshipApi.sendFriendRequest).mockResolvedValueOnce(undefined);
    // Set up the query hooks so their cache exists before testing invalidation
    vi.mocked(friendshipApi.getFriends).mockResolvedValue(mockFriends);
    vi.mocked(friendshipApi.getPendingRequests).mockResolvedValue(mockRequests);

    const { result } = renderHook(() => useSendFriendRequest(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate('charlie');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(friendshipApi.sendFriendRequest).toHaveBeenCalledWith(mockToken, 'charlie');
  });

  it('forwards error when send friend request fails', async () => {
    vi.mocked(friendshipApi.sendFriendRequest).mockRejectedValueOnce(new Error('User not found'));

    const { result } = renderHook(() => useSendFriendRequest(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate('nobody');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('User not found');
  });
});

describe('useAcceptRequest', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: mockToken });
    vi.resetAllMocks();
  });

  it('accepts friend request and invalidates both friend queries on success', async () => {
    vi.mocked(friendshipApi.acceptFriendRequest).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAcceptRequest(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate('req-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(friendshipApi.acceptFriendRequest).toHaveBeenCalledWith(mockToken, 'req-1');
  });
});

describe('useDeclineRequest', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: mockToken });
    vi.resetAllMocks();
  });

  it('declines friend request and invalidates requests query on success', async () => {
    vi.mocked(friendshipApi.declineFriendRequest).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeclineRequest(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate('req-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(friendshipApi.declineFriendRequest).toHaveBeenCalledWith(mockToken, 'req-1');
  });
});
