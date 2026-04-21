# Chat Rooms + Messaging Design (2.4 + 2.5)

**Date:** 2026-04-21  
**Scope:** Requirements sections 2.4 (Chat Rooms) and 2.5 (Messaging) — rooms only, no attachments (2.6 is a separate plan)

---

## 1. Goals

- Full room lifecycle: create, discover, join/leave, delete
- Public rooms (free join, searchable catalog) and private rooms (invite-only)
- Role hierarchy: Owner > Admin > Member
- Ban management (soft-lift, history preserved)
- Real-time room messaging with inline replies, edit, delete
- Typing indicators
- Admin UI via gear icon in room header + context menus on messages

---

## 2. Out of Scope

- File/image attachments (requirement 2.6 — separate plan)
- XMPP federation for rooms

---

## 3. Data Model

Four new Prisma models. Add to `packages/backend/prisma/schema.prisma`.

```prisma
enum RoomRole {
  OWNER
  ADMIN
  MEMBER
}

model Room {
  id          String   @id @default(cuid())
  name        String   @unique
  description String   @default("")
  isPrivate   Boolean  @default(false)
  ownerId     String
  owner       User     @relation("RoomOwner", fields: [ownerId], references: [id])
  createdAt   DateTime @default(now())

  memberships RoomMembership[]
  bans        RoomBan[]
  messages    RoomMessage[]

  @@index([isPrivate, name])
}

model RoomMembership {
  id       String   @id @default(cuid())
  roomId   String
  userId   String
  role     RoomRole @default(MEMBER)
  joinedAt DateTime @default(now())

  room Room @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([roomId, userId])
  @@index([userId])
}

model RoomBan {
  id         String    @id @default(cuid())
  roomId     String
  userId     String
  bannedById String
  reason     String?
  createdAt  DateTime  @default(now())
  liftedAt   DateTime?

  room     Room @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user     User @relation("BannedUser", fields: [userId], references: [id], onDelete: Cascade)
  bannedBy User @relation("Banner", fields: [bannedById], references: [id])

  @@index([roomId, userId])
  // Enforced in service: only one active ban (liftedAt IS NULL) per (roomId, userId)
}

model RoomMessage {
  id        String    @id @default(cuid())
  roomId    String
  authorId  String
  content   String    @db.VarChar(3072)
  replyToId String?
  editedAt  DateTime?
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  room    Room         @relation(fields: [roomId], references: [id], onDelete: Cascade)
  author  User         @relation("RoomMessages", fields: [authorId], references: [id])
  replyTo RoomMessage?  @relation("RoomReplies", fields: [replyToId], references: [id])
  replies RoomMessage[] @relation("RoomReplies")

  @@index([roomId, createdAt(sort: Desc), id(sort: Desc)])
}
```

**`User` model additions:**

```prisma
ownedRooms      Room[]           @relation("RoomOwner")
roomMemberships RoomMembership[]
roomBans        RoomBan[]        @relation("BannedUser")
roomBansGiven   RoomBan[]        @relation("Banner")
roomMessages    RoomMessage[]    @relation("RoomMessages")
```

---

## 4. Backend Module

### 4.1 File Structure

```
packages/backend/src/rooms/
  rooms.module.ts
  rooms.controller.ts
  rooms.service.ts
  rooms.gateway.ts
  rooms.service.spec.ts
  dto/
    create-room.dto.ts
    update-room.dto.ts
    send-message.dto.ts
    edit-message.dto.ts
    get-messages.dto.ts      # cursor pagination query
    invite-user.dto.ts
    ban-user.dto.ts
    set-role.dto.ts
    search-rooms.dto.ts
```

### 4.2 Service Methods

| Method                                            | Description                                            |
| ------------------------------------------------- | ------------------------------------------------------ |
| `createRoom(userId, dto)`                         | Create room + insert OWNER membership in transaction   |
| `listMyRooms(userId)`                             | Rooms with active membership for caller                |
| `searchPublic(query, cursor)`                     | Public rooms cursor-paginated; returns `RoomSummary[]` |
| `getRoom(roomId, userId)`                         | Detail + members; 403 if private and not member        |
| `updateRoom(roomId, userId, dto)`                 | Owner only; name uniqueness re-checked                 |
| `deleteRoom(roomId, userId)`                      | Owner only; cascade deletes all messages               |
| `joinRoom(roomId, userId)`                        | Public only; checks not banned, not already member     |
| `leaveRoom(roomId, userId)`                       | Throws `ForbiddenException` if caller is owner         |
| `inviteUser(roomId, actorId, targetUsername)`     | Owner/admin only; works for private and public         |
| `kickMember(roomId, actorId, targetId)`           | Actor role > target role; owner unkickable             |
| `banUser(roomId, actorId, targetId, reason?)`     | Creates `RoomBan`, removes membership in transaction   |
| `unbanUser(roomId, actorId, targetId)`            | Sets `liftedAt = now()` on active ban                  |
| `setRole(roomId, actorId, targetId, role)`        | Owner only; cannot set OWNER role                      |
| `sendMessage(roomId, userId, dto)`                | Authz check first; returns `RoomMessagePayload`        |
| `editMessage(roomId, userId, messageId, content)` | Author only                                            |
| `deleteMessage(roomId, userId, messageId)`        | Author or admin/owner                                  |
| `getMessages(roomId, userId, cursor)`             | Cursor pagination `(createdAt, id)` DESC, page size 50 |
| `getMembers(roomId, userId)`                      | Active members with roles; caller must be member       |

