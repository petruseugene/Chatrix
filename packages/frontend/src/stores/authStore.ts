import { create } from 'zustand';
import type { JwtPayload } from '@chatrix/shared';

interface AuthState {
  user: JwtPayload | null;
  accessToken: string | null;
  setAuth: (user: JwtPayload, accessToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  clearAuth: () => set({ user: null, accessToken: null }),
}));
