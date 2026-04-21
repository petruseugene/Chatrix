import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { DM_EVENTS } from '@chatrix/shared';
import type { DmMessagePayload, DmThreadPayload } from '@chatrix/shared';

// Mock socket.io-client before importing the hook
vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}));

import { io } from 'socket.io-client';
import { useAuthStore } from '../../stores/authStore';
import { useDmStore } from '../../stores/dmStore';
import { useChatStore } from '../../stores/chatStore';
import { useDmSocket } from './useDmSocket';

const mockToken = 'test-jwt-token';

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
};

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

function makeMockSocket() {
  return {
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  };
}

describe('useDmSocket', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: mockToken });
    useDmStore.setState({ activeThreadId: null, socketConnected: false });
    useChatStore.setState({ activeView: null });
    vi.resetAllMocks();
    // Default: return a valid mock socket
    vi.mocked(io).mockReturnValue(makeMockSocket() as unknown as ReturnType<typeof io>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a socket connection with the access token from auth store', () => {
    renderHook(() => useDmSocket(), { wrapper: createWrapper() });

    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        auth: { token: mockToken },
      }),
    );
  });

  it('registers listeners for all DM_EVENTS on mount', () => {
    const mockSocket = makeMockSocket();
    vi.mocked(io).mockReturnValue(mockSocket as unknown as ReturnType<typeof io>);

    renderHook(() => useDmSocket(), { wrapper: createWrapper() });

    const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(onCalls).toContain('connect');
    expect(onCalls).toContain('disconnect');
    expect(onCalls).toContain(DM_EVENTS.MESSAGE_NEW);
    expect(onCalls).toContain(DM_EVENTS.MESSAGE_EDITED);
    expect(onCalls).toContain(DM_EVENTS.MESSAGE_DELETED);
  });

  it('does not connect when there is no access token', () => {
    useAuthStore.setState({ user: null, accessToken: null });

    renderHook(() => useDmSocket(), { wrapper: createWrapper() });

    expect(io).not.toHaveBeenCalled();
  });

  it('disconnects socket on unmount', () => {
    const mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };
    vi.mocked(io).mockReturnValue(mockSocket as unknown as ReturnType<typeof io>);

    const { unmount } = renderHook(() => useDmSocket(), { wrapper: createWrapper() });

    unmount();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('sets socketConnected true on connect event', () => {
    let connectHandler: (() => void) | undefined;
    const mockSocket = {
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'connect') connectHandler = handler;
      }),
      off: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };
    vi.mocked(io).mockReturnValue(mockSocket as unknown as ReturnType<typeof io>);

    renderHook(() => useDmSocket(), { wrapper: createWrapper() });

    connectHandler?.();

    expect(useDmStore.getState().socketConnected).toBe(true);
  });

  it('sets socketConnected false on disconnect event', () => {
    let disconnectHandler: (() => void) | undefined;
    const mockSocket = {
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'disconnect') disconnectHandler = handler;
      }),
      off: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };
    vi.mocked(io).mockReturnValue(mockSocket as unknown as ReturnType<typeof io>);

    useDmStore.setState({ activeThreadId: null, socketConnected: true });

    renderHook(() => useDmSocket(), { wrapper: createWrapper() });

    disconnectHandler?.();

    expect(useDmStore.getState().socketConnected).toBe(false);
  });

  it('inserts new message into query cache on MESSAGE_NEW event', () => {
    let messageNewHandler: ((msg: DmMessagePayload) => void) | undefined;
    const mockSocket = {
      on: vi.fn((event: string, handler: (msg: DmMessagePayload) => void) => {
        if (event === DM_EVENTS.MESSAGE_NEW) messageNewHandler = handler;
      }),
      off: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };
    vi.mocked(io).mockReturnValue(mockSocket as unknown as ReturnType<typeof io>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Pre-seed cache with an empty page
    queryClient.setQueryData(['dm', 'messages', 'thread-1'], {
      pages: [[]],
      pageParams: [null],
    });

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useDmSocket(), { wrapper });

    messageNewHandler?.(mockMessage);

    const cached = queryClient.getQueryData<{ pages: DmMessagePayload[][] }>([
      'dm',
      'messages',
      'thread-1',
    ]);
    expect(cached?.pages[0]).toContainEqual(mockMessage);
  });

  it('updates existing message in cache on MESSAGE_EDITED event', () => {
    const editedMessage: DmMessagePayload = {
      ...mockMessage,
      content: 'Edited!',
      editedAt: '2026-04-20T13:00:00Z',
    };
    let editedHandler: ((msg: DmMessagePayload) => void) | undefined;
    const mockSocket = {
      on: vi.fn((event: string, handler: (msg: DmMessagePayload) => void) => {
        if (event === DM_EVENTS.MESSAGE_EDITED) editedHandler = handler;
      }),
      off: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };
    vi.mocked(io).mockReturnValue(mockSocket as unknown as ReturnType<typeof io>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['dm', 'messages', 'thread-1'], {
      pages: [[mockMessage]],
      pageParams: [null],
    });

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useDmSocket(), { wrapper });

    editedHandler?.(editedMessage);

    const cached = queryClient.getQueryData<{ pages: DmMessagePayload[][] }>([
      'dm',
      'messages',
      'thread-1',
    ]);
    expect(cached?.pages[0]?.[0]).toEqual(editedMessage);
  });

  it('marks message deletedAt in cache on MESSAGE_DELETED event', () => {
    const deletedPayload = { id: 'msg-1', threadId: 'thread-1', deletedAt: '2026-04-20T14:00:00Z' };
    let deletedHandler:
      | ((payload: { id: string; threadId: string; deletedAt: string }) => void)
      | undefined;
    const mockSocket = {
      on: vi.fn(
        (
          event: string,
          handler: (payload: { id: string; threadId: string; deletedAt: string }) => void,
        ) => {
          if (event === DM_EVENTS.MESSAGE_DELETED) deletedHandler = handler;
        },
      ),
      off: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };
    vi.mocked(io).mockReturnValue(mockSocket as unknown as ReturnType<typeof io>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['dm', 'messages', 'thread-1'], {
      pages: [[mockMessage]],
      pageParams: [null],
    });

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useDmSocket(), { wrapper });

    deletedHandler?.(deletedPayload);

    const cached = queryClient.getQueryData<{ pages: DmMessagePayload[][] }>([
      'dm',
      'messages',
      'thread-1',
    ]);
    expect(cached?.pages[0]?.[0]?.deletedAt).toBe('2026-04-20T14:00:00Z');
  });

  describe('threads cache patching on MESSAGE_NEW', () => {
    const mockThread: DmThreadPayload = {
      id: 'thread-1',
      otherUserId: 'user-1',
      otherUsername: 'bob',
      lastMessage: null,
      unreadCount: 2,
    };

    function setupMessageNewTest() {
      let messageNewHandler: ((msg: DmMessagePayload) => void) | undefined;
      const mockSocket = {
        on: vi.fn((event: string, handler: (msg: DmMessagePayload) => void) => {
          if (event === DM_EVENTS.MESSAGE_NEW) messageNewHandler = handler;
        }),
        off: vi.fn(),
        disconnect: vi.fn(),
        connected: false,
      };
      vi.mocked(io).mockReturnValue(mockSocket as unknown as ReturnType<typeof io>);

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      // Pre-seed messages cache so the messages patch doesn't create a new entry
      queryClient.setQueryData(['dm', 'messages', 'thread-1'], {
        pages: [[mockMessage]],
        pageParams: [null],
      });
      // Pre-seed threads cache
      queryClient.setQueryData<DmThreadPayload[]>(['dm', 'threads'], [mockThread]);

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      renderHook(() => useDmSocket(), { wrapper });

      return { queryClient, fireMessageNew: (msg: DmMessagePayload) => messageNewHandler?.(msg) };
    }

    it('increments unreadCount and updates lastMessage for a background thread', () => {
      // Active view is a different thread — 'thread-1' is in the background
      useChatStore.setState({ activeView: { type: 'dm', threadId: 'thread-99' } });

      const { queryClient, fireMessageNew } = setupMessageNewTest();

      fireMessageNew(mockMessage);

      const threads = queryClient.getQueryData<DmThreadPayload[]>(['dm', 'threads']);
      const patched = threads?.find((t) => t.id === 'thread-1');
      expect(patched?.unreadCount).toBe(mockThread.unreadCount + 1);
      expect(patched?.lastMessage).toEqual(mockMessage);
    });

    it('does not increment unreadCount but still updates lastMessage for the active thread', () => {
      // Active view is exactly the thread that receives the new message
      useChatStore.setState({ activeView: { type: 'dm', threadId: 'thread-1' } });

      const { queryClient, fireMessageNew } = setupMessageNewTest();

      fireMessageNew(mockMessage);

      const threads = queryClient.getQueryData<DmThreadPayload[]>(['dm', 'threads']);
      const patched = threads?.find((t) => t.id === 'thread-1');
      expect(patched?.unreadCount).toBe(mockThread.unreadCount);
      expect(patched?.lastMessage).toEqual(mockMessage);
    });

    it('does not throw when the threads cache is empty/undefined', () => {
      useChatStore.setState({ activeView: null });

      let messageNewHandler: ((msg: DmMessagePayload) => void) | undefined;
      const mockSocket = {
        on: vi.fn((event: string, handler: (msg: DmMessagePayload) => void) => {
          if (event === DM_EVENTS.MESSAGE_NEW) messageNewHandler = handler;
        }),
        off: vi.fn(),
        disconnect: vi.fn(),
        connected: false,
      };
      vi.mocked(io).mockReturnValue(mockSocket as unknown as ReturnType<typeof io>);

      // QueryClient with NO threads cache set at all
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      queryClient.setQueryData(['dm', 'messages', 'thread-1'], {
        pages: [[mockMessage]],
        pageParams: [null],
      });

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      renderHook(() => useDmSocket(), { wrapper });

      expect(() => messageNewHandler?.(mockMessage)).not.toThrow();

      // Cache should still be undefined — nothing was written
      const threads = queryClient.getQueryData<DmThreadPayload[]>(['dm', 'threads']);
      expect(threads).toBeUndefined();
    });
  });
});
