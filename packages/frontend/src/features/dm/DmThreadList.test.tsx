import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';

// Mock hooks
vi.mock('./useDmQueries', () => ({
  useThreads: vi.fn(),
}));

vi.mock('../friendship/useFriendshipMutations', () => ({
  usePendingRequests: vi.fn(),
}));

vi.mock('../../stores/dmStore', () => ({
  useDmStore: vi.fn(),
}));

vi.mock('../../stores/presenceStore', () => ({
  usePresenceStore: vi.fn(),
}));

import { useThreads } from './useDmQueries';
import { usePendingRequests } from '../friendship/useFriendshipMutations';
import { useDmStore } from '../../stores/dmStore';
import { usePresenceStore } from '../../stores/presenceStore';
import DmThreadList from './DmThreadList';
import type { DmThreadPayload } from '@chatrix/shared';
import type { FriendRequestDto } from '../friendship/friendshipApi';

const mockThreads: DmThreadPayload[] = [
  {
    id: 'thread-1',
    otherUserId: 'user-2',
    otherUsername: 'alice',
    unreadCount: 0,
    lastMessage: null,
  },
];

const mockRequests: FriendRequestDto[] = [
  {
    id: 'req-1',
    fromUserId: 'user-3',
    fromUsername: 'bob',
    fromUserCreatedAt: '2025-06-01T00:00:00Z',
    createdAt: '2026-01-02T00:00:00Z',
  },
  {
    id: 'req-2',
    fromUserId: 'user-4',
    fromUsername: 'charlie',
    fromUserCreatedAt: '2025-07-01T00:00:00Z',
    createdAt: '2026-01-03T00:00:00Z',
  },
];

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function renderDmThreadList() {
  return render(<DmThreadList />, { wrapper: createWrapper() });
}

describe('DmThreadList', () => {
  const mockSetActiveThread = vi.fn();
  const mockSetActivePendingRequestId = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useDmStore).mockImplementation((selector) => {
      const state = {
        activeThreadId: null,
        setActiveThread: mockSetActiveThread,
        setActivePendingRequestId: mockSetActivePendingRequestId,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return selector(state as any);
    });

    vi.mocked(useThreads).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    vi.mocked(usePendingRequests).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // Default: no statuses
    vi.mocked(usePresenceStore).mockImplementation((selector) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return selector({ statuses: {} } as any);
    });
  });

  it('shows "No conversations yet" when both threads and pending requests are empty', () => {
    renderDmThreadList();
    expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
  });

  it('does not show "No conversations yet" when there are pending requests but no threads', () => {
    vi.mocked(usePendingRequests).mockReturnValue({
      data: mockRequests,
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderDmThreadList();
    expect(screen.queryByText(/no conversations yet/i)).not.toBeInTheDocument();
  });

  it('does not show "No conversations yet" when there are threads but no pending requests', () => {
    vi.mocked(useThreads).mockReturnValue({
      data: mockThreads,
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderDmThreadList();
    expect(screen.queryByText(/no conversations yet/i)).not.toBeInTheDocument();
  });

  it('renders pending request rows with fromUsername when pending requests exist', () => {
    vi.mocked(usePendingRequests).mockReturnValue({
      data: mockRequests,
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderDmThreadList();

    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('charlie')).toBeInTheDocument();
  });

  it('renders pending requests above active thread rows', () => {
    vi.mocked(useThreads).mockReturnValue({
      data: mockThreads,
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(usePendingRequests).mockReturnValue({
      data: mockRequests,
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderDmThreadList();

    // All names should be visible
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('charlie')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();

    // Pending requests appear before threads in DOM order
    const allButtons = screen.getAllByRole('button');
    const bobButtonIndex = allButtons.findIndex((b) => b.textContent?.includes('bob'));
    const aliceButtonIndex = allButtons.findIndex((b) => b.textContent?.includes('alice'));
    expect(bobButtonIndex).toBeLessThan(aliceButtonIndex);
  });

  it('calls setActivePendingRequestId with request id when a pending request row is clicked', async () => {
    const user = userEvent.setup();

    vi.mocked(usePendingRequests).mockReturnValue({
      data: mockRequests,
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderDmThreadList();

    const bobButton = screen.getAllByRole('button').find((b) => b.textContent?.includes('bob'));
    expect(bobButton).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await user.click(bobButton!);

    expect(mockSetActivePendingRequestId).toHaveBeenCalledWith('req-1');
  });

  describe('presence dot on ThreadRow', () => {
    it('shows a presence dot with online status when the other user is online', () => {
      vi.mocked(useThreads).mockReturnValue({
        data: mockThreads,
        isLoading: false,
        isError: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      vi.mocked(usePresenceStore).mockImplementation((selector) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return selector({ statuses: { 'user-2': 'online' } } as any);
      });

      renderDmThreadList();

      const dot = screen.getByTestId('presence-dot');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveAttribute('data-presence', 'online');
    });

    it('shows a presence dot with afk status when the other user is afk', () => {
      vi.mocked(useThreads).mockReturnValue({
        data: mockThreads,
        isLoading: false,
        isError: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      vi.mocked(usePresenceStore).mockImplementation((selector) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return selector({ statuses: { 'user-2': 'afk' } } as any);
      });

      renderDmThreadList();

      const dot = screen.getByTestId('presence-dot');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveAttribute('data-presence', 'afk');
    });

    it('shows a presence dot with offline status when the other user is offline', () => {
      vi.mocked(useThreads).mockReturnValue({
        data: mockThreads,
        isLoading: false,
        isError: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      vi.mocked(usePresenceStore).mockImplementation((selector) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return selector({ statuses: { 'user-2': 'offline' } } as any);
      });

      renderDmThreadList();

      const dot = screen.getByTestId('presence-dot');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveAttribute('data-presence', 'offline');
    });

    it('defaults to offline presence dot when no status is found for the user', () => {
      vi.mocked(useThreads).mockReturnValue({
        data: mockThreads,
        isLoading: false,
        isError: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      // presenceStore returns empty statuses (default beforeEach)

      renderDmThreadList();

      const dot = screen.getByTestId('presence-dot');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveAttribute('data-presence', 'offline');
    });
  });
});
