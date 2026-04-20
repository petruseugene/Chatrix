import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';

// Mock roomsApi before importing the hook
vi.mock('./roomsApi', () => ({
  getRooms: vi.fn(),
}));

import * as roomsApi from './roomsApi';
import { useAuthStore } from '../../stores/authStore';
import { useRooms } from './useRoomsQuery';

const mockToken = 'test-token';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useRooms', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: mockToken });
    vi.resetAllMocks();
  });

  it('uses the query key [rooms, list]', async () => {
    vi.mocked(roomsApi.getRooms).mockResolvedValueOnce([]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useRooms(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cachedData = queryClient.getQueryData(['rooms', 'list']);
    expect(cachedData).toBeDefined();
  });

  it('fetches rooms using the access token from auth store', async () => {
    vi.mocked(roomsApi.getRooms).mockResolvedValueOnce([
      { id: 'room-1', name: 'General', unreadCount: 0 },
    ]);

    const { result } = renderHook(() => useRooms(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(roomsApi.getRooms).toHaveBeenCalledWith(mockToken);
    expect(result.current.data).toEqual([{ id: 'room-1', name: 'General', unreadCount: 0 }]);
  });

  it('is disabled when no access token is present', () => {
    useAuthStore.setState({ user: null, accessToken: null });

    const { result } = renderHook(() => useRooms(), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(roomsApi.getRooms).not.toHaveBeenCalled();
  });

  it('returns empty array when API returns no rooms', async () => {
    vi.mocked(roomsApi.getRooms).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useRooms(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('returns error state when fetch fails', async () => {
    vi.mocked(roomsApi.getRooms).mockRejectedValueOnce(new Error('Unauthorized'));

    const { result } = renderHook(() => useRooms(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
