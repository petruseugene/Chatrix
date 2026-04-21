import { create } from 'zustand';
import type { FriendPresence, PresenceStatus } from '@chatrix/shared';

interface PresenceState {
  statuses: Record<string, PresenceStatus>;
  setStatus: (userId: string, status: PresenceStatus) => void;
  setMany: (presences: FriendPresence[]) => void;
  clearAll: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  statuses: {},
  setStatus: (userId, status) =>
    set((state) => ({
      statuses: { ...state.statuses, [userId]: status },
    })),
  setMany: (presences) =>
    set({
      statuses: Object.fromEntries(presences.map((p) => [p.userId, p.status])),
    }),
  clearAll: () => set({ statuses: {} }),
}));
