# DM Unread Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track unread DM message counts per thread, surface them as a badge + "New" chip in the sidebar, show a "New messages" divider in the chat history, and auto-clear everything when the thread is opened.

**Architecture:** Add two nullable `lastReadAt` timestamps to the `DirectMessageThread` DB row (one per participant). The backend computes `unreadCount` from these on every `listThreads` call. The frontend patches the TanStack Query cache in real time (socket increment / mark-read reset) so the UI stays live without polling.

**Tech Stack:** NestJS + Prisma 5 (backend), TanStack Query v5 + Zustand + Socket.IO client + MUI v5 (frontend), TypeScript strict throughout.

---

## File Map

| File                                                               | Change                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `packages/backend/prisma/schema.prisma`                            | Add `userALastReadAt` and `userBLastReadAt` nullable DateTime fields     |
| `packages/backend/prisma/migrations/<timestamp>_dm_read_tracking/` | Auto-generated migration                                                 |
| `packages/backend/src/dm/dm.service.ts`                            | Add `markThreadRead`; update `listThreads` to compute real `unreadCount` |
| `packages/backend/src/dm/dm.controller.ts`                         | Add `POST /dm/threads/:threadId/read` endpoint                           |
| `packages/backend/src/dm/dm.service.spec.ts`                       | Tests for `markThreadRead` and updated `listThreads`                     |
| `packages/frontend/src/features/dm/dmApi.ts`                       | Add `markThreadRead` API call                                            |
| `packages/frontend/src/features/dm/useDmQueries.ts`                | Add `useMarkThreadRead` mutation                                         |
| `packages/frontend/src/features/dm/useDmSocket.ts`                 | Update `onMessageNew` to conditionally increment unread count            |
| `packages/frontend/src/features/dm/DmChatWindow.tsx`               | Snapshot `initialUnreadCount` on mount; call `useMarkThreadRead`         |
| `packages/frontend/src/features/dm/DmMessageList.tsx`              | Accept `initialUnreadCount` prop; render "New messages" divider          |
| `packages/frontend/src/features/chat/SidebarDmList.tsx`            | Replace amber dot with "New" chip                                        |

---

## Task 1: DB schema — add read-tracking timestamps

**Files:**

- Modify: `packages/backend/prisma/schema.prisma`

- [ ] Open `schema.prisma` and locate the `DirectMessageThread` model.
- [ ] Add two nullable `DateTime?` fields: `userALastReadAt` and `userBLastReadAt`.
- [ ] Run `pnpm --filter backend prisma migrate dev --name dm_read_tracking` to generate and apply the migration.
- [ ] Verify the migration file was created under `packages/backend/prisma/migrations/`.
- [ ] Run `pnpm --filter backend prisma generate` to refresh the Prisma client.
- [ ] Commit: `feat(db): add userA/BLastReadAt to DirectMessageThread`

---

## Task 2: Backend — `markThreadRead` service method

**Files:**

- Modify: `packages/backend/src/dm/dm.service.ts`
- Modify: `packages/backend/src/dm/dm.service.spec.ts`

- [ ] Add `markThreadRead(threadId, userId)` to `DmService`:
  - Call `assertParticipant` first.
  - Determine whether `userId === thread.userAId` and set `userALastReadAt` or `userBLastReadAt` accordingly to `new Date()`.
- [ ] Write a unit test: given a thread where `userId` is `userA`, calling `markThreadRead` updates `userALastReadAt` and leaves `userBLastReadAt` unchanged. Mock `prisma.directMessageThread.findUnique` and `prisma.directMessageThread.update`.
- [ ] Write a second test for the `userB` case.
- [ ] Write a test that `markThreadRead` throws `ForbiddenException` when the caller is not a participant.
- [ ] Run `pnpm --filter backend test -- --testPathPattern=dm.service` and confirm all pass.
- [ ] Commit: `feat(dm): add markThreadRead service method`

---

## Task 3: Backend — real `unreadCount` in `listThreads`

**Files:**

- Modify: `packages/backend/src/dm/dm.service.ts`
- Modify: `packages/backend/src/dm/dm.service.spec.ts`

- [ ] Update `listThreads` in `DmService`: for each thread, derive the caller's `lastReadAt` (either `userALastReadAt` or `userBLastReadAt` depending on which side the caller is). Run a Prisma `count` on `DirectMessage` where `threadId = thread.id AND authorId != userId AND (lastReadAt is null OR createdAt > lastReadAt)`. Use this count as `unreadCount` instead of the hardcoded `0`.
- [ ] Write a unit test: thread has 3 messages from the other user, caller's `lastReadAt` is null → `unreadCount` is `3`.
- [ ] Write a test: caller's `lastReadAt` is set to after message 2 → `unreadCount` is `1`.
- [ ] Write a test: caller's `lastReadAt` is after all messages → `unreadCount` is `0`.
- [ ] Run `pnpm --filter backend test -- --testPathPattern=dm.service` and confirm all pass.
- [ ] Commit: `feat(dm): compute real unreadCount in listThreads`

