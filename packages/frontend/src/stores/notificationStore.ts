import { create } from 'zustand';

export interface Notification {
  id: string;
  type: 'friend_declined' | 'friend_request';
  message: string;
  createdAt: string;
  read: boolean;
  requestId?: string;
}

export interface Toast {
  id: string;
  type: Notification['type'];
  message: string;
  requestId?: string;
}

interface NotificationState {
  notifications: Notification[];
  toasts: Toast[];
  addNotification: (payload: Omit<Notification, 'id' | 'read'>) => void;
  markRead: (id: string) => void;
  clearAll: () => void;
  dismissToast: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  toasts: [],
  addNotification: (payload) => {
    const id = crypto.randomUUID();
    set((state) => ({
      notifications: [...state.notifications, { ...payload, id, read: false }],
      toasts: [
        ...state.toasts,
        {
          id,
          type: payload.type,
          message: payload.message,
          ...(payload.requestId !== undefined && { requestId: payload.requestId }),
        },
      ],
    }));
  },
  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  clearAll: () => set({ notifications: [] }),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
