# Pending Friend Invite in DM List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface incoming friend requests as pending entries in the DM sidebar with a real-time invite panel where the recipient can accept or decline, and notify the sender when declined.

**Architecture:** Two separate queries (`usePendingRequests` + `useThreads`) are merged in `DmThreadList`. A new `FriendshipGateway` emits socket events after send/accept/decline in `FriendshipService`. A new `useFriendSocket` hook registers listeners that invalidate query caches and feed the notification store.

**Tech Stack:** NestJS + Socket.IO (backend), React + MUI v5 + Zustand + TanStack Query v5 (frontend), `@chatrix/shared` for shared event constants and DTOs.

**Spec:** `docs/superpowers/specs/2026-04-21-pending-friend-invite-in-dm-list-design.md`

---

## File Map

**Create:**

- `packages/backend/src/friendship/friendship.gateway.ts` — thin NestJS gateway; holds `@WebSocketServer` and exposes `emitToUser(userId, event, data)`
- `packages/frontend/src/stores/notificationStore.ts` — Zustand store for in-memory notifications
- `packages/frontend/src/stores/notificationStore.test.ts`
- `packages/frontend/src/features/friendship/PendingRequestRow.tsx` — sidebar row for a pending request
- `packages/frontend/src/features/dm/PendingInvitePanel.tsx` — detail panel shown in place of the chat when a pending request is selected
- `packages/frontend/src/features/dm/useFriendSocket.ts` — registers FRIEND_EVENTS listeners on the shared socket

**Modify:**

- `packages/shared/src/events.ts` — add `FRIEND_EVENTS` constant
- `packages/shared/src/index.ts` — re-export `FRIEND_EVENTS` if not already wildcard-exported
- `packages/backend/src/friendship/friendship.service.ts` — inject `FriendshipGateway`; emit events after send/accept/decline; include `fromUserCreatedAt` in `listPendingRequests` return
- `packages/backend/src/friendship/friendship.service.spec.ts` — cover new emit calls and updated return shape
- `packages/backend/src/friendship/friendship.module.ts` — add `FriendshipGateway` to providers
- `packages/frontend/src/features/friendship/friendshipApi.ts` — add `fromUserCreatedAt: string` to `FriendRequestDto`
- `packages/frontend/src/stores/dmStore.ts` — add `activePendingRequestId` + `setActivePendingRequestId`
- `packages/frontend/src/stores/dmStore.test.ts` — cover new field
- `packages/frontend/src/features/dm/DmThreadList.tsx` — call `usePendingRequests`, render `PendingRequestRow` items above threads
- `packages/frontend/src/features/dm/DmLayout.tsx` — call `useFriendSocket`; render `PendingInvitePanel` when `activePendingRequestId` is set; place `NotificationBell` in the layout
- `packages/frontend/src/components/NotificationBell.tsx` — bell icon with unread badge and dropdown

---

## Task 1: Add FRIEND_EVENTS to shared package

**Files:**

- Modify: `packages/shared/src/events.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/events.test.ts`

- [x] Open `packages/shared/src/events.ts` and add a `FRIEND_EVENTS` constant with three keys: `REQUEST_RECEIVED` (`'friend:request:received'`), `REQUEST_ACCEPTED` (`'friend:request:accepted'`), `REQUEST_DECLINED` (`'friend:request:declined'`). Mark it `as const`.
- [x] Check `packages/shared/src/index.ts` — if it uses wildcard re-exports, no change needed. If it lists named exports, add `FRIEND_EVENTS`.
- [x] Add a test in `packages/shared/src/events.test.ts` asserting that each of the three new event string values is defined and matches the expected string.
- [x] Run `pnpm --filter shared test` — all tests must pass.
- [x] Commit: `feat(shared): add FRIEND_EVENTS socket event constants`

---

## Task 2: Extend FriendRequestDto with fromUserCreatedAt

**Files:**

- Modify: `packages/backend/src/friendship/friendship.service.ts`
- Modify: `packages/backend/src/friendship/friendship.service.spec.ts`
- Modify: `packages/frontend/src/features/friendship/friendshipApi.ts`

- [x] In `friendship.service.ts`, update the `listPendingRequests` Prisma query to also select `fromUser.createdAt`. Add `fromUserCreatedAt: r.fromUser.createdAt` to the mapped return object. Update the return type annotation accordingly.
- [x] In `friendship.service.spec.ts`, update the mock for `listPendingRequests` to include `fromUserCreatedAt` in the expected return shape. Run `pnpm --filter backend test -- --testPathPattern=friendship.service` — must pass.
- [x] In `packages/frontend/src/features/friendship/friendshipApi.ts`, add `fromUserCreatedAt: string` to the `FriendRequestDto` interface.
- [x] Commit: `feat(friendship): add fromUserCreatedAt to pending requests response`

