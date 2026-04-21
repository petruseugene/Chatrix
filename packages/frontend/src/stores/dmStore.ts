import { create } from 'zustand';
import type { Socket } from 'socket.io-client';

interface DmState {
  activeThreadId: string | null;
  setActiveThread: (id: string | null) => void;
  socketConnected: boolean;
  setSocketConnected: (connected: boolean) => void;
  socket: Socket | null;
  setSocket: (socket: Socket | null) => void;
  activePendingRequestId: string | null;
  setActivePendingRequestId: (id: string | null) => void;
}

export const useDmStore = create<DmState>((set) => ({
  activeThreadId: null,
  setActiveThread: (id) => set({ activeThreadId: id }),
  socketConnected: false,
  setSocketConnected: (connected) => set({ socketConnected: connected }),
  socket: null,
  setSocket: (socket) => set({ socket }),
  activePendingRequestId: null,
  setActivePendingRequestId: (id) => set({ activePendingRequestId: id }),
}));
