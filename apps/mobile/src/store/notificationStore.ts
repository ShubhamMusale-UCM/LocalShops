import { create } from 'zustand';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) =>
    set({ notifications, unreadCount: notifications.filter(n => !n.isRead).length }),

  addNotification: (notification) => {
    const notifications = [notification, ...get().notifications];
    set({ notifications, unreadCount: notifications.filter(n => !n.isRead).length });
  },

  markRead: (id) => {
    const notifications = get().notifications.map(n =>
      n.id === id ? { ...n, isRead: true } : n
    );
    set({ notifications, unreadCount: notifications.filter(n => !n.isRead).length });
  },

  markAllRead: () => {
    const notifications = get().notifications.map(n => ({ ...n, isRead: true }));
    set({ notifications, unreadCount: 0 });
  },
}));
