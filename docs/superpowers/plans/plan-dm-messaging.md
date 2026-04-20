# Direct Messages — Implementation Plan

> **Status: DONE**
>
> **Branch:** `feature/dm-messaging`
>
> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

## Prerequisites

Auth backend Tasks 9–16 (docs/superpowers/plans/2026-04-20-auth.md) **must be completed first**. `JwtAuthGuard` must work before DM endpoints can be protected. Complete those tasks, then begin this plan.

## Goal

Implement one-to-one personal messaging between mutual friends. DMs use a dedicated `DirectMessageThread` model (not a room). This plan includes a minimal friend/block system needed to gate DMs; the full contacts/friends UI is deferred to Feature 4.

## Architecture

- `FriendshipModule` — friend requests, accept/decline, block, mutual-friend check
- `DmModule` — thread management, message CRUD, cursor pagination, Socket.IO gateway
- `packages/shared/src/events.ts` — DM event name constants (never hardcoded)
- Frontend `features/friendship/` — minimal friend-request UI
- Frontend `features/dm/` — thread list, chat window, message input

## Task Status

| Task                                                                             | Status |
| -------------------------------------------------------------------------------- | ------ |
| Task 1: Prisma schema — Friendship, Block, DirectMessageThread, DirectMessage    | DONE   |
| Task 2: Shared events.ts + DM/friendship Zod schemas                             | DONE   |
| Task 3: FriendshipService (requests, accept/decline, block, mutual-friend check) | DONE   |
| Task 4: FriendshipController + FriendshipModule wiring                           | DONE   |
| Task 5: DmService — thread CRUD + cursor-paginated messages                      | DONE   |
| Task 6: DmGateway — Socket.IO real-time events                                   | DONE   |
| Task 7: DmController + DmModule wiring + AppModule registration                  | DONE   |
| Task 8: Frontend — friendship API hooks + minimal UI                             | DONE   |
| Task 9: Frontend — DM store + API hooks                                          | DONE   |
| Task 10: Frontend — DM UI (thread list, chat window, message input)              | DONE   |

---

## File Map

**New files:**

```
packages/shared/src/events.ts
packages/shared/src/dm.ts
packages/backend/src/friendship/friendship.module.ts
packages/backend/src/friendship/friendship.service.ts
packages/backend/src/friendship/friendship.service.spec.ts
packages/backend/src/friendship/friendship.controller.ts
packages/backend/src/friendship/dto/send-request.dto.ts
packages/backend/src/dm/dm.module.ts
packages/backend/src/dm/dm.service.ts
packages/backend/src/dm/dm.service.spec.ts
packages/backend/src/dm/dm.controller.ts
packages/backend/src/dm/dm.gateway.ts
packages/backend/src/dm/dto/send-message.dto.ts
packages/backend/src/dm/dto/edit-message.dto.ts
packages/backend/src/dm/dto/get-messages.dto.ts
packages/frontend/src/features/friendship/friendshipApi.ts
packages/frontend/src/features/friendship/useFriendshipMutations.ts
packages/frontend/src/features/friendship/FriendRequests.tsx
packages/frontend/src/features/dm/dmStore.ts
packages/frontend/src/features/dm/dmApi.ts
packages/frontend/src/features/dm/useDmMutations.ts
packages/frontend/src/features/dm/DmLayout.tsx
packages/frontend/src/features/dm/DmThreadList.tsx
packages/frontend/src/features/dm/DmChatWindow.tsx
packages/frontend/src/features/dm/DmMessageList.tsx
packages/frontend/src/features/dm/DmMessageItem.tsx
packages/frontend/src/features/dm/DmMessageInput.tsx
```

**Modified files:**

```
packages/backend/prisma/schema.prisma
packages/shared/src/index.ts
packages/backend/src/app.module.ts
packages/frontend/src/App.tsx (add /dm route)
```

---

## Task 1: Prisma schema

**Files:**

- Modify: `packages/backend/prisma/schema.prisma`
- Auto-generated: migration SQL

**Step 1: Update User model relations** — append to the User model:

```prisma
  friendshipsA     Friendship[]      @relation("FriendshipA")
  friendshipsB     Friendship[]      @relation("FriendshipB")
  sentRequests     FriendRequest[]   @relation("SentRequests")
  receivedRequests FriendRequest[]   @relation("ReceivedRequests")
  blocking         Block[]           @relation("Blocking")
  blockedBy        Block[]           @relation("Blocked")
  dmThreadsA       DirectMessageThread[] @relation("DmThreadA")
  dmThreadsB       DirectMessageThread[] @relation("DmThreadB")
  directMessages   DirectMessage[]   @relation("DirectMessages")
```

