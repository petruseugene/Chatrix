import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';

// Mock the hooks
vi.mock('./useFriendshipMutations', () => ({
  usePendingRequests: vi.fn(),
  useSendFriendRequest: vi.fn(),
  useAcceptRequest: vi.fn(),
  useDeclineRequest: vi.fn(),
}));

import {
  usePendingRequests,
  useSendFriendRequest,
  useAcceptRequest,
  useDeclineRequest,
} from './useFriendshipMutations';
import FriendRequests from './FriendRequests';
import type { FriendRequestDto } from './friendshipApi';

const mockRequests: FriendRequestDto[] = [
  {
    id: 'req-1',
    fromUserId: 'user-2',
    fromUsername: 'bob',
    fromUserCreatedAt: '2025-06-01T00:00:00Z',
    createdAt: '2026-01-02T00:00:00Z',
  },
  {
    id: 'req-2',
    fromUserId: 'user-3',
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

function renderFriendRequests() {
  return render(<FriendRequests />, { wrapper: createWrapper() });
}

function createMockMutation(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    isSuccess: false,
    isIdle: true,
    data: undefined,
    variables: undefined,
    status: 'idle',
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('FriendRequests', () => {
  const mockSendMutate = vi.fn();
  const mockAcceptMutate = vi.fn();
  const mockDeclineMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePendingRequests).mockReturnValue({
      data: mockRequests,
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(useSendFriendRequest).mockReturnValue(createMockMutation({ mutate: mockSendMutate }));
    vi.mocked(useAcceptRequest).mockReturnValue(createMockMutation({ mutate: mockAcceptMutate }));
    vi.mocked(useDeclineRequest).mockReturnValue(createMockMutation({ mutate: mockDeclineMutate }));
  });

  it('renders the send friend request form with a text field and Send button', () => {
    renderFriendRequests();

    expect(screen.getByRole('textbox', { name: /username/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('shows validation error when submitting empty username', async () => {
    const user = userEvent.setup();
    renderFriendRequests();

    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 3/i)).toBeInTheDocument();
    });
    expect(mockSendMutate).not.toHaveBeenCalled();
  });

  it('shows validation error when username is too short', async () => {
    const user = userEvent.setup();
    renderFriendRequests();

    const input = screen.getByRole('textbox', { name: /username/i });
    await user.type(input, 'ab');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 3/i)).toBeInTheDocument();
    });
    expect(mockSendMutate).not.toHaveBeenCalled();
  });

  it('calls sendFriendRequest mutate with the username on valid submit', async () => {
    const user = userEvent.setup();
    renderFriendRequests();

    const input = screen.getByRole('textbox', { name: /username/i });
    await user.type(input, 'alice');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(mockSendMutate).toHaveBeenCalledWith(
        'alice',
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });
  });

  it('renders list of pending incoming requests with fromUsername', () => {
    renderFriendRequests();

    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('charlie')).toBeInTheDocument();
  });

  it('renders Accept and Decline buttons for each pending request', () => {
    renderFriendRequests();

    const acceptButtons = screen.getAllByRole('button', { name: /accept/i });
    const declineButtons = screen.getAllByRole('button', { name: /decline/i });

    expect(acceptButtons).toHaveLength(2);
    expect(declineButtons).toHaveLength(2);
  });

  it('calls acceptRequest mutate with correct requestId when Accept is clicked', async () => {
    const user = userEvent.setup();
    renderFriendRequests();

    const [firstAccept] = screen.getAllByRole('button', { name: /accept/i });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await user.click(firstAccept!);

    expect(mockAcceptMutate).toHaveBeenCalledWith('req-1');
  });

  it('calls declineRequest mutate with correct requestId when Decline is clicked', async () => {
    const user = userEvent.setup();
    renderFriendRequests();

    const declineButtons = screen.getAllByRole('button', { name: /decline/i });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await user.click(declineButtons[1]!);

    expect(mockDeclineMutate).toHaveBeenCalledWith('req-2');
  });

  it('shows loading indicator when requests are loading', () => {
    vi.mocked(usePendingRequests).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderFriendRequests();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error alert when requests fetch fails', () => {
    vi.mocked(usePendingRequests).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderFriendRequests();

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows error alert when send friend request fails', () => {
    vi.mocked(useSendFriendRequest).mockReturnValue(
      createMockMutation({
        mutate: mockSendMutate,
        isError: true,
        error: new Error('User not found'),
      }),
    );

    renderFriendRequests();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/user not found/i)).toBeInTheDocument();
  });

  it('shows empty state when there are no pending requests', () => {
    vi.mocked(usePendingRequests).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderFriendRequests();

    expect(screen.getByText(/no pending/i)).toBeInTheDocument();
  });
});
