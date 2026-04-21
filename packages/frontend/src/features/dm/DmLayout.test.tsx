import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { DmThreadPayload } from '@chatrix/shared';
import type { FriendRequestDto } from '../friendship/friendshipApi';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// useDmSocket — no-op
vi.mock('./useDmSocket', () => ({ useDmSocket: () => undefined }));

// useFriendSocket — no-op (new hook wired into DmLayout)
vi.mock('./useFriendSocket', () => ({ useFriendSocket: () => undefined }));

// useThreads — returns typed result; overridable per test
type ThreadsResult = { data: DmThreadPayload[] | undefined };
const mockUseThreads = vi.fn<[], ThreadsResult>(() => ({ data: [] }));
vi.mock('./useDmQueries', () => ({
  useThreads: () => mockUseThreads(),
  useStartThread: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

// usePendingRequests — returns typed result; overridable per test
type PendingResult = { data: FriendRequestDto[] | undefined };
const mockUsePendingRequests = vi.fn<[], PendingResult>(() => ({ data: [] }));
vi.mock('../friendship/useFriendshipMutations', () => ({
  usePendingRequests: () => mockUsePendingRequests(),
  useAcceptRequest: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useDeclineRequest: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

// authStore — provide a token so queries are enabled
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { accessToken: string }) => unknown) =>
    selector({ accessToken: 'test-token' }),
}));

// notificationStore — no-op
vi.mock('../../stores/notificationStore', () => ({
  useNotificationStore: (selector: (s: { notifications: unknown[] }) => unknown) =>
    selector({ notifications: [] }),
}));

// dmStore — injectable state via module-level mutable vars
let mockActiveThreadId: string | null = null;
let mockActivePendingRequestId: string | null = null;

const mockSetActiveThread = vi.fn();
const mockSetActivePendingRequestId = vi.fn();

vi.mock('../../stores/dmStore', () => ({
  useDmStore: (
    selector: (s: {
      activeThreadId: string | null;
      setActiveThread: (id: string | null) => void;
      activePendingRequestId: string | null;
      setActivePendingRequestId: (id: string | null) => void;
      socket: null;
      socketConnected: boolean;
      setSocketConnected: (v: boolean) => void;
      setSocket: (s: null) => void;
    }) => unknown,
  ) =>
    selector({
      get activeThreadId() {
        return mockActiveThreadId;
      },
      setActiveThread: mockSetActiveThread,
      get activePendingRequestId() {
        return mockActivePendingRequestId;
      },
      setActivePendingRequestId: mockSetActivePendingRequestId,
      socket: null,
      socketConnected: false,
      setSocketConnected: vi.fn(),
      setSocket: vi.fn(),
    }),
}));

// Stub heavy sub-components
vi.mock('./DmThreadList', () => ({
  default: () => <div data-testid="dm-thread-list" />,
}));
vi.mock('./DmChatWindow', () => ({
  default: ({ thread }: { thread: { id: string } }) => (
    <div data-testid="dm-chat-window" data-thread-id={thread.id} />
  ),
}));
vi.mock('./PendingInvitePanel', () => ({
  PendingInvitePanel: ({ fromUsername }: { fromUsername: string }) => (
    <div data-testid="pending-invite-panel" data-username={fromUsername} />
  ),
}));
vi.mock('../../components/NotificationBell', () => ({
  default: () => <div data-testid="notification-bell" />,
}));

// ---------------------------------------------------------------------------
// Component under test (imported after all vi.mock() calls)
// ---------------------------------------------------------------------------
import DmLayout from './DmLayout';

function renderDmLayout() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DmLayout />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const THREAD_FIXTURE: DmThreadPayload = {
  id: 'thread-1',
  otherUserId: 'u1',
  otherUsername: 'alice',
  lastMessage: null,
  unreadCount: 0,
};

const REQUEST_FIXTURE: FriendRequestDto = {
  id: 'req-1',
  fromUserId: 'u2',
  fromUsername: 'bob',
  fromUserCreatedAt: '2024-01-01T00:00:00.000Z',
  createdAt: '2025-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockActiveThreadId = null;
  mockActivePendingRequestId = null;
  mockUseThreads.mockReturnValue({ data: [] });
  mockUsePendingRequests.mockReturnValue({ data: [] });
  vi.clearAllMocks();
});

describe('DmLayout', () => {
  describe('EmptyState (default)', () => {
    it('renders EmptyState when no thread and no pending request are active', () => {
      renderDmLayout();
      expect(screen.getByText('Select a conversation')).toBeInTheDocument();
    });
  });

  describe('DmChatWindow', () => {
    it('renders DmChatWindow when activeThreadId matches a loaded thread', () => {
      mockActiveThreadId = 'thread-1';
      mockUseThreads.mockReturnValue({ data: [THREAD_FIXTURE] });
      renderDmLayout();
      expect(screen.getByTestId('dm-chat-window')).toBeInTheDocument();
      expect(screen.queryByText('Select a conversation')).not.toBeInTheDocument();
    });
  });

  describe('PendingInvitePanel', () => {
    it('renders PendingInvitePanel when activePendingRequestId is set and request is found', () => {
      mockActivePendingRequestId = 'req-1';
      mockUsePendingRequests.mockReturnValue({ data: [REQUEST_FIXTURE] });
      renderDmLayout();
      expect(screen.getByTestId('pending-invite-panel')).toBeInTheDocument();
      expect(screen.getByTestId('pending-invite-panel')).toHaveAttribute('data-username', 'bob');
      // EmptyState must not show
      expect(screen.queryByText('Select a conversation')).not.toBeInTheDocument();
    });

    it('falls back to EmptyState when activePendingRequestId is set but request is not in data', () => {
      mockActivePendingRequestId = 'req-999';
      mockUsePendingRequests.mockReturnValue({ data: [] });
      renderDmLayout();
      expect(screen.queryByTestId('pending-invite-panel')).not.toBeInTheDocument();
      expect(screen.getByText('Select a conversation')).toBeInTheDocument();
    });
  });

  describe('NotificationBell', () => {
    it('renders NotificationBell in the right pane regardless of active state', () => {
      renderDmLayout();
      expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    });
  });

  describe('priority: PendingInvitePanel over DmChatWindow', () => {
    it('shows PendingInvitePanel and hides DmChatWindow when both ids are active', () => {
      mockActivePendingRequestId = 'req-1';
      mockActiveThreadId = 'thread-1';
      mockUseThreads.mockReturnValue({ data: [THREAD_FIXTURE] });
      mockUsePendingRequests.mockReturnValue({ data: [REQUEST_FIXTURE] });
      renderDmLayout();
      expect(screen.getByTestId('pending-invite-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('dm-chat-window')).not.toBeInTheDocument();
    });
  });
});
