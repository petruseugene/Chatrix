'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.resetPasswordSchema =
  exports.requestResetSchema =
  exports.changePasswordSchema =
  exports.loginSchema =
  exports.registerSchema =
    void 0;
const zod_1 = require('zod');
exports.registerSchema = zod_1.z.object({
  email: zod_1.z.string().email('Please enter a valid email address'),
  password: zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  username: zod_1.z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username must be at most 32 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username may only contain letters, numbers, hyphens, and underscores',
    ),
});
exports.loginSchema = zod_1.z.object({
  email: zod_1.z.string().email(),
  password: zod_1.z.string().min(1),
});
exports.changePasswordSchema = zod_1.z.object({
  currentPassword: zod_1.z.string().min(1),
  newPassword: zod_1.z.string().min(8).max(128),
});
exports.requestResetSchema = zod_1.z.object({
  email: zod_1.z.string().email(),
});
exports.resetPasswordSchema = zod_1.z.object({
  token: zod_1.z.string().min(1),
  newPassword: zod_1.z.string().min(8).max(128),
});
//# sourceMappingURL=auth.js.map
