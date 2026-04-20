# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

While working on this project keep all prompt messages in prompt-history.md file width date and time.

## Project: Online Chat Server

Keep this file updated when the stack or structure changes.

## Scope

Classic web chat (IRC/Slack-lite), **not a social network**. Target: 300 concurrent users, 1000/room, 10k+ msgs/room.

## Stack

- **FE:** Vite + React 18 + TS (strict), MUI v5, Zustand, TanStack Query v5, socket.io-client, react-hook-form + zod, react-router v6, Vitest
- **BE:** Node 20 + NestJS 10 + TS (strict), Socket.IO + `@socket.io/redis-adapter`, Prisma 5, Passport + JWT, **argon2** (not bcrypt), class-validator, Multer + sharp, `@xmpp/client`, Pino, Jest
- **Infra:** Postgres 16, Redis 7, MinIO, Prosody (XMPP s2s), Nginx, Docker Compose
- **Monorepo:** pnpm workspaces (`packages/shared`, `packages/backend`, `packages/frontend`)

Do not substitute: no Next.js, no bare Express, no Mongo, no Redux, no bcrypt.

## Layout

```
packages/
  shared/         # TS types, zod schemas, socket event names — single source of truth
  backend/        # NestJS modules: auth, users, contacts, rooms, messages,
                  # attachments, presence, notifications, moderation, gateway,
                  # xmpp, health
  frontend/       # features/, components/, stores/, api/, socket/, pages/
prosody/          # XMPP config
nginx/            # reverse proxy
docker-compose.yml + docker-compose.dev.yml
```

## Core Domain Rules (non-negotiable)

1. **Username immutable.** No update path, ever.
2. **Email + username globally unique** — DB unique index AND DTO validation.
3. **Owner cannot leave a room** — only delete it. Delete cascades messages + files.
4. **Deleted account:** owned rooms deleted; memberships + friendships removed; author soft-deleted on remaining messages (display "[deleted user]").
5. **Bans freeze history:** banned user loses all access but their messages remain visible. Cannot rejoin until unbanned.
6. **DMs only between mutual friends** with no active blocks. Model as dedicated `DirectMessageThread`, not a room.
7. **Lost access = lost access.** Every message/attachment endpoint AND socket event re-checks current, non-banned membership.
8. **Files persist** unless the room is deleted. No GC on user removal.
9. **Limits:** text UTF-8 ≤3KB, file ≤20MB, image ≤3MB. Enforce in DTO **and** Multer **and** Nginx `client_max_body_size`.
10. **Presence:** online = ≥1 active tab; AFK = tabs exist but all inactive >1min; offline = no tabs. Per-tab heartbeat in Redis.
11. **Admin hierarchy:** Owner > Admin > Member. Admins can remove admins but never the Owner; only Owner transfers ownership.

## Data Model Notes

- `Message` has nullable `roomId` XOR `directMessageThreadId` — enforce with CHECK constraint.
- `Friendship` stored once with canonical ordering (`userAId < userBId`).
- `RoomMembership` includes the owner as a row.
- Partial unique index on active `RoomBan(roomId, userId)`.
- Index `(roomId, createdAt DESC, id DESC)` for cursor pagination.
- `AuditLog` for all moderation actions.

## Real-Time (Socket.IO)

All event names + payload types in `packages/shared/src/events.ts`. **Never hardcode event strings.**

Auth: JWT in handshake `auth`. On connect, join `user:${userId}` and all `room:${roomId}` the user belongs to. Use Redis adapter for horizontal scaling (required for federation load test).

## Auth

Access token 15min, refresh token 30d in httpOnly+Secure+SameSite=Lax cookie. Rotate refresh on every use. `Session` row per login so users can list/revoke sessions.

Password reset without email is ambiguous in the spec — **ask before implementing**.

## Files

1. Client requests upload → backend issues presigned PUT to MinIO.
2. Client PUTs to MinIO, then sends `message:send` with attachment refs.
3. Downloads always proxied through backend (auth check → short-lived presigned GET). **Never expose MinIO directly.**
4. Validate MIME by magic bytes server-side. Strip EXIF + generate thumbnail with `sharp`.

## Presence

Redis only, encapsulated in `PresenceService` (gateways/controllers don't touch keys directly).

- `presence:user:{userId}:tabs` — SET, per-member TTL ~45s, heartbeat every 20s
- `presence:user:{userId}:activity` — hash `{tabId: unixMs}` for AFK derivation
- Interval sweep broadcasts `presence:changed` on transitions

## XMPP Federation

Prosody in compose with s2s enabled. `XmppModule` bridges Socket.IO ↔ XMPP. **Prefer XEP-0114 Component protocol** over per-user connections. Gate behind feature flag; implement last if timeline is tight.

## Architecture Rules

- Controllers/gateways **never** call Prisma — always via services.
- Services **never** import controllers.
- Socket emits go through a dedicated `EventsService`, not from controllers.
- Frontend: one folder per feature under `features/`; cross-feature sharing only via `components/`, `hooks/`, or `packages/shared`.
- Share types and zod schemas via `packages/shared` — no duplication between FE/BE.

## Performance

- Cursor pagination on `(createdAt, id)` — **never OFFSET**:
  `WHERE roomId = ? AND (createdAt, id) < (?, ?) ORDER BY createdAt DESC, id DESC LIMIT 50`
- Targets: message delivery <3s, presence <2s.

## Security Must-Haves

Argon2id passwords, Helmet, CORS locked to FE origin from env, class-validator with `whitelist + forbidNonWhitelisted`, rate limit auth + friend requests + message send + uploads, JWT secret from env only, MIME-by-magic-bytes on uploads, sanitize newlines before logging user input.

Every room/message/attachment handler starts with: **"is caller a current, non-banned member?"**

## Dev

```bash
cp .env.example .env && pnpm install
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis minio prosody
pnpm --filter backend prisma migrate dev
pnpm --filter backend dev
pnpm --filter frontend dev
```

**Submission requirement:** bare `docker compose up` must work end-to-end with no manual migration step (run migrations in backend entrypoint or an init container).

### Other common commands

```bash
# Lint
pnpm lint                          # all packages
pnpm --filter backend lint
pnpm --filter frontend lint

# Tests
pnpm --filter backend test         # unit tests (Jest)
pnpm --filter backend test:e2e     # e2e tests
pnpm --filter backend test -- --testPathPattern=auth  # single test file
pnpm --filter frontend test        # Vitest

# Build
pnpm --filter backend build
pnpm --filter frontend build

# Prisma
pnpm --filter backend prisma studio
pnpm --filter backend prisma generate
```

## Coding Standards

- TS strict both packages, no `any` without justifying comment.
- ESLint + Prettier shared at root. Conventional commits.
- NestJS module shape: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.gateway.ts` (if sockets), `dto/`, `*.spec.ts`.
- Unit test services (mock Prisma/Redis); integration via testcontainers; e2e the auth→room→message→attachment happy path. Target 70%+ on services.

## Feature-Done Checklist

Schema + migration → service + unit tests → HTTP DTOs + guards → socket events in shared → FE query hook + socket handler → FE UI with loading/error → server-side authz → rate limit if abuse-prone.

## Ambiguities to confirm with user

1. Password reset flow without email verification.
2. Deleted users' messages — soft-delete author (recommended) vs hard-delete.
3. XMPP federation priority.
4. "Local" file storage = MinIO in Docker volume.
5. "Classic UI" scope — no feeds/walls/likes.
