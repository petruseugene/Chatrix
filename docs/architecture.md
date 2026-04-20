# Online Chat Server

Keep this file updated if some additions or changes in the project structure or tech stack are noticed!

---

## Project Overview

A classic web-based online chat application supporting user registration, public/private rooms, one-to-one messaging, contacts/friends, file sharing, moderation, persistent history, and XMPP federation. Target scale: 300 concurrent users, 1000 users/room, 10k+ messages/room.

**Not a social network.** Keep UI and feature scope aligned with "classic chat" (think IRC/Slack-lite), not Facebook.

---

## Tech Stack

### Frontend

- **Vite + React 18 + TypeScript** (strict mode)
- **MUI (Material UI) v5** — component library
- **Zustand** — client state (auth, UI, active room, presence)
- **TanStack Query (React Query) v5** — server state, caching, optimistic updates
- **socket.io-client** — real-time
- **react-hook-form + zod** — forms + validation (share zod schemas with backend where possible)
- **react-router-dom v6** — routing
- **emoji-mart** — emoji picker
- **dayjs** — timestamps
- **Vitest + React Testing Library** — tests

### Backend

- **Node.js 20 LTS + TypeScript** (strict mode)
- **NestJS 10** — framework (modules, DI, guards, interceptors)
- **@nestjs/websockets + socket.io** — real-time gateway
- **@socket.io/redis-adapter** — horizontal scaling of sockets
- **Prisma 5** — ORM + migrations
- **Passport + @nestjs/jwt** — auth (JWT access + refresh)
- **argon2** — password hashing (NOT bcrypt)
- **class-validator + class-transformer** — DTO validation
- **Multer + sharp** — file upload + image processing
- **@xmpp/client** — XMPP bridge client
- **Pino + nestjs-pino** — structured logging
- **Jest + Supertest** — tests

### Data & Infra

- **PostgreSQL 16** — primary datastore
- **Redis 7** — Socket.IO adapter, presence (TTL keys), rate limiting, ephemeral session tracking
- **MinIO** — S3-compatible object storage for attachments
- **Prosody** — XMPP server (for federation requirement)
- **Nginx** — reverse proxy (HTTP + WebSocket upgrade)
- **Docker Compose** — local + submission deployment

---

## Repository Layout

```
/
├── docker-compose.yml           # Full stack: postgres, redis, minio, prosody, nginx, backend, frontend
├── docker-compose.dev.yml       # Dev overrides (hot reload, exposed ports)
├── .env.example                 # All required env vars, documented
├── nginx/
│   └── default.conf             # Reverse proxy: /api -> backend, /socket.io -> backend (ws), / -> frontend
├── prosody/
│   └── prosody.cfg.lua          # XMPP server config with federation enabled
├── packages/
│   ├── shared/                  # Shared TS types + zod schemas (message shapes, event names, DTOs)
│   │   ├── src/
│   │   │   ├── events.ts        # Socket.IO event name constants + payload types
│   │   │   ├── schemas.ts       # zod schemas shared FE/BE
│   │   │   └── types.ts         # Domain types
│   │   └── package.json
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/          # guards, interceptors, filters, decorators, pipes
│   │   │   ├── config/          # typed config module
│   │   │   ├── auth/            # register, login, JWT, refresh, sessions
│   │   │   ├── users/           # profile, password change, account deletion
│   │   │   ├── contacts/        # friends, friend requests, bans
│   │   │   ├── rooms/           # CRUD, membership, roles, invites, catalog
│   │   │   ├── messages/        # send, edit, delete, history (cursor pagination)
│   │   │   ├── attachments/     # upload, download, presigned URLs
│   │   │   ├── presence/        # online/AFK/offline tracking (Redis-backed)
│   │   │   ├── notifications/   # unread counts
│   │   │   ├── moderation/      # admin actions, audit log
│   │   │   ├── gateway/         # Socket.IO gateway(s)
│   │   │   ├── xmpp/            # Prosody bridge + federation
│   │   │   └── health/          # /health endpoint
│   │   └── test/                # e2e tests
│   └── frontend/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── api/             # TanStack Query hooks + axios client
│       │   ├── socket/          # socket.io-client setup, event handlers
│       │   ├── stores/          # zustand stores (auth, ui, presence)
│       │   ├── features/        # feature folders: auth, rooms, messages, contacts, admin
│       │   ├── components/      # shared UI components
│       │   ├── hooks/
│       │   ├── pages/           # route components
│       │   ├── theme/           # MUI theme
│       │   └── utils/
│       └── vite.config.ts
└── README.md                    # Run instructions (docker compose up)
```

