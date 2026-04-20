# Auth Design — User Registration & Authentication

**Date:** 2026-04-20  
**Feature:** Feature 1 — User Registration and Authentication  
**Status:** Approved

---

## 1. Scope

Implements user registration, login, logout, persistent sessions with refresh-token rotation, password change, password reset via email, and account deletion. Covers backend `AuthModule` + `SessionModule`, Prisma schema additions, shared types/zod schemas, and test strategy. Frontend forms are out of scope for this spec.

---

## 2. Data Model

Extends the existing `User` model and adds two new models.

```prisma
model User {
  id            String          @id @default(cuid())
  email         String          @unique
  username      String          @unique
  passwordHash  String
  createdAt     DateTime        @default(now())
  deletedAt     DateTime?       // soft-delete; messages display "[deleted user]"

  sessions       Session[]
  passwordResets PasswordReset[]
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshToken String   @unique  // stored hashed (argon2id)
  userAgent    String?
  ipAddress    String?
  createdAt    DateTime @default(now())
  lastUsedAt   DateTime @updatedAt

  @@index([userId])
}

model PasswordReset {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String    @unique  // stored hashed (argon2id); raw token sent by email
  expiresAt DateTime
  usedAt    DateTime?

  @@index([userId])
}
```

**Key decisions:**

- Refresh tokens stored hashed — a stolen DB does not yield live tokens.
- `Session` rows enable listing and revoking individual sessions (required by §2.2 of requirements).
- `PasswordReset` tokens are single-use (`usedAt`) with a 1-hour TTL, cascade-deleted with the user.

---

## 3. Module Structure

```
packages/backend/src/auth/
  auth.module.ts
  auth.controller.ts
  auth.service.ts
  auth.service.spec.ts
  strategies/
    local.strategy.ts           # validates email + password → User
    jwt.strategy.ts             # validates access token → JwtPayload
    jwt-refresh.strategy.ts     # validates refresh cookie → Session
  guards/
    local-auth.guard.ts
    jwt-auth.guard.ts
    jwt-refresh.guard.ts
  decorators/
    current-user.decorator.ts   # @CurrentUser() → JwtPayload
  dto/
    register.dto.ts             # email, password, username
    login.dto.ts                # email, password
    change-password.dto.ts      # currentPassword, newPassword
    reset-password.dto.ts       # token, newPassword
    request-reset.dto.ts        # email
```

Session list/revoke endpoints live in `UsersModule` since they logically belong to user account management, but they share `JwtAuthGuard` from `AuthModule`.

---

## 4. HTTP API

All endpoints under `/auth` unless noted. DTOs validated with `class-validator` (`whitelist + forbidNonWhitelisted`).

| Method   | Path                    | Guard             | Description                                         |
| -------- | ----------------------- | ----------------- | --------------------------------------------------- |
| `POST`   | `/auth/register`        | none              | Create account; returns access token + sets cookie  |
| `POST`   | `/auth/login`           | `LocalAuthGuard`  | Validate credentials; returns access token + cookie |
| `POST`   | `/auth/logout`          | `JwtRefreshGuard` | Revoke current session only                         |
| `POST`   | `/auth/refresh`         | `JwtRefreshGuard` | Rotate refresh token; return new access token       |
| `POST`   | `/auth/request-reset`   | none              | Send password reset email (rate-limited)            |
| `POST`   | `/auth/reset-password`  | none              | Consume reset token; set new password               |
| `POST`   | `/auth/change-password` | `JwtAuthGuard`    | Change password while authenticated                 |
| `DELETE` | `/auth/account`         | `JwtAuthGuard`    | Soft-delete account; revoke all sessions            |
| `GET`    | `/users/sessions`       | `JwtAuthGuard`    | List all active sessions for current user           |
| `DELETE` | `/users/sessions/:id`   | `JwtAuthGuard`    | Revoke a specific session by ID                     |

**Token transport:**

- Access token: returned in response body (`{ accessToken: string }`), 15-minute TTL.
- Refresh token: set as `HttpOnly; Secure; SameSite=Lax` cookie named `refreshToken`, 30-day TTL.

---

## 5. Token Flow

### Login / Register

1. Validate credentials (Passport `LocalStrategy`).
2. Generate access token (JWT, 15m, `JWT_ACCESS_SECRET`).
3. Generate refresh token (64-byte cryptographically random hex, **not** JWT).
4. Hash refresh token with argon2id; insert `Session` row.
5. Set cookie; return access token in body.

