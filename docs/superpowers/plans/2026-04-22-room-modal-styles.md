# Room Modal Styles Implementation Plan

> **Status: DONE**

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the four Room dialog modals to match `NewDmDialog`'s dark-glass style and add an X close button to each.

**Architecture:** Create a shared `StyledDialog` wrapper that owns the dark Paper styles and the header (title + X button). Each room dialog swaps its plain `<Dialog>` for `<StyledDialog>` and re-styles its inner form elements to match the dark theme.

**Tech Stack:** React 18, MUI v5, TypeScript strict

---

## File Map

| Action | File                                                          |
| ------ | ------------------------------------------------------------- |
| Create | `packages/frontend/src/components/StyledDialog.tsx`           |
| Modify | `packages/frontend/src/features/rooms/CreateRoomDialog.tsx`   |
| Modify | `packages/frontend/src/features/rooms/InviteUserDialog.tsx`   |
| Modify | `packages/frontend/src/features/rooms/RoomDiscoverDialog.tsx` |
| Modify | `packages/frontend/src/features/rooms/RoomSettingsDialog.tsx` |

---

## Style Reference

All values come from `NewDmDialog.tsx`. Use it as the source of truth throughout.

```
Paper:   bgcolor #1e2030, borderRadius 14px, border rgba(255,255,255,0.07), shadow 0 24px 64px rgba(0,0,0,0.6)
Width:   maxWidth={false}, sx maxWidth 440px
Title:   fontSize 1rem, fontWeight 700, color #fff, letterSpacing -0.01em
X btn:   color rgba(255,255,255,0.4), hover color rgba(255,255,255,0.8) / bgcolor rgba(255,255,255,0.06)
Fields:  bgcolor rgba(255,255,255,0.05), border rgba(255,255,255,0.1), radius 8px, focus #6366f1
Accent:  #6366f1
```

---

## Task 1: Create StyledDialog component — DONE

**Files:**

- Create: `packages/frontend/src/components/StyledDialog.tsx`

- [x] Create `StyledDialog.tsx` with props: `open`, `onClose`, `title`, `children`, `maxWidth?: number` (default 440)
- [x] Render `<Dialog maxWidth={false} PaperProps={{ sx: { ...dark paper styles... } }}>` — copy PaperProps sx directly from `NewDmDialog`
- [x] Render `<DialogTitle>` with flex row: title `<Typography>` on left, `<IconButton onClick={onClose}>` with `<CloseIcon>` on right — copy styles directly from `NewDmDialog` header
- [x] Render `{children}` below the title
- [x] Import: `Dialog`, `DialogTitle`, `Typography`, `IconButton` from `@mui/material`; `CloseIcon` from `@mui/icons-material/Close`

- [x] Commit: `feat(ui): add StyledDialog wrapper component`

---

## Task 2: Update CreateRoomDialog — DONE

**Files:**

- Modify: `packages/frontend/src/features/rooms/CreateRoomDialog.tsx`

- [x] Replace `<Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>` with `<StyledDialog open={open} onClose={handleClose} title="Create Room">`
- [x] Remove `<DialogTitle>Create Room</DialogTitle>` (now owned by StyledDialog)
- [x] The existing `<form>` wraps `<DialogContent>` and `<DialogActions>` as children — no change needed to form structure
- [x] Add dark-theme `sx` to both `TextField` inputs — copy the `sx` from the search field in `NewDmDialog` (bg, border, focus, text colour, placeholder colour)
- [x] Add `sx={{ color: 'rgba(255,255,255,0.7)' }}` to the `FormControlLabel` label
- [x] Style the Cancel `<Button>`: `variant="outlined"` with `sx` for ghost dark style (`border rgba(255,255,255,0.15)`, `color rgba(255,255,255,0.6)`, `borderRadius 8px`)
- [x] Style the Create `<Button>`: keep `variant="contained"`, add `sx={{ bgcolor: '#6366f1', borderRadius: '8px', '&:hover': { bgcolor: '#4f46e5' } }}`
- [x] Style the error `<Alert>` to match NewDmDialog alert style

