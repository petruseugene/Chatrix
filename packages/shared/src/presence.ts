export type PresenceStatus = 'online' | 'afk' | 'offline';

export interface FriendPresence {
  userId: string;
  username: string;
  status: PresenceStatus;
}

export interface PresenceChangedPayload {
  userId: string;
  status: PresenceStatus;
}

export interface PresenceHeartbeatPayload {
  tabId: string;
  isActive: boolean;
}