**Monorepo tool:** pnpm workspaces. Use `pnpm` for all installs.

---

## Core Domain Rules (DO NOT violate)

These come directly from the spec. When writing code, verify every operation respects these:

1. **Username is immutable.** No update endpoint, no admin override.
2. **Email and username are globally unique.** Enforce at DB level with unique indexes AND in validation.
3. **Owner cannot leave a room** — they can only delete it. Deleting a room deletes all its messages and files (cascade).
4. **Deleting an account** deletes owned rooms (and their contents), removes all memberships, removes friendships. Other users' messages to them remain in their own copies? No — per spec, deleting account removes the user; messages sent by the deleted user in rooms should handle via soft-delete of author (display as "[deleted user]") to preserve room history integrity. **Decide and document this in the migration.**
5. **Bans freeze chat history** — a banned user keeps no access; their past messages remain visible to room members. A user banned from a room cannot rejoin until unbanned.
6. **Friendship-only DMs:** one-to-one messages only allowed between mutual friends with no bans between them.
7. **Losing access means losing access** — if kicked/banned/left, the user must no longer be able to fetch messages or files from that room. Enforce in every message/attachment endpoint AND socket event.
8. **Files persist unless room is deleted.** Do not garbage-collect files when a user loses access or their account is deleted.
9. **Personal chats = exactly 2 users.** Model as a special room type or a dedicated DM table — prefer a dedicated `direct_messages` model to avoid polluting room logic.
10. **Message limits:** text UTF-8, max 3KB. File max 20MB, image max 3MB. Enforce in validation pipes AND Multer limits.
11. **Presence:** online = ≥1 active tab, AFK = inactive >1min in all tabs, offline = no tabs. Track per-tab heartbeats in Redis with short TTL.
12. **Admin hierarchy:** Admins cannot remove the Owner or each other's ownership. Admins can remove other admins (except owner). Owner has full control.

---

## Data Model (Prisma sketch)

High-level entities — refine during implementation but keep the relationships:

- `User` (id, email UNIQUE, username UNIQUE, passwordHash, createdAt, deletedAt nullable for soft-delete-of-author pattern)
- `Session` (id, userId, userAgent, ip, createdAt, lastSeenAt, revokedAt) — for "view/revoke sessions"
- `RefreshToken` (id, sessionId, hashedToken, expiresAt, revokedAt)
- `Friendship` (userAId, userBId, status: PENDING/ACCEPTED, requestedById) — store as single row with canonical ordering (userAId < userBId) to prevent duplicates
- `UserBlock` (blockerId, blockedId) — one-way block
- `Room` (id, name UNIQUE, description, isPublic, ownerId, createdAt)
- `RoomMembership` (roomId, userId, role: MEMBER/ADMIN/OWNER, joinedAt) — owner is also a membership row
- `RoomBan` (roomId, userId, bannedById, reason, bannedAt)
- `RoomInvite` (roomId, invitedUserId, invitedById, status)
- `Message` (id, roomId nullable, directMessageId nullable, authorId, content, replyToId nullable, editedAt nullable, deletedAt nullable, createdAt) — either roomId OR directMessageId set, never both; enforce with CHECK constraint
- `DirectMessageThread` (id, userAId, userBId) — canonical ordering
- `Attachment` (id, messageId, originalFilename, storedKey, mimeType, sizeBytes, comment, createdAt)
- `AuditLog` (id, actorId, action, targetType, targetId, metadata, createdAt) — for moderation actions

**Indexes to add:** `(roomId, createdAt DESC)` for message pagination, `(userId, status)` on friendships, partial unique on active `RoomBan(roomId, userId)`.

---

## Real-Time Events (Socket.IO)

All event names and payload types live in `packages/shared/src/events.ts`. Never hardcode event strings in FE or BE code — import from shared.

**Client → Server:**