**Role numeric map** (used for hierarchy comparisons in service):

```typescript
const ROLE_RANK = { OWNER: 2, ADMIN: 1, MEMBER: 0 } as const;
```

### 4.3 HTTP Endpoints

All routes under `/rooms`, all behind `JwtAuthGuard`.

| Method   | Path                              | Caller                                               |
| -------- | --------------------------------- | ---------------------------------------------------- |
| `POST`   | `/rooms`                          | any auth user                                        |
| `GET`    | `/rooms`                          | caller's rooms                                       |
| `GET`    | `/rooms/public`                   | any authenticated user (query: `search?`, `cursor?`) |
| `GET`    | `/rooms/:id`                      | member (public rooms: anyone)                        |
| `PATCH`  | `/rooms/:id`                      | owner                                                |
| `DELETE` | `/rooms/:id`                      | owner                                                |
| `POST`   | `/rooms/:id/join`                 | any non-banned auth user                             |
| `POST`   | `/rooms/:id/leave`                | non-owner member                                     |
| `POST`   | `/rooms/:id/invite`               | owner/admin                                          |
| `DELETE` | `/rooms/:id/members/:userId`      | owner/admin                                          |
| `POST`   | `/rooms/:id/bans`                 | owner/admin                                          |
| `DELETE` | `/rooms/:id/bans/:userId`         | owner/admin                                          |
| `PATCH`  | `/rooms/:id/members/:userId/role` | owner                                                |
| `GET`    | `/rooms/:id/messages`             | member                                               |
| `GET`    | `/rooms/:id/members`              | member                                               |

### 4.4 Socket Gateway (`RoomsGateway`)

On connect: join all `room:${roomId}` socket rooms for the user's active memberships (same pattern as `DmGateway`).

On disconnect: no explicit leave needed — Socket.IO handles it.

**Client → Server events:**

| Event                 | Payload                           | Description            |
| --------------------- | --------------------------------- | ---------------------- |
| `room:message:send`   | `{ roomId, content, replyToId? }` | Send message           |
| `room:message:edit`   | `{ roomId, messageId, content }`  | Edit own message       |
| `room:message:delete` | `{ roomId, messageId }`           | Delete message         |
| `room:typing:start`   | `{ roomId }`                      | Start typing indicator |
| `room:typing:stop`    | `{ roomId }`                      | Stop typing indicator  |

**Server → Client events (broadcast to `room:${roomId}`):**

| Event                  | Payload                                    |
| ---------------------- | ------------------------------------------ |
| `room:message:new`     | `RoomMessagePayload`                       |
| `room:message:edited`  | `{ roomId, messageId, content, editedAt }` |
| `room:message:deleted` | `{ roomId, messageId }`                    |
| `room:member:joined`   | `{ roomId, userId, username }`             |
| `room:member:left`     | `{ roomId, userId, username }`             |
| `room:member:kicked`   | `{ roomId, userId, username }`             |
| `room:member:banned`   | `{ roomId, userId, username }`             |
| `room:typing`          | `{ roomId, userId, username, isTyping }`   |

---

## 5. Shared Package (`packages/shared`)

### `src/events.ts` addition

```typescript
export const ROOM_EVENTS = {
  MESSAGE_SEND: 'room:message:send',
  MESSAGE_EDIT: 'room:message:edit',
  MESSAGE_DELETE: 'room:message:delete',
  TYPING_START: 'room:typing:start',
  TYPING_STOP: 'room:typing:stop',
  MESSAGE_NEW: 'room:message:new',
  MESSAGE_EDITED: 'room:message:edited',
  MESSAGE_DELETED: 'room:message:deleted',
  MEMBER_JOINED: 'room:member:joined',
  MEMBER_LEFT: 'room:member:left',
  MEMBER_KICKED: 'room:member:kicked',
  MEMBER_BANNED: 'room:member:banned',
  TYPING: 'room:typing',
} as const;
```

### New `src/rooms.ts`

```typescript
export type RoomRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface RoomSummary {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  memberCount: number;
  myRole?: RoomRole; // present in /rooms (my rooms), absent in public catalog
  unreadCount: number; // always 0 for now; full unread tracking is requirement 2.7
}

export interface RoomMember {
  userId: string;
  username: string;
  role: RoomRole;
  joinedAt: string;
}

export interface RoomDetail extends RoomSummary {
  ownerId: string;
  members: RoomMember[];
}

export interface RoomMessagePayload {
  id: string;
  roomId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  replyTo?: { id: string; authorUsername: string; content: string } | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface SendRoomMessagePayload {
  roomId: string;
  content: string;
  replyToId?: string;
}

export interface RoomTypingPayload {
  roomId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface RoomMemberEventPayload {
  roomId: string;
  userId: string;
  username: string;
}
```

