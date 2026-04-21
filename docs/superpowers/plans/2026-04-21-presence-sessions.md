# Presence & Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real-time online/AFK/offline presence tracking, broadcast to friends via Socket.IO, with an HTTP snapshot endpoint.

**Architecture:** Per-tab heartbeats stored in Redis ZSETs with TTL-based expiry. A 10s sweep computes status transitions and emits `presence:changed` to friends via `EventsService`. Disconnects trigger an immediate re-derivation without waiting for the sweep.

**Tech Stack:** NestJS, ioredis, Socket.IO, Prisma (read-only for friend lookups), `@chatrix/shared` for types and event constants.

**Spec:** `docs/superpowers/specs/2026-04-21-presence-sessions-design.md`

---

## File Map

| Action | Path                                                        | Responsibility                                                                                                   |
| ------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Create | `packages/shared/src/presence.ts`                           | `PresenceStatus`, `FriendPresence`, payload types                                                                |
| Modify | `packages/shared/src/events.ts`                             | Add `PRESENCE_EVENTS` constant                                                                                   |
| Modify | `packages/shared/src/index.ts`                              | Re-export presence types and events                                                                              |
| Create | `packages/backend/src/redis/redis.module.ts`                | Global `@Global()` module that provides the `ioredis` client under the `REDIS_CLIENT` injection token            |
| Create | `packages/backend/src/events/events.module.ts`              | Exports `EventsService`                                                                                          |
| Create | `packages/backend/src/events/events.service.ts`             | Receives Socket.IO `Server` reference via `setServer()`; exposes `emitPresenceChanged()`                         |
| Create | `packages/backend/src/presence/presence.service.ts`         | All Redis operations; heartbeat write; status derivation; sweep loop                                             |
| Create | `packages/backend/src/presence/presence.service.spec.ts`    | Unit tests — mock ioredis and EventsService                                                                      |
| Create | `packages/backend/src/presence/presence.gateway.ts`         | Handles `presence:heartbeat`; connect/disconnect tab lifecycle; calls `EventsService.setServer()` in `afterInit` |
| Create | `packages/backend/src/presence/presence.controller.ts`      | `GET /presence/friends` — returns `FriendPresence[]`                                                             |
| Create | `packages/backend/src/presence/presence.controller.spec.ts` | Unit test for controller                                                                                         |
| Create | `packages/backend/src/presence/presence.module.ts`          | Wires service, gateway, controller; imports Redis, Events, Prisma, Auth                                          |
| Modify | `packages/backend/src/app.module.ts`                        | Register `RedisModule`, `EventsModule`, `PresenceModule`                                                         |

---

## Task 1: Install ioredis and add shared presence types

**Files:**

