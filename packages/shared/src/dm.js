'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.sendFriendRequestSchema =
  exports.dmCursorSchema =
  exports.editDmSchema =
  exports.sendDmSchema =
    void 0;
const zod_1 = require('zod');
exports.sendDmSchema = zod_1.z.object({
  recipientId: zod_1.z.string().cuid(),
  content: zod_1.z.string().min(1).max(3072),
  replyToId: zod_1.z.string().cuid().optional(),
});
exports.editDmSchema = zod_1.z.object({
  content: zod_1.z.string().min(1).max(3072),
});
exports.dmCursorSchema = zod_1.z.object({
  before: zod_1.z.string().optional(),
  beforeId: zod_1.z.string().cuid().optional(),
  limit: zod_1.z.coerce.number().int().min(1).max(50).default(50),
});
exports.sendFriendRequestSchema = zod_1.z.object({
  username: zod_1.z.string().min(3).max(32),
});
//# sourceMappingURL=dm.js.map