---

## Task 3: Create FriendshipGateway and wire socket emits

**Files:**

- Create: `packages/backend/src/friendship/friendship.gateway.ts`
- Modify: `packages/backend/src/friendship/friendship.service.ts`
- Modify: `packages/backend/src/friendship/friendship.module.ts`
- Modify: `packages/backend/src/friendship/friendship.service.spec.ts`

- [x] Create `friendship.gateway.ts`. Decorate it with `@WebSocketGateway` (same CORS config as `dm.gateway.ts`). Add `@WebSocketServer() server: Server`. Add a single public method `emitToUser(userId: string, event: string, data: unknown): void` that calls `this.server.to(`user:${userId}`).emit(event, data)`.
- [x] In `friendship.service.ts`, inject `FriendshipGateway` via constructor. After the `prisma.friendRequest.create` call in `sendRequest`, call `emitToUser` on `toUser.id` with `FRIEND_EVENTS.REQUEST_RECEIVED` and a payload of `{ requestId, fromUserId, fromUsername, fromUserCreatedAt, createdAt }` (use the values already in scope).
- [x] In `acceptRequest`, after the `$transaction`, call `emitToUser` on `request.fromUserId` with `FRIEND_EVENTS.REQUEST_ACCEPTED`.
- [x] In `declineRequest`, after `friendRequest.delete`, call `emitToUser` on `request.fromUserId` with `FRIEND_EVENTS.REQUEST_DECLINED` and payload `{ requestId, declinedByUsername }`. You'll need to fetch the declining user's username — add a `prisma.user.findUnique` call for `userId` before the delete.
- [x] In `friendship.module.ts`, add `FriendshipGateway` to the `providers` array.
- [x] Update `friendship.service.spec.ts`: mock `FriendshipGateway` with a jest spy on `emitToUser`. Assert it is called with the correct arguments after `sendRequest`, `acceptRequest`, and `declineRequest`.
- [x] Run `pnpm --filter backend test -- --testPathPattern=friendship.service` — must pass.
- [x] Commit: `feat(friendship): emit socket events on request send/accept/decline`

---

## Task 4: Extend dmStore with activePendingRequestId

**Files:**

- Modify: `packages/frontend/src/stores/dmStore.ts`
- Modify: `packages/frontend/src/stores/dmStore.test.ts`

- [x] In `dmStore.ts`, add `activePendingRequestId: string | null` to the `DmState` interface, initialised to `null`. Add `setActivePendingRequestId: (id: string | null) => void` to the interface and the store implementation.
- [x] In `dmStore.test.ts`, add a test verifying that `setActivePendingRequestId` sets the value and that calling it with `null` clears it.
- [x] Run `pnpm --filter frontend test -- --testPathPattern=dmStore` — must pass.
- [x] Commit: `feat(dm-store): add activePendingRequestId field`

---

## Task 5: Create notificationStore

**Files:**

- Create: `packages/frontend/src/stores/notificationStore.ts`
- Create: `packages/frontend/src/stores/notificationStore.test.ts`

- [x] Create `notificationStore.ts` with a Zustand store. The state holds `notifications: Notification[]` where `Notification` has `id: string`, `type: 'friend_declined'`, `message: string`, `createdAt: string`, `read: boolean`. Implement `addNotification` (generates a uuid via `crypto.randomUUID()`, sets `read: false`), `markRead(id)`, and `clearAll`.
- [x] Create `notificationStore.test.ts`. Write tests for: adding a notification sets `read: false` and assigns an `id`; `markRead` flips `read` to `true` for the correct entry; `clearAll` empties the array.
- [x] Run `pnpm --filter frontend test -- --testPathPattern=notificationStore` — must pass.
- [x] Commit: `feat(stores): add notificationStore`

---

## Task 6: Create PendingRequestRow component

**Files:**

- Create: `packages/frontend/src/features/friendship/PendingRequestRow.tsx`

- [x] Create `PendingRequestRow.tsx`. It accepts a `FriendRequestDto` prop and an `onClick` callback. Render a button-shaped row matching `ThreadRow` in `DmThreadList.tsx`: `Avatar` with the first letter of `fromUsername`, username text, "Pending request" subtitle in amber (`#f59e0b`), a yellow dot positioned bottom-right on the avatar (use a relative-positioned wrapper + absolute dot), and a "NEW" `Chip` on the right. Use the same MUI `Box` + `Typography` patterns as `ThreadRow`.
- [x] Commit: `feat(friendship): add PendingRequestRow sidebar component`

