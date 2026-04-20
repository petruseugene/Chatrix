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
