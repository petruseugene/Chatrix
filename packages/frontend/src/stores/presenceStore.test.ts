import { describe, it, expect, beforeEach } from 'vitest';
import type { FriendPresence } from '@chatrix/shared';
import { usePresenceStore } from './presenceStore';

describe('presenceStore', () => {
  beforeEach(() => {
    usePresenceStore.setState({ statuses: {} });
  });

  it('starts with an empty statuses map', () => {
    const { statuses } = usePresenceStore.getState();
    expect(statuses).toEqual({});
  });

  it('setStatus sets a single entry', () => {
    usePresenceStore.getState().setStatus('user-1', 'online');

    const { statuses } = usePresenceStore.getState();
    expect(statuses['user-1']).toBe('online');
  });

  it('setStatus overwrites an existing entry', () => {
    usePresenceStore.getState().setStatus('user-1', 'online');
    usePresenceStore.getState().setStatus('user-1', 'afk');

    expect(usePresenceStore.getState().statuses['user-1']).toBe('afk');
  });

  it('setStatus does not affect other entries', () => {
    usePresenceStore.getState().setStatus('user-1', 'online');
    usePresenceStore.getState().setStatus('user-2', 'offline');

    const { statuses } = usePresenceStore.getState();
    expect(statuses['user-1']).toBe('online');
    expect(statuses['user-2']).toBe('offline');
  });

  it('setMany bulk-initialises from a FriendPresence array and replaces all entries', () => {
    usePresenceStore.getState().setStatus('old-user', 'online');

    const presences: FriendPresence[] = [
      { userId: 'user-1', username: 'alice', status: 'online' },
      { userId: 'user-2', username: 'bob', status: 'afk' },
      { userId: 'user-3', username: 'carol', status: 'offline' },
    ];

    usePresenceStore.getState().setMany(presences);

    const { statuses } = usePresenceStore.getState();
    expect(statuses['user-1']).toBe('online');
    expect(statuses['user-2']).toBe('afk');
    expect(statuses['user-3']).toBe('offline');
    expect('old-user' in statuses).toBe(false);
  });

  it('setMany with an empty array clears all entries', () => {
    usePresenceStore.getState().setStatus('user-1', 'online');

    usePresenceStore.getState().setMany([]);

    expect(usePresenceStore.getState().statuses).toEqual({});
  });

  it('clearAll resets statuses to an empty map', () => {
    usePresenceStore.getState().setStatus('user-1', 'online');
    usePresenceStore.getState().setStatus('user-2', 'afk');

    usePresenceStore.getState().clearAll();

    expect(usePresenceStore.getState().statuses).toEqual({});
  });
});
