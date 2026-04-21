# Chat Rooms + Messaging Implementation Plan

> **Status: DONE** — Tasks 1–17 complete. Task 18 (manual E2E smoke check) to be verified with a running stack.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full chat rooms (create, discover, join/leave, roles, bans) and real-time room messaging with inline replies, edit, delete, and admin UI.

**Architecture:** Single `rooms` NestJS module owns all room business logic, HTTP endpoints, and the socket gateway. The frontend mirrors the existing `dm` feature structure under `features/rooms/`. Prisma cascades handle deletion; role hierarchy is enforced in the service via a numeric rank map.

**Tech Stack:** NestJS 10, Prisma 5, Socket.IO, Redis adapter, React 18, MUI v5, Zustand, TanStack Query v5, `@chatrix/shared`

**Spec:** `docs/superpowers/specs/2026-04-21-rooms-messaging-design.md`

---

## File Map

**Created:**

- `packages/shared/src/rooms.ts` — shared types: `RoomRole`, `RoomSummary`, `RoomDetail`, `RoomMember`, `RoomMessagePayload`, `SendRoomMessagePayload`, `RoomTypingPayload`, `RoomMemberEventPayload`
- `packages/backend/src/rooms/rooms.module.ts`
- `packages/backend/src/rooms/rooms.service.ts`
- `packages/backend/src/rooms/rooms.controller.ts`
- `packages/backend/src/rooms/rooms.gateway.ts`
- `packages/backend/src/rooms/rooms.service.spec.ts`
- `packages/backend/src/rooms/dto/create-room.dto.ts`
- `packages/backend/src/rooms/dto/update-room.dto.ts`
- `packages/backend/src/rooms/dto/invite-user.dto.ts`
- `packages/backend/src/rooms/dto/ban-user.dto.ts`
- `packages/backend/src/rooms/dto/set-role.dto.ts`
- `packages/backend/src/rooms/dto/send-message.dto.ts`
- `packages/backend/src/rooms/dto/edit-message.dto.ts`
- `packages/backend/src/rooms/dto/get-messages.dto.ts`
- `packages/backend/src/rooms/dto/search-rooms.dto.ts`
- `packages/frontend/src/features/rooms/roomsApi.ts`
- `packages/frontend/src/features/rooms/useRoomsQuery.ts`
- `packages/frontend/src/features/rooms/useRoomMutations.ts`
- `packages/frontend/src/features/rooms/useRoomSocket.ts`
- `packages/frontend/src/stores/roomStore.ts`
- `packages/frontend/src/features/rooms/RoomChatWindow.tsx`
- `packages/frontend/src/features/rooms/RoomHeader.tsx`
- `packages/frontend/src/features/rooms/RoomMessageList.tsx`
- `packages/frontend/src/features/rooms/RoomMessageItem.tsx`
- `packages/frontend/src/features/rooms/RoomMessageInput.tsx`
- `packages/frontend/src/features/rooms/RoomSettingsDialog.tsx`
- `packages/frontend/src/features/rooms/CreateRoomDialog.tsx`
- `packages/frontend/src/features/rooms/RoomDiscoverDialog.tsx`
- `packages/frontend/src/features/rooms/InviteUserDialog.tsx`
- `packages/backend/prisma/migrations/<timestamp>_add_rooms/migration.sql` (auto-generated)

**Modified:**

- `packages/shared/src/events.ts` — add `ROOM_EVENTS` constant
- `packages/shared/src/index.ts` — export `rooms.ts`
- `packages/backend/prisma/schema.prisma` — add `RoomRole` enum + `Room`, `RoomMembership`, `RoomBan`, `RoomMessage` models + `User` back-relations
- `packages/backend/src/app.module.ts` — import `RoomsModule`
- `packages/frontend/src/features/chat/roomsApi.ts` — replace stub with re-export from `features/rooms/roomsApi.ts`
- `packages/frontend/src/features/chat/useRoomsQuery.ts` — replace stub call with `useMyRooms()` from `features/rooms/`
- `packages/frontend/src/features/chat/SidebarRoomList.tsx` — add `+` and globe icon buttons
- `packages/frontend/src/features/chat/ChatPage.tsx` — call `useRoomSocket()`, replace `RoomChatWindowPlaceholder` with `RoomChatWindow`