---

## 6. Frontend Architecture

### 6.1 Folder Structure

```
packages/frontend/src/features/rooms/
  roomsApi.ts               # replaces stub in features/chat/roomsApi.ts
  useRoomsQuery.ts          # useMyRooms, usePublicRooms, useRoomDetail, useRoomMessages, useRoomMembers
  useRoomMutations.ts       # create/join/leave/invite/kick/ban/unban/setRole/delete/send/edit/delete-msg
  useRoomSocket.ts          # socket listeners; patches TanStack Query cache
  RoomChatWindow.tsx        # top-level room view (replaces RoomChatWindowPlaceholder)
  RoomHeader.tsx            # name, member count, lock icon, gear icon
  RoomMessageList.tsx       # infinite scroll, cursor pagination, auto-scroll logic
  RoomMessageItem.tsx       # message + reply quote + edited label + context menu
  RoomMessageInput.tsx      # multiline input + reply-to bar
  RoomSettingsDialog.tsx    # tabbed: Info / Members / Bans
  CreateRoomDialog.tsx      # name, description, public/private toggle
  RoomDiscoverDialog.tsx    # search public rooms + join
  InviteUserDialog.tsx      # username input + invite button
```

The existing stub `packages/frontend/src/features/chat/roomsApi.ts` is replaced by importing from `features/rooms/roomsApi.ts`.

### 6.2 Sidebar Wiring

- Add `+` icon button next to "Rooms" label in `SidebarRoomList` → opens `CreateRoomDialog`
- Add globe/search icon → opens `RoomDiscoverDialog`
- `useMyRooms()` replaces the stub call in `useRoomsQuery.ts`

### 6.3 Socket Integration

`useRoomSocket` (called once from `ChatPage` alongside `useDmSocket`):

- On `room:message:new`: prepend to `['rooms', roomId, 'messages']` query cache
- On `room:message:edited`: patch message in cache
- On `room:message:deleted`: mark `deletedAt` in cache
- On `room:member:joined/left/kicked/banned`: invalidate `['rooms', roomId, 'detail']`
- On `room:typing`: update `roomStore` typing map; auto-clear after 3s

### 6.4 Store

`roomStore.ts` (Zustand) — typing indicators only:

```typescript
interface RoomStore {
  typing: Record<string, Record<string, string>>; // roomId → userId → username
  setTyping: (roomId: string, userId: string, username: string) => void;
  clearTyping: (roomId: string, userId: string) => void;
}
```

---

## 7. Authorization Rules

Enforced in `RoomsService` (never in controller):

1. Every `sendMessage`, `editMessage`, `deleteMessage`, `getMessages` call starts with: verify caller has active `RoomMembership` and no active `RoomBan`.
2. `kickMember` / `banUser`: `ROLE_RANK[actor] > ROLE_RANK[target]`. Owner is unkickable/unbannable.
3. `setRole`: owner only; cannot assign `OWNER` role (ownership transfer not in scope).
4. `getRoom` on private room: non-member gets `403 Forbidden` (not 404) to avoid room existence leak.
5. `getRoom` on public room: any authenticated user can read (needed for catalog join flow).

---

## 8. Error Handling

| Scenario                            | HTTP / WS                                                               |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Room name already taken             | `409 ConflictException`                                                 |
| Already a member                    | `409 ConflictException`                                                 |
| Active ban exists                   | `409 ConflictException` (ban) / `403 ForbiddenException` (join attempt) |
| Insufficient role                   | `403 ForbiddenException`                                                |
| Owner tries to leave                | `403 ForbiddenException`                                                |
| Room/message/user not found         | `404 NotFoundException`                                                 |
| Non-member sends message via socket | `WsException('Forbidden')`                                              |

---

## 9. Rate Limits

| Endpoint                     | Limit                         |
| ---------------------------- | ----------------------------- |
| `POST /rooms`                | 5 / minute                    |
| `POST /rooms/:id/bans`       | 20 / minute                   |
| `room:message:send` (socket) | 30 messages / 10 s (per user) |

---

## 10. Testing

`rooms.service.spec.ts` — unit tests with mocked Prisma, targeting ≥70% service coverage:

- Create room: owner membership inserted in same transaction
- Create room: duplicate name throws `ConflictException`
- Join room: banned user throws `ForbiddenException`
- Join room: already member throws `ConflictException`
- Join room: private room throws `ForbiddenException`
- Kick member: admin cannot kick admin (role hierarchy enforced)
- Kick member: owner is unkickable
- Ban user: membership removed atomically with ban creation
- Leave room: owner throws `ForbiddenException`
- Send message: non-member throws `WsException`
- Send message: banned user throws `WsException`
- Get messages: returns cursor-paginated results in correct order
- Delete room: only owner succeeds
- Set role: only owner can promote; cannot set OWNER role