**Step 2: Append new models:**

```prisma
// Canonical ordering: userAId < userBId always
model Friendship {
  id        String   @id @default(cuid())
  userAId   String
  userBId   String
  userA     User     @relation("FriendshipA", fields: [userAId], references: [id], onDelete: Cascade)
  userB     User     @relation("FriendshipB", fields: [userBId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userAId, userBId])
  @@index([userBId])
}

model FriendRequest {
  id         String   @id @default(cuid())
  fromUserId String
  toUserId   String
  fromUser   User     @relation("SentRequests", fields: [fromUserId], references: [id], onDelete: Cascade)
  toUser     User     @relation("ReceivedRequests", fields: [toUserId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@unique([fromUserId, toUserId])
  @@index([toUserId])
}

// Directional: blockerId blocked blockedId
model Block {
  id        String   @id @default(cuid())
  blockerId String
  blockedId String
  blocker   User     @relation("Blocking", fields: [blockerId], references: [id], onDelete: Cascade)
  blocked   User     @relation("Blocked", fields: [blockedId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([blockerId, blockedId])
  @@index([blockedId])
}

// Canonical ordering: userAId < userBId always; one thread per pair
model DirectMessageThread {
  id        String          @id @default(cuid())
  userAId   String
  userBId   String
  userA     User            @relation("DmThreadA", fields: [userAId], references: [id], onDelete: Cascade)
  userB     User            @relation("DmThreadB", fields: [userBId], references: [id], onDelete: Cascade)
  createdAt DateTime        @default(now())
  messages  DirectMessage[]

  @@unique([userAId, userBId])
  @@index([userBId])
}

model DirectMessage {
  id        String              @id @default(cuid())
  threadId  String
  thread    DirectMessageThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  authorId  String
  author    User                @relation("DirectMessages", fields: [authorId], references: [id])
  content   String              @db.VarChar(3072)
  replyToId String?
  replyTo   DirectMessage?      @relation("DmReplies", fields: [replyToId], references: [id])
  replies   DirectMessage[]     @relation("DmReplies")
  editedAt  DateTime?
  deletedAt DateTime?
  createdAt DateTime            @default(now())
  updatedAt DateTime            @updatedAt

  // Cursor pagination index per CLAUDE.md
  @@index([threadId, createdAt(sort: Desc), id(sort: Desc)])
}
```

**Step 3: Run migration**

```bash
pnpm --filter backend prisma migrate dev --name dm-messaging
pnpm --filter backend prisma generate
```

**Step 4: Verify existing tests still pass**

```bash
pnpm --filter backend test
```

**Acceptance criteria:**

- [ ] Migration applied, all 6 new tables exist in DB
- [ ] Prisma client generated with new models
- [ ] Existing unit tests still pass

---

## Task 2: Shared events.ts + DM/friendship Zod schemas

**Files:**

- Create: `packages/shared/src/events.ts`
- Create: `packages/shared/src/dm.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Create packages/shared/src/events.ts**

```typescript
export const DM_EVENTS = {
  MESSAGE_SEND: 'dm:message:send',
  MESSAGE_NEW: 'dm:message:new',
  MESSAGE_EDIT: 'dm:message:edit',
  MESSAGE_EDITED: 'dm:message:edited',
  MESSAGE_DELETE: 'dm:message:delete',
  MESSAGE_DELETED: 'dm:message:deleted',
  TYPING_START: 'dm:typing:start',
  TYPING_STOP: 'dm:typing:stop',
} as const;
```

**Step 2: Create packages/shared/src/dm.ts**

```typescript
import { z } from 'zod';

export const sendDmSchema = z.object({
  recipientId: z.string().cuid(),
  content: z.string().min(1).max(3072),
  replyToId: z.string().cuid().optional(),
});

export const editDmSchema = z.object({
  content: z.string().min(1).max(3072),
});

export const dmCursorSchema = z.object({
  before: z.string().optional(), // ISO datetime string
  beforeId: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});

export const sendFriendRequestSchema = z.object({
  username: z.string().min(3).max(32),
});

