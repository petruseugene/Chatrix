'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PRESENCE_EVENTS = exports.ROOM_EVENTS = exports.DM_EVENTS = exports.FRIEND_EVENTS = void 0;
exports.FRIEND_EVENTS = {
  REQUEST_RECEIVED: 'friend:request:received',
  REQUEST_ACCEPTED: 'friend:request:accepted',
  REQUEST_DECLINED: 'friend:request:declined',
};
exports.DM_EVENTS = {
  MESSAGE_SEND: 'dm:message:send',
  MESSAGE_NEW: 'dm:message:new',
  MESSAGE_EDIT: 'dm:message:edit',
  MESSAGE_EDITED: 'dm:message:edited',
  MESSAGE_DELETE: 'dm:message:delete',
  MESSAGE_DELETED: 'dm:message:deleted',
  TYPING_START: 'dm:typing:start',
  TYPING_STOP: 'dm:typing:stop',
  MESSAGE_REACT: 'dm:message:react',
  REACTION_UPDATED: 'dm:message:reaction:updated',
};
exports.ROOM_EVENTS = {
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
  MESSAGE_REACT: 'room:message:react',
  REACTION_UPDATED: 'room:message:reaction:updated',
};
exports.PRESENCE_EVENTS = {
  HEARTBEAT: 'presence:heartbeat',
  CHANGED: 'presence:changed',
};
//# sourceMappingURL=events.js.map
