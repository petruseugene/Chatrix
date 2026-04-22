# Emoji Feature Design

**Date:** 2026-04-22
**Scope:** Emoji reactions on messages + emoji picker in compose box, for both Room and DM chat.

---

## Overview

Two distinct sub-features implemented together:

1. **Emoji Reactions** — users react to any message with one of 6 fixed emojis. Reactions appear as counted chips below the message, left-aligned. Toggling the same emoji removes the reaction.
2. **Emoji Picker (compose)** — a smiley button in the compose box opens a flat grid of 20 common emojis. Clicking one inserts it at the cursor position in the message text.

No external emoji library. All emoji sets are hardcoded constants in `packages/shared`.

---

## Emoji Sets

Defined in `packages/shared/src/emoji.ts` (new file):

```typescript
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const INPUT_EMOJIS = [
  '😀',
  '😂',
  '😍',
  '😎',
  '🥳',
  '🤔',
  '😅',
  '😭',
  '🤣',
  '😊',
  '👍',
  '❤️',
  '🔥',
  '💯',
  '🎉',
  '🙏',
  '👀',
  '💪',
  '🥲',
  '😬',
];
```

---

## Data Model

New `Reaction` table in Prisma, shared across Room and DM messages via nullable foreign keys (exactly one must be set):

```prisma
model Reaction {
  id              String         @id @default(cuid())
  emoji           String
  userId          String
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  roomMessageId   String?
  roomMessage     RoomMessage?   @relation(fields: [roomMessageId], references: [id], onDelete: Cascade)
  directMessageId String?
  directMessage   DirectMessage? @relation(fields: [directMessageId], references: [id], onDelete: Cascade)
  createdAt       DateTime       @default(now())

  @@unique([userId, emoji, roomMessageId])
  @@unique([userId, emoji, directMessageId])
}
```

**Toggle logic:** on react, check if `(userId, emoji, messageId)` exists — delete if so, create if not.

**Constraints:**

- `emoji` must be one of `REACTION_EMOJIS` (enforced in DTO with `@IsIn`)
- One user may react with multiple _different_ emojis to the same message
- A user cannot react with the same emoji twice (unique constraint)
- Exactly one of `roomMessageId` / `directMessageId` must be non-null — enforced via a Prisma `@@check` or a raw SQL CHECK constraint in the migration

---

## Shared Types

Added to `packages/shared/src/rooms.ts` and `packages/shared/src/dm.ts`:

```typescript
export interface ReactionSummary {
  emoji: string;
  count: number;
  userIds: string[]; // lets the client know if the current user has reacted
}
```

`reactions: ReactionSummary[]` added to both `RoomMessagePayload` and `DmMessagePayload`. Initial message load always includes reactions — no separate request needed.

---

## Socket Events

Added to `packages/shared/src/events.ts`:

```typescript
// Client → Server
ROOM_MESSAGE_REACT = 'room:message:react';
DM_MESSAGE_REACT = 'dm:message:react';

// Server → Client
ROOM_MESSAGE_REACTION_UPDATED = 'room:message:reaction:updated';
DM_MESSAGE_REACTION_UPDATED = 'dm:message:reaction:updated';
```

**Client → Server payloads:**

- Room: `{ roomId: string, messageId: string, emoji: string }`
- DM: `{ threadId: string, messageId: string, emoji: string }`

**Server → Client payload (both):**

- `{ messageId: string, reactions: ReactionSummary[] }`

Server broadcasts the reaction-updated event to all members of the room/thread after every toggle.

---

## Backend

No new module. Reactions live inside the existing `rooms` and `dm` modules.

### New files

- `packages/backend/src/rooms/dto/react-message.dto.ts`
- `packages/backend/src/dm/dto/react-message.dto.ts`

Both DTOs use `@IsIn(REACTION_EMOJIS)` from shared to reject arbitrary emojis.

### Modified files

| File               | Change                                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rooms.gateway.ts` | New `@SubscribeMessage(ROOM_MESSAGE_REACT)` handler: verify caller is current non-banned member → toggle reaction → broadcast `ROOM_MESSAGE_REACTION_UPDATED` to `room:${roomId}` |
| `dm.gateway.ts`    | Same pattern for DM thread                                                                                                                                                        |
| `rooms.service.ts` | `toggleRoomReaction(userId, dto): Promise<ReactionSummary[]>` + include reactions in `getRoomMessages` response                                                                   |
| `dm.service.ts`    | `toggleDmReaction(userId, dto): Promise<ReactionSummary[]>` + include reactions in `getDmMessages` response                                                                       |

**Authorization:** reaction handler performs the same membership check as message send — caller must be a current, non-banned member of the room/thread.

---

## Frontend

### New component

`packages/frontend/src/components/EmojiPicker.tsx`

Reusable. Renders the 20-emoji grid inside a MUI `Popover`. Props:

- `open: boolean`
- `anchorEl: HTMLElement | null`
- `onSelect: (emoji: string) => void`
- `onClose: () => void`

Popover is anchored `bottom: top, right: right` of the trigger button (opens upward, right-aligned).

### Modified: compose inputs

Both `RoomMessageInput.tsx` and `DmMessageInput.tsx`:

- Add 😊 `IconButton` to the right of the attach button
- Wire it to toggle `EmojiPicker` popover
- `onSelect`: insert emoji at the saved cursor position in the MUI `TextField` (tracked via `inputRef.current.selectionStart` before the popover opens), then close picker

### Modified: message items

Both `RoomMessageItem.tsx` and `DmMessageItem.tsx`:

- Accept `reactions: ReactionSummary[]` in props
- Render reaction chips below message content, left-aligned, as MUI `Chip` components
- Chip is highlighted (outlined + primary colour) if `reaction.userIds.includes(currentUserId)`
- Clicking a chip emits the react socket event (toggle)
- `😊 +` button rendered inline after chips, visible only on row hover (`opacity: 0` → `1` via CSS)
- Clicking `😊 +` shows a small inline `Box` with the 6 `REACTION_EMOJIS`; clicking one emits the react socket event and closes the bar

### Modified: socket hooks

`useRoomSocket` and `useDmSocket` (or equivalent):

- Listen for `ROOM_MESSAGE_REACTION_UPDATED` / `DM_MESSAGE_REACTION_UPDATED`
- On receipt: patch the matching message in the TanStack Query cache, updating its `reactions` array

---

## UX Behaviour Summary

| Interaction                    | Result                                           |
| ------------------------------ | ------------------------------------------------ |
| Click 😊 button in compose     | Opens 20-emoji grid above-right of button        |
| Click emoji in grid            | Inserts at cursor, closes picker                 |
| Click outside picker           | Closes picker                                    |
| Hover a message                | `😊 +` button appears inline with reaction chips |
| Click `😊 +`                   | 6-emoji quick-react bar appears below chips      |
| Click emoji in quick-react bar | Toggles reaction; bar closes                     |
| Click existing reaction chip   | Toggles own reaction on that emoji               |
| Reaction chip highlighted      | Current user has reacted with that emoji         |

---

## Out of Scope

- Emoji search or categories in the input picker
- Custom reaction sets per room
- Reaction notifications
- Animated emoji / custom emoji uploads
