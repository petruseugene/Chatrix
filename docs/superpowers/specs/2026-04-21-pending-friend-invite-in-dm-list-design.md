# Pending Friend Invite in DM List

**Date:** 2026-04-21  
**Status:** Approved

## Overview

When a user receives a friend request, it appears instantly in their DM sidebar as a pending entry. Clicking it opens a rich invite detail panel where they can accept or decline. On accept, the DM thread opens automatically. On decline, the sender receives a persistent in-app notification.

## Requirements

- Pending friend requests appear in the DM sidebar in real-time (socket push, not poll)
- Pending entries sit above active DM threads in the sidebar
- Opening a pending entry shows an invite detail panel (not a chat view)
- Accepting creates the mutual friendship and navigates directly into the new DM thread
- Declining removes the entry and sends the sender a persistent notification badge
- All mutations show loading state and disable buttons during in-flight requests

## UI Design

### Sidebar entry (style B)

- Avatar with a yellow dot indicator in the bottom-right corner
- Username in normal weight, "Pending request" subtitle in yellow
- "NEW" badge on the right
- Visually distinct from active DM threads but lives in the same list

### Invite detail panel (style C, light theme)

- Light background (`#f8f9fa`) contrasting the dark sidebar
- Header bar: avatar + username + "Pending" amber chip
- Centered card:
  - Large avatar
  - Username + "Joined X months ago"
  - Info box: _"Accepting will make you mutual friends and allow {username} to send you direct messages. You can remove them as a friend at any time."_
  - **Accept** button (green, solid) and **Decline** button (red, outlined)
  - Both buttons disabled with spinner during mutation

## Architecture

### Approach

Two separate queries (existing `usePendingRequests` + `useThreads`) merged in the DM list component. Socket events invalidate the appropriate query caches in real-time.

### Backend changes

No new REST endpoints. Three new socket events added to `packages/shared/src/events.ts`:

```typescript
FRIEND_EVENTS = {
  REQUEST_RECEIVED: 'friend:request:received', // emitted to recipient
  REQUEST_ACCEPTED: 'friend:request:accepted', // emitted to sender
  REQUEST_DECLINED: 'friend:request:declined', // emitted to sender
};
```

**Emit points** — `FriendshipService` calls the existing `EventsService` to emit (consistent with the architecture rule that socket emits go through `EventsService`, not controllers):

- `POST /friends/request` → emit `REQUEST_RECEIVED` to `user:{toUserId}` with `{ requestId, fromUserId, fromUsername, fromUserCreatedAt, createdAt }`
- `POST /friends/accept/:requestId` → emit `REQUEST_ACCEPTED` to `user:{fromUserId}`
- `DELETE /friends/decline/:requestId` → emit `REQUEST_DECLINED` to `user:{fromUserId}` with `{ requestId, declinedByUsername }`

`FriendRequestDto` (backend + shared) gains one field: `fromUserCreatedAt: Date` so the invite panel can display "Joined X months ago" without an extra fetch. The REST `GET /friends/requests` response also includes this field.

### Frontend changes

#### `packages/shared/src/events.ts`

Add `FRIEND_EVENTS` constant with the three event names above.

#### `dmStore` (extend existing)

Add one field:

```typescript
activePendingRequestId: string | null
setActivePendingRequestId: (id: string | null) => void
```

#### `notificationStore` (new Zustand store)

```typescript
interface Notification {
  id: string;
  type: 'friend_declined';
  message: string;
  createdAt: Date;
  read: boolean;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id' | 'read'>) => void;
  markRead: (id: string) => void;
  clearAll: () => void;
}
```

In-memory only — no persistence. Cleared on page refresh.

#### `PendingRequestRow` (new component)

Renders a single pending friend request in the sidebar. Accepts `FriendRequestDto` as props. On click, calls `dmStore.setActivePendingRequestId(request.id)`.

#### `DmThreadList.tsx` (modify)

- Call both `usePendingRequests()` and `useThreads()`
- Register socket listeners:
  - `FRIEND_EVENTS.REQUEST_RECEIVED` → invalidate `['friends', 'requests']`
  - `FRIEND_EVENTS.REQUEST_ACCEPTED` → invalidate `['friends', 'list']` + `['dm', 'threads']`
- Render `PendingRequestRow` items above `DmThreadRow` items
- When `activePendingRequestId` is set, render `PendingInvitePanel` in the main content area

#### `PendingInvitePanel` (new component)

- Props: `requestId`, `fromUserId`, `fromUsername`, `fromUserCreatedAt`, `createdAt`
- Derives "Joined X months ago" from `fromUserCreatedAt` — no extra fetch needed
- Accept flow:
  1. Call `useAcceptRequest(requestId)`
  2. On success, call `useStartThread(fromUserId)` to get/create the thread
  3. Set `activeThreadId` to the returned thread id, clear `activePendingRequestId`
- Decline flow:
  1. Call `useDeclineRequest(requestId)`
  2. On success, clear `activePendingRequestId`

#### `NotificationBell` (new component)

- Placed in the top nav/header
- Reads from `notificationStore`
- Shows red badge with unread count
- Dropdown lists notifications; clicking one marks it read
- Socket listener: `FRIEND_EVENTS.REQUEST_DECLINED` → `notificationStore.addNotification({ type: 'friend_declined', message: '{declinedByUsername} declined your friend request', createdAt })`

## Data Flow

```
Sender                    Backend                   Recipient
──────                    ───────                   ─────────
POST /friends/request ──► save FriendRequest row
                          emit REQUEST_RECEIVED ──► socket handler
                                                    invalidate requests query
                                                    PendingRequestRow appears in sidebar

                                                    [user clicks pending entry]
                                                    PendingInvitePanel shown

                          [accept path]
                          POST /friends/accept ───► create Friendship row
                          emit REQUEST_ACCEPTED ──► invalidate friends + threads query
socket: accepted          ◄─────────────────────    DM thread navigated to

                          [decline path]
                          DELETE /friends/decline ► remove FriendRequest row
                          emit REQUEST_DECLINED ──► [no UI action needed for recipient]
socket: declined          ◄─────────────────────
NotificationBell badge
shows "X declined your
friend request"
```

## Out of Scope

- Persisting notifications across page refresh
- Read receipts or notification history endpoint
- Blocking a user from the invite panel (existing block endpoint available elsewhere)
- XMPP federation for friend request events