- Modify: `packages/backend/package.json`
- Create: `packages/shared/src/presence.ts`
- Modify: `packages/shared/src/events.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] Install `ioredis` in the backend package:

  ```
  pnpm --filter backend add ioredis
  ```

- [ ] Create `packages/shared/src/presence.ts` with:
  - `PresenceStatus` type: `'online' | 'afk' | 'offline'`
  - `FriendPresence` interface: `{ userId: string; username: string; status: PresenceStatus }`
  - `PresenceChangedPayload` interface: `{ userId: string; status: PresenceStatus }`
  - `PresenceHeartbeatPayload` interface: `{ tabId: string; isActive: boolean }`

- [ ] Add `PRESENCE_EVENTS` to `packages/shared/src/events.ts`:
  - `HEARTBEAT: 'presence:heartbeat'`
  - `CHANGED: 'presence:changed'`

- [ ] Re-export everything from `packages/shared/src/index.ts`

- [ ] Verify the shared package builds cleanly:

  ```
  pnpm --filter @chatrix/shared build
  ```

- [ ] Commit:

  ```
  git add packages/shared/src/presence.ts packages/shared/src/events.ts packages/shared/src/index.ts packages/backend/package.json pnpm-lock.yaml
  git commit -m "feat(shared): add presence types and PRESENCE_EVENTS"
  ```

---

## Task 2: Redis provider (global module)

**Files:**

- Create: `packages/backend/src/redis/redis.module.ts`

- [ ] Create `packages/backend/src/redis/redis.module.ts` as a `@Global()` NestJS module. It should:
  - Read `REDIS_URL` from `ConfigService<AppConfig, true>`
  - Create an `ioredis` client using that URL
  - Provide the client under the injection token `'REDIS_CLIENT'`
  - Export the `'REDIS_CLIENT'` provider so any module that imports `RedisModule` can inject it

- [ ] Verify there are no TypeScript errors:

  ```
  pnpm --filter backend build
  ```

- [ ] Commit:

  ```
  git add packages/backend/src/redis/
  git commit -m "feat(redis): add global Redis provider"
  ```

---

## Task 3: EventsService

**Files:**

- Create: `packages/backend/src/events/events.module.ts`
- Create: `packages/backend/src/events/events.service.ts`

- [ ] Create `packages/backend/src/events/events.service.ts` as an `@Injectable()` service with:
  - A private `server: Server | null` field
  - `setServer(server: Server): void` — stores the Socket.IO server reference
  - `emitPresenceChanged(friendIds: string[], payload: PresenceChangedPayload): void` — for each friendId emits `PRESENCE_EVENTS.CHANGED` with the payload to the `user:{friendId}` Socket.IO room. No-ops if `server` is null.

- [ ] Create `packages/backend/src/events/events.module.ts` — plain `@Module` that provides and exports `EventsService`.

- [ ] Verify TypeScript:

  ```
  pnpm --filter backend build
  ```

- [ ] Commit:

  ```
  git add packages/backend/src/events/
  git commit -m "feat(events): add EventsService for centralised socket emits"
  ```

---

## Task 4: PresenceService

**Files:**

- Create: `packages/backend/src/presence/presence.service.ts`
- Create: `packages/backend/src/presence/presence.service.spec.ts`

### 4a — Write failing tests first

- [ ] Create `packages/backend/src/presence/presence.service.spec.ts`. Mock `ioredis` and `EventsService`. Write tests for:

  | Test                                                     | What to assert                                              |
  | -------------------------------------------------------- | ----------------------------------------------------------- |
  | `recordHeartbeat` with `isActive: true`                  | Calls ZADD on both `tabs` and `activity` ZSETs              |
  | `recordHeartbeat` with `isActive: false`                 | Calls ZADD only on `tabs` ZSET; `activity` ZSET not touched |
  | `deriveStatus`: 0 live tabs                              | Returns `'offline'`                                         |
  | `deriveStatus`: tabs present, activity ≤60s ago          | Returns `'online'`                                          |
  | `deriveStatus`: tabs present, activity >60s ago          | Returns `'afk'`                                             |
  | `deriveStatus`: tabs present, no activity entry          | Returns `'afk'`                                             |
  | `removeTab`: last tab removed, status changes to offline | Calls `emitPresenceChanged` with `offline`                  |
  | `removeTab`: other tabs still live                       | `emitPresenceChanged` not called (no change)                |
  | Sweep: status unchanged                                  | `emitPresenceChanged` not called                            |
  | Sweep: status changed to offline                         | Keys cleaned up; user removed from `presence:tracked`       |

- [ ] Run tests and confirm they all fail:

  ```
  pnpm --filter backend test -- --testPathPattern=presence.service
  ```

### 4b — Implement PresenceService

- [ ] Create `packages/backend/src/presence/presence.service.ts` implementing `OnModuleInit` and `OnModuleDestroy`:

  **Redis key helpers (private):**
  - `tabsKey(userId)` → `presence:user:{userId}:tabs`
  - `activityKey(userId)` → `presence:user:{userId}:activity`
  - `statusKey(userId)` → `presence:user:{userId}:status`
  - `TRACKED_KEY` constant → `presence:tracked`

  **Public methods:**
  - `recordHeartbeat(userId, tabId, isActive)` — ZADD tabs ZSET with score `Date.now() + 45_000`; if `isActive` also ZADD activity ZSET with score `Date.now()`; SADD to tracked set
  - `removeTab(userId, tabId)` — ZREM from both tabs and activity ZSETs; re-derive and emit if changed
  - `getFriendPresence(userId)` — load friends from `Friendship` table (both FK directions); batch-read `statusKey` for each via `MGET`; return `FriendPresence[]` defaulting missing entries to `'offline'`

  **Private helpers:**
  - `deriveStatus(userId)` — ZREMRANGEBYSCORE stale tabs; ZCARD; ZREVRANGE activity 0 0 WITHSCORES; apply rules from spec Section 3
  - `maybeEmit(userId, newStatus)` — GET current status; if changed: SET new status, load friends, call `EventsService.emitPresenceChanged`; if offline: cleanup keys and SREM from tracked

  **Sweep:**
  - `onModuleInit`: start `setInterval` every 10_000ms — SMEMBERS tracked, run `deriveStatus` + `maybeEmit` for each userId
  - `onModuleDestroy`: `clearInterval`

- [ ] Run tests and confirm they all pass:

  ```
  pnpm --filter backend test -- --testPathPattern=presence.service
  ```

- [ ] Commit:

  ```
  git add packages/backend/src/presence/presence.service.ts packages/backend/src/presence/presence.service.spec.ts
  git commit -m "feat(presence): add PresenceService with Redis sweep"
  ```

---

## Task 5: PresenceGateway

**Files:**

- Create: `packages/backend/src/presence/presence.gateway.ts`

- [ ] Create `packages/backend/src/presence/presence.gateway.ts` implementing `OnGatewayInit`, `OnGatewayConnection`, `OnGatewayDisconnect`. Use `@WebSocketGateway({ cors: { origin: process.env['CORS_ORIGIN'], credentials: true } })`.

  **`afterInit(server)`** — call `EventsService.setServer(server)`

  **`handleConnection(socket)`:**
  1. Verify JWT from `socket.handshake.auth.token` (same pattern as `DmGateway` — disconnect on failure)
  2. Read `tabId` from `socket.handshake.auth.tabId`; disconnect if missing
  3. Store `{ userId: payload.sub, tabId }` on `socket.data`
  4. Join `user:{userId}` room
  5. Call `PresenceService.recordHeartbeat(userId, tabId, true)`

  **`handleDisconnect(socket)`:**
  1. Read `{ userId, tabId }` from `socket.data`; return early if missing
  2. Call `PresenceService.removeTab(userId, tabId)`

  **`@SubscribeMessage(PRESENCE_EVENTS.HEARTBEAT)`:**
  1. Read `userId` from `socket.data`; throw `WsException` if missing
  2. Validate body is `PresenceHeartbeatPayload`
  3. Call `PresenceService.recordHeartbeat(userId, body.tabId, body.isActive)`

- [ ] Verify TypeScript:

  ```
  pnpm --filter backend build
  ```

- [ ] Commit:

  ```
  git add packages/backend/src/presence/presence.gateway.ts
  git commit -m "feat(presence): add PresenceGateway for heartbeat and tab lifecycle"
  ```

---

## Task 6: PresenceController

**Files:**

- Create: `packages/backend/src/presence/presence.controller.ts`
- Create: `packages/backend/src/presence/presence.controller.spec.ts`

### 6a — Write failing test first

- [ ] Create `packages/backend/src/presence/presence.controller.spec.ts`. Mock `PresenceService`. Write tests for:
  - `GET /presence/friends` returns `FriendPresence[]` from `PresenceService.getFriendPresence`
  - `JwtAuthGuard` metadata is applied to the endpoint (reflect metadata check)

- [ ] Run and confirm fail:

  ```
  pnpm --filter backend test -- --testPathPattern=presence.controller
  ```

### 6b — Implement controller

- [ ] Create `packages/backend/src/presence/presence.controller.ts`:
  - `@Controller('presence')`, `@UseGuards(JwtAuthGuard)`
  - `GET /friends` — calls `PresenceService.getFriendPresence(currentUser.sub)`, returns the array
  - Inject `@CurrentUser()` decorator from `AuthModule`

- [ ] Run tests and confirm pass:

  ```
  pnpm --filter backend test -- --testPathPattern=presence.controller
  ```

- [ ] Commit:

  ```
  git add packages/backend/src/presence/presence.controller.ts packages/backend/src/presence/presence.controller.spec.ts
  git commit -m "feat(presence): add PresenceController GET /presence/friends"
  ```

---

## Task 7: Wire module and register in AppModule

**Files:**

- Create: `packages/backend/src/presence/presence.module.ts`
- Modify: `packages/backend/src/app.module.ts`

- [ ] Create `packages/backend/src/presence/presence.module.ts`:
  - `imports`: `RedisModule`, `EventsModule`, `PrismaModule`, `AuthModule` (for `JwtModule`)
  - `providers`: `PresenceService`, `PresenceGateway`
  - `controllers`: `PresenceController`

- [ ] Add `RedisModule`, `EventsModule`, and `PresenceModule` to the `imports` array in `packages/backend/src/app.module.ts`.

  > `RedisModule` must appear before `PresenceModule`.

- [ ] Run all backend tests to verify nothing regressed:

  ```
  pnpm --filter backend test
  ```

- [ ] Start the backend and verify:
  - Server starts without errors
  - `GET /presence/friends` returns `[]` (no friends yet) with a valid JWT

  ```
  pnpm --filter backend dev
  ```

- [ ] Commit:

  ```
  git add packages/backend/src/presence/presence.module.ts packages/backend/src/app.module.ts
  git commit -m "feat(presence): wire PresenceModule and register in AppModule"
  ```