export interface DmMessagePayload {
  id: string;
  threadId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  replyToId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface DmThreadPayload {
  id: string;
  otherUserId: string;
  otherUsername: string;
  lastMessage: DmMessagePayload | null;
  unreadCount: number;
}
```

**Step 3: Re-export from packages/shared/src/index.ts** — append:

```typescript
export { DM_EVENTS } from './events';
export type { DmMessagePayload, DmThreadPayload } from './dm';
export { sendDmSchema, editDmSchema, dmCursorSchema, sendFriendRequestSchema } from './dm';
```

**Step 4: Verify compilation**

```bash
cd packages/shared && npx tsc --noEmit
```

**Acceptance criteria:**

- [ ] `DM_EVENTS` exported from shared with no magic strings in backend/frontend
- [ ] Zod schemas exported for reuse in DTOs and frontend validation
- [ ] TypeScript compiles with no errors

---

## Task 3: FriendshipService

**Files:**

- Create: `packages/backend/src/friendship/friendship.service.ts`
- Create: `packages/backend/src/friendship/friendship.service.spec.ts`

**Key methods:**

- `sendRequest(fromUserId, toUsername)` — look up toUser by username, create FriendRequest; throws ConflictException if pending/existing friendship
- `acceptRequest(requestId, userId)` — verify userId is `toUserId`; create Friendship with `userAId = min(a,b), userBId = max(a,b)`; delete request
- `declineRequest(requestId, userId)` — verify userId is `toUserId`; delete request
- `removeFriend(userId, friendId)` — delete Friendship row (try both orderings); also delete DM thread
- `blockUser(blockerId, blockedId)` — create Block; also remove friendship if exists
- `unblockUser(blockerId, blockedId)` — delete Block
- `areMutualFriendsAndNotBlocked(userAId, userBId): Promise<boolean>` — returns true iff Friendship exists AND no Block in either direction
- `listFriends(userId)` — list friendships + other user's id/username
- `listPendingRequests(userId)` — list FriendRequests where toUserId = userId

**Write tests first (TDD).** Mock Prisma entirely. Cover:

- sendRequest throws ConflictException on duplicate
- sendRequest throws NotFoundException for unknown username
- acceptRequest creates friendship with canonical ordering (smaller id first)
- areMutualFriendsAndNotBlocked returns false when blocked in either direction

**Acceptance criteria:**

- [ ] All unit tests pass with mocked Prisma
- [ ] Canonical ordering enforced in acceptRequest: `min(id) → userAId`
- [ ] blockUser removes friendship in transaction
- [ ] areMutualFriendsAndNotBlocked checks both block directions

---

## Task 4: FriendshipController + FriendshipModule

**Files:**

- Create: `packages/backend/src/friendship/friendship.controller.ts`
- Create: `packages/backend/src/friendship/friendship.module.ts`
- Create: `packages/backend/src/friendship/dto/send-request.dto.ts`

**Endpoints (all protected by JwtAuthGuard):**

```
POST   /friends/request        body: { username }       → 201
POST   /friends/accept/:id     (requestId)               → 204
DELETE /friends/decline/:id    (requestId)               → 204
DELETE /friends/:friendId                                → 204
POST   /friends/block/:userId                            → 204
DELETE /friends/block/:userId                            → 204
GET    /friends                                          → 200 FriendDto[]
GET    /friends/requests                                 → 200 FriendRequestDto[]
```

Rate limit `POST /friends/request` to 10/min.

**Acceptance criteria:**

- [ ] All endpoints protected by JwtAuthGuard
- [ ] Rate limit on friend requests
- [ ] TypeScript builds cleanly

---

## Task 5: DmService

**Files:**

- Create: `packages/backend/src/dm/dm.service.ts`
- Create: `packages/backend/src/dm/dm.service.spec.ts`

**Key methods:**

- `getOrCreateThread(callerUserId, otherUserId)` — calls `areMutualFriendsAndNotBlocked`; throws ForbiddenException if not; creates/returns thread with canonical ordering
- `sendMessage(threadId, authorId, content, replyToId?)` — validates caller is thread participant; creates DirectMessage
- `editMessage(messageId, authorId, content)` — validates caller is author and message is not deleted; updates content + editedAt
- `deleteMessage(messageId, authorId)` — validates caller is author; soft-deletes (deletedAt = now)
- `listThreads(userId)` — all threads where userAId or userBId = userId; include last message + unread count
- `getMessages(threadId, userId, cursor?)` — validates caller is participant; cursor pagination on `(createdAt DESC, id DESC)`; NEVER offset

**Write tests first (TDD).** Mock Prisma and FriendshipService. Cover:

- getOrCreateThread throws ForbiddenException when not mutual friends
- getOrCreateThread uses canonical ordering (smaller id → userAId)
- sendMessage throws ForbiddenException when caller not in thread
- editMessage throws ForbiddenException when caller is not author
- editMessage throws BadRequestException when message is soft-deleted
- getMessages returns 50 items max, ordered newest first

**Acceptance criteria:**

- [ ] All unit tests pass
- [ ] Cursor pagination: `WHERE threadId = ? AND (createdAt, id) < (?, ?) ORDER BY createdAt DESC, id DESC LIMIT 50`
- [ ] Friend + block check on every thread create/send

---

## Task 6: DmGateway

**Files:**

- Create: `packages/backend/src/dm/dm.gateway.ts`

**Socket.IO gateway** using `@WebSocketGateway({ cors: ... })`.

**On connect:**

- Validate JWT from `socket.handshake.auth.token`
- Join `user:{userId}` room
- Fetch all user's thread IDs; join `dm:thread:{threadId}` for each

**Events handled (client → server):**

```typescript
// dm:message:send
{ threadId: string; content: string; replyToId?: string }
→ calls DmService.sendMessage
→ emits DM_EVENTS.MESSAGE_NEW to `dm:thread:{threadId}` with DmMessagePayload

// dm:message:edit
{ messageId: string; content: string }
→ calls DmService.editMessage
→ emits DM_EVENTS.MESSAGE_EDITED to thread room

// dm:message:delete
{ messageId: string }
→ calls DmService.deleteMessage
→ emits DM_EVENTS.MESSAGE_DELETED to thread room

// dm:typing:start / dm:typing:stop
{ threadId: string }
→ broadcasts to other participant in thread room (not stored)
```

All events validated: caller must be thread participant (re-checked in service, not just on connect).

Use event names from `DM_EVENTS` — never hardcode strings.

**Acceptance criteria:**

- [ ] JWT validated on socket connect; unauthenticated sockets rejected
- [ ] All event names from `DM_EVENTS` constants
- [ ] New thread rooms joined dynamically when `getOrCreateThread` is called via HTTP
- [ ] No Prisma calls in gateway — delegates to DmService

---

## Task 7: DmController + DmModule wiring

**Files:**

- Create: `packages/backend/src/dm/dm.controller.ts`
- Create: `packages/backend/src/dm/dto/send-message.dto.ts`
- Create: `packages/backend/src/dm/dto/edit-message.dto.ts`
- Create: `packages/backend/src/dm/dto/get-messages.dto.ts`
- Create: `packages/backend/src/dm/dm.module.ts`
- Modify: `packages/backend/src/app.module.ts`

**Endpoints (all JwtAuthGuard protected):**

```
POST   /dm/threads              body: { recipientId }   → 201 DmThreadPayload
GET    /dm/threads              query: none             → 200 DmThreadPayload[]
GET    /dm/threads/:id/messages query: before?, beforeId?, limit?  → 200 DmMessagePayload[]
PATCH  /dm/messages/:id         body: { content }       → 200 DmMessagePayload
DELETE /dm/messages/:id                                 → 204
```

Rate limit message send to 30/min per user.

**DmModule imports:** PrismaModule, FriendshipModule (for service), AuthModule (for guards).

**Register DmModule and FriendshipModule in AppModule.**

**Build must pass:**

```bash
pnpm --filter backend build
pnpm --filter backend test
```

**Acceptance criteria:**

- [ ] All 5 endpoints work with correct HTTP status codes
- [ ] Rate limit on message send
- [ ] `pnpm --filter backend build` exits 0
- [ ] All existing + new unit tests pass

---

## Task 8: Frontend — friendship API hooks + minimal UI

**Files:**

- Create: `packages/frontend/src/features/friendship/friendshipApi.ts`
- Create: `packages/frontend/src/features/friendship/useFriendshipMutations.ts`
- Create: `packages/frontend/src/features/friendship/FriendRequests.tsx`

**API layer (TanStack Query):**

- `useFriends()` — GET /friends
- `usePendingRequests()` — GET /friends/requests
- `useSendFriendRequest()` — mutation
- `useAcceptRequest()` — mutation
- `useDeclineRequest()` — mutation

**FriendRequests component:**

- List pending incoming requests with Accept / Decline buttons
- Input to send a request by username
- MUI components only (no inline styles)

**Acceptance criteria:**

- [ ] TanStack Query used for all async operations (no raw useEffect+fetch)
- [ ] MUI components used for all styling
- [ ] Optimistic updates on accept/decline for responsive UX

---

## Task 9: Frontend — DM store + API hooks

**Files:**

- Create: `packages/frontend/src/features/dm/dmStore.ts`
- Create: `packages/frontend/src/features/dm/dmApi.ts`
- Create: `packages/frontend/src/features/dm/useDmMutations.ts`

**Zustand store (`dmStore.ts`):**

```typescript
interface DmState {
  activeThreadId: string | null;
  setActiveThread: (id: string | null) => void;
  // Socket-delivered messages go into TanStack Query cache via queryClient.setQueryData
}
```

**TanStack Query hooks (`dmApi.ts`):**

- `useThreads()` — GET /dm/threads
- `useMessages(threadId, options)` — GET /dm/threads/:id/messages with infinite scroll (useInfiniteQuery)

**Mutations (`useDmMutations.ts`):**

- `useStartThread()` — POST /dm/threads
- `useSendMessage()` — socket emit DM_EVENTS.MESSAGE_SEND (not HTTP, for real-time)
- `useEditMessage()` — PATCH /dm/messages/:id
- `useDeleteMessage()` — DELETE /dm/messages/:id

**Socket integration:**

- Connect socket with JWT from authStore
- On `DM_EVENTS.MESSAGE_NEW` → insert message into TanStack Query cache for that thread
- On `DM_EVENTS.MESSAGE_EDITED` → update message in cache
- On `DM_EVENTS.MESSAGE_DELETED` → mark message deleted in cache

**Acceptance criteria:**

- [ ] Zustand store for UI state (active thread)
- [ ] TanStack Query cache updated by socket events (no parallel fetch loops)
- [ ] `useInfiniteQuery` for message pagination

---

## Task 10: Frontend — DM UI

**Files:**

- Create: `packages/frontend/src/features/dm/DmLayout.tsx`
- Create: `packages/frontend/src/features/dm/DmThreadList.tsx`
- Create: `packages/frontend/src/features/dm/DmChatWindow.tsx`
- Create: `packages/frontend/src/features/dm/DmMessageList.tsx`
- Create: `packages/frontend/src/features/dm/DmMessageItem.tsx`
- Create: `packages/frontend/src/features/dm/DmMessageInput.tsx`
- Modify: `packages/frontend/src/App.tsx` — add `/dm` route

**Layout:**

```
<DmLayout>
  ┌──────────────────┬────────────────────────────────┐
  │  DmThreadList    │  DmChatWindow                  │
  │  (sidebar)       │  ┌──────────────────────────┐  │
  │  - list threads  │  │  DmMessageList           │  │
  │  - online status │  │  (infinite scroll up)    │  │
  │  - unread badge  │  └──────────────────────────┘  │
  │                  │  DmMessageInput               │  │
  └──────────────────┴────────────────────────────────┘
</DmLayout>
```

**Behaviors:**

- Auto-scroll to bottom on new message (when already at bottom)
- No auto-scroll when reading history (classic chat rule)
- Infinite scroll upward loads older messages
- "edited" label on edited messages
- Soft-deleted messages show "[Message deleted]"
- Typing indicator when other user is typing

**DmMessageInput:** multiline TextField (Shift+Enter = newline, Enter = send), emoji button placeholder, send button disabled when empty.

**MUI sx prop or SCSS modules for all styling — no `style={{}}` for layout.**

**Use the `frontend-design:frontend-design` skill for polish.**

**Test via browser before marking done:**

1. Login as user A, navigate to /dm
2. Send friend request to user B
3. Accept as user B
4. Start a DM thread from user A
5. Send messages, verify real-time delivery
6. Edit a message, verify "edited" label
7. Delete a message, verify "[Message deleted]"

**Acceptance criteria:**

- [ ] `/dm` route works and shows layout
- [ ] Thread list shows all threads with unread badges
- [ ] Messages load via infinite scroll
- [ ] Real-time delivery via Socket.IO (no page refresh needed)
- [ ] Edit + delete work
- [ ] No TypeScript errors (`pnpm --filter frontend build`)
- [ ] No ESLint warnings (`pnpm --filter frontend lint`)

---

## Final Verification

After all tasks are done:

```bash
pnpm --filter backend build     # must exit 0
pnpm --filter backend test      # must pass
pnpm --filter frontend build    # must exit 0
pnpm --filter frontend lint     # must exit 0
```

Update every task status to DONE and top-level status to DONE.