---

## Task 4: Backend — `POST /dm/threads/:threadId/read` endpoint

**Files:**

- Modify: `packages/backend/src/dm/dm.controller.ts`

- [ ] Add a `@Post('threads/:threadId/read')` handler with `@HttpCode(204)` and `@Param('threadId')`. Call `dmService.markThreadRead(threadId, user.sub)` and return nothing.
- [ ] Manually test with curl or a REST client: `POST /api/dm/threads/<id>/read` with a valid JWT should return 204. A request for a thread the user doesn't belong to should return 403.
- [ ] Commit: `feat(dm): add POST /dm/threads/:threadId/read endpoint`

---

## Task 5: Frontend — `markThreadRead` API + mutation

**Files:**

- Modify: `packages/frontend/src/features/dm/dmApi.ts`
- Modify: `packages/frontend/src/features/dm/useDmQueries.ts`

- [ ] Add `markThreadRead(token, threadId)` to `dmApi.ts`: `POST /api/dm/threads/:threadId/read`, expect 204, throw on non-ok.
- [ ] Add `useMarkThreadRead` mutation to `useDmQueries.ts`. In `onSuccess`, use `queryClient.setQueryData` to find the thread in the `['dm', 'threads']` cache and set its `unreadCount` to `0`.
- [ ] Commit: `feat(dm): add markThreadRead API call and mutation`

---

## Task 6: Frontend — socket increments unread count for background threads

**Files:**

- Modify: `packages/frontend/src/features/dm/useDmSocket.ts`

- [ ] In `onMessageNew`, read the active thread ID from `useChatStore` (use `useChatStore.getState()` inside the socket callback — not a hook call — to avoid stale closures).
- [ ] If `msg.threadId` matches the active thread ID, leave the threads cache alone (user is watching; no badge needed).
- [ ] If `msg.threadId` is a different thread, patch the `['dm', 'threads']` cache: increment `unreadCount` by 1 and update `lastMessage` with the new message payload.
- [ ] Also update `lastMessage` for the active-thread case (this already happens; verify it still does).
- [ ] Run `pnpm --filter frontend test -- --testPathPattern=useDmSocket` to confirm existing tests still pass.
- [ ] Commit: `feat(dm): increment unreadCount in socket for background threads`

---

## Task 7: Frontend — `DmChatWindow` marks thread as read on open

**Files:**

- Modify: `packages/frontend/src/features/dm/DmChatWindow.tsx`

- [ ] Import `useMarkThreadRead` from `useDmQueries`.
- [ ] On mount (and when `thread.id` changes), snapshot `thread.unreadCount` into a `useRef` as `initialUnreadCount` _before_ the mutation fires. Pass this ref's value as `initialUnreadCount` prop to `DmMessageList`.
- [ ] In a `useEffect` dependent on `thread.id`, call the `markThreadRead` mutation.
- [ ] Commit: `feat(dm): mark thread as read when DmChatWindow mounts`

---

## Task 8: Frontend — "New messages" divider in `DmMessageList`

**Files:**

- Modify: `packages/frontend/src/features/dm/DmMessageList.tsx`

- [ ] Add `initialUnreadCount?: number` to the component's props interface.
- [ ] After the `allMessages` array is built, compute `dividerIndex = allMessages.length - (initialUnreadCount ?? 0)`. Clamp to `0` if it would be negative.
- [ ] When rendering the message list, check before each message whether its index equals `dividerIndex` and `initialUnreadCount > 0`. If so, insert a MUI `<Divider>` with the text "New messages" above it. Use amber `#f59e0b` for the divider color to match the existing unread palette.
- [ ] Only render the divider once (a simple index comparison is sufficient).
- [ ] Commit: `feat(dm): add New messages divider in DmMessageList`

---

## Task 9: Frontend — "New" chip replaces amber dot in sidebar

**Files:**

- Modify: `packages/frontend/src/features/chat/SidebarDmList.tsx`

- [ ] In `DmRow`, locate the small 7×7 amber dot rendered when `thread.unreadCount > 0`.
- [ ] Replace it with a MUI `<Chip>` labeled "New", sized to `height: 16`, amber background `#f59e0b`, dark text `#1c1917`, bold small font. Import `Chip` from `@mui/material`.
- [ ] The numbered badge on the avatar already works via `thread.unreadCount` — leave it untouched.
- [ ] Start the frontend dev server (`pnpm --filter frontend dev`) and visually confirm: sending a DM from another session shows the badge count and "New" chip; opening the thread clears both; the "New messages" divider appears in the chat history.
- [ ] Commit: `feat(dm): replace unread dot with New chip in SidebarDmList`