---

## Task 7: Update DmThreadList to render pending requests

**Files:**

- Modify: `packages/frontend/src/features/dm/DmThreadList.tsx`

- [x] Import `usePendingRequests` from `useFriendshipMutations` and `PendingRequestRow` from `../friendship/PendingRequestRow`. Import `useDmStore` selector for `setActivePendingRequestId`.
- [x] Call `usePendingRequests()` at the top of `DmThreadList`. When `pendingRequests` has items, render them above the active threads section. Each `PendingRequestRow` gets `onClick={() => setActivePendingRequestId(request.id)}`.
- [x] If both `threads` and `pendingRequests` are empty, show the existing "No conversations yet" empty state.
- [x] Run `pnpm --filter frontend test` to check for regressions — must pass.
- [x] Commit: `feat(dm): show pending friend requests in DM thread list`

---

## Task 8: Create useFriendSocket hook

**Files:**

- Create: `packages/frontend/src/features/dm/useFriendSocket.ts`

- [x] Create `useFriendSocket.ts`. It reads `socket` from `dmStore`. In a `useEffect` that depends on `socket`, register three listeners: `FRIEND_EVENTS.REQUEST_RECEIVED` invalidates `['friends', 'requests']`; `FRIEND_EVENTS.REQUEST_ACCEPTED` invalidates `['friends', 'list']` and `['dm', 'threads']`; `FRIEND_EVENTS.REQUEST_DECLINED` calls `notificationStore.addNotification` with a `friend_declined` message built from `payload.declinedByUsername`. Clean up all listeners on effect teardown.
- [x] Commit: `feat(dm): add useFriendSocket for real-time friend request events`

---

## Task 9: Create PendingInvitePanel

**Files:**

- Create: `packages/frontend/src/features/dm/PendingInvitePanel.tsx`

- [x] Create `PendingInvitePanel.tsx`. Props: `requestId: string`, `fromUserId: string`, `fromUsername: string`, `fromUserCreatedAt: string`, `createdAt: string`. Derive "Joined X months/years ago" from `fromUserCreatedAt` using `date-fns` or native `Date` arithmetic.
- [x] Render: a light-background panel (`bgcolor: '#f8f9fa'`) with a header bar (avatar + username + amber "Pending" chip), then a centered card with large avatar, username, join date, the info box text from the spec, and Accept / Decline buttons.
- [x] Accept flow: call `useAcceptRequest().mutateAsync(requestId)`, then `useStartThread().mutateAsync(fromUserId)`, then call `setActiveThread(thread.id)` and `setActivePendingRequestId(null)`.
- [x] Decline flow: call `useDeclineRequest().mutateAsync(requestId)`, then call `setActivePendingRequestId(null)`.
- [x] Both buttons must be `disabled` and show a `CircularProgress` while the respective mutation is pending.
- [x] Commit: `feat(dm): add PendingInvitePanel component`

---

## Task 10: Create NotificationBell component

**Files:**

- Create: `packages/frontend/src/components/NotificationBell.tsx`

- [x] Create `NotificationBell.tsx`. Read `notifications` from `notificationStore`. Render a MUI `IconButton` with `NotificationsIcon`. Wrap it in a MUI `Badge` showing the count of unread notifications; use red badge colour. On click, open a MUI `Popover` or `Menu` listing each notification as a `MenuItem` with its `message` and formatted `createdAt`. Clicking a notification item calls `markRead(id)`.
- [x] Commit: `feat(components): add NotificationBell with unread badge`

---

## Task 11: Wire everything into DmLayout

**Files:**

- Modify: `packages/frontend/src/features/dm/DmLayout.tsx`

- [x] Call `useFriendSocket()` at the top of `DmLayout` (alongside the existing `useDmSocket()`).
- [x] Read `activePendingRequestId` from `dmStore`. Read `pendingRequests` from `usePendingRequests()` to find the full request object for the active id.
- [x] In the right pane, add a third branch: if `activePendingRequestId` is set and the matching request is found, render `PendingInvitePanel` with the request's props instead of `DmChatWindow` or `EmptyState`.
- [x] Place `NotificationBell` in a fixed position in the top-right corner of the right pane (use `position: 'absolute', top: 8, right: 8` inside the relative-positioned right pane box, or add a minimal header bar).
- [x] Run `pnpm --filter frontend test` — must pass.
- [x] Commit: `feat(dm): wire pending invite panel and notification bell into DmLayout`
