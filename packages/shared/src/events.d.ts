export declare const FRIEND_EVENTS: {
  readonly REQUEST_RECEIVED: 'friend:request:received';
  readonly REQUEST_ACCEPTED: 'friend:request:accepted';
  readonly REQUEST_DECLINED: 'friend:request:declined';
};
export declare const DM_EVENTS: {
  readonly MESSAGE_SEND: 'dm:message:send';
  readonly MESSAGE_NEW: 'dm:message:new';
  readonly MESSAGE_EDIT: 'dm:message:edit';
  readonly MESSAGE_EDITED: 'dm:message:edited';
  readonly MESSAGE_DELETE: 'dm:message:delete';
  readonly MESSAGE_DELETED: 'dm:message:deleted';
  readonly TYPING_START: 'dm:typing:start';
  readonly TYPING_STOP: 'dm:typing:stop';
  readonly MESSAGE_REACT: 'dm:message:react';
  readonly REACTION_UPDATED: 'dm:message:reaction:updated';
};
export declare const ROOM_EVENTS: {
  readonly MESSAGE_SEND: 'room:message:send';
  readonly MESSAGE_EDIT: 'room:message:edit';
  readonly MESSAGE_DELETE: 'room:message:delete';
  readonly TYPING_START: 'room:typing:start';
  readonly TYPING_STOP: 'room:typing:stop';
  readonly MESSAGE_NEW: 'room:message:new';
  readonly MESSAGE_EDITED: 'room:message:edited';
  readonly MESSAGE_DELETED: 'room:message:deleted';
  readonly MEMBER_JOINED: 'room:member:joined';
  readonly MEMBER_LEFT: 'room:member:left';
  readonly MEMBER_KICKED: 'room:member:kicked';
  readonly MEMBER_BANNED: 'room:member:banned';
  readonly TYPING: 'room:typing';
  readonly MESSAGE_REACT: 'room:message:react';
  readonly REACTION_UPDATED: 'room:message:reaction:updated';
};
export declare const PRESENCE_EVENTS: {
  readonly HEARTBEAT: 'presence:heartbeat';
  readonly CHANGED: 'presence:changed';
};
//# sourceMappingURL=events.d.ts.map