---

## Task 1: Shared package — types and events

**Files:**

- Create: `packages/shared/src/rooms.ts`
- Modify: `packages/shared/src/events.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] Add `ROOM_EVENTS` constant to `events.ts` with all 13 event string values from the spec (section 5)
- [ ] Create `rooms.ts` with: `RoomRole` type, `RoomSummary`, `RoomMember`, `RoomDetail`, `RoomMessagePayload`, `SendRoomMessagePayload`, `RoomTypingPayload`, `RoomMemberEventPayload` — shapes match spec section 5 exactly
- [ ] Export everything from `index.ts`
- [ ] Run `pnpm --filter shared build` and confirm no type errors
- [ ] Commit: `feat(shared): add room types and events`

---

## Task 2: Database schema and migration

**Files:**

- Modify: `packages/backend/prisma/schema.prisma`

- [ ] Add `RoomRole` enum with values `OWNER`, `ADMIN`, `MEMBER`
- [ ] Add `Room` model: `id` (cuid), `name` (unique), `description` (default `""`), `isPrivate` (default `false`), `ownerId`, `createdAt`; relations to `RoomMembership`, `RoomBan`, `RoomMessage`; composite index on `(isPrivate, name)`
- [ ] Add `RoomMembership` model: `id`, `roomId`, `userId`, `role` (default `MEMBER`), `joinedAt`; unique on `(roomId, userId)`; index on `userId`; cascade delete from `Room` and `User`
- [ ] Add `RoomBan` model: `id`, `roomId`, `userId`, `bannedById`, `reason?`, `createdAt`, `liftedAt?`; index on `(roomId, userId)`; cascade delete from `Room` and `User` (not `bannedBy`)
- [ ] Add `RoomMessage` model: `id`, `roomId`, `authorId`, `content` (VarChar 3072), `replyToId?` (self-ref), `editedAt?`, `deletedAt?`, `createdAt`, `updatedAt`; index on `(roomId, createdAt DESC, id DESC)`; cascade delete from `Room`
- [ ] Add back-relations to `User`: `ownedRooms`, `roomMemberships`, `roomBans`, `roomBansGiven`, `roomMessages`
- [ ] Run `pnpm --filter backend prisma migrate dev --name add_rooms` and confirm migration succeeds with no errors
- [ ] Run `pnpm --filter backend prisma generate`
- [ ] Commit: `feat(db): add Room, RoomMembership, RoomBan, RoomMessage models`

---

## Task 3: DTOs

**Files:**

- Create: all files in `packages/backend/src/rooms/dto/`

- [ ] `create-room.dto.ts` — `name` (string, 1–60 chars, `@IsString @MinLength(1) @MaxLength(60)`), `description` (optional string, max 300 chars), `isPrivate` (optional boolean, default `false`)
- [ ] `update-room.dto.ts` — same fields as create but all optional (use `PartialType(CreateRoomDto)`)
- [ ] `invite-user.dto.ts` — `username` (string, required)
- [ ] `ban-user.dto.ts` — `reason` (optional string, max 200 chars)
- [ ] `set-role.dto.ts` — `role` (enum `ADMIN | MEMBER`, use `@IsIn(['ADMIN', 'MEMBER'])`)
- [ ] `send-message.dto.ts` — `content` (string, 1–3072 chars), `replyToId` (optional string)
- [ ] `edit-message.dto.ts` — `content` (string, 1–3072 chars)
- [ ] `get-messages.dto.ts` — `cursor` (optional string), `limit` (optional number, max 50, default 50)
- [ ] `search-rooms.dto.ts` — `search` (optional string, max 60 chars), `cursor` (optional string)
- [ ] Run `pnpm --filter backend lint` and fix any issues
- [ ] Commit: `feat(rooms): add DTOs`

---

## Task 4: RoomsService — room lifecycle methods

**Files:**

- Create: `packages/backend/src/rooms/rooms.service.ts`

- [ ] Define file-level `ROLE_RANK` constant: `{ OWNER: 2, ADMIN: 1, MEMBER: 0 }`
- [ ] Implement private helper `assertMember(roomId, userId)` — queries `RoomMembership` for active membership; throws `ForbiddenException` if not found
- [ ] Implement private helper `assertNotBanned(roomId, userId)` — queries `RoomBan` where `liftedAt IS NULL`; throws `ForbiddenException` if active ban found
- [ ] Implement private helper `getMembership(roomId, userId)` — returns membership or `null`
- [ ] Implement private helper `buildRoomSummary(room, membership?)` — maps Prisma room row to `RoomSummary` shape including `memberCount`, `myRole`, `unreadCount: 0`
- [ ] Implement `createRoom(userId, dto)` — Prisma `$transaction`: create `Room` then create `RoomMembership` with role `OWNER`; return `RoomSummary`
- [ ] Implement `listMyRooms(userId)` — find all `RoomMembership` rows for user, include `room` with `_count: { memberships: true }`; return `RoomSummary[]`
- [ ] Implement `searchPublic(query, cursor)` — find public rooms where `isPrivate = false`; if `search` provided filter by `name contains`; cursor by `id`; page 20; return `RoomSummary[]`
- [ ] Implement `getRoom(roomId, userId)` — load room with members; if `isPrivate` and caller not member throw `ForbiddenException`; return `RoomDetail`
- [ ] Implement `updateRoom(roomId, userId, dto)` — load membership; if not OWNER throw `ForbiddenException`; update room; return updated `RoomSummary`
- [ ] Implement `deleteRoom(roomId, userId)` — assert OWNER; `prisma.room.delete` (cascade handles rest)
- [ ] Implement `joinRoom(roomId, userId)` — load room; throw if `isPrivate`; call `assertNotBanned`; throw `ConflictException` if already member; create `RoomMembership`
- [ ] Implement `leaveRoom(roomId, userId)` — assert member; throw `ForbiddenException` if role is `OWNER`; delete `RoomMembership`
- [ ] Implement `inviteUser(roomId, actorId, targetUsername)` — assert actor is ADMIN or OWNER; find target user by username; assert not already member; assert not banned; create `RoomMembership` with role `MEMBER`
- [ ] Implement `kickMember(roomId, actorId, targetId)` — load both memberships; compare `ROLE_RANK`: actor must be strictly greater than target; delete target's `RoomMembership`
- [ ] Implement `banUser(roomId, actorId, targetId, reason?)` — same role check as kick; `$transaction`: create `RoomBan`, delete `RoomMembership` if exists
- [ ] Implement `unbanUser(roomId, actorId, targetId)` — load actor membership; assert ADMIN or OWNER; find active ban (`liftedAt IS NULL`); set `liftedAt = new Date()`
- [ ] Implement `setRole(roomId, actorId, targetId, role)` — assert actorId is OWNER; refuse if `role === 'OWNER'`; update target's `RoomMembership.role`
- [ ] Run `pnpm --filter backend lint` and fix issues
- [ ] Commit: `feat(rooms): implement room lifecycle service methods`

---

## Task 5: RoomsService — messaging methods

**Files:**

- Modify: `packages/backend/src/rooms/rooms.service.ts`

- [ ] Implement private helper `buildMessagePayload(msg)` — maps Prisma `RoomMessage` (with `author` and `replyTo` includes) to `RoomMessagePayload` shape
- [ ] Implement `sendMessage(roomId, userId, dto)` — `assertMember` + `assertNotBanned`; create `RoomMessage` with optional `replyToId`; include `author` and `replyTo.author`; return `RoomMessagePayload`
- [ ] Implement `editMessage(roomId, userId, messageId, content)` — assert member; load message; throw `ForbiddenException` if `authorId !== userId`; update `content` and `editedAt`; return updated payload
- [ ] Implement `deleteMessage(roomId, userId, messageId)` — assert member; load message and caller membership; allow if `authorId === userId` OR `ROLE_RANK[callerRole] >= 1`; soft-delete: set `deletedAt = new Date()`
- [ ] Implement `getMessages(roomId, userId, cursor)` — `assertMember`; cursor-paginate: `WHERE roomId = ? AND (createdAt, id) < cursor ORDER BY createdAt DESC, id DESC LIMIT 50`; include `author` and `replyTo` with `author`; return `RoomMessagePayload[]` + `nextCursor`
- [ ] Implement `getMembers(roomId, userId)` — `assertMember`; find all `RoomMembership` rows with `user`; return `RoomMember[]`
- [ ] Run `pnpm --filter backend lint`
- [ ] Commit: `feat(rooms): implement messaging service methods`

---

## Task 6: RoomsService unit tests

**Files:**

- Create: `packages/backend/src/rooms/rooms.service.spec.ts`

- [ ] Set up test module with `RoomsService` and mocked `PrismaService` (use `jest.fn()` for all Prisma methods used)
- [ ] **createRoom — happy path:** mock `prisma.$transaction` to return a room + membership; assert service returns correct `RoomSummary` with `myRole: 'OWNER'`
- [ ] **createRoom — duplicate name:** mock `prisma.$transaction` to throw `PrismaClientKnownRequestError` with code `P2002`; assert service throws `ConflictException`
- [ ] **joinRoom — banned user:** mock `prisma.roomBan.findFirst` to return an active ban; assert throws `ForbiddenException`
- [ ] **joinRoom — already member:** mock `prisma.roomMembership.findUnique` to return existing row; assert throws `ConflictException`
- [ ] **joinRoom — private room:** mock `prisma.room.findUnique` to return `{ isPrivate: true }`; assert throws `ForbiddenException`
- [ ] **leaveRoom — owner:** mock membership with `role: 'OWNER'`; assert throws `ForbiddenException`
- [ ] **kickMember — admin tries to kick admin:** mock both memberships as `ADMIN`; assert throws `ForbiddenException`
- [ ] **kickMember — owner is unkickable:** mock target as `OWNER`; assert throws `ForbiddenException`
- [ ] **banUser — membership removed atomically:** mock `prisma.$transaction`; assert transaction includes both `roomBan.create` and `roomMembership.deleteMany`
- [ ] **deleteRoom — non-owner:** mock membership as `MEMBER`; assert throws `ForbiddenException`
- [ ] **setRole — non-owner actor:** mock as `ADMIN`; assert throws `ForbiddenException`
- [ ] **setRole — trying to set OWNER role:** assert throws `ForbiddenException`
- [ ] **sendMessage — non-member:** mock `prisma.roomMembership.findUnique` to return `null`; assert throws `ForbiddenException`
- [ ] **sendMessage — banned user:** mock active ban; assert throws `ForbiddenException`
- [ ] **getMessages — returns cursor-paginated results:** mock `prisma.roomMessage.findMany` with sample rows; assert payload shape is correct and `nextCursor` is set when page is full
- [ ] Run `pnpm --filter backend test -- --testPathPattern=rooms.service` and confirm all tests pass
- [ ] Commit: `test(rooms): add RoomsService unit tests`

---

## Task 7: RoomsController

**Files:**

- Create: `packages/backend/src/rooms/rooms.controller.ts`
- Modify: `packages/backend/src/events/events.service.ts`

- [ ] Add the following emit methods to `EventsService` (each emits to the `room:${roomId}` socket room with the appropriate `ROOM_EVENTS.*` key): `emitRoomMemberJoined`, `emitRoomMemberLeft`, `emitRoomMemberKicked`, `emitRoomMemberBanned` — all accept `(roomId: string, payload: RoomMemberEventPayload)`
- [ ] Apply `@UseGuards(JwtAuthGuard)` and `@Controller('rooms')` at class level
- [ ] `POST /rooms` — `@Throttle({ default: { limit: 5, ttl: 60_000 } })`; call `roomsService.createRoom`; return `201`
- [ ] `GET /rooms` — call `roomsService.listMyRooms`
- [ ] `GET /rooms/public` — extract `search` and `cursor` from query (use `SearchRoomsDto`); call `roomsService.searchPublic`
- [ ] `GET /rooms/:id` — call `roomsService.getRoom`
- [ ] `PATCH /rooms/:id` — call `roomsService.updateRoom`
- [ ] `DELETE /rooms/:id` — `@HttpCode(204)`; call `roomsService.deleteRoom`
- [ ] `POST /rooms/:id/join` — `@HttpCode(204)`; call `roomsService.joinRoom`; emit `room:member:joined` via `EventsService`
- [ ] `POST /rooms/:id/leave` — `@HttpCode(204)`; call `roomsService.leaveRoom`; emit `room:member:left`
- [ ] `POST /rooms/:id/invite` — `@HttpCode(204)`; call `roomsService.inviteUser`; emit `room:member:joined` for invited user
- [ ] `DELETE /rooms/:id/members/:userId` — `@HttpCode(204)`; call `roomsService.kickMember`; emit `room:member:kicked`
- [ ] `POST /rooms/:id/bans` — `@Throttle({ default: { limit: 20, ttl: 60_000 } })`; `@HttpCode(204)`; call `roomsService.banUser`; emit `room:member:banned`
- [ ] `DELETE /rooms/:id/bans/:userId` — `@HttpCode(204)`; call `roomsService.unbanUser`
- [ ] `PATCH /rooms/:id/members/:userId/role` — `@HttpCode(204)`; call `roomsService.setRole`
- [ ] `GET /rooms/:id/messages` — call `roomsService.getMessages`; return `{ messages, nextCursor }`
- [ ] `GET /rooms/:id/members` — call `roomsService.getMembers`
- [ ] Run `pnpm --filter backend lint`
- [ ] Commit: `feat(rooms): add RoomsController`

---

## Task 8: RoomsGateway

**Files:**

- Create: `packages/backend/src/rooms/rooms.gateway.ts`

- [ ] Implement `OnGatewayConnection`: on socket connect, verify JWT from `socket.handshake.auth.token`; load user's `RoomMembership` rows; call `socket.join('room:' + roomId)` for each
- [ ] Handle `room:message:send` (`ROOM_EVENTS.MESSAGE_SEND`) — extract `userId` from `socket.data`; call `roomsService.sendMessage`; broadcast `room:message:new` to `room:${roomId}` via `EventsService`; apply rate limit: 30 messages / 10s per user using a simple in-memory Map with TTL reset
- [ ] Handle `room:message:edit` (`ROOM_EVENTS.MESSAGE_EDIT`) — call `roomsService.editMessage`; broadcast `room:message:edited` to room
- [ ] Handle `room:message:delete` (`ROOM_EVENTS.MESSAGE_DELETE`) — call `roomsService.deleteMessage`; broadcast `room:message:deleted` to room
- [ ] Handle `room:typing:start` (`ROOM_EVENTS.TYPING_START`) — broadcast `room:typing` with `isTyping: true` to room (exclude sender)
- [ ] Handle `room:typing:stop` (`ROOM_EVENTS.TYPING_STOP`) — broadcast `room:typing` with `isTyping: false` to room
- [ ] Wrap all handlers in try/catch; throw `WsException` on auth/validation failure
- [ ] Run `pnpm --filter backend lint`
- [ ] Commit: `feat(rooms): add RoomsGateway`

---

## Task 9: Wire RoomsModule into AppModule

**Files:**

- Create: `packages/backend/src/rooms/rooms.module.ts`
- Modify: `packages/backend/src/app.module.ts`

- [ ] Create `RoomsModule` importing `PrismaModule`, `RedisModule`, `EventsModule`, `JwtModule`; providing `RoomsService`, `RoomsController`, `RoomsGateway`
- [ ] Import `RoomsModule` in `AppModule`
- [ ] Start the backend: `pnpm --filter backend dev`; confirm no startup errors in console
- [ ] Test `POST /rooms` with a valid JWT and body `{ "name": "test-room" }` — expect `201` with a room object
- [ ] Test `GET /rooms` — expect the newly created room in the array
- [ ] Test `GET /rooms/public` — expect the room appears (it defaults to public)
- [ ] Commit: `feat(rooms): wire RoomsModule into app`

---

## Task 10: Frontend API layer

**Files:**

- Create: `packages/frontend/src/features/rooms/roomsApi.ts`
- Modify: `packages/frontend/src/features/chat/roomsApi.ts`

- [ ] Create `features/rooms/roomsApi.ts` with typed fetch functions using the existing `apiFetch` / axios pattern from `features/dm/dmApi.ts`:
  - `getMyRooms()` → `GET /rooms`
  - `getPublicRooms(search?, cursor?)` → `GET /rooms/public`
  - `getRoom(roomId)` → `GET /rooms/:id`
  - `createRoom(dto)` → `POST /rooms`
  - `updateRoom(roomId, dto)` → `PATCH /rooms/:id`
  - `deleteRoom(roomId)` → `DELETE /rooms/:id`
  - `joinRoom(roomId)` → `POST /rooms/:id/join`
  - `leaveRoom(roomId)` → `POST /rooms/:id/leave`
  - `inviteUser(roomId, username)` → `POST /rooms/:id/invite`
  - `kickMember(roomId, userId)` → `DELETE /rooms/:id/members/:userId`
  - `banUser(roomId, userId, reason?)` → `POST /rooms/:id/bans`
  - `unbanUser(roomId, userId)` → `DELETE /rooms/:id/bans/:userId`
  - `setRole(roomId, userId, role)` → `PATCH /rooms/:id/members/:userId/role`
  - `getMessages(roomId, cursor?)` → `GET /rooms/:id/messages`
  - `getMembers(roomId)` → `GET /rooms/:id/members`
- [ ] Replace stub in `features/chat/roomsApi.ts` with a re-export from `features/rooms/roomsApi.ts`
- [ ] Run `pnpm --filter frontend lint`
- [ ] Commit: `feat(rooms): add frontend API layer`

---

## Task 11: Frontend query hooks and mutations

**Files:**

- Create: `packages/frontend/src/features/rooms/useRoomsQuery.ts`
- Create: `packages/frontend/src/features/rooms/useRoomMutations.ts`
- Modify: `packages/frontend/src/features/chat/useRoomsQuery.ts`

- [ ] In `useRoomsQuery.ts`, implement:
  - `useMyRooms()` — `useQuery(['rooms', 'list'])` calling `getMyRooms()`
  - `usePublicRooms(search?)` — `useQuery(['rooms', 'public', search])` calling `getPublicRooms`
  - `useRoomDetail(roomId)` — `useQuery(['rooms', roomId, 'detail'])` calling `getRoom`
  - `useRoomMessages(roomId)` — `useInfiniteQuery(['rooms', roomId, 'messages'])` with cursor pagination; `getNextPageParam` extracts `nextCursor` from each page
  - `useRoomMembers(roomId)` — `useQuery(['rooms', roomId, 'members'])`
- [ ] In `useRoomMutations.ts`, implement one `useMutation` per operation; on success, invalidate or patch the relevant query cache keys:
  - `useCreateRoom` — on success invalidate `['rooms', 'list']`
  - `useJoinRoom` — on success invalidate `['rooms', 'list']` and `['rooms', roomId, 'detail']`
  - `useLeaveRoom` — on success invalidate `['rooms', 'list']`
  - `useDeleteRoom` — on success invalidate `['rooms', 'list']`
  - `useUpdateRoom` — on success invalidate `['rooms', roomId, 'detail']` and `['rooms', 'list']`
  - `useInviteUser` / `useKickMember` / `useBanUser` / `useUnbanUser` / `useSetRole` — on success invalidate `['rooms', roomId, 'members']` and `['rooms', roomId, 'detail']`
  - `useSendRoomMessage` — optimistic or fire-and-forget (socket handles real-time prepend)
  - `useEditRoomMessage` / `useDeleteRoomMessage` — patch message in `['rooms', roomId, 'messages']` cache
- [ ] Update `features/chat/useRoomsQuery.ts` to re-export `useMyRooms` as `useRooms` for backward compat with `SidebarRoomList`
- [ ] Run `pnpm --filter frontend lint`
- [ ] Commit: `feat(rooms): add query hooks and mutations`

---

## Task 12: Room store and socket hook

**Files:**

- Create: `packages/frontend/src/stores/roomStore.ts`
- Create: `packages/frontend/src/features/rooms/useRoomSocket.ts`

- [ ] Create `roomStore.ts` (Zustand) with:
  - State: `typing: Record<string, Record<string, string>>` (roomId → userId → username)
  - `setTyping(roomId, userId, username)` — merges into nested map
  - `clearTyping(roomId, userId)` — removes userId from room's map
- [ ] Create `useRoomSocket.ts` — gets `socket` from `useDmStore` (same shared socket as DM); registers listeners:
  - `ROOM_EVENTS.MESSAGE_NEW` — prepend message to `['rooms', roomId, 'messages']` infinite query cache using `queryClient.setQueryData`
  - `ROOM_EVENTS.MESSAGE_EDITED` — find and patch message content + `editedAt` in cache
  - `ROOM_EVENTS.MESSAGE_DELETED` — find and set `deletedAt` on message in cache
  - `ROOM_EVENTS.MEMBER_JOINED` / `MEMBER_LEFT` / `MEMBER_KICKED` / `MEMBER_BANNED` — invalidate `['rooms', roomId, 'detail']` and `['rooms', 'list']`
  - `ROOM_EVENTS.TYPING` — if `isTyping`, call `setTyping`; start 3s timeout to call `clearTyping`; if not `isTyping`, call `clearTyping` immediately
- [ ] Run `pnpm --filter frontend lint`
- [ ] Commit: `feat(rooms): add room store and socket hook`

---

## Task 13: Dialogs — Create, Discover, Invite

**Files:**

- Create: `packages/frontend/src/features/rooms/CreateRoomDialog.tsx`
- Create: `packages/frontend/src/features/rooms/RoomDiscoverDialog.tsx`
- Create: `packages/frontend/src/features/rooms/InviteUserDialog.tsx`

- [ ] `CreateRoomDialog` — MUI `Dialog` with:
  - `name` text field (required, 1–60 chars)
  - `description` text field (optional, multiline)
  - public/private toggle (`Switch` or `FormControlLabel`)
  - Submit calls `useCreateRoom`; close on success
- [ ] `RoomDiscoverDialog` — MUI `Dialog` with:
  - Search text field that calls `usePublicRooms(search)` with 300ms debounce
  - List of `RoomSummary` rows: name, member count, description preview, "Join" button
  - "Join" calls `useJoinRoom`; button shows loading state; disables if already a member (`myRole` is defined)
- [ ] `InviteUserDialog` — MUI `Dialog` with:
  - Username text field
  - Submit calls `useInviteUser`; shows success/error inline
- [ ] Run frontend dev server, open the app, and manually verify: create a public room → it appears in sidebar; open discover dialog → find and join a second room
- [ ] Commit: `feat(rooms): add CreateRoomDialog, RoomDiscoverDialog, InviteUserDialog`

---

## Task 14: Sidebar wiring

**Files:**

- Modify: `packages/frontend/src/features/chat/SidebarRoomList.tsx`

- [ ] Add two icon buttons to the "Rooms" section header row:
  - Globe/search icon (`TravelExploreIcon` or `ExploreIcon`) → opens `RoomDiscoverDialog`
  - Plus icon (`AddIcon`) → opens `CreateRoomDialog`
- [ ] Import and render both dialogs in `SidebarRoomList` (pass `open`/`onClose` state)
- [ ] Verify in browser: sidebar shows both icons; clicking each opens the correct dialog
- [ ] Commit: `feat(rooms): wire room dialogs into sidebar`

---

## Task 15: RoomHeader and RoomSettingsDialog

**Files:**

- Create: `packages/frontend/src/features/rooms/RoomHeader.tsx`
- Create: `packages/frontend/src/features/rooms/RoomSettingsDialog.tsx`

- [ ] `RoomHeader` — renders room name, member count, lock icon if `isPrivate`; gear `IconButton` opens `RoomSettingsDialog`; receives `room: RoomDetail` and `myRole: RoomRole` as props
- [ ] `RoomSettingsDialog` — MUI `Dialog` with three tabs:
  - **Info tab** — editable name/description/privacy (visible to owner only); "Save" calls `useUpdateRoom`; "Delete room" button (owner only) calls `useDeleteRoom` with a confirmation prompt
  - **Members tab** — list of `RoomMember[]` with role chips; owner sees "Kick", "Ban", promote/demote actions per member; admins see kick/ban on members; actions call the corresponding mutations
  - **Bans tab** — list active bans (members where `RoomBan` is active); "Unban" button calls `useUnbanUser`
- [ ] For the Bans tab, add `getBans(roomId)` to `roomsApi.ts` → `GET /rooms/:id/bans` (add this endpoint to `RoomsController` and `RoomsService` as well: `getActiveBans(roomId, userId)` — assert ADMIN or OWNER; return `RoomBan[]` with `user.username`)
- [ ] Run `pnpm --filter backend lint` and `pnpm --filter frontend lint`
- [ ] Commit: `feat(rooms): add RoomHeader and RoomSettingsDialog`

---

## Task 16: Room messaging UI

**Files:**

- Create: `packages/frontend/src/features/rooms/RoomMessageItem.tsx`
- Create: `packages/frontend/src/features/rooms/RoomMessageInput.tsx`
- Create: `packages/frontend/src/features/rooms/RoomMessageList.tsx`

- [ ] `RoomMessageItem` — renders a single message: avatar, username, timestamp, content, "edited" label if `editedAt`, "[deleted]" style if `deletedAt`; reply-to quote block if `replyTo` is present; MUI `Menu` context menu (right-click or `⋯` button) with:
  - "Edit" — appears only if `authorId === currentUserId`; opens an inline edit field
  - "Delete" — appears if author or if `ROLE_RANK[myRole] >= 1` (admin/owner); calls `useDeleteRoomMessage`
  - "Reply" — sets the reply-to state in `RoomMessageInput`
- [ ] `RoomMessageInput` — multiline `TextField`; if replying, shows a dismissible quote bar above input; send on Enter (Shift+Enter for newline); emits `ROOM_EVENTS.MESSAGE_SEND` via socket; emits `ROOM_EVENTS.TYPING_START` on keydown and `ROOM_EVENTS.TYPING_STOP` on blur/send
- [ ] `RoomMessageList` — fetches messages via `useRoomMessages(roomId)` infinite query; renders messages oldest-first (reverse the DESC pages); auto-scrolls to bottom when at bottom and new message arrives (same pattern as `DmMessageList`); shows "Load earlier messages" button when `hasNextPage`; shows typing indicator row at bottom for each user in `roomStore.typing[roomId]`
- [ ] Run `pnpm --filter frontend lint`
- [ ] Commit: `feat(rooms): add room messaging UI components`

---

## Task 17: RoomChatWindow and ChatPage wiring

**Files:**

- Create: `packages/frontend/src/features/rooms/RoomChatWindow.tsx`
- Modify: `packages/frontend/src/features/chat/ChatPage.tsx`

- [ ] `RoomChatWindow` — receives `roomId: string`; fetches `useRoomDetail(roomId)` for header data; renders `RoomHeader` at top, `RoomMessageList` in middle, `RoomMessageInput` at bottom; if `isLoading` show skeleton; if room not found show fallback
- [ ] In `ChatPage.tsx`:
  - Import and call `useRoomSocket()` alongside existing `useDmSocket()`
  - Replace `RoomChatWindowPlaceholder` with `<RoomChatWindow roomId={activeView.roomId} />`
  - Remove the `RoomChatWindowPlaceholder` function entirely
- [ ] Start both backend and frontend; log in; create a room; open it; send a message; verify it appears in real time; open a second browser tab, join the same room, send a message, verify both tabs see it
- [ ] Commit: `feat(rooms): add RoomChatWindow and wire into ChatPage`

---

## Task 18: End-to-end smoke check

- [ ] Start full stack: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis` then `pnpm --filter backend dev` and `pnpm --filter frontend dev`
- [ ] **Create public room:** log in as User A; click `+` in sidebar; create "general" (public); confirm it appears in sidebar
- [ ] **Discover and join:** log in as User B in a second tab/incognito; open discover dialog; search "general"; click Join; confirm "general" appears in User B's sidebar
- [ ] **Real-time messaging:** User A sends a message in "general"; confirm User B sees it without refresh; User B replies inline; confirm reply quote appears for User A
- [ ] **Edit and delete:** User A edits their message; confirm "edited" label appears for both; User A deletes a message; confirm it shows "[deleted]" for both
- [ ] **Create private room:** User A creates "secret" (private); User A invites User B via gear → Members → Invite; confirm User B sees room in sidebar; confirm a third user cannot discover or join it
- [ ] **Kick and ban:** User A (owner) kicks User B from "general"; confirm User B's room disappears; User A bans User B; confirm User B cannot rejoin; User A unbans; confirm User B can rejoin
- [ ] **Delete room:** User A deletes "secret"; confirm it disappears for User B immediately
- [ ] Run `pnpm --filter backend test -- --testPathPattern=rooms.service` — confirm all tests pass
- [ ] Commit: `chore: rooms + messaging smoke check complete`
