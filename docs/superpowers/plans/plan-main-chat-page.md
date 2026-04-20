# Main Chat Page — Implementation Plan

> **Status:** DONE
> **For agentic workers:** Use project-manager skill to execute task-by-task.

**Goal:** Build the unified main chat page that users land on after login, combining a sidebar (rooms + DM threads, search, user panel) with a dynamic chat window that renders either a room chat or a DM thread.

**Architecture:**

- New route `/` replaces the current placeholder `<div>Chat coming soon</div>` in `App.tsx`
- New `ChatPage` component at `features/chat/ChatPage.tsx` acts as the shell; it renders:
  - `Sidebar` (left, 280px fixed): unified chat list (rooms section + DMs section), search bar, "New DM" button, user control panel at the bottom
  - `ChatWindow` (right, flex-1): renders `DmChatWindow` when a DM thread is active, `RoomChatWindow` when a room is active, or an `EmptyState`
- A new `chatStore` (Zustand) tracks `activeView: { type: 'dm'; threadId: string } | { type: 'room'; roomId: string } | null`
- The existing `DmLayout` at `/dm` is preserved for backward compat but the primary experience moves to `/`
- Rooms data: a stub `roomsApi.ts` + `useRooms()` hook returns an empty list for now (rooms feature not yet built); the sidebar renders them gracefully when absent
- The "New DM" button opens a `NewDmDialog` that lists friends and calls `useStartThread()` (already implemented in `useDmQueries.ts`)
- User control panel reads from `useAuthStore` (username, email) and calls `useLogout()` (already in `useAuthMutations.ts`)
- Settings button opens a `SettingsDialog` (placeholder for future settings)
- Socket is connected at the `ChatPage` level via `useDmSocket()` (already implemented) so it is active for the whole session
- All styling via MUI `sx` prop; color palette stays consistent with existing DM UI (`#1e2030` sidebar, `#fafaf8` content area, `#6366f1` primary accent)

**Tech Stack:** Vite + React 18 + TS strict, MUI v5, Zustand, TanStack Query v5, socket.io-client, react-hook-form + zod, react-router v6

---

## File Map

| Action | Path                                                       | Purpose                                                                    |
| ------ | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Create | `packages/frontend/src/features/chat/ChatPage.tsx`         | Top-level shell: sidebar + chat window                                     |
| Create | `packages/frontend/src/features/chat/Sidebar.tsx`          | Unified sidebar: rooms + DMs list, search, new DM button                   |
| Create | `packages/frontend/src/features/chat/SidebarRoomList.tsx`  | Rooms section of sidebar (stub list)                                       |
| Create | `packages/frontend/src/features/chat/SidebarDmList.tsx`    | DM threads section of sidebar (reuses thread data)                         |
| Create | `packages/frontend/src/features/chat/SidebarUserPanel.tsx` | Bottom panel: avatar, username, settings button, logout                    |
| Create | `packages/frontend/src/features/chat/NewDmDialog.tsx`      | Dialog to pick a friend and start/open a DM thread                         |
| Create | `packages/frontend/src/features/chat/SettingsDialog.tsx`   | Placeholder settings dialog (username, email display)                      |
| Create | `packages/frontend/src/features/chat/EmptyState.tsx`       | Center pane shown when no thread/room is selected                          |
| Create | `packages/frontend/src/features/chat/roomsApi.ts`          | Stub API: `getRooms()` returns `[]`; shape ready for rooms feature         |
| Create | `packages/frontend/src/features/chat/useRoomsQuery.ts`     | TanStack Query hook wrapping `roomsApi.getRooms`                           |
| Create | `packages/frontend/src/stores/chatStore.ts`                | Zustand store: `activeView`, `setActiveDm`, `setActiveRoom`, `clearActive` |
| Modify | `packages/frontend/src/App.tsx`                            | Replace `/` placeholder with `<ChatPage />`; keep `/dm` route              |

---

## Task 1: chatStore — Zustand store for active view

**Status:** DONE
**Relevant files:**

- Create: `packages/frontend/src/stores/chatStore.ts`

**Skill to use:** superpowers:test-driven-development

**Details:**

```typescript
type ActiveView = { type: 'dm'; threadId: string } | { type: 'room'; roomId: string } | null;

interface ChatState {
  activeView: ActiveView;
  setActiveDm: (threadId: string) => void;
  setActiveRoom: (roomId: string) => void;
  clearActive: () => void;
}
```

