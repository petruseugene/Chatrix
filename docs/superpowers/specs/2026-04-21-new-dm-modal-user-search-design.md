# New DM Modal — User Search & Friend Request Design

**Date:** 2026-04-21
**Status:** Approved

## Problem

The New DM modal only shows existing friends. Users have no way to discover or add new people from within the DM flow. The Friendship table is empty because there's no discoverable path to build connections.

## Goal

Rework the modal so users can search all users, send friend requests inline, and open DMs with existing friends — all from one place.

---

## Design Decisions

| Decision         | Choice                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| Layout           | Unified search (Approach B)                                            |
| Empty state      | Friends list shown by default                                          |
| Results layout   | Two sections: Friends / Other People                                   |
| Modal max-width  | 360px                                                                  |
| Friend row       | Green **DM** button + full row clickable                               |
| Stranger row     | Indigo **+ Add** button                                                |
| Post-send state  | Button → disabled grey **Pending…**, modal stays open                  |
| Presence display | Status dot on avatar + label (Online / AFK / Offline) for friends only |

---

## Behaviour by State

### Empty query (default)

- Shows full friends list from `GET /api/friends`
- Each friend row: avatar with status dot, username, status label, green **DM** button
- Clicking row or **DM** button → open/create DM thread → close modal

### Active query (≥2 characters, debounced 300ms)

- Calls `GET /api/users/search?q=:query` (new endpoint)
- Results split into two sections:

**Friends** (relationship = `friend`)

- Same row style as empty state: avatar + status + green **DM** button

**Other People** (relationship = `none | pending_sent | pending_received`)

- `none` → indigo **+ Add** button; clicking sends friend request, button flips to **Pending…**
- `pending_sent` → disabled grey **Pending…** on load (already sent before)
- `pending_received` → indigo **Accept** button; clicking accepts the request, row moves to Friends section on next query

### No results

- Single message: `No users found for "{query}"`

---

## Backend Changes

### 1. `GET /api/users/search?q=:query` — new endpoint on `UsersController`

**Auth:** JWT required

**Query params:**

- `q` — search term, 2–32 chars (validated, trimmed)

**Logic:**

1. Find users where `username ILIKE '%q%'` (case-insensitive partial match)
2. Exclude caller's own account
3. Exclude users where an active `Block` exists in either direction
4. Limit to 20 results, ordered by username ASC
5. For each result, derive `relationshipStatus`:
   - Query `Friendship` table → `friend`
   - Query `FriendRequest` table:
     - `fromUserId = caller` → `pending_sent`
     - `toUserId = caller` → `pending_received`
   - Otherwise → `none`

**Response shape:**

```ts
interface UserSearchResultDto {
  id: string;
  username: string;
  relationshipStatus: 'friend' | 'pending_sent' | 'pending_received' | 'none';
  friendRequestId?: string; // present only when relationshipStatus === 'pending_received'
}
```

**Rate limit:** 30 requests / minute per user (abuse-prone: text search on every keystroke)

### 2. No changes to friendship endpoints

`POST /api/friends/request` and `POST /api/friends/accept/:id` already exist and are used as-is.

---

## Frontend Changes

### New API function — `packages/frontend/src/features/friendship/friendshipApi.ts`

```ts
export interface UserSearchResultDto {
  id: string;
  username: string;
  relationshipStatus: 'friend' | 'pending_sent' | 'pending_received' | 'none';
  friendRequestId?: string; // present only when relationshipStatus === 'pending_received'
}

export async function searchUsers(token: string, q: string): Promise<UserSearchResultDto[]>;
```

### New hook — `useUserSearch(query: string)`

Location: `packages/frontend/src/features/friendship/useFriendshipMutations.ts`

- Wraps `useQuery` with `queryKey: ['users', 'search', query]`
- `enabled` only when `query.trim().length >= 2`
- 300ms debounce on the input before updating the query key
- Stale time: 30s (search results can be cached briefly)

### Updated `NewDmDialog.tsx`

**State:**

```ts
const [search, setSearch] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');
const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
```

**Data sources:**

- `useFriends()` — always fetched, used for empty state and for presence enrichment
- `useUserSearch(debouncedSearch)` — fires only when `debouncedSearch.length >= 2`

**Sections when searching:**

```
friends   = searchResults.filter(r => r.relationshipStatus === 'friend')
strangers = searchResults.filter(r => r.relationshipStatus !== 'friend')
```

Friends from search results are rendered identically to empty-state friend rows (with status if available).

**Add button click:**

1. Call `sendFriendRequest(token, username)` mutation
2. Optimistically add `userId` to local `pendingIds` set immediately (no wait for server)
3. On error: remove from `pendingIds`, show inline error on that row

**Accept button click:**

1. Call `acceptFriendRequest(token, requestId)` mutation
2. Invalidate `['friends']` and `['users', 'search', debouncedSearch]` queries
3. Row naturally moves to Friends section on re-fetch

**Dialog props:**

```tsx
<Dialog maxWidth={false} PaperProps={{ sx: { width: '100%', maxWidth: 360 } }}>
```

### Presence status

The presence module is not yet implemented. The `PresenceStatus` type and display are designed as a slot:

```ts
type PresenceStatus = 'online' | 'afk' | 'offline';
```

- If a `presenceStore` exists (future): read status from it by `userId`
- Until then: default all friends to `'offline'` — the dot and label render but show grey/Offline

The `FriendRow` component accepts an optional `presence?: PresenceStatus` prop. This decouples the presence integration from the modal itself.

---

## Component Breakdown

### `FriendRow` (new, extracted)

Props: `friend: FriendDto, presence?: PresenceStatus, onDm: () => void`

- Avatar with status dot overlay
- Username + status label
- Green **DM** button (`onClick` stops propagation, calls `onDm`)
- Entire row also calls `onDm` on click

### `StrangerRow` (new, extracted)

Props: `user: UserSearchResultDto, isPending: boolean, onAdd: () => void, onAccept?: () => void`

- Avatar (no status dot)
- Username
- Button: **+ Add** / **Pending…** / **Accept** depending on `relationshipStatus` + `isPending`

### Updated `NewDmDialog`

Orchestrates both rows, debounce logic, section headers, and all empty/loading/error states.

---

## Error Handling

| Scenario             | Behaviour                                                                      |
| -------------------- | ------------------------------------------------------------------------------ |
| Search API fails     | Show subtle inline error below search field, friends list still visible        |
| Friend request fails | Row reverts button from Pending… to + Add, shows error toast or inline message |
| Accept fails         | Toast error, no state change                                                   |
| Rate limited (429)   | Friendly message: "Too many searches, slow down a moment"                      |

---

## Not In Scope

- Blocking users from this modal
- Pagination of search results (20 results is sufficient for username search)
- Real-time presence (deferred to presence module)
- Removing friends from this modal

---

## Mockups

Saved in `.superpowers/brainstorm/` — session `23358-1776759934`.
