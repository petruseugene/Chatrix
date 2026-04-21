// Shared types, zod schemas, and socket event names will go here.

export interface HealthResponse {
  status: string;
  db: string;
}

export type { JwtPayload } from './auth';
export {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  requestResetSchema,
  resetPasswordSchema,
} from './auth';

export { DM_EVENTS, FRIEND_EVENTS, PRESENCE_EVENTS } from './events';
export type {
  PresenceStatus,
  FriendPresence,
  PresenceChangedPayload,
  PresenceHeartbeatPayload,
} from './presence';
export type { DmMessagePayload, DmThreadPayload } from './dm';
export { sendDmSchema, editDmSchema, dmCursorSchema, sendFriendRequestSchema } from './dm';

export type { RelationshipStatus, UserSearchResult } from './users';
