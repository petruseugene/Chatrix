import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { JwtPayload } from '@chatrix/shared';

// Mock authApi before importing the hooks
vi.mock('./authApi', () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  requestReset: vi.fn(),
  resetPassword: vi.fn(),
}));

import * as authApi from './authApi';
import { useAuthStore } from '../../stores/authStore';
import { useLogin, useRegister } from './useAuthMutations';

const mockUser: JwtPayload = {
  sub: 'user-123',
  email: 'alice@example.com',
  username: 'alice',
};
const mockToken = 'eyJ.test.token';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useLogin', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: null });
    vi.resetAllMocks();
  });

  it('calls setAuth with user and token on successful login', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      user: mockUser,
      accessToken: mockToken,
    });

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ email: 'alice@example.com', password: 'secret' });
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    const { user, accessToken } = useAuthStore.getState();
    expect(user).toEqual(mockUser);
    expect(accessToken).toBe(mockToken);
  });

  it('forwards error on login failure', async () => {
    const loginError = new Error('Invalid credentials');
    vi.mocked(authApi.login).mockRejectedValueOnce(loginError);

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ email: 'alice@example.com', password: 'wrong' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBe(loginError);
    // Store should remain empty
    const { user, accessToken } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(accessToken).toBeNull();
  });
});

describe('useRegister', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: null });
    vi.resetAllMocks();
  });

  it('calls setAuth with user and token on successful registration', async () => {
    vi.mocked(authApi.register).mockResolvedValueOnce({
      user: mockUser,
      accessToken: mockToken,
    });

    const { result } = renderHook(() => useRegister(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({
        email: 'alice@example.com',
        password: 'secret',
        username: 'alice',
      });
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    const { user, accessToken } = useAuthStore.getState();
    expect(user).toEqual(mockUser);
    expect(accessToken).toBe(mockToken);
  });

  it('forwards error on registration failure', async () => {
    const registerError = new Error('Email already taken');
    vi.mocked(authApi.register).mockRejectedValueOnce(registerError);

    const { result } = renderHook(() => useRegister(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({
        email: 'alice@example.com',
        password: 'secret',
        username: 'alice',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBe(registerError);
    const { user, accessToken } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(accessToken).toBeNull();
  });
});