The store is created with `create<ChatState>()`. No persistence needed.

**Acceptance criteria:**

- [ ] `chatStore.ts` exists at `packages/frontend/src/stores/chatStore.ts`
- [ ] `setActiveDm` sets `activeView` to `{ type: 'dm', threadId }`
- [ ] `setActiveRoom` sets `activeView` to `{ type: 'room', roomId }`
- [ ] `clearActive` sets `activeView` to `null`
- [ ] TypeScript compiles without errors (`pnpm --filter frontend build` exits 0)
- [ ] Unit test file `chatStore.test.ts` created alongside (covers all three actions)

---

## Task 2: roomsApi stub + useRoomsQuery hook

**Status:** DONE
**Relevant files:**

- Create: `packages/frontend/src/features/chat/roomsApi.ts`
- Create: `packages/frontend/src/features/chat/useRoomsQuery.ts`

**Skill to use:** superpowers:test-driven-development

**Details:**

`roomsApi.ts` exports:

```typescript
export interface RoomSummary {
  id: string;
  name: string;
  unreadCount: number;
}
// Stub: always returns []
export async function getRooms(_token: string): Promise<RoomSummary[]> {
  return [];
}
```

`useRoomsQuery.ts` exports `useRooms()` using `useQuery` from TanStack Query, enabled when `accessToken` is present. Query key: `['rooms', 'list']`.

**Acceptance criteria:**

- [ ] `getRooms` returns `Promise<RoomSummary[]>` (typed, no `any`)
- [ ] `useRooms()` hook uses TanStack Query (`useQuery`), not raw `useEffect`
- [ ] `useRooms()` is enabled only when `accessToken` is non-null (reads from `useAuthStore`)
- [ ] TypeScript compiles without errors
- [ ] Unit test for `useRoomsQuery` mocks the API and verifies the query key

---

## Task 3: EmptyState component

**Status:** DONE
**Relevant files:**

- Create: `packages/frontend/src/features/chat/EmptyState.tsx`

**Skill to use:** frontend-design:frontend-design

**Details:**

Center-pane placeholder shown when `activeView` is `null`. Use the same visual language as the existing `DmLayout` empty state: gradient icon box + heading + subtitle. Add a hint: "Select a room or conversation from the sidebar, or start a new DM."

MUI only — no inline `style={{}}`, no plain CSS.

**Acceptance criteria:**

- [ ] Component renders with MUI `Box` / `Typography` only, no `style={{}}` props
- [ ] Uses `#fafaf8` background, `#6366f1` accent, matching existing DM UI
- [ ] Exports `EmptyState` as default export
- [ ] TypeScript compiles without errors

---

## Task 4: SidebarRoomList component

**Status:** DONE
**Relevant files:**

- Create: `packages/frontend/src/features/chat/SidebarRoomList.tsx`

**Skill to use:** frontend-design:frontend-design

**Depends on:** Task 2 (useRoomsQuery), Task 1 (chatStore)

**Details:**

Renders a labeled section "ROOMS" above the list. Each row shows room name and an unread badge. Active room is highlighted. Clicking a row calls `chatStore.setActiveRoom(room.id)` and clears the active DM. Uses `useRooms()` for data. Shows skeleton rows while loading, a "No rooms yet" empty state, and an error message on failure.

Colors match sidebar dark theme: `#1e2030` background, white text at various opacities.

**Acceptance criteria:**

- [ ] Section label "ROOMS" shown with uppercase, 0.7rem, letter-spacing style matching DM section header
- [ ] Loading state: 2 skeleton rows using MUI `Skeleton`
- [ ] Error state: small error text
- [ ] Empty state: "No rooms yet" text
- [ ] Active room highlighted with `rgba(255,255,255,0.12)` background
- [ ] Clicking a room calls `setActiveRoom` from chatStore
- [ ] No `style={{}}` inline props
- [ ] TypeScript compiles without errors

---

## Task 5: SidebarDmList component

**Status:** DONE
**Relevant files:**

- Create: `packages/frontend/src/features/chat/SidebarDmList.tsx`

**Skill to use:** frontend-design:frontend-design

**Depends on:** Task 1 (chatStore)

**Details:**

