import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from './notificationStore';

describe('notificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [] });
  });

  it('starts with an empty notifications array', () => {
    const { notifications } = useNotificationStore.getState();
    expect(notifications).toEqual([]);
  });

  it('addNotification sets read to false and assigns an id', () => {
    useNotificationStore.getState().addNotification({
      type: 'friend_declined',
      message: 'User declined your friend request',
      createdAt: '2026-04-21T10:00:00.000Z',
    });

    const { notifications } = useNotificationStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].read).toBe(false);
    expect(typeof notifications[0].id).toBe('string');
    expect(notifications[0].id.length).toBeGreaterThan(0);
  });

  it('addNotification preserves payload fields', () => {
    const payload = {
      type: 'friend_declined' as const,
      message: 'Alice declined your request',
      createdAt: '2026-04-21T12:00:00.000Z',
    };

    useNotificationStore.getState().addNotification(payload);

    const notification = useNotificationStore.getState().notifications[0];
    expect(notification.type).toBe('friend_declined');
    expect(notification.message).toBe('Alice declined your request');
    expect(notification.createdAt).toBe('2026-04-21T12:00:00.000Z');
  });

  it('markRead flips read to true for the correct entry only', () => {
    useNotificationStore.getState().addNotification({
      type: 'friend_declined',
      message: 'First',
      createdAt: '2026-04-21T10:00:00.000Z',
    });
    useNotificationStore.getState().addNotification({
      type: 'friend_declined',
      message: 'Second',
      createdAt: '2026-04-21T11:00:00.000Z',
    });

    const { notifications } = useNotificationStore.getState();
    const firstId = notifications[0].id;
    const secondId = notifications[1].id;

    useNotificationStore.getState().markRead(firstId);

    const updated = useNotificationStore.getState().notifications;
    const first = updated.find((n) => n.id === firstId);
    const second = updated.find((n) => n.id === secondId);
    expect(first?.read).toBe(true);
    expect(second?.read).toBe(false);
  });

  it('clearAll empties the notifications array', () => {
    useNotificationStore.getState().addNotification({
      type: 'friend_declined',
      message: 'One',
      createdAt: '2026-04-21T10:00:00.000Z',
    });
    useNotificationStore.getState().addNotification({
      type: 'friend_declined',
      message: 'Two',
      createdAt: '2026-04-21T11:00:00.000Z',
    });

    useNotificationStore.getState().clearAll();

    expect(useNotificationStore.getState().notifications).toEqual([]);
  });
});
