import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createElement } from 'react';
import type { ReactNode } from 'react';

// Mock useAuthMutations
vi.mock('./useAuthMutations', () => ({
  useLogin: vi.fn(),
}));

// Mock react-router-dom navigate (keep MemoryRouter real, just mock useNavigate)
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import { useLogin } from './useAuthMutations';
import LoginForm from './LoginForm';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, null, children),
    );
}

function renderLoginForm() {
  return render(<LoginForm />, { wrapper: createWrapper() });
}

describe('LoginForm', () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    vi.mocked(useLogin).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: null,
      // Minimal TanStack Query mutation result shape
      isError: false,
      isSuccess: false,
      isIdle: true,
      data: undefined,
      variables: undefined,
      status: 'idle',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it('shows validation errors when submitting empty form', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      // Email validation error from zod — "Invalid email"
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });

    // Password field required error
    expect(screen.getByText(/string must contain at least 1 character/i)).toBeInTheDocument();
  });

  it('calls mutate with correct email and password on valid submit', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await user.type(screen.getByLabelText(/^email$/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        { email: 'alice@example.com', password: 'secret123' },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });
  });

  it('renders error alert when mutation fails', async () => {
    const errorMessage = 'Invalid credentials';
    vi.mocked(useLogin).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: new Error(errorMessage),
      isError: true,
      isSuccess: false,
      isIdle: false,
      data: undefined,
      variables: undefined,
      status: 'error',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderLoginForm();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('shows loading spinner while mutation is pending', () => {
    vi.mocked(useLogin).mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      error: null,
      isError: false,
      isSuccess: false,
      isIdle: false,
      data: undefined,
      variables: undefined,
      status: 'pending',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderLoginForm();

    // Submit button should be disabled and show a progress indicator (CircularProgress)
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    // All buttons with type="submit" should be disabled
    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find((b) => b.getAttribute('type') === 'submit');
    expect(submitButton).toBeDefined();
    expect(submitButton).toBeDisabled();
    // CircularProgress renders an svg role="progressbar"
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders "Forgot password?" link pointing to /forgot-password', () => {
    renderLoginForm();

    const link = screen.getByRole('link', { name: /forgot password/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/forgot-password');
  });
});
