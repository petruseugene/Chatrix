# Frontend Presence — Implementation Plan

> **Status:** DONE
> **For agentic workers:** Use superpowers:executing-plans (or superpowers:subagent-driven-development) to execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire client-side presence into the Chatrix frontend: emit heartbeats every 20 seconds over the existing Socket.IO connection, and display online/AFK/offline indicators next to friends in the DM thread list and the New DM dialog.

**Architecture:**

- A new `usePresenceHeartbeat` hook owns tab lifecycle: it generates a stable `tabId` (UUID on mount), tracks last user activity via `document` events, and emits `PRESENCE_EVENTS.HEARTBEAT` on the existing `socket` from `dmStore` every 20 seconds.
- A new `presenceStore` (Zustand) holds a `Record<userId, PresenceStatus>` map. It is populated on mount via `GET /presence/friends` (TanStack Query) and kept live by a `usePresenceSocket` hook that listens for `presence:changed` events on the shared socket.
- A new `presenceApi.ts` file in `features/presence/` fetches friend presences from the backend.
- `DmThreadList` (`ThreadRow`) and `NewDmDialog` (`FriendRow`) read status from the store and render a presence dot using MUI's `Box` overlay on the avatar — matching the pattern already in `FriendRow`.

**Tech Stack:** React 18, TypeScript strict, MUI v5, Zustand, TanStack Query v5, socket.io-client, `@chatrix/shared` (`PRESENCE_EVENTS`, `FriendPresence`, `PresenceChangedPayload`, `PresenceHeartbeatPayload`), Vitest

---

## File Map

| Action | Path                                                                   | Purpose                                                   |
| ------ | ---------------------------------------------------------------------- | --------------------------------------------------------- |
| Create | `packages/frontend/src/stores/presenceStore.ts`                        | Zustand store: `Record<userId, PresenceStatus>` + setters |
| Create | `packages/frontend/src/stores/presenceStore.test.ts`                   | Unit tests for store actions                              |
| Create | `packages/frontend/src/features/presence/presenceApi.ts`               | `getFriendPresences(token): Promise<FriendPresence[]>`    |
| Create | `packages/frontend/src/features/presence/usePresenceQuery.ts`          | TanStack Query hook for initial snapshot                  |
| Create | `packages/frontend/src/features/presence/usePresenceSocket.ts`         | Socket listener for `presence:changed`; updates store     |
| Create | `packages/frontend/src/features/presence/usePresenceSocket.test.ts`    | Vitest unit tests                                         |
| Create | `packages/frontend/src/features/presence/usePresenceHeartbeat.ts`      | Per-tab heartbeat emitter + activity detection            |
| Create | `packages/frontend/src/features/presence/usePresenceHeartbeat.test.ts` | Vitest unit tests                                         |
| Modify | `packages/frontend/src/features/dm/DmLayout.tsx`                       | Call `usePresenceHeartbeat()` and `usePresenceSocket()`   |
| Modify | `packages/frontend/src/features/dm/DmThreadList.tsx`                   | Read presence from store; show dot on `ThreadRow` avatar  |
| Modify | `packages/frontend/src/features/chat/NewDmDialog.tsx`                  | Pass `presence` prop to `FriendRow` (already renders dot) |

---

## Task 1: Presence Zustand store

**Status:** DONE
**Relevant files:**

- Create: `packages/frontend/src/stores/presenceStore.ts`
- Create: `packages/frontend/src/stores/presenceStore.test.ts`

**Skill to use:** superpowers:test-driven-development

**Acceptance criteria:**

- [ ] Store exported as `usePresenceStore` (matches naming convention of `useAuthStore`, `useDmStore`, etc.)
- [ ] State shape: `statuses: Record<string, PresenceStatus>` (userId → status)
- [ ] Action `setStatus(userId: string, status: PresenceStatus)` — sets a single entry
- [ ] Action `setMany(presences: FriendPresence[])` — bulk-initialises from the API snapshot; replaces all entries
- [ ] Action `clearAll()` — resets to `{}`
- [ ] Types imported from `@chatrix/shared` (`PresenceStatus`, `FriendPresence`) — no local re-declaration
- [ ] Unit tests in `presenceStore.test.ts` cover: initial state, `setStatus`, `setMany`, `clearAll`
- [ ] TypeScript compiles without errors (`pnpm --filter frontend build`)

---

## Task 2: Presence API + TanStack Query hook

**Status:** DONE
**Relevant files:**

- Create: `packages/frontend/src/features/presence/presenceApi.ts`
- Create: `packages/frontend/src/features/presence/usePresenceQuery.ts`

**Skill to use:** superpowers:test-driven-development

**Acceptance criteria:**

- [ ] `presenceApi.ts` exports `getFriendPresences(token: string): Promise<FriendPresence[]>` — fetches `GET /api/presence/friends` with `Authorization: Bearer {token}` header; throws a meaningful error on non-2xx using the same `extractError` / `handleJsonResponse` pattern as `dmApi.ts`
- [ ] `usePresenceQuery.ts` exports `usePresenceQuery()` — a TanStack Query `useQuery` with key `['presence', 'friends']`; enabled only when `accessToken` is set; on success calls `usePresenceStore.getState().setMany(data)` inside `onSuccess` option (or in a `useEffect` watching `data`)
- [ ] Query key follows the existing convention (`[domain, resource]`)
- [ ] Hook file does not import from `presenceStore` directly in the query config — use `getState()` in callbacks so tests can verify the call without wrapping in a provider
- [ ] TypeScript compiles without errors

