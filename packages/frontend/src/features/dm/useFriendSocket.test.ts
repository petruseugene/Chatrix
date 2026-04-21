import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { FRIEND_EVENTS } from '@chatrix/shared';
import type { Socket } from 'socket.io-client';

import { useDmStore } from '../../stores/dmStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useFriendSocket } from './useFriendSocket';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
    queryClient,
  };
}

type EventHandler = (...args: unknown[]) => void;

function makeMockSocket() {
  return {
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  };
}

describe('useFriendSocket', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [] });
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useDmStore.setState({ socket: null });
  });

  it('registers listeners for all three FRIEND_EVENTS when socket is present', async () => {
    const mockSocket = makeMockSocket();
    useDmStore.setState({ socket: mockSocket as unknown as Socket });

    const { wrapper } = createWrapper();
    await act(async () => {
      renderHook(() => useFriendSocket(), { wrapper });
    });

    const registeredEvents = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(registeredEvents).toContain(FRIEND_EVENTS.REQUEST_RECEIVED);
    expect(registeredEvents).toContain(FRIEND_EVENTS.REQUEST_ACCEPTED);
    expect(registeredEvents).toContain(FRIEND_EVENTS.REQUEST_DECLINED);
  });

  it('does not register listeners when socket is null', async () => {
    useDmStore.setState({ socket: null });

    const { wrapper } = createWrapper();
    const mockSocket = makeMockSocket();

    await act(async () => {
      renderHook(() => useFriendSocket(), { wrapper });
    });

    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  it('invalidates [friends, requests] cache on REQUEST_RECEIVED event', async () => {
    let receivedHandler: EventHandler | undefined;
    const mockSocket = {
      on: vi.fn((event: string, handler: EventHandler) => {
        if (event === FRIEND_EVENTS.REQUEST_RECEIVED) receivedHandler = handler;
      }),
      off: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };
    useDmStore.setState({ socket: mockSocket as unknown as Socket });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      renderHook(() => useFriendSocket(), { wrapper });
    });

    await act(async () => {
      receivedHandler?.({});
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['friends', 'requests'] });
  });

  it('invalidates [friends, list] and [dm, threads] cache on REQUEST_ACCEPTED event', async () => {
    let acceptedHandler: EventHandler | undefined;
    const mockSocket = {
      on: vi.fn((event: string, handler: EventHandler) => {
        if (event === FRIEND_EVENTS.REQUEST_ACCEPTED) acceptedHandler = handler;
      }),
      off: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };
    useDmStore.setState({ socket: mockSocket as unknown as Socket });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      renderHook(() => useFriendSocket(), { wrapper });
    });

    await act(async () => {
      acceptedHandler?.({});
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['friends', 'list'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dm', 'threads'] });
  });

  it('calls addNotification with friend_declined message on REQUEST_DECLINED event', async () => {
    let declinedHandler: EventHandler | undefined;
    const mockSocket = {
      on: vi.fn((event: string, handler: EventHandler) => {
        if (event === FRIEND_EVENTS.REQUEST_DECLINED) declinedHandler = handler;
      }),
      off: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };
    useDmStore.setState({ socket: mockSocket as unknown as Socket });

    const { wrapper } = createWrapper();
    await act(async () => {
      renderHook(() => useFriendSocket(), { wrapper });
    });

    await act(async () => {
      declinedHandler?.({ declinedByUsername: 'alice' });
    });

    const notifications = useNotificationStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    const first = notifications[0];
    expect(first).toBeDefined();
    expect(first?.type).toBe('friend_declined');
    expect(first?.message).toContain('alice');
  });

  it('removes all listeners on unmount (cleanup)', async () => {
    const mockSocket = makeMockSocket();
    useDmStore.setState({ socket: mockSocket as unknown as Socket });

    const { wrapper } = createWrapper();
    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = renderHook(() => useFriendSocket(), { wrapper }));
    });

    unmount();

    const offCalls = (mockSocket.off as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(offCalls).toContain(FRIEND_EVENTS.REQUEST_RECEIVED);
    expect(offCalls).toContain(FRIEND_EVENTS.REQUEST_ACCEPTED);
    expect(offCalls).toContain(FRIEND_EVENTS.REQUEST_DECLINED);
  });
});
