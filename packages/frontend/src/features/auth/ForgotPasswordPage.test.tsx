import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ForgotPasswordPage from './ForgotPasswordPage';

// Mock the mutation hook so we can control its behaviour per-test
vi.mock('./useAuthMutations', () => ({
  useRequestReset: vi.fn(),
}));

import { useRequestReset } from './useAuthMutations';

const mockedUseRequestReset = vi.mocked(useRequestReset);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/forgot-password']}>
        <ForgotPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ForgotPasswordPage', () => {
  it('shows an email validation error when submitted empty', async () => {
    mockedUseRequestReset.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useRequestReset>);

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('replaces the form with a success message after a successful mutation', async () => {
    let capturedOnSuccess: (() => void) | undefined;

    mockedUseRequestReset.mockReturnValue({
      mutate: vi.fn((_data, options?: { onSuccess?: () => void }) => {
        capturedOnSuccess = options?.onSuccess;
      }),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useRequestReset>);

    renderPage();

    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    // Trigger the onSuccess callback manually
    await waitFor(() => expect(capturedOnSuccess).toBeDefined());
    capturedOnSuccess!();

    await waitFor(() => {
      expect(screen.getByText(/check your email for a reset link/i)).toBeInTheDocument();
    });

    // Form inputs should no longer be visible
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it('shows "Back to login" link in the form state', () => {
    mockedUseRequestReset.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useRequestReset>);

    renderPage();

    expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument();
  });

  it('shows "Back to login" button in the success state', async () => {
    let capturedOnSuccess: (() => void) | undefined;

    mockedUseRequestReset.mockReturnValue({
      mutate: vi.fn((_data, options?: { onSuccess?: () => void }) => {
        capturedOnSuccess = options?.onSuccess;
      }),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useRequestReset>);

    renderPage();

    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => expect(capturedOnSuccess).toBeDefined());
    capturedOnSuccess!();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument();
    });
  });
});
