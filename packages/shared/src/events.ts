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