- `message:send`, `message:edit`, `message:delete`
- `typing:start`, `typing:stop`
- `presence:heartbeat` (every 20s while tab active)
- `room:join`, `room:leave` (socket room subscription, NOT membership change)

**Server → Client:**

- `message:new`, `message:edited`, `message:deleted`
- `typing:update`
- `presence:changed`
- `friend:request`, `friend:accepted`
- `room:member-joined`, `room:member-left`, `room:member-banned`, `room:deleted`
- `notification:unread-count`

**Auth:** connect with JWT in `auth` handshake field. Guard gateway with a socket JWT guard. On connect, join `user:${userId}` room and all `room:${roomId}` rooms the user belongs to.

**Scaling:** use `@socket.io/redis-adapter` so multiple backend instances work. Required for federation load test (50 users on server A, 50 on B).

---

## Authentication Flow

- Register: email + username + password → argon2 hash → create user → return access token (15min) + refresh token (30d, httpOnly secure cookie, SameSite=Lax)
- Login: same, create `Session` row
- Refresh: rotate refresh token on every use, revoke old one
- Logout (current): revoke current session's refresh token, clear cookie
- Logout (specific session): revoke by sessionId (must belong to user)
- Password reset: email-less flow per spec — implement as "security question" or simply allow password change only when logged in. Re-read spec §2.1 carefully; if reset must work without email, use a time-limited recovery code shown at registration. **Confirm with user before implementing.**

---

## File Uploads