Renders a labeled section "DIRECT MESSAGES" above the thread list. Each row shows the other user's avatar, username, last message preview, and unread dot. Data from `useThreads()` (already in `useDmQueries.ts`). Clicking a row calls `chatStore.setActiveDm(thread.id)`. Active thread highlighted. Skeleton + error + empty states consistent with existing `DmThreadList.tsx` but integrated into the unified sidebar.

This component is essentially a refactored version of the existing `DmThreadList.tsx`, adapted to use `chatStore` instead of `dmStore`. The existing `DmThreadList` is **not** deleted — it stays for the `/dm` route.

**Acceptance criteria:**

- [ ] Section label "DIRECT MESSAGES" styled consistently with "ROOMS" label
- [ ] Rows match existing `DmThreadList` visual design (avatar, username, preview, unread badge)
- [ ] Active thread highlighted
- [ ] Clicking calls `chatStore.setActiveDm`
- [ ] Loading / error / empty states handled
- [ ] No `style={{}}` inline props
- [ ] TypeScript compiles without errors

---

## Task 6: NewDmDialog component

**Status:** DONE
**Relevant files:**

- Create: `packages/frontend/src/features/chat/NewDmDialog.tsx`

**Skill to use:** frontend-design:frontend-design

**Depends on:** Task 1 (chatStore)

**Details:**

MUI `Dialog` that opens when user clicks the "+" / "New DM" button in the sidebar. Shows a searchable list of friends (from `useFriends()` in `useFriendshipMutations.ts`). Clicking a friend calls `useStartThread()` from `useDmQueries.ts`; on success, calls `chatStore.setActiveDm(newThread.id)` and closes the dialog.

If no friends: show "You have no friends yet. Send a friend request first." with a link or button to a future friends page (placeholder — just show the message).

Loading state while `useStartThread` is pending: disable the friend list item, show spinner.

Error state: show MUI `Alert` inside the dialog.

**Acceptance criteria:**

- [ ] `Dialog` opens and closes correctly
- [ ] Friends list loaded from `useFriends()`
- [ ] Loading + error states handled
- [ ] On friend click: calls `useStartThread(friendId)` → on success sets active DM and closes dialog
- [ ] Empty friends state shows helpful message
- [ ] No `style={{}}` inline props
- [ ] TypeScript compiles without errors

---

## Task 7: SettingsDialog component

**Status:** DONE
**Relevant files:**

- Create: `packages/frontend/src/features/chat/SettingsDialog.tsx`

**Skill to use:** frontend-design:frontend-design

**Details:**

Placeholder MUI `Dialog` showing current user info (username, email from `useAuthStore`). Includes a "Change Password" section header with a "Coming soon" note. The dialog is opened by the settings icon button in `SidebarUserPanel`.

**Acceptance criteria:**

- [ ] Dialog shows username and email from `useAuthStore`
- [ ] "Change Password" section with "Coming soon" note
- [ ] Closes with an X button or Cancel
- [ ] No `style={{}}` inline props
- [ ] TypeScript compiles without errors

---

## Task 8: SidebarUserPanel component

**Status:** DONE
**Relevant files:**

- Create: `packages/frontend/src/features/chat/SidebarUserPanel.tsx`

**Skill to use:** frontend-design:frontend-design

**Depends on:** Task 7 (SettingsDialog)

**Details:**

Pinned to the bottom of the sidebar. Shows:

- User avatar (letter avatar, color from `getAvatarColor(username)` — import from `features/dm/dmUtils.ts`)
- Username (bold) + email (small, muted)
- Settings `IconButton` → opens `SettingsDialog`
- Logout `IconButton` → calls `useLogout()` from `useAuthMutations.ts`; on success navigates to `/auth`

Layout: horizontal flex, avatar left, text middle, action buttons right.

Dark theme styling consistent with sidebar: white text at reduced opacity, hover states.

**Acceptance criteria:**

- [ ] Avatar, username, email displayed correctly
- [ ] Settings button opens `SettingsDialog`
- [ ] Logout button calls `useLogout().mutate()` and navigates to `/auth` on success
- [ ] Logout button shows loading spinner while pending
- [ ] No `style={{}}` inline props
- [ ] TypeScript compiles without errors

---

## Task 9: Sidebar component (assembly)

**Status:** DONE
**Relevant files:**

- Create: `packages/frontend/src/features/chat/Sidebar.tsx`

