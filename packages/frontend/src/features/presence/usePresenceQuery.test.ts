import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import type { FriendPresence } from '@chatrix/shared';

// Mock presenceApi before importing hook
vi.mock('./presenceApi', () => ({
  getFriendPresences: vi.fn(),
}));

import * as presenceApi from './presenceApi';
import { useAuthStore } from '../../stores/authStore';
import { usePresenceStore } from '../../stores/presenceStore';
import { usePresenceQuery } from './usePresenceQuery';

const mockToken = 'test-token';

const mockPresences: FriendPresence[] = [
  { userId: 'user-2', username: 'alice', status: 'online' },
  { userId: 'user-3', username: 'bob', status: 'offline' },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('usePresenceQuery', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: mockToken });
    usePresenceStore.setState({ statuses: {} });
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses query key ["presence", "friends"]', async () => {
    vi.mocked(presenceApi.getFriendPresences).mockResolvedValueOnce(mockPresences);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => usePresenceQuery(), { wrapper });

    await waitFor(() =>
      expect(queryClient.getQueryState(['presence', 'friends'])?.status).toBe('success'),
    );
  });

  it('fetches friend presences using the access token', async () => {
    vi.mocked(presenceApi.getFriendPresences).mockResolvedValueOnce(mockPresences);

    const { result } = renderHook(() => usePresenceQuery(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(presenceApi.getFriendPresences).toHaveBeenCalledWith(mockToken);
    expect(result.current.data).toEqual(mockPresences);
  });

  it('is disabled when no access token is present', () => {
    useAuthStore.setState({ user: null, accessToken: null });

    const { result } = renderHook(() => usePresenceQuery(), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(presenceApi.getFriendPresences).not.toHaveBeenCalled();
  });

  it('stores presence statuses in the presence store after fetch', async () => {
    vi.mocked(presenceApi.getFriendPresences).mockResolvedValueOnce(mockPresences);

    const { result } = renderHook(() => usePresenceQuery(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await waitFor(() => {
      const statuses = usePresenceStore.getState().statuses;
      expect(statuses['user-2']).toBe('online');
    });

    const statuses = usePresenceStore.getState().statuses;
    expect(statuses['user-3']).toBe('offline');
  });

  it('calls usePresenceStore.getState().setMany with fetched data on success', async () => {
    vi.mocked(presenceApi.getFriendPresences).mockResolvedValueOnce(mockPresences);

    // Capture original setMany so we can call through in spy
    const originalSetMany = usePresenceStore.getState().setMany;
    const setManySpy = vi
      .spyOn(usePresenceStore.getState(), 'setMany')
      .mockImplementation((...args) => originalSetMany(...args));

    const { result } = renderHook(() => usePresenceQuery(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(setManySpy).toHaveBeenCalledWith(mockPresences));
  });

  it('returns error state when fetch fails', async () => {
    vi.mocked(presenceApi.getFriendPresences).mockRejectedValueOnce(new Error('Unauthorized'));

    const { result } = renderHook(() => usePresenceQuery(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('does not call setMany when disabled (no token)', () => {
    useAuthStore.setState({ user: null, accessToken: null });

    const setManySpy = vi.spyOn(usePresenceStore.getState(), 'setMany');

    renderHook(() => usePresenceQuery(), { wrapper: createWrapper() });

    expect(setManySpy).not.toHaveBeenCalled();
  });
});
