# New DM Modal — User Search & Friend Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the New DM modal so users can search all users, send friend requests inline, and open DMs with friends — all from one place.

**Architecture:** Add a new `GET /api/users/search` endpoint that returns users with their relationship status. On the frontend, swap `NewDmDialog` to show the friends list by default and switch to a two-section search view (Friends / Other People) as the user types. Extract `FriendRow` and `StrangerRow` as focused sub-components.

**Tech Stack:** NestJS + Prisma (backend), React + TanStack Query + MUI (frontend), Vitest (FE tests), Jest (BE tests)

**Spec:** `docs/superpowers/specs/2026-04-21-new-dm-modal-user-search-design.md`

---

## File Map

**Create:**

- `packages/backend/src/users/dto/search-users-query.dto.ts` — validates the `q` query param (2–32 chars)
- `packages/backend/src/users/users.service.ts` — `searchUsers()` method with Prisma query + relationship status derivation
- `packages/backend/src/users/users.service.spec.ts` — unit tests for `searchUsers`
- `packages/frontend/src/features/chat/FriendRow.tsx` — friend list item: avatar + presence dot + status label + green DM button
- `packages/frontend/src/features/chat/StrangerRow.tsx` — non-friend list item: avatar + username + Add/Pending/Accept button

**Modify:**

- `packages/backend/src/users/users.module.ts` — import `PrismaModule`, provide `UsersService`
- `packages/backend/src/users/users.controller.ts` — add `GET /search` endpoint with `@Throttle` and `UsersService` injection
- `packages/frontend/src/features/friendship/friendshipApi.ts` — add `UserSearchResultDto` interface + `searchUsers()` fetch function
- `packages/frontend/src/features/friendship/useFriendshipMutations.ts` — add `SEARCH_KEY` constant + `useUserSearch(query)` hook
- `packages/frontend/src/features/chat/NewDmDialog.tsx` — full rewrite: debounce state, two-section layout, 360px max-width, presence slot

---

## Task 1: Backend — SearchUsersQueryDto

**Files:**

- Create: `packages/backend/src/users/dto/search-users-query.dto.ts`

- [x] Create the DTO file with a single `q` property decorated with `@IsString()`, `@MinLength(2)`, `@MaxLength(32)`, and `@Transform({ value: value.trim() })`.
- [x] Commit: `feat(users): add SearchUsersQueryDto`

---

## Task 2: Backend — UsersService with searchUsers

**Files:**

- Create: `packages/backend/src/users/users.service.ts`
- Modify: `packages/backend/src/users/users.module.ts`

- [x] Create `UsersService` as an `@Injectable()` class that injects `PrismaService`.
- [x] Add `searchUsers(callerId: string, q: string)` method:
  - Find up to 20 `User` rows where `username` contains `q` (case-insensitive), excluding the caller and any user who has an active `Block` in either direction with the caller.
  - Order results by `username ASC`.
  - For each user, determine `relationshipStatus` by checking `Friendship` (→ `friend`), then `FriendRequest` where `fromUserId = caller` (→ `pending_sent`) or `toUserId = caller` (→ `pending_received`), otherwise `none`.
  - When status is `pending_received`, include the `FriendRequest.id` as `friendRequestId`.
  - Return array of `{ id, username, relationshipStatus, friendRequestId? }`.
- [x] In `users.module.ts`, add `PrismaModule` to `imports` and `UsersService` to `providers` and `exports`.
- [x] Commit: `feat(users): add UsersService.searchUsers`

---

## Task 3: Backend — UsersService unit tests

**Files:**

- Create: `packages/backend/src/users/users.service.spec.ts`

- [x] Write a test that mocks `PrismaService` and verifies `searchUsers` excludes the caller's own account.
- [x] Write a test that verifies blocked users (both directions) are excluded from results.
- [x] Write a test that returns `relationshipStatus: 'friend'` when a `Friendship` row exists.
- [x] Write a test that returns `relationshipStatus: 'pending_sent'` when a `FriendRequest` exists from caller.
- [x] Write a test that returns `relationshipStatus: 'pending_received'` with `friendRequestId` when a `FriendRequest` exists to caller.
- [x] Write a test that returns `relationshipStatus: 'none'` for a user with no relationship.
- [x] Run: `pnpm --filter backend test -- --testPathPattern=users.service` — all tests pass.
- [x] Commit: `test(users): add UsersService.searchUsers unit tests` (done as part of Task 2 commit)

---

## Task 4: Backend — GET /users/search endpoint

**Files:**

- Modify: `packages/backend/src/users/users.controller.ts`

- [x] Inject `UsersService` into `UsersController` constructor.
- [x] Add `GET /search` handler decorated with `@Get('search')`, `@UseGuards(JwtAuthGuard)`, and `@Throttle({ default: { limit: 30, ttl: 60_000 } })`.
- [x] Handler receives `@Query() query: SearchUsersQueryDto` (enable `ValidationPipe` with `transform: true` so trimming works) and `@CurrentUser() user: JwtPayload`, then delegates to `usersService.searchUsers(user.sub, query.q)`.
- [x] Verify manually: start backend, call `GET /api/users/search?q=test` with a valid JWT — should return JSON array.
- [x] Commit: `feat(users): add GET /users/search endpoint`

---

## Task 5: Frontend — searchUsers API function

**Files:**

- Modify: `packages/frontend/src/features/friendship/friendshipApi.ts`