- Client uploads via multipart POST to `/api/attachments` with messageId-pending-token flow: client requests upload URL, uploads to MinIO via presigned PUT, then sends `message:send` with attachment refs.
- Validate MIME type server-side (don't trust client).
- Images: use `sharp` to strip EXIF and generate a thumbnail (stored alongside original).
- Download: always proxy through backend endpoint that checks room/DM access BEFORE issuing a short-lived presigned GET. Never expose MinIO directly.
- Size limits enforced at Multer, at MinIO policy, and in Nginx `client_max_body_size`.

---

## Presence Implementation

Redis keys:

- `presence:user:{userId}:tabs` — SET of tab IDs with TTL per member
- Tab heartbeat (every 20s) → `SADD` tab ID, `EXPIRE` 45s
- Status derivation:
  - No tabs in set → offline
  - ≥1 tab with recent (<1min) activity timestamp → online
  - Tabs exist but all activity >1min old → AFK
- Store last-activity timestamp per tab in a hash: `presence:user:{userId}:activity` → `{tabId: unixMs}`
- A cron-like interval (every 15s) scans changed users and broadcasts `presence:changed`

Keep presence logic in `PresenceService`. Gateway and controllers never touch Redis presence keys directly.

---

## XMPP Federation

This is the hardest advanced requirement. Approach:

1. Run Prosody in the compose stack with federation (s2s) enabled.
2. NestJS has an `XmppModule` that:
   - Creates a system XMPP account per chat user on registration (or lazily on first federation need)
   - Maintains a pool of `@xmpp/client` connections (or a single admin connection using component protocol)
   - Relays messages between Socket.IO world (internal users) and XMPP (external federated users)
3. A user identified as `username@ourdomain.tld` can receive messages from `user@otherserver.tld`.
4. For the load test: deploy two full stacks on different domains, verify s2s messaging works.

**Implementation strategy — prefer XMPP Component (XEP-0114) over per-user connections** for efficiency at 300 users. Document the decision in `packages/backend/src/xmpp/README.md`.

If federation is deprioritized by the user, stub the module behind a feature flag and implement the rest first.

---

## Nginx Config Essentials

- `/api/*` → backend:3000
- `/socket.io/*` → backend:3000 with `Upgrade`/`Connection` headers for WebSocket
- `/*` → frontend static (production) or frontend:5173 (dev)
- `client_max_body_size 25m;` (headroom over 20MB limit)
- Gzip on for text responses
- `proxy_read_timeout 3600s;` for socket connections

---

## Development Workflow

```bash
# First time
cp .env.example .env
pnpm install
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis minio prosody
pnpm --filter backend prisma migrate dev
pnpm --filter backend prisma db seed   # optional seed data

# Run
pnpm --filter backend dev
pnpm --filter frontend dev

# Or everything in docker
docker compose up --build
```

**Submission requirement:** `docker compose up` must bring up a fully working system with no manual migration step. Add a migration-runner init container or run migrations in backend entrypoint.

---

## Testing Strategy

- **Unit tests** for services (auth, rooms, messages, presence) — mock Prisma and Redis.
- **Integration tests** for each module using testcontainers (Postgres + Redis) or a dedicated test docker-compose.
- **E2E** happy paths: register → login → create room → invite → send message → edit → delete → attachment round-trip.
- **Socket tests**: spin up NestJS app, connect two socket.io-clients, verify event delivery.
- Target coverage: 70%+ on services; don't obsess over controllers.

---

## Security Checklist (apply throughout)

- [ ] Argon2id for passwords, never log password fields
- [ ] Rate limit: register, login, password change, friend requests, message send (per-user and per-IP), file upload
- [ ] CSRF: not needed if using Bearer tokens for API; for refresh cookie, use double-submit pattern
- [ ] Helmet on backend (via `@nestjs/helmet` or middleware)
- [ ] CORS: allow only the frontend origin from env
- [ ] Validate ALL DTOs with class-validator (whitelist + forbidNonWhitelisted)
- [ ] Every room/message/attachment endpoint starts with: "is the caller a current, non-banned member?"
- [ ] Never reflect user input in logs without sanitizing newlines
- [ ] Sign JWTs with rotated secret from env, never check in secrets
- [ ] File uploads: validate MIME by magic bytes (not just Content-Type), reject executables
- [ ] Strip EXIF from images via sharp

---

## Coding Standards

- TypeScript strict mode on both packages. No `any` without a `// eslint-disable` comment explaining why.
- ESLint + Prettier with shared config at repo root.
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`).
- Every NestJS module has: `*.module.ts`, `*.controller.ts` (if HTTP), `*.service.ts`, `*.gateway.ts` (if sockets), `dto/`, `*.spec.ts`.
- Services never import controllers. Controllers/gateways never touch Prisma directly — always via a service.
- Frontend: one feature = one folder under `features/`. No cross-feature imports except via shared `components/` or `hooks/`.
- Use shared `packages/shared` types/schemas instead of duplicating between FE and BE.

---

## When Implementing Features — Checklist

Before marking any feature "done":

1. ✅ DB schema + migration
2. ✅ Service layer with unit tests
3. ✅ HTTP endpoints with DTOs + guards
4. ✅ Socket events (if real-time) with payload types in `shared`
5. ✅ Frontend API hook (TanStack Query) + socket handler
6. ✅ Frontend UI component with loading/error states
7. ✅ Authorization: who can do this, enforced server-side
8. ✅ Rate limiting if abuse-prone
9. ✅ Update README if it changes how to run the project

---

## Known Ambiguities — Ask User Before Deciding

1. **Password reset without email verification** — spec says no email verification but also says password reset. Clarify intended flow.
2. **Deleted user's messages in rooms** — soft-delete author vs hard-delete messages. Recommend soft-delete (preserve history).
3. **XMPP federation priority** — if timeline is tight, implement behind a feature flag last.
4. **File storage "locally"** — MinIO in Docker volume counts as local. Confirm this interpretation.
5. **"Classic UI (not соцсеть)"** — no feeds, no profiles-as-walls, no likes. Confirm scope.

---

## Performance Targets (from spec)

- Message delivery < 3s end-to-end
- Presence updates < 2s
- 300 concurrent users
- 1000 users per room
- 10,000+ messages per room (pagination required — use cursor pagination on `(createdAt, id)`, never OFFSET)

For message history: `WHERE roomId = ? AND (createdAt, id) < (?, ?) ORDER BY createdAt DESC, id DESC LIMIT 50`.

---

## What NOT to Do

- ❌ Don't use Next.js, Express bare, MongoDB, or Redux — stack is fixed.
- ❌ Don't store files in Postgres as bytea.
- ❌ Don't use OFFSET pagination for messages.
- ❌ Don't expose MinIO directly to clients.
- ❌ Don't emit socket events from controllers — go through a dedicated `EventsService` that the gateway consumes.
- ❌ Don't check authorization in the frontend only — every server endpoint re-verifies.
- ❌ Don't add features outside the spec. "Classic chat" — resist scope creep.