### Token Refresh (`POST /auth/refresh`)

1. `JwtRefreshStrategy` reads cookie, queries `Session` by hashed token.
2. If not found or token hash mismatch → 401, no cleanup needed.
3. Issue new access token + new refresh token.
4. Delete old `Session` row; insert new one (atomic rotation).
5. Set new cookie; return new access token.

### Logout

- Delete the `Session` row matching the current refresh token.
- Clear the cookie.
- Other sessions remain active.

### Change Password

- Verify current password with argon2id.
- Hash new password; update `User.passwordHash`.
- Revoke **all** sessions for the user (forces re-login everywhere).

### Password Reset

1. `POST /auth/request-reset`: look up user by email. If found, generate 64-byte random hex token, hash it, store `PasswordReset` with `expiresAt = now + 1h`.
   - Dev (`NODE_ENV !== production`): log reset URL to console.
   - Prod: send via `nodemailer` using `SMTP_*` env vars.
   - Always return 200 (no user enumeration).
2. `POST /auth/reset-password`: look up `PasswordReset` by hashed token. Verify not expired and not used. Set new password; mark `usedAt`. Revoke all sessions.

### Account Deletion (`DELETE /auth/account`)

- Set `User.deletedAt = now` (soft-delete).
- Cascade: owned rooms deleted (room deletion logic handled by `RoomsModule` via service call).
- Memberships and friendships removed.
- All sessions revoked.
- Messages authored by user: `authorId` remains but display layer renders "[deleted user]" when `deletedAt` is set.

---

## 6. Security

| Concern          | Measure                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| Passwords        | Argon2id (not bcrypt)                                                       |
| Refresh tokens   | Stored hashed (argon2id); raw token only in-memory + cookie                 |
| Rate limiting    | Login: 10 req/min per IP; request-reset: 3 req/hour per IP                  |
| Input validation | `class-validator` with `whitelist + forbidNonWhitelisted`                   |
| Headers          | Helmet; CORS locked to `CORS_ORIGIN` env var                                |
| User enumeration | `/auth/request-reset` always returns 200                                    |
| Token rotation   | Refresh token replaced on every use; old token immediately invalid          |
| Socket auth      | `JwtAuthGuard` reused; client passes access token in handshake `auth.token` |

New env vars required: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

---

## 7. Shared Package

Add to `packages/shared/src/`:

```ts
// auth.ts
export interface JwtPayload {
  sub: string; // userId
  email: string;
  username: string;
}

// zod schemas (mirrored from backend DTOs — single source of truth for FE validation)
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const requestResetSchema = z.object({ email: z.string().email() });

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});
```

---

## 8. Testing Strategy

### Unit Tests (`auth.service.spec.ts`) — mock PrismaService, JwtService, argon2

| Scenario                         | Expected                                             |
| -------------------------------- | ---------------------------------------------------- |
| Register with duplicate email    | 409 ConflictException                                |
| Register with duplicate username | 409 ConflictException                                |
| Register success                 | passwordHash stored (not plaintext); Session created |
| Login with wrong password        | 401 UnauthorizedException                            |
| Login with unknown email         | 401 UnauthorizedException                            |
| Login success                    | access token + session row returned                  |
| Refresh with invalid token       | 401                                                  |
| Refresh with valid token         | new tokens; old session deleted                      |
| Change password wrong current    | 401                                                  |
| Change password success          | all sessions for user revoked                        |
| Reset with expired token         | 400                                                  |
| Reset with used token            | 400                                                  |
| Reset success                    | new password hashed; all sessions revoked            |
| Account delete                   | `deletedAt` set; sessions cleared                    |

### Integration Tests (testcontainers + real Postgres)

- Register → login → refresh → logout full cycle
- Concurrent refresh with same token — only first succeeds (rotation race condition)
- Password reset: request → consume token → login with new password

### e2e (`test/auth.e2e-spec.ts`)

- Register → login → GET protected route (200) → refresh → logout → GET protected route (401)

Target: **70%+ coverage** on `AuthService`.

---

## 9. Decisions Made

| Question                     | Decision                                                        |
| ---------------------------- | --------------------------------------------------------------- |
| Password reset without email | Send token link via email                                       |
| Deleted users' messages      | Soft-delete author — messages stay as "[deleted user]"          |
| Email infrastructure         | `console.log` in dev; `nodemailer` + SMTP in prod               |
| Auth strategy                | Passport (`passport-local` + `passport-jwt`) with NestJS guards |