**Skill to use:** frontend-design:frontend-design

**Depends on:** Tasks 4, 5, 6, 8

**Details:**

Assembles the full sidebar. Layout (top to bottom):

1. **App header** (top, 56px): app name "Chatrix" with a small chat icon, plus a "+" `IconButton` that opens `NewDmDialog`
2. **Search bar**: MUI `TextField` with search icon, `size="small"`, filters both rooms and DM threads by name (client-side, no API call). Typing filters `SidebarRoomList` and `SidebarDmList` via a `searchQuery` state prop passed down.
3. **Scrollable list area** (flex-1, overflowY auto): `SidebarRoomList` followed by a `Divider` then `SidebarDmList`
4. **User panel** (bottom, pinned): `SidebarUserPanel`

Width: fixed 280px. Background: `#1e2030`. Borderright: `1px solid rgba(255,255,255,0.08)`.

Search filters: rooms by `name.toLowerCase().includes(query)`, DM threads by `otherUsername.toLowerCase().includes(query)`.

**Acceptance criteria:**

- [ ] All four sub-sections render correctly
- [ ] "+" button opens `NewDmDialog`
- [ ] Search bar filters rooms and DMs in real-time (client-side)
- [ ] Scrollable list area scrolls independently; header and user panel stay fixed
- [ ] No `style={{}}` inline props
- [ ] TypeScript compiles without errors

---

## Task 10: ChatPage shell + App.tsx wiring

**Status:** DONE
**Relevant files:**

- Create: `packages/frontend/src/features/chat/ChatPage.tsx`
- Modify: `packages/frontend/src/App.tsx`

**Skill to use:** frontend-design:frontend-design

**Depends on:** Tasks 1, 3, 9 (chatStore, EmptyState, Sidebar)

**Details:**

`ChatPage.tsx`:

- Calls `useDmSocket()` at the top level (so socket is connected for the whole session)
- Reads `activeView` from `chatStore`
- Layout: `display: flex`, `height: 100vh`, `overflow: hidden`
  - Left: `<Sidebar />` (fixed 280px)
  - Right (flex-1): conditional render:
    - `activeView === null` → `<EmptyState />`
    - `activeView.type === 'dm'` → finds thread from `useThreads()` data → `<DmChatWindow thread={thread} />`
    - `activeView.type === 'room'` → `<RoomChatWindowPlaceholder roomId={activeView.roomId} />` (placeholder `Box` with "Room chat coming soon" text)
- Background: right pane uses `#fafaf8`

`RoomChatWindowPlaceholder` is a local inline component (not a separate file) that displays the room name (from `useRooms()` data) and a "Coming soon" message.

`App.tsx` changes:

- Import `ChatPage` from `./features/chat/ChatPage`
- Replace `<Route path="/" element={<div>Chat coming soon</div>} />` with `<Route path="/" element={<ChatPage />} />`
- Keep `<Route path="/dm" element={<DmLayout />} />` intact for backward compat

**Acceptance criteria:**

- [ ] `/` route renders `ChatPage` for authenticated users
- [ ] Socket is connected when `ChatPage` mounts (via `useDmSocket`)
- [ ] Selecting a DM thread renders `DmChatWindow` in the right pane
- [ ] Selecting a room renders the placeholder in the right pane
- [ ] No active selection shows `EmptyState`
- [ ] `/dm` route still works independently
- [ ] `pnpm --filter frontend build` exits 0
- [ ] `pnpm --filter frontend lint` exits 0
- [ ] TypeScript compiles without errors

---

## Final Verification

After all tasks are done:

```bash
pnpm --filter frontend build    # must exit 0
pnpm --filter frontend lint     # must exit 0
pnpm --filter frontend test     # must pass
```

Manual smoke test:

1. `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`
2. `pnpm --filter backend dev` + `pnpm --filter frontend dev`
3. Register user A, register user B
4. Login as A → lands at `/` → sidebar shows Chatrix header, empty rooms, empty DMs, user panel with A's name
5. Send friend request to B; login as B, accept
6. Click "+" in sidebar as A → `NewDmDialog` shows B in friends list → click B → DM thread opens in right pane
7. Send a message → real-time delivery
8. Search for B's username in sidebar search → DM thread filtered correctly
9. Click settings icon → `SettingsDialog` shows A's username and email
10. Click logout → redirected to `/auth`
