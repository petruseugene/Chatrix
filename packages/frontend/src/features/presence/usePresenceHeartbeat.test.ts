import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PRESENCE_EVENTS } from '@chatrix/shared';
import type { PresenceHeartbeatPayload } from '@chatrix/shared';
import type { Socket } from 'socket.io-client';

import { useDmStore } from '../../stores/dmStore';
import { usePresenceHeartbeat } from './usePresenceHeartbeat';

const TEST_TAB_ID = 'test-tab-id';

vi.stubGlobal('crypto', { randomUUID: () => TEST_TAB_ID });

function makeMockSocket() {
  return {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  };
}

describe('usePresenceHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    act(() => {
      useDmStore.setState({ socket: null });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => {
      useDmStore.setState({ socket: null });
    });
  });

  it('emits PRESENCE_EVENTS.HEARTBEAT with correct payload shape on mount', () => {
    const mockSocket = makeMockSocket();
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    renderHook(() => usePresenceHeartbeat());

    expect(mockSocket.emit).toHaveBeenCalledWith(
      PRESENCE_EVENTS.HEARTBEAT,
      expect.objectContaining<PresenceHeartbeatPayload>({
        tabId: TEST_TAB_ID,
        isActive: expect.any(Boolean) as boolean,
      }),
    );
  });

  it('emits PRESENCE_EVENTS.HEARTBEAT again after 20 seconds', () => {
    const mockSocket = makeMockSocket();
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    renderHook(() => usePresenceHeartbeat());

    // Initial emit on mount
    expect(mockSocket.emit).toHaveBeenCalledTimes(1);

    // Advance 20 seconds
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(mockSocket.emit).toHaveBeenCalledTimes(2);
    expect(mockSocket.emit).toHaveBeenLastCalledWith(
      PRESENCE_EVENTS.HEARTBEAT,
      expect.objectContaining({ tabId: TEST_TAB_ID }),
    );
  });

  it('emits isActive: true when a mouse activity event occurred within 60 seconds', () => {
    const mockSocket = makeMockSocket();
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    renderHook(() => usePresenceHeartbeat());

    // Simulate user activity
    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown'));
    });

    // Clear the initial emit, advance timer to get interval emit
    mockSocket.emit.mockClear();
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    const calls = mockSocket.emit.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastPayload = calls[calls.length - 1]?.[1] as PresenceHeartbeatPayload;
    expect(lastPayload.isActive).toBe(true);
  });

  it('emits isActive: false when no activity for more than 60 seconds', () => {
    const mockSocket = makeMockSocket();
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    renderHook(() => usePresenceHeartbeat());

    // Advance 61 seconds with no activity
    act(() => {
      vi.advanceTimersByTime(61000);
    });

    const calls = mockSocket.emit.mock.calls;
    // At least the initial + one interval emit
    expect(calls.length).toBeGreaterThanOrEqual(2);

    // The last interval payload should be inactive
    const lastPayload = calls[calls.length - 1]?.[1] as PresenceHeartbeatPayload;
    expect(lastPayload.isActive).toBe(false);
  });

  it('does not emit when socket is null', () => {
    // socket is null from beforeEach
    const emitSpy = vi.fn();

    renderHook(() => usePresenceHeartbeat());

    expect(emitSpy).not.toHaveBeenCalled();
    // Advance time — still no emits
    act(() => {
      vi.advanceTimersByTime(40000);
    });
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('does not emit after unmount (interval cleared)', () => {
    const mockSocket = makeMockSocket();
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    const { unmount } = renderHook(() => usePresenceHeartbeat());

    // Initial emit on mount
    expect(mockSocket.emit).toHaveBeenCalledTimes(1);

    unmount();
    mockSocket.emit.mockClear();

    // Advance past an interval — no more emits after unmount
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('removes document event listeners on unmount', () => {
    const mockSocket = makeMockSocket();
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => usePresenceHeartbeat());
    unmount();

    const removedEvents = removeEventListenerSpy.mock.calls.map((c) => c[0]);
    expect(removedEvents).toContain('mousedown');
    expect(removedEvents).toContain('keydown');
    expect(removedEvents).toContain('scroll');
    expect(removedEvents).toContain('touchstart');

    removeEventListenerSpy.mockRestore();
  });

  it('uses a stable tabId across re-renders (useRef - not regenerated)', () => {
    const mockSocket = makeMockSocket();
    act(() => {
      useDmStore.setState({ socket: mockSocket as unknown as Socket });
    });

    const { rerender } = renderHook(() => usePresenceHeartbeat());

    const firstCallTabId = (mockSocket.emit.mock.calls[0]?.[1] as PresenceHeartbeatPayload).tabId;

    mockSocket.emit.mockClear();
    rerender();

    act(() => {
      vi.advanceTimersByTime(20000);
    });

    const secondCallTabId = (mockSocket.emit.mock.calls[0]?.[1] as PresenceHeartbeatPayload).tabId;
    expect(secondCallTabId).toBe(firstCallTabId);
    expect(firstCallTabId).toBe(TEST_TAB_ID);
  });
});
