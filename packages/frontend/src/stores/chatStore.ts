import { create } from 'zustand';

type DmView = { type: 'dm'; threadId: string };
type RoomView = { type: 'room'; roomId: string };
type ActiveView = DmView | RoomView | null;

interface ChatStore {
  activeView: ActiveView;
  setActiveDm: (threadId: string) => void;
  setActiveRoom: (roomId: string) => void;
  clearActive: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  activeView: null,
  setActiveDm: (threadId) => set({ activeView: { type: 'dm', threadId } }),
  setActiveRoom: (roomId) => set({ activeView: { type: 'room', roomId } }),
  clearActive: () => set({ activeView: null }),
}));
