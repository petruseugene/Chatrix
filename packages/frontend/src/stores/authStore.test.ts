import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';
import type { JwtPayload } from '@chatrix/shared';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: null });
  });

  it('has null user in initial state', () => {
    const { user } = useAuthStore.getState();
    expect(user).toBeNull();
  });

  it('has null accessToken in initial state', () => {
    const { accessToken } = useAuthStore.getState();
    expect(accessToken).toBeNull();
  });

  it('setAuth sets user and accessToken', () => {
    const payload: JwtPayload = {
      sub: 'user-123',
      email: 'alice@example.com',
      username: 'alice',
    };
    const token = 'eyJ.test.token';

    useAuthStore.getState().setAuth(payload, token);

    const { user, accessToken } = useAuthStore.getState();
    expect(user).toEqual(payload);
    expect(accessToken).toBe(token);
  });

  it('clearAuth resets user and accessToken to null', () => {
    const payload: JwtPayload = {
      sub: 'user-123',
      email: 'alice@example.com',
      username: 'alice',
    };
    useAuthStore.getState().setAuth(payload, 'eyJ.test.token');

    useAuthStore.getState().clearAuth();

    const { user, accessToken } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(accessToken).toBeNull();
  });
});
