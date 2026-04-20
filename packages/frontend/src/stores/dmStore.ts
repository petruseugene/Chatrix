import { create } from 'zustand';

interface DmState {
  activeThreadId: string | null;
  setActiveThread: (id: string | null) => void;
  socketConnected: boolean;
  setSocketConnected: (connected: boolean) => void;
}

export const useDmStore = create<DmState>((set) => ({
  activeThreadId: null,
  setActiveThread: (id) => set({ activeThreadId: id }),
  socketConnected: false,
  setSocketConnected: (connected) => set({ socketConnected: connected }),
}));