---

## Task 3: Presence socket listener (`usePresenceSocket`)

**Status:** DONE
**Relevant files:**

- Create: `packages/frontend/src/features/presence/usePresenceSocket.ts`
- Create: `packages/frontend/src/features/presence/usePresenceSocket.test.ts`

**Skill to use:** superpowers:test-driven-development

**Notes on pattern:** Mirror `useFriendSocket` — read `socket` from `useDmStore`, register listener in `useEffect`, clean up on unmount.

**Acceptance criteria:**

- [ ] Hook reads `socket` from `useDmStore((s) => s.socket)`; early-returns when `socket` is null
- [ ] Listens for `PRESENCE_EVENTS.CHANGED` (imported from `@chatrix/shared`) — never hardcodes the string
- [ ] On event, calls `usePresenceStore.getState().setStatus(userId, status)` with the `PresenceChangedPayload` fields
- [ ] Registers and removes listener correctly (`socket.on` / `socket.off`) in cleanup
- [ ] Tests in `usePresenceSocket.test.ts` cover:
  - [ ] No listener registered when `socket` is null
  - [ ] Listener registered for `PRESENCE_EVENTS.CHANGED` when socket present
  - [ ] `setStatus` called with correct args on event fire
  - [ ] Listeners removed on unmount
- [ ] TypeScript compiles without errors

---

## Task 4: Heartbeat hook (`usePresenceHeartbeat`)

**Status:** DONE
**Relevant files:**

- Create: `packages/frontend/src/features/presence/usePresenceHeartbeat.ts`
- Create: `packages/frontend/src/features/presence/usePresenceHeartbeat.test.ts`

**Skill to use:** superpowers:test-driven-development

**Acceptance criteria:**

- [ ] `tabId` generated once with `crypto.randomUUID()` using `useRef` (stable across re-renders; not regenerated on each call)
- [ ] `isActive` logic: tracks `lastActivity` timestamp via `mousedown`, `keydown`, `scroll`, `touchstart` events on `document`; `isActive = (Date.now() - lastActivity) < 60_000`
- [ ] Hook reads `socket` from `useDmStore((s) => s.socket)`; no-ops when socket is null
- [ ] Emits `PRESENCE_EVENTS.HEARTBEAT` with `{ tabId, isActive }` payload (types match `PresenceHeartbeatPayload` from `@chatrix/shared`)
- [ ] Emits immediately on socket connection (on mount when socket is available), then every 20 seconds via `setInterval`
- [ ] Cleans up: removes document event listeners and clears the interval on unmount
- [ ] Tests in `usePresenceHeartbeat.test.ts` cover:
  - [ ] `socket.emit` called with correct event name and payload shape on mount
  - [ ] `socket.emit` called again after 20 s (use `vi.useFakeTimers`)
  - [ ] `isActive` is `true` when activity recorded within 60 s
  - [ ] `isActive` is `false` when no activity for >60 s
  - [ ] No emit when socket is null
  - [ ] Interval cleared on unmount (no emit after unmount)
- [ ] TypeScript compiles without errors

---

## Task 5: Wire hooks into DmLayout and show indicators in DmThreadList and NewDmDialog

**Status:** DONE
**Relevant files:**

- Modify: `packages/frontend/src/features/dm/DmLayout.tsx`
- Modify: `packages/frontend/src/features/dm/DmThreadList.tsx`
- Modify: `packages/frontend/src/features/chat/NewDmDialog.tsx`
- Update test mock: `packages/frontend/src/features/dm/DmLayout.test.tsx`

**Skill to use:** superpowers:test-driven-development

**DmLayout changes:**

- [ ] Import and call `usePresenceHeartbeat()` and `usePresenceSocket()` alongside the existing `useDmSocket()` and `useFriendSocket()` calls
- [ ] Import and call `usePresenceQuery()` so the initial snapshot is fetched when the DM page mounts
- [ ] Existing tests still pass; add mocks for the three new hooks in `DmLayout.test.tsx`

**DmThreadList changes (presence dot on `ThreadRow`):**

- [ ] `ThreadRow` reads `presenceStore` to get the status for `thread.otherUserId`
- [ ] Presence dot overlaid on the `Avatar` — use `Box` with `position: absolute`, `bottom: 0`, `right: 0`, `width: 9`, `height: 9`, `borderRadius: '50%'`, `border: '2px solid #1e2030'` (matches `FriendRow` styling exactly)
- [ ] Dot colors: `online` → `#22c55e`, `afk` → `#eab308`, `offline` → `#4b5563`
- [ ] Offline dot is rendered but visually muted (color `#4b5563`), not hidden — matches the existing `FriendRow` approach
- [ ] Outer `Badge` (for unread count) and presence dot coexist without overlap — position the dot on the `Avatar` wrapper, keep the `Badge` wrapping the whole `Avatar` container
- [ ] `aria-label` on the row includes status for accessibility (e.g. `"alice — Online"`)

**NewDmDialog changes:**

- [ ] `FriendRow` already accepts a `presence?: PresenceStatus` prop and renders the dot
- [ ] All `FriendRow` usages in `NewDmDialog` pass `presence={usePresenceStore.getState().statuses[friend.friendId] ?? 'offline'}` — or read from a store selector at the list level
- [ ] No inline `PresenceStatus` type re-declaration — import from `@chatrix/shared`

**General:**

- [ ] `pnpm --filter frontend test` passes with no new failures
- [ ] TypeScript compiles without errors (`pnpm --filter frontend build`)