- [x] Add `UserSearchResultDto` interface with fields: `id`, `username`, `relationshipStatus` (`'friend' | 'pending_sent' | 'pending_received' | 'none'`), and optional `friendRequestId`.
- [x] Add `searchUsers(token, q)` async function that calls `GET /api/users/search?q=<q>` with `Authorization` header and returns `UserSearchResultDto[]` via `handleJsonResponse`.
- [x] Run: `pnpm --filter frontend test -- --testPathPattern=friendshipApi` — existing tests still pass.
- [x] Commit: `feat(friendship): add searchUsers API function and UserSearchResultDto`

---

## Task 6: Frontend — useUserSearch hook

**Files:**

- Modify: `packages/frontend/src/features/friendship/useFriendshipMutations.ts`

- [x] Add `SEARCH_KEY` constant: `['users', 'search']`.
- [x] Add `useUserSearch(query: string)` hook that wraps `useQuery` with `queryKey: [...SEARCH_KEY, query]`, calls `friendshipApi.searchUsers(accessToken!, query)`, sets `enabled` to `!!accessToken && query.trim().length >= 2`, and `staleTime: 30_000`.
- [x] The debounce (300ms) lives in the component, not the hook — the hook receives the already-debounced value.
- [x] Export the hook.
- [x] Commit: `feat(friendship): add useUserSearch hook`

---

## Task 7: Frontend — FriendRow component

**Files:**

- Create: `packages/frontend/src/features/chat/FriendRow.tsx`

- [x] Create `FriendRow` as a default export accepting props: `friend: FriendDto`, `presence?: 'online' | 'afk' | 'offline'`, `onDm: () => void`, `disabled?: boolean`.
- [x] Render a MUI `ListItem` with `component="button"` that calls `onDm` on click.
- [x] Avatar: 34×34 `Avatar` using `getAvatarColor(friend.username)` for background; first letter of username as content.
- [x] Presence dot: small circle overlaid on the avatar bottom-right (9px, `border: 2px solid` matching card background). Colors: `online` → `#22c55e`, `afk` → `#eab308`, `offline`/undefined → `#4b5563`.
- [x] Below the username, render the status label in the matching colour (e.g. "Online", "AFK", "Offline"). Default to "Offline" when `presence` is undefined.
- [x] On the right: a green `Button` (`background: #16a34a`) labelled **DM** that calls `onDm` and stops propagation so clicking the button doesn't double-fire.
- [x] Commit: `feat(chat): add FriendRow component`

---

## Task 8: Frontend — StrangerRow component

**Files:**

- Create: `packages/frontend/src/features/chat/StrangerRow.tsx`

- [x] Create `StrangerRow` as a default export accepting props: `user: UserSearchResultDto`, `isPending: boolean`, `onAdd: () => void`, `onAccept: () => void`.
- [x] Render a MUI `ListItem` (not clickable as a whole).
- [x] Avatar: 34×34, colour via `getAvatarColor(user.username)`, first letter — no presence dot.
- [x] Username only (no status label).
- [x] Button on the right determined by state:
  - `isPending` or `user.relationshipStatus === 'pending_sent'` → disabled grey button labelled **Pending…**
  - `user.relationshipStatus === 'pending_received'` → indigo button labelled **Accept**, calls `onAccept` on click
  - `user.relationshipStatus === 'none'` → indigo button labelled **+ Add**, calls `onAdd` on click
- [x] Commit: `feat(chat): add StrangerRow component`

---

## Task 9: Frontend — Rewrite NewDmDialog

**Files:**

- Modify: `packages/frontend/src/features/chat/NewDmDialog.tsx`

- [x] Replace the existing `NewDmDialog` implementation keeping the same props interface (`open`, `onClose`).
- [x] Add state: `search` (raw input value), `debouncedSearch` (updated 300ms after `search` changes via `useEffect` + `setTimeout`/`clearTimeout`), `pendingIds` (`Set<string>`).
- [x] Data: always call `useFriends()`. Call `useUserSearch(debouncedSearch)` — it self-disables when query < 2 chars.
- [x] Set `Dialog` max-width to 360px: `maxWidth={false}` and `PaperProps={{ sx: { width: '100%', maxWidth: 360 } }}`.
- [x] **Empty state** (`debouncedSearch.length < 2`): render a "Friends" section header followed by one `FriendRow` per friend from `useFriends()`. If no friends, show the existing "no friends" empty state message.
- [x] **Search active** (`debouncedSearch.length >= 2`): split `useUserSearch` results into `friends` (status `=== 'friend'`) and `strangers` (all others). Render "Friends" section with `FriendRow` items (if any), then "Other People" section with `StrangerRow` items (if any). If both sections empty, show "No users found for "…"".
- [x] **Loading state** (search query active but results not yet arrived): show a centered `CircularProgress`.
- [x] **Search error state** (`useUserSearch` returns an error): show a small `Alert` with severity `error` below the search field; the friends list (from `useFriends`) remains visible above it.
- [x] **onDm handler**: call `startThread.mutateAsync(friend.friendId)` → `setActiveDm(newThread.id)` → `handleClose()`. Reuse existing `useStartThread` hook.
- [x] **onAdd handler**: optimistically add the user's `id` to `pendingIds`, then call `useSendFriendRequest` mutation. On error, remove from `pendingIds`.
- [x] **onAccept handler**: call `useAcceptRequest` mutation with `user.friendRequestId`, then invalidate `['friends', 'list']` and `['users', 'search', debouncedSearch]`.
- [x] Clear `pendingIds` and `debouncedSearch` in `handleClose` (same as existing `search` clear).
- [x] Run: `pnpm --filter frontend dev`, open the app, open New DM modal — verify all four states work end-to-end.
- [x] Commit: `feat(chat): rewrite NewDmDialog with unified user search and friend requests`