- [x] Commit: `feat(ui): restyle CreateRoomDialog to dark theme`

---

## Task 3: Update InviteUserDialog — DONE

**Files:**

- Modify: `packages/frontend/src/features/rooms/InviteUserDialog.tsx`

- [x] Replace `<Dialog ... maxWidth="xs" fullWidth>` with `<StyledDialog open={open} onClose={handleClose} title="Invite User">`
- [x] Remove `<DialogTitle>Invite User</DialogTitle>`
- [x] The existing `<form>` wraps `<DialogContent>` and `<DialogActions>` as children
- [x] Add dark-theme `sx` to the username `TextField` (same pattern as Task 2)
- [x] Style both `<Alert>` (success + error) to dark style — success: `bgcolor rgba(34,197,94,0.12)`, `color #86efac`; error: copy from NewDmDialog
- [x] Style the Close `<Button>`: ghost dark (same as Cancel in Task 2)
- [x] Style the Invite `<Button>`: indigo filled (same as Create in Task 2)

- [x] Commit: `feat(ui): restyle InviteUserDialog to dark theme`

---

## Task 4: Update RoomDiscoverDialog — DONE

**Files:**

- Modify: `packages/frontend/src/features/rooms/RoomDiscoverDialog.tsx`

- [x] Replace `<Dialog ... maxWidth="sm" fullWidth>` with `<StyledDialog open={open} onClose={handleClose} title="Discover Rooms">`
- [x] Remove `<DialogTitle>Discover Rooms</DialogTitle>`
- [x] Add dark-theme `sx` to the search `TextField` (same pattern as Task 2; note it uses `InputProps` not `inputProps`)
- [x] Style the loading `<CircularProgress>`: `sx={{ color: '#6366f1' }}`
- [x] Style the "No rooms found" `<Typography>`: `sx={{ color: 'rgba(255,255,255,0.35)' }}`
- [x] Style each `<ListItem>`: add `sx={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}` (replace `divider` prop)
- [x] Style `<ListItemText>` primary text `#fff`, secondary `rgba(255,255,255,0.5)`
- [x] Style Join `<Button>`: `variant="outlined"` indigo (`borderColor '#6366f1'`, `color '#6366f1'`); disabled/joined state: muted (`color rgba(255,255,255,0.3)`, `borderColor rgba(255,255,255,0.1)`)
- [x] No footer actions needed — X is the only close

- [x] Commit: `feat(ui): restyle RoomDiscoverDialog to dark theme`

---

## Task 5: Update RoomSettingsDialog — DONE

**Files:**

- Modify: `packages/frontend/src/features/rooms/RoomSettingsDialog.tsx`

- [x] Replace `<Dialog ... maxWidth="sm" fullWidth>` with `<StyledDialog open={open} onClose={handleClose} title={\`Room Settings — ${room.name}\`}>`
- [x] Remove `<DialogTitle>Room Settings — {room.name}</DialogTitle>`
- [x] Style the `<Tabs>` bar: `sx={{ px: 2.5, borderBottom: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.02)' }}`; selected tab indicator colour `#6366f1`; tab text colour `rgba(255,255,255,0.6)` / selected `#fff`
- [x] In the Info tab — dark-style both `TextField` inputs (same as Task 2)
- [x] Add `sx={{ color: 'rgba(255,255,255,0.7)' }}` to the Private `FormControlLabel`
- [x] Style the `<Chip>` (Public/Private): `sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#fff' }}`
- [x] Style `<Typography>` in the read-only Info view: primary `#fff`, secondary `rgba(255,255,255,0.5)`
- [x] In the Members/Bans tabs — style `<ListItem>` dividers, primary/secondary text (same approach as Task 4)
- [x] Style action buttons (Save, Delete room, Promote/Demote, Kick, Ban, Unban) — match filled/ghost/error patterns used in earlier tasks
- [x] Style error `<Alert>` to dark style (same as Task 2)
- [x] Keep the existing `<DialogActions>` with the "Close" `<Button>` — style it as ghost dark (same as Cancel in Task 2)

- [x] Commit: `feat(ui): restyle RoomSettingsDialog to dark theme`
