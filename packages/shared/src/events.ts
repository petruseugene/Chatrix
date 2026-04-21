export const FRIEND_EVENTS = {
  REQUEST_RECEIVED: 'friend:request:received',
  REQUEST_ACCEPTED: 'friend:request:accepted',
  REQUEST_DECLINED: 'friend:request:declined',
} as const;

export const DM_EVENTS = {
  MESSAGE_SEND: 'dm:message:send',
  MESSAGE_NEW: 'dm:message:new',
  MESSAGE_EDIT: 'dm:message:edit',
  MESSAGE_EDITED: 'dm:message:edited',
  MESSAGE_DELETE: 'dm:message:delete',
  MESSAGE_DELETED: 'dm:message:deleted',
  TYPING_START: 'dm:typing:start',
  TYPING_STOP: 'dm:typing:stop',
} as const;

export const PRESENCE_EVENTS = {
  HEARTBEAT: 'presence:heartbeat',
  CHANGED: 'presence:changed',
} as const;

export const ROOM_EVENTS = {
  MESSAGE_SEND: 'room:message:send',
  MESSAGE_EDIT: 'room:message:edit',
  MESSAGE_DELETE: 'room:message:delete',
  TYPING_START: 'room:typing:start',
  TYPING_STOP: 'room:typing:stop',
  MESSAGE_NEW: 'room:message:new',
  MESSAGE_EDITED: 'room:message:edited',
  MESSAGE_DELETED: 'room:message:deleted',
  MEMBER_JOINED: 'room:member:joined',
  MEMBER_LEFT: 'room:member:left',
  MEMBER_KICKED: 'room:member:kicked',
  MEMBER_BANNED: 'room:member:banned',
  TYPING: 'room:typing',
} as const;
