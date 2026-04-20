import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createElement } from 'react';

// Mock useAuthMutations before importing the page
vi.mock('./useAuthMutations', () => ({
  useResetPassword: vi.fn(),
}));

// Mock react-router-dom navigate (keep MemoryRouter real)
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import { useResetPassword } from './useAuthMutations';
import ResetPasswordPage from './ResetPasswordPage';

function createWrapper(initialEntries: string[] = ['/reset-password']) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, { initialEntries }, children),
    );
}

function renderPage(path = '/reset-password') {
  return render(createElement(ResetPasswordPage), { wrapper: createWrapper([path]) });
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: idle mutation
    vi.mocked(useResetPassword).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { mutate: vi.fn(), isPending: false, error: null } as any,
    );
  });

  // ── Missing token ─────────────────────────────────────────────────────────

  it('renders error state when token is absent', () => {
    renderPage('/reset-password');

    expect(screen.getByText('Invalid or missing reset token')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument();
    // Form fields must NOT be present
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
  });

  // ── Token present: form renders ───────────────────────────────────────────

  it('renders form when a valid token is in the URL', () => {
    renderPage('/reset-password?token=abc123');

    expect(screen.queryByText('Invalid or missing reset token')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  // ── Client-side validation: password mismatch ─────────────────────────────

  it('shows validation error when passwords do not match', async () => {
    const user = userEvent.setup();
    renderPage('/reset-password?token=abc123');

    await user.type(screen.getByLabelText(/new password/i), 'Password1!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Different1!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    });

    // Mutation must NOT have been called
    expect(vi.mocked(useResetPassword)().mutate).not.toHaveBeenCalled();
  });

  // ── Successful submit navigates ────────────────────────────────────────────

  it('navigates to /auth?tab=login on successful submit', async () => {
    const user = userEvent.setup();
    const mutateMock = vi.fn((_data, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    vi.mocked(useResetPassword).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { mutate: mutateMock, isPending: false, error: null } as any,
    );

    renderPage('/reset-password?token=my-token');

    await user.type(screen.getByLabelText(/new password/i), 'StrongPass1!');
    await user.type(screen.getByLabelText(/confirm password/i), 'StrongPass1!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        { token: 'my-token', newPassword: 'StrongPass1!' },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith('/auth?tab=login');
  });

  // ── API error renders inline alert ────────────────────────────────────────

  it('renders inline error alert when mutation returns an error', () => {
    vi.mocked(useResetPassword).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { mutate: vi.fn(), isPending: false, error: new Error('Token expired or invalid') } as any,
    );

    renderPage('/reset-password?token=bad-token');

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Token expired or invalid')).toBeInTheDocument();
  });
});
