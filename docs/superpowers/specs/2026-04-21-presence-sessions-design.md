# Presence & Sessions Design — Feature 2.2

**Date:** 2026-04-21
**Feature:** Feature 2.2 — User Presence and Sessions
**Status:** Approved

---

## 1. Scope

Implements online/AFK/offline status tracking for all users, broadcast to confirmed friends in real time. Introduces `PresenceModule` (Redis-backed), `PresenceGateway` (socket heartbeats and tab lifecycle), `PresenceController` (HTTP snapshot), and `EventsService` (centralised socket emit helper required by architecture rules).

**Session management** (view active sessions, revoke individual sessions) was already shipped as part of Feature 1 (`GET /users/sessions`, `DELETE /users/sessions/:id` in `AuthService`). This spec does not re-implement it.

**Out of scope:** frontend UI components, room presence (rooms are a later feature), XMPP presence bridging.

---

## 2. Presence Rules

| Condition                                      | Status    |
| ---------------------------------------------- | --------- |
| No open tabs (or all TTLs expired)             | `offline` |
| ≥1 open tab AND any tab active within last 60s | `online`  |
| ≥1 open tab AND no tab active within last 60s  | `afk`     |

A tab is "active" when `document.hasFocus() || document.visibilityState === 'visible'` evaluates to `true` at heartbeat time on the client. No extra DOM event listeners are needed.

**Visibility:** a user's status is only broadcast to and queryable by their confirmed friends.

---

## 3. Redis Data Model

All keys are prefixed `presence:`. No new Prisma models are required — all state is ephemeral Redis with TTL-based expiry.

| Key                           | Type   | Purpose                                                              |
| ----------------------------- | ------ | -------------------------------------------------------------------- | ----- | ----------------------------------------------- |
| `presence:tracked`            | SET    | Global set of userIds with ≥1 open tab. The sweep iterates this set. |
| `presence:user:{id}:tabs`     | ZSET   | `member=tabId`, `score=expiresAt (ms)`. Represents open tabs.        |
| `presence:user:{id}:activity` | ZSET   | `member=tabId`, `score=lastActiveAt (ms)`. Used for AFK derivation.  |
| `presence:user:{id}:status`   | STRING | Last known `'online'                                                 | 'afk' | 'offline'`. Used by sweep for change detection. |

### Heartbeat write path

Client emits `presence:heartbeat` with `{ tabId: string; isActive: boolean }` every 20s.

```
ZADD presence:user:{id}:tabs     {now + 45_000}  {tabId}   -- refresh tab with 45s forward expiry
if isActive:
  ZADD presence:user:{id}:activity  {now}         {tabId}   -- record this tab was active now
SADD presence:tracked {userId}
```

### Status derivation algorithm

```
1. ZREMRANGEBYSCORE tabs  0  {now - 1}            -- evict expired tab entries
2. tabCount = ZCARD tabs
3. [tabId, score] = ZREVRANGE activity 0 0 WITHSCORES   -- most recent active heartbeat
4. if tabCount == 0              → offline
   elif score >= now - 60_000   → online
   else                          → afk
```

---

## 4. Module Structure

```
packages/backend/src/presence/
  presence.module.ts
  presence.service.ts          # all Redis operations; no raw Redis calls outside this file
  presence.gateway.ts          # handles presence:heartbeat; connect/disconnect tab lifecycle
  presence.controller.ts       # GET /presence/friends
  presence.service.spec.ts
  presence.controller.spec.ts

packages/backend/src/events/
  events.module.ts
  events.service.ts            # typed socket emit helpers; holds reference to Socket.IO Server
```

`EventsService` is introduced here to satisfy the CLAUDE.md rule: "Socket emits go through a dedicated `EventsService`, not from controllers." `PresenceService` calls `EventsService.emitPresenceChanged()`; it never touches the socket server directly.

`PresenceGateway` shares the same `/` namespace as `DmGateway` — NestJS supports multiple gateways on the same namespace. The `@WebSocketServer()` reference in `PresenceGateway` is passed to `EventsService` on `afterInit`.

---

## 5. HTTP API

| Method | Path                | Guard          | Description                                       |
| ------ | ------------------- | -------------- | ------------------------------------------------- |
| `GET`  | `/presence/friends` | `JwtAuthGuard` | Returns presence status for all confirmed friends |

**Response:** `FriendPresence[]`

```ts
{
  userId: string;
  username: string;
  status: 'online' | 'afk' | 'offline';
}
```

Implementation: load the caller's friend list from the `Friendship` table (both FK directions), then batch-read `presence:user:{id}:status` from Redis via `MGET`. Friends with no Redis key default to `'offline'`.

