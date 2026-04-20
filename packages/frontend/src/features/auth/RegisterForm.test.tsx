import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createElement } from 'react';
import type { ReactNode } from 'react';

// Mock useAuthMutations
vi.mock('./useAuthMutations', () => ({
  useRegister: vi.fn(),
}));

// Mock react-router-dom navigate (keep MemoryRouter real, just mock useNavigate)
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import { useRegister } from './useAuthMutations';
import RegisterForm from './RegisterForm';

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

function renderRegisterForm() {
  return render(<RegisterForm />, { wrapper: createWrapper() });
}

describe('RegisterForm', () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    vi.mocked(useRegister).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: null,
      isError: false,
      isSuccess: false,
      isIdle: true,
      data: undefined,
      variables: undefined,
      status: 'idle',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it('shows validation errors on all 3 fields when submitting empty form', async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      // Username: String must contain at least 3 character(s)
      expect(screen.getByText(/string must contain at least 3 character/i)).toBeInTheDocument();
    });

    // Email validation error
    expect(screen.getByText(/invalid email/i)).toBeInTheDocument();

    // Password validation error — min 8 chars
    expect(screen.getByText(/string must contain at least 8 character/i)).toBeInTheDocument();
  });

  it('shows username regex error on invalid input with a space', async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    await user.type(screen.getByLabelText(/^username$/i), 'user name');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/username may only contain letters, numbers, hyphens, and underscores/i),
      ).toBeInTheDocument();
    });
  });

  it('calls mutate with correct values on valid submit', async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    await user.type(screen.getByLabelText(/^username$/i), 'alice_99');
    await user.type(screen.getByLabelText(/^email$/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'strongpass1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        { username: 'alice_99', email: 'alice@example.com', password: 'strongpass1' },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });
  });

  it('renders error alert when mutation fails', () => {
    const errorMessage = 'Username already taken';
    vi.mocked(useRegister).mockReturnValue({
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

    renderRegisterForm();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('shows loading spinner and disables submit button while mutation is pending', () => {
    vi.mocked(useRegister).mockReturnValue({
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

    renderRegisterForm();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find((b) => b.getAttribute('type') === 'submit');
    expect(submitButton).toBeDefined();
    expect(submitButton).toBeDisabled();
  });
});
