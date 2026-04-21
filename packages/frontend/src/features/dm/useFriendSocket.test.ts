import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { FRIEND_EVENTS } from '@chatrix/shared';
import type { Socket } from 'socket.io-client';

// Mock useQueryClient so tests don't need a QueryClientProvider and avoid async RQ state updates
const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

import { useDmStore } from '../../stores/dmStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useFriendSocket } from './useFriendSocket';

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
    act(() => {
      useDmStore.setState({ socket: null });
      useNotificationStore.setState({ notifications: [] });
    });
    mockInvalidateQueries.mockClear();
  });

  afterEach(() => {
    act(() => {
      useDmStore.setState({ socket: null });
    });
  });

  it('registers listeners for all three FRIEND_EVENTS when socket is present', () => {
    const mockSocket = makeMockSocket();
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    renderHook(() => useFriendSocket());

    const registeredEvents = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(registeredEvents).toContain(FRIEND_EVENTS.REQUEST_RECEIVED);
    expect(registeredEvents).toContain(FRIEND_EVENTS.REQUEST_ACCEPTED);
    expect(registeredEvents).toContain(FRIEND_EVENTS.REQUEST_DECLINED);
  });

  it('does not register listeners when socket is null', () => {
    // socket is null from beforeEach — hook early-returns without registering
    const { result } = renderHook(() => useFriendSocket());

    expect(result.current).toBeUndefined();
    expect(useDmStore.getState().socket).toBeNull();
  });

  it('invalidates [friends, requests] cache on REQUEST_RECEIVED event', () => {
    let receivedHandler: EventHandler | undefined;
    const mockSocket = {
      on: vi.fn((event: string, handler: EventHandler) => {
        if (event === FRIEND_EVENTS.REQUEST_RECEIVED) receivedHandler = handler;
      }),
      off: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    renderHook(() => useFriendSocket());
    receivedHandler?.({});

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['friends', 'requests'] });
  });

  it('invalidates [friends, list] and [dm, threads] cache on REQUEST_ACCEPTED event', () => {
    let acceptedHandler: EventHandler | undefined;
    const mockSocket = {
      on: vi.fn((event: string, handler: EventHandler) => {
        if (event === FRIEND_EVENTS.REQUEST_ACCEPTED) acceptedHandler = handler;
      }),
      off: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    renderHook(() => useFriendSocket());
    acceptedHandler?.({});

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['friends', 'list'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['dm', 'threads'] });
  });

  it('calls addNotification with friend_declined message on REQUEST_DECLINED event', () => {
    let declinedHandler: EventHandler | undefined;
    const mockSocket = {
      on: vi.fn((event: string, handler: EventHandler) => {
        if (event === FRIEND_EVENTS.REQUEST_DECLINED) declinedHandler = handler;
      }),
      off: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    renderHook(() => useFriendSocket());
    declinedHandler?.({ declinedByUsername: 'alice' });

    const notifications = useNotificationStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    const first = notifications[0]!;
    expect(first.type).toBe('friend_declined');
    expect(first.message).toContain('alice');
  });

  it('removes all listeners on unmount (cleanup)', () => {
    const mockSocket = makeMockSocket();
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    const { unmount } = renderHook(() => useFriendSocket());
    unmount();

    const offCalls = (mockSocket.off as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(offCalls).toContain(FRIEND_EVENTS.REQUEST_RECEIVED);
    expect(offCalls).toContain(FRIEND_EVENTS.REQUEST_ACCEPTED);
    expect(offCalls).toContain(FRIEND_EVENTS.REQUEST_DECLINED);
  });
});
