import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PRESENCE_EVENTS } from '@chatrix/shared';
import type { PresenceChangedPayload } from '@chatrix/shared';
import type { Socket } from 'socket.io-client';

import { useDmStore } from '../../stores/dmStore';
import { usePresenceStore } from '../../stores/presenceStore';
import { usePresenceSocket } from './usePresenceSocket';

type EventHandler = (...args: unknown[]) => void;

function makeMockSocket() {
  return {
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  };
}

describe('usePresenceSocket', () => {
  beforeEach(() => {
    act(() => {
      useDmStore.setState({ socket: null });
      usePresenceStore.setState({ statuses: {} });
    });
  });

  afterEach(() => {
    act(() => {
      useDmStore.setState({ socket: null });
      usePresenceStore.setState({ statuses: {} });
    });
  });

  it('does not register any listener when socket is null', () => {
    // socket is null from beforeEach — hook should early-return
    renderHook(() => usePresenceSocket());

    // Nothing to spy on since there's no socket, but verify store is still null
    expect(useDmStore.getState().socket).toBeNull();
  });

  it('registers a listener for PRESENCE_EVENTS.CHANGED when socket is present', () => {
    const mockSocket = makeMockSocket();
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    renderHook(() => usePresenceSocket());

    const registeredEvents = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(registeredEvents).toContain(PRESENCE_EVENTS.CHANGED);
  });

  it('calls setStatus with correct userId and status when PRESENCE_EVENTS.CHANGED fires', () => {
    let changedHandler: EventHandler | undefined;
    const mockSocket = {
      on: vi.fn((event: string, handler: EventHandler) => {
        if (event === PRESENCE_EVENTS.CHANGED) changedHandler = handler;
      }),
      off: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    renderHook(() => usePresenceSocket());

    const payload: PresenceChangedPayload = { userId: 'user-42', status: 'online' };
    changedHandler?.(payload);

    expect(usePresenceStore.getState().statuses['user-42']).toBe('online');
  });

  it('calls setStatus with afk status correctly', () => {
    let changedHandler: EventHandler | undefined;
    const mockSocket = {
      on: vi.fn((event: string, handler: EventHandler) => {
        if (event === PRESENCE_EVENTS.CHANGED) changedHandler = handler;
      }),
      off: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    renderHook(() => usePresenceSocket());

    const payload: PresenceChangedPayload = { userId: 'user-7', status: 'afk' };
    changedHandler?.(payload);

    expect(usePresenceStore.getState().statuses['user-7']).toBe('afk');
  });

  it('removes the PRESENCE_EVENTS.CHANGED listener on unmount', () => {
    const mockSocket = makeMockSocket();
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    const { unmount } = renderHook(() => usePresenceSocket());
    unmount();

    const offEvents = (mockSocket.off as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(offEvents).toContain(PRESENCE_EVENTS.CHANGED);
  });

  it('removes the exact same handler function on unmount (not a different reference)', () => {
    const handlers: Record<string, EventHandler> = {};
    const mockSocket = {
      on: vi.fn((event: string, handler: EventHandler) => {
        handlers[event] = handler;
      }),
      off: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    const { unmount } = renderHook(() => usePresenceSocket());
    unmount();

    const offCalls = (mockSocket.off as ReturnType<typeof vi.fn>).mock.calls;
    const offChangedCall = offCalls.find((c: unknown[]) => c[0] === PRESENCE_EVENTS.CHANGED);
    expect(offChangedCall).toBeDefined();
    // The handler passed to off must be the same reference registered with on
    expect(offChangedCall![1]).toBe(handlers[PRESENCE_EVENTS.CHANGED]);
  });
});