---

## 6. Socket Events

Added to `packages/shared/src/events.ts`:

```ts
export const PRESENCE_EVENTS = {
  HEARTBEAT: 'presence:heartbeat',
  CHANGED: 'presence:changed',
} as const;
```

| Event                | Direction       | Payload                                      | Description                                                          |
| -------------------- | --------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| `presence:heartbeat` | client → server | `{ tabId: string; isActive: boolean }`       | Sent every 20s per open tab                                          |
| `presence:changed`   | server → client | `{ userId: string; status: PresenceStatus }` | Emitted to each friend's `user:{friendId}` room on status transition |

`presence:changed` targets `user:{friendId}` Socket.IO rooms already created by `DmGateway.handleConnection` — no new rooms are needed.

---

## 7. Sweep & Lifecycle

### Sweep (`setInterval` every 10s, started in `onModuleInit`)

```
for each userId in SMEMBERS presence:tracked:
  run status derivation algorithm (Section 3)
  prevStatus = GET presence:user:{id}:status
  if newStatus !== prevStatus:
    SET presence:user:{id}:status  newStatus
    load friend list for userId from Friendship table
    EventsService.emitPresenceChanged(friendIds, { userId, status: newStatus })
  if newStatus === 'offline':
    SREM presence:tracked {userId}
    DEL presence:user:{id}:tabs
    DEL presence:user:{id}:activity
    DEL presence:user:{id}:status
```

### handleConnection (PresenceGateway)

1. Verify JWT from `socket.handshake.auth.token` (same pattern as `DmGateway`).
2. Read `tabId` from `socket.handshake.auth.tabId` (UUID generated by client on page load).
3. Store `{ userId, tabId }` on `socket.data`.
4. Write heartbeat immediately with `isActive: true`.
5. Join `user:{userId}` room (if not already joined — `DmGateway` also does this; Socket.IO deduplicates).

### handleDisconnect (PresenceGateway)

1. Read `{ userId, tabId }` from `socket.data`.
2. `ZREM presence:user:{id}:tabs {tabId}` and `ZREM presence:user:{id}:activity {tabId}`.
3. Re-derive status immediately and emit if changed — no waiting for the next sweep cycle.

This means tab-close transitions are near-instant. The sweep catches only ungraceful disconnects (browser crash, network loss) within ≤45s via TTL expiry.

---

## 8. Shared Package Additions

New file `packages/shared/src/presence.ts`:

```ts
export type PresenceStatus = 'online' | 'afk' | 'offline';

export interface FriendPresence {
  userId: string;
  username: string;
  status: PresenceStatus;
}

export interface PresenceChangedPayload {
  userId: string;
  status: PresenceStatus;
}

export interface PresenceHeartbeatPayload {
  tabId: string;
  isActive: boolean;
}
```

Export all from `packages/shared/src/index.ts`.

---

## 9. Testing Strategy

### Unit tests — `presence.service.spec.ts` (mock ioredis + EventsService)

| Scenario                               | Expected                                                |
| -------------------------------------- | ------------------------------------------------------- |
| Heartbeat `isActive: true`             | Updates both tabs ZSET and activity ZSET                |
| Heartbeat `isActive: false`            | Updates only tabs ZSET; activity ZSET unchanged         |
| Sweep: 0 live tabs                     | Status → offline; friends notified; all keys cleaned up |
| Sweep: tabs present, activity ≤60s ago | Status → online                                         |
| Sweep: tabs present, activity >60s ago | Status → afk                                            |
| Sweep: no status change                | `EventsService` not called                              |
| Disconnect: last tab removed           | Immediate offline transition and emit                   |
| Disconnect: other tabs still live      | No status change                                        |

### Unit tests — `presence.controller.spec.ts`

- Mock `PresenceService.getFriendPresence`; verify `FriendPresence[]` shape returned.
- Verify `JwtAuthGuard` is applied (guard metadata test).

Target: **70%+ coverage** on `PresenceService`.

---

## 10. Key Decisions

| Question                 | Decision                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Who sees presence?       | Friends only                                                                         |
| Initial state delivery   | HTTP `GET /presence/friends` snapshot on page load                                   |
| AFK signal               | Heartbeat `isActive` flag (`document.hasFocus() \|\| visibilityState === 'visible'`) |
| Presence architecture    | PresenceService + scheduled sweep (Option A)                                         |
| Session management       | Already implemented in Feature 1; not repeated here                                  |
| Redis key for tab expiry | ZSET with score = expiresAt ms (no per-member TTL, not a native Redis feature)       |
