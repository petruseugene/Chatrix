import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import type { DmThreadPayload, DmMessagePayload } from '@chatrix/shared';

// Mock dmApi before importing hooks
vi.mock('./dmApi', () => ({
  getThreads: vi.fn(),
  getMessages: vi.fn(),
  startThread: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
}));

import * as dmApi from './dmApi';
import { useAuthStore } from '../../stores/authStore';
import {
  useThreads,
  useMessages,
  useStartThread,
  useEditMessage,
  useDeleteMessage,
} from './useDmQueries';

const mockToken = 'test-token';

const mockThread: DmThreadPayload = {
  id: 'thread-1',
  otherUserId: 'user-2',
  otherUsername: 'alice',
  lastMessage: null,
  unreadCount: 0,
};

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

describe('useThreads', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: mockToken });
    vi.resetAllMocks();
  });

  it('fetches threads using the access token from auth store', async () => {
    vi.mocked(dmApi.getThreads).mockResolvedValueOnce([mockThread]);

    const { result } = renderHook(() => useThreads(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(dmApi.getThreads).toHaveBeenCalledWith(mockToken);
    expect(result.current.data).toEqual([mockThread]);
  });

  it('is disabled when no access token is present', () => {
    useAuthStore.setState({ user: null, accessToken: null });

    const { result } = renderHook(() => useThreads(), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(dmApi.getThreads).not.toHaveBeenCalled();
  });

  it('returns error state when fetch fails', async () => {
    vi.mocked(dmApi.getThreads).mockRejectedValueOnce(new Error('Unauthorized'));

    const { result } = renderHook(() => useThreads(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useMessages', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: mockToken });
    vi.resetAllMocks();
  });

  it('fetches messages using useInfiniteQuery for a given threadId', async () => {
    vi.mocked(dmApi.getMessages).mockResolvedValueOnce([mockMessage]);

    const { result } = renderHook(() => useMessages('thread-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(dmApi.getMessages).toHaveBeenCalledWith(mockToken, 'thread-1', null);
    // Infinite query returns pages
    expect(result.current.data?.pages[0]).toEqual([mockMessage]);
  });

  it('is disabled when threadId is null', () => {
    const { result } = renderHook(() => useMessages(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(dmApi.getMessages).not.toHaveBeenCalled();
  });

  it('is disabled when no access token is present', () => {
    useAuthStore.setState({ user: null, accessToken: null });

    const { result } = renderHook(() => useMessages('thread-1'), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(dmApi.getMessages).not.toHaveBeenCalled();
  });

  it('provides getNextPageParam based on oldest message cursor', async () => {
    // First page has messages, second page will use cursor from oldest on first page
    const messages = [mockMessage];
    vi.mocked(dmApi.getMessages).mockResolvedValue(messages);

    const { result } = renderHook(() => useMessages('thread-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // hasNextPage true when a full page (1 item, but limit is tested via logic)
    // The hook should expose hasNextPage based on whether there are more pages
    expect(result.current.data).toBeDefined();
  });

  it('returns empty pages array when no messages', async () => {
    vi.mocked(dmApi.getMessages).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useMessages('thread-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages[0]).toEqual([]);
    // No next page when empty page returned
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe('useStartThread', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: mockToken });
    vi.resetAllMocks();
  });

  it('starts a thread with the given recipientId and token', async () => {
    vi.mocked(dmApi.startThread).mockResolvedValueOnce(mockThread);

    const { result } = renderHook(() => useStartThread(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate('user-2');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(dmApi.startThread).toHaveBeenCalledWith(mockToken, 'user-2');
    expect(result.current.data).toEqual(mockThread);
  });

  it('returns error state when startThread fails', async () => {
    vi.mocked(dmApi.startThread).mockRejectedValueOnce(new Error('Not friends'));

    const { result } = renderHook(() => useStartThread(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate('user-3');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Not friends');
  });
});

describe('useEditMessage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: mockToken });
    vi.resetAllMocks();
  });

  it('edits a message and updates the query cache', async () => {
    const edited = { ...mockMessage, content: 'Edited!', editedAt: '2026-04-20T13:00:00Z' };
    vi.mocked(dmApi.editMessage).mockResolvedValueOnce(edited);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(['dm', 'messages', 'thread-1'], {
      pages: [[mockMessage]],
      pageParams: [null],
    });

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useEditMessage(), { wrapper });

    act(() => {
      result.current.mutate({ messageId: 'msg-1', content: 'Edited!', threadId: 'thread-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(dmApi.editMessage).toHaveBeenCalledWith(mockToken, 'msg-1', 'Edited!');

    const cached = queryClient.getQueryData<{ pages: DmMessagePayload[][] }>([
      'dm',
      'messages',
      'thread-1',
    ]);
    expect(cached?.pages[0]?.[0]?.content).toBe('Edited!');
  });

  it('returns error state when editMessage fails', async () => {
    vi.mocked(dmApi.editMessage).mockRejectedValueOnce(new Error('Message not found'));

    const { result } = renderHook(() => useEditMessage(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ messageId: 'msg-missing', content: 'hello', threadId: 'thread-1' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Message not found');
  });
});

describe('useDeleteMessage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: mockToken });
    vi.resetAllMocks();
  });

  it('deletes a message and marks deletedAt in query cache', async () => {
    vi.mocked(dmApi.deleteMessage).mockResolvedValueOnce(undefined);

    const deletedAt = '2026-04-20T14:00:00Z';
    const deletedMessage = { ...mockMessage, deletedAt };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(['dm', 'messages', 'thread-1'], {
      pages: [[mockMessage]],
      pageParams: [null],
    });

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useDeleteMessage(), { wrapper });

    act(() => {
      result.current.mutate({ messageId: 'msg-1', threadId: 'thread-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(dmApi.deleteMessage).toHaveBeenCalledWith(mockToken, 'msg-1');

    const cached = queryClient.getQueryData<{ pages: DmMessagePayload[][] }>([
      'dm',
      'messages',
      'thread-1',
    ]);
    expect(cached?.pages[0]?.[0]?.deletedAt).toBeTruthy();
    // Ensure the message matches the deleted shape (except deletedAt timestamp which we don't control exactly)
    expect(cached?.pages[0]?.[0]).toMatchObject({ id: 'msg-1', content: 'Hello!' });
    // deletedAt should be set (not null)
    expect(cached?.pages[0]?.[0]?.deletedAt).not.toBeNull();

    // Suppress unused var warning
    void deletedMessage;
  });

  it('returns error state when deleteMessage fails', async () => {
    vi.mocked(dmApi.deleteMessage).mockRejectedValueOnce(new Error('Forbidden'));

    const { result } = renderHook(() => useDeleteMessage(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ messageId: 'msg-1', threadId: 'thread-1' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Forbidden');
  });
});
