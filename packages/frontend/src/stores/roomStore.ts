import { create } from 'zustand';

interface RoomStore {
  typing: Record<string, Record<string, string>>; // roomId → userId → username
  setTyping: (roomId: string, userId: string, username: string) => void;
  clearTyping: (roomId: string, userId: string) => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  typing: {},
  setTyping: (roomId, userId, username) =>
    set((state) => ({
      typing: {
        ...state.typing,
        [roomId]: { ...state.typing[roomId], [userId]: username },
      },
    })),
  clearTyping: (roomId, userId) =>
    set((state) => {
      const roomTyping = { ...state.typing[roomId] };
      delete roomTyping[userId];
      return { typing: { ...state.typing, [roomId]: roomTyping } };
    }),
}));
