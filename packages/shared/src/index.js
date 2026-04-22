'use strict';
// Shared types, zod schemas, and socket event names will go here.
Object.defineProperty(exports, '__esModule', { value: true });
exports.sendFriendRequestSchema =
  exports.dmCursorSchema =
  exports.editDmSchema =
  exports.sendDmSchema =
  exports.INPUT_EMOJIS =
  exports.REACTION_EMOJIS =
  exports.ROOM_EVENTS =
  exports.PRESENCE_EVENTS =
  exports.FRIEND_EVENTS =
  exports.DM_EVENTS =
  exports.resetPasswordSchema =
  exports.requestResetSchema =
  exports.changePasswordSchema =
  exports.loginSchema =
  exports.registerSchema =
    void 0;
var auth_1 = require('./auth');
Object.defineProperty(exports, 'registerSchema', {
  enumerable: true,
  get: function () {
    return auth_1.registerSchema;
  },
});
Object.defineProperty(exports, 'loginSchema', {
  enumerable: true,
  get: function () {
    return auth_1.loginSchema;
  },
});
Object.defineProperty(exports, 'changePasswordSchema', {
  enumerable: true,
  get: function () {
    return auth_1.changePasswordSchema;
  },
});
Object.defineProperty(exports, 'requestResetSchema', {
  enumerable: true,
  get: function () {
    return auth_1.requestResetSchema;
  },
});
Object.defineProperty(exports, 'resetPasswordSchema', {
  enumerable: true,
  get: function () {
    return auth_1.resetPasswordSchema;
  },
});
var events_1 = require('./events');
Object.defineProperty(exports, 'DM_EVENTS', {
  enumerable: true,
  get: function () {
    return events_1.DM_EVENTS;
  },
});
Object.defineProperty(exports, 'FRIEND_EVENTS', {
  enumerable: true,
  get: function () {
    return events_1.FRIEND_EVENTS;
  },
});
Object.defineProperty(exports, 'PRESENCE_EVENTS', {
  enumerable: true,
  get: function () {
    return events_1.PRESENCE_EVENTS;
  },
});
Object.defineProperty(exports, 'ROOM_EVENTS', {
  enumerable: true,
  get: function () {
    return events_1.ROOM_EVENTS;
  },
});
var emoji_1 = require('./emoji');
Object.defineProperty(exports, 'REACTION_EMOJIS', {
  enumerable: true,
  get: function () {
    return emoji_1.REACTION_EMOJIS;
  },
});
Object.defineProperty(exports, 'INPUT_EMOJIS', {
  enumerable: true,
  get: function () {
    return emoji_1.INPUT_EMOJIS;
  },
});
var dm_1 = require('./dm');
Object.defineProperty(exports, 'sendDmSchema', {
  enumerable: true,
  get: function () {
    return dm_1.sendDmSchema;
  },
});
Object.defineProperty(exports, 'editDmSchema', {
  enumerable: true,
  get: function () {
    return dm_1.editDmSchema;
  },
});
Object.defineProperty(exports, 'dmCursorSchema', {
  enumerable: true,
  get: function () {
    return dm_1.dmCursorSchema;
  },
});
Object.defineProperty(exports, 'sendFriendRequestSchema', {
  enumerable: true,
  get: function () {
    return dm_1.sendFriendRequestSchema;
  },
});
//# sourceMappingURL=index.js.map
