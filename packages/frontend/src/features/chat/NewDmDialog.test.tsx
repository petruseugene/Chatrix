import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { FriendDto } from '../friendship/friendshipApi';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../friendship/useFriendshipMutations', () => ({
  useFriends: vi.fn(),
  useUserSearch: vi.fn(),
  useSendFriendRequest: vi.fn(),
  useAcceptRequest: vi.fn(),
  SEARCH_KEY: ['search'],
}));

vi.mock('../dm/useDmQueries', () => ({
  useStartThread: vi.fn(),
}));

vi.mock('../../stores/chatStore', () => ({
  useChatStore: (selector: (s: { setActiveDm: () => void }) => unknown) =>
    selector({ setActiveDm: vi.fn() }),
}));

// usePresenceStore is called as a reactive selector: usePresenceStore((s) => s.statuses)
// The mock must be a callable function that accepts a selector and applies it to a state object.
let mockPresenceStatuses: Record<string, string> = {};
vi.mock('../../stores/presenceStore', () => ({
  usePresenceStore: (selector: (s: { statuses: Record<string, string> }) => unknown) =>
    selector({ statuses: mockPresenceStatuses }),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { accessToken: string }) => unknown) =>
    selector({ accessToken: 'test-token' }),
}));

import {
  useFriends,
  useUserSearch,
  useSendFriendRequest,
  useAcceptRequest,
} from '../friendship/useFriendshipMutations';
import { useStartThread } from '../dm/useDmQueries';
import NewDmDialog from './NewDmDialog';

const FRIEND_FIXTURE: FriendDto = {
  friendId: 'u1',
  username: 'alice',
  createdAt: '2024-01-01T00:00:00.000Z',
};

function renderDialog(open = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NewDmDialog open={open} onClose={() => undefined} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(useFriends).mockReturnValue({
    data: [FRIEND_FIXTURE],
    isLoading: false,
    isError: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  vi.mocked(useUserSearch).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  vi.mocked(useSendFriendRequest).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  vi.mocked(useAcceptRequest).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  vi.mocked(useStartThread).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    reset: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // Default: no presence statuses
  mockPresenceStatuses = {};
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NewDmDialog', () => {
  describe('FriendRow presence dot', () => {
    it('passes online presence to FriendRow when friend status is online', () => {
      mockPresenceStatuses = { u1: 'online' };

      renderDialog();

      const dot = screen.getByTestId('presence-dot');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveAttribute('data-presence', 'online');
    });

    it('passes afk presence to FriendRow when friend status is afk', () => {
      mockPresenceStatuses = { u1: 'afk' };

      renderDialog();

      const dot = screen.getByTestId('presence-dot');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveAttribute('data-presence', 'afk');
    });

    it('defaults to offline presence for FriendRow when no status is available', () => {
      renderDialog();

      const dot = screen.getByTestId('presence-dot');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveAttribute('data-presence', 'offline');
    });
  });
});
