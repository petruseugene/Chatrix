# DM Unread Notifications — Design Spec

**Date:** 2026-04-21

## Overview

Track unread DM message counts per thread per user. Show a numbered badge on the avatar in the sidebar, a "New" chip label next to the thread name, a "New messages" divider inside the chat history, and auto-clear all indicators when the user opens the thread.

---

## Data Model

Add two nullable timestamp columns to `DirectMessageThread` in Prisma:

```prisma
userALastReadAt DateTime?
userBLastReadAt DateTime?
```

- `userA` maps to `DirectMessageThread.userAId`, `userB` to `userBId`.
- `null` means the user has never read the thread → all messages from the other participant are unread.
- A new migration file is generated via `prisma migrate dev`.

**Unread count formula:**

```
count(DirectMessage where threadId = t.id AND authorId != callerId AND createdAt > callerLastReadAt)
```

If `callerLastReadAt` is null, count all messages where `authorId != callerId`.

---

## Backend

### DmService

**`markThreadRead(threadId: string, userId: string): Promise<void>`**

- Calls `assertParticipant(threadId, userId)`.
- Updates `userALastReadAt` or `userBLastReadAt` (whichever maps to `userId`) to `new Date()`.

**`listThreads` update**

- For each thread, run a Prisma `count` on `DirectMessage` with the unread formula above.
- Replace the hardcoded `unreadCount: 0` with the computed value.

### DmController

**`POST /dm/threads/:threadId/read`** → HTTP 204

- JWT-guarded (already applies at controller level).
- Calls `dmService.markThreadRead(threadId, user.sub)`.
- No request body; no response body.

---

## Shared Types / Events

No new socket events are needed. `DmThreadPayload.unreadCount` already exists in `packages/shared/src/dm.ts` — no changes required.

---

## Frontend

### `dmApi.ts`

Add:

```ts
markThreadRead(token: string, threadId: string): Promise<void>
// POST /api/dm/threads/:threadId/read  →  204
```

### `useDmQueries.ts`

Add `useMarkThreadRead` mutation:

- Calls `dmApi.markThreadRead`.
- `onSuccess`: patch the TanStack Query threads cache (`['dm', 'threads']`) to set `unreadCount: 0` for the given `threadId`.

### `useDmSocket.ts`

On `DM_EVENTS.MESSAGE_NEW`:

- Read the currently active thread ID from `useChatStore`.
- If `msg.threadId !== activeThreadId` → patch the threads cache to increment `unreadCount` by 1 and update `lastMessage`.
- If `msg.threadId === activeThreadId` → only update `lastMessage` (user is watching; no badge increment).

### `DmChatWindow.tsx`

- Accept `thread: DmThreadPayload` (already does).
- On mount and on `thread.id` change:
  1. Snapshot `initialUnreadCount = thread.unreadCount` into a ref (captures the count before `markRead` resets it to 0).
  2. Call `markThreadRead` mutation.
- Pass `initialUnreadCount` as a prop to `DmMessageList`.

### `DmMessageList.tsx`

- Accept optional `initialUnreadCount?: number` prop.
- After messages load, compute the divider index: `allMessages.length - initialUnreadCount`. If ≥ 0 and < `allMessages.length`, render a `<Divider>New messages</Divider>` before `allMessages[dividerIndex]`.
- If `initialUnreadCount` ≥ `allMessages.length` (more unread than loaded), show the divider at the very top of the visible list.
- The divider is amber-colored to match the existing unread palette (`#f59e0b`), text `"New messages"`, thin horizontal rule.
- `initialUnreadCount` is captured once on mount via a ref and never changes for the lifetime of the component instance.

### `SidebarDmList.tsx`

- The numbered badge on the avatar already renders via `thread.unreadCount` — no change needed there.
- Replace the small 7×7 amber dot with a **"New"** chip: `<Chip label="New" size="small" />` styled in amber (`bgcolor: '#f59e0b'`, `color: '#1c1917'`, `fontWeight: 700`, `fontSize: '0.6rem'`, `height: 16`).

---

## Auto-Clear Flow

1. User clicks a thread in the sidebar → `setActiveDm(threadId)` fires.
2. `DmChatWindow` mounts with the thread.
3. `useEffect` captures `firstUnreadId` (if `thread.unreadCount > 0`), then fires `markThreadRead`.
4. Mutation `onSuccess` sets `unreadCount: 0` in the threads cache → badge and "New" chip disappear.
5. The divider stays visible for the session (it's captured from the pre-clear snapshot) but disappears on next thread open since `firstUnreadId` will be null.

---

## Real-Time Increment Flow

1. User B sends a message to User A.
2. `DM_EVENTS.MESSAGE_NEW` fires on User A's socket.
3. If User A is **not** viewing that thread: patch threads cache → `unreadCount += 1`, update `lastMessage`.
4. Badge and "New" chip appear/update in the sidebar immediately.
5. If User A **is** viewing that thread: message lands in chat, no badge change.

---

## Out of Scope

- Unread counts persisting across server restarts without DB (handled by DB approach).
- Per-message read receipts (double-ticks) — not in scope.
- Unread counts for room channels — separate feature.
