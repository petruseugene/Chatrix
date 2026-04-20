import { useMutation } from '@tanstack/react-query';
import * as authApi from './authApi';
import { useAuthStore } from '../../stores/authStore';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ user, accessToken }) => setAuth(user, accessToken),
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: ({ user, accessToken }) => setAuth(user, accessToken),
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => clearAuth(),
  });
}

export function useRequestReset() {
  return useMutation({
    mutationFn: authApi.requestReset,
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: authApi.resetPassword,
  });
}
