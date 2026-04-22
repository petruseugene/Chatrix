# Room Modal Styles — Design Spec

**Date:** 2026-04-22
**Status:** Approved

## Goal

Unify the visual style of the four Room dialog modals to match the existing `NewDmDialog` dark-glass aesthetic. All modals must be closable via an X button in the top-right corner.

## Reference Style (NewDmDialog)

```
bgcolor: '#1e2030'
backgroundImage: 'none'
borderRadius: '14px'
border: '1px solid rgba(255,255,255,0.07)'
boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
maxWidth: 440px (fixed, not responsive)

Header:
  title — fontSize 1rem, fontWeight 700, color #fff, letterSpacing -0.01em
  X button — color rgba(255,255,255,0.4), hover color rgba(255,255,255,0.8) / bgcolor rgba(255,255,255,0.06)

Fields:
  bgcolor rgba(255,255,255,0.05), border rgba(255,255,255,0.1), borderRadius 8px
  focus border: #6366f1

Accent colour: #6366f1 (indigo)
```

## New Component

**File:** `packages/frontend/src/components/StyledDialog.tsx`

### Props

| Prop       | Type         | Default | Description                                  |
| ---------- | ------------ | ------- | -------------------------------------------- |
| `open`     | `boolean`    | —       | Controls dialog visibility                   |
| `onClose`  | `() => void` | —       | Called when X is clicked or backdrop clicked |
| `title`    | `string`     | —       | Displayed in the header                      |
| `children` | `ReactNode`  | —       | DialogContent, DialogActions, Tabs, etc.     |
| `maxWidth` | `number`     | `440`   | Max width in px                              |

### Behaviour

- Renders `<Dialog>` with `maxWidth={false}` and dark `PaperProps.sx`
- Renders a styled `<DialogTitle>` containing the title text and a `CloseIcon` `<IconButton>` on the right
- Clicking X calls `onClose`; clicking outside the dialog also calls `onClose` (MUI default)
- Children are rendered verbatim — consumers own `DialogContent`, `DialogActions`, `Tabs`, etc.

## Dialogs Updated

### 1. CreateRoomDialog

- Swap `<Dialog>` → `<StyledDialog title="Create Room">`
- Dark-style the two `TextField` inputs (bg, border, focus colour, text colour)
- Dark-style the `Switch` label text
- Style action buttons: outlined ghost "Cancel", indigo filled "Create"
- X button closes; Cancel button also closes (both call `handleClose`)

### 2. InviteUserDialog

- Swap `<Dialog>` → `<StyledDialog title="Invite User">`
- Dark-style the username `TextField`
- Dark-style `Alert` success and error states (match NewDmDialog alert style)
- Style action buttons: outlined ghost "Close", indigo filled "Invite"
- X button closes; "Close" footer button also closes

### 3. RoomDiscoverDialog

- Swap `<Dialog>` → `<StyledDialog title="Discover Rooms">`
- Dark-style the search `TextField`
- Dark-style `ListItem` rows: divider becomes `rgba(255,255,255,0.07)`, primary text `#fff`, secondary text `rgba(255,255,255,0.5)`
- "Join" button: outlined indigo; "Joined" state: disabled muted
- No footer actions; X is the only close affordance

### 4. RoomSettingsDialog

- Swap `<Dialog>` → `<StyledDialog title={\`Room Settings — ${room.name}\`}>`
- Dark-style `Tabs` bar: bg `rgba(255,255,255,0.03)`, selected tab indigo underline
- Dark-style all `TextField` inputs in the Info tab
- Dark-style `ListItem` rows in Members and Bans tabs
- `Chip` for Public/Private: dark background, white text
- Footer `DialogActions` keeps the existing "Close" button (outlined ghost style)
- X button in header also closes (calls `onClose`)

## What Is Not Changed

- `NewDmDialog` — already styled, no changes
- `SettingsDialog` (chat settings) — out of scope
- Auth dialogs — out of scope
- Button variants outside the four dialogs — not touched
- Any backend / shared types — no changes needed

## Files Touched

```
packages/frontend/src/components/StyledDialog.tsx          ← new
packages/frontend/src/features/rooms/CreateRoomDialog.tsx  ← update
packages/frontend/src/features/rooms/InviteUserDialog.tsx  ← update
packages/frontend/src/features/rooms/RoomDiscoverDialog.tsx ← update
packages/frontend/src/features/rooms/RoomSettingsDialog.tsx ← update
```
