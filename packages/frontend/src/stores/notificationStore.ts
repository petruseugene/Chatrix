import { create } from 'zustand';

export interface Notification {
  id: string;
  type: 'friend_declined';
  message: string;
  createdAt: string;
  read: boolean;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (payload: Omit<Notification, 'id' | 'read'>) => void;
  markRead: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (payload) =>
    set((state) => ({
      notifications: [...state.notifications, { ...payload, id: crypto.randomUUID(), read: false }],
    })),
  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  clearAll: () => set({ notifications: [] }),
}));
