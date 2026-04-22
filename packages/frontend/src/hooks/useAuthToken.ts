import { useAuthStore } from '../stores/authStore';

/**
 * Returns the current JWT access token.
 * Throws if the user is not authenticated — callers must only use this hook
 * inside protected routes where an auth guard ensures a token is present.
 */
export function useAuthToken(): string {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) {
    throw new Error('useAuthToken: no access token — user is not authenticated');
  }
  return accessToken;
}
