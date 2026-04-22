# Attachments — Design Spec

**Date:** 2026-04-22
**Status:** Approved

---

## Goal

Allow users to attach one image or file per message in both room chats and DM threads. Files upload directly to MinIO via presigned URLs; downloads are always proxied through the backend with membership/friendship re-checked on every request.

---

## Scope decisions

| Decision               | Choice                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Contexts               | Both rooms and DM threads                                                                      |
| Files per message      | One attachment per message                                                                     |
| Allowed types          | Images (`jpeg`, `png`, `gif`, `webp`) + documents (`pdf`, `zip`, `txt`, common office formats) |
| Image display in chat  | Inline, full-width (max 320px), click to open lightbox                                         |
| File display in chat   | Compact card: file icon + filename + download button                                           |
| Input UX during upload | Preview strip above input: thumbnail/icon + progress bar + ✕ cancel                            |
| Upload architecture    | Two-phase presigned upload (client → MinIO direct, backend never touches bytes)                |

---

## Architecture

### Upload flow

1. User picks a file (file picker button or clipboard paste into textarea)
2. Preview strip appears above input with thumbnail/icon, filename, progress bar
3. Frontend: `POST /api/attachments/upload-url` → `{ attachmentId, presignedUrl }`
4. Frontend: PUT file directly to MinIO via XHR (progress events → 0–100)
5. Frontend: `POST /api/attachments/:id/commit` → backend validates, processes, returns `AttachmentPayload`
6. Send button enabled; user optionally types a comment and clicks send
7. Message emitted via socket with `{ content, attachmentId }`

### Download flow

1. `AttachmentPreview` mounts → calls `GET /api/attachments/:id/download`
2. Backend re-checks current access → returns short-lived presigned GET URL (1 min TTL)
3. Frontend renders image or triggers file download via `window.open`

---

## Data model

### New `Attachment` model

```prisma
model Attachment {
  id               String    @id @default(cuid())
  uploaderId       String
  uploader         User      @relation(fields: [uploaderId], references: [id])
  targetType       AttachmentTarget          // ROOM | DM
  roomId           String?
  room             Room?     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  dmThreadId       String?
  dmThread         DirectMessageThread? @relation(fields: [dmThreadId], references: [id], onDelete: Cascade)
  objectKey        String    @unique
  thumbnailKey     String?
  originalFilename String
  mimeType         String
  size             Int
  committedAt      DateTime?             // null = pending upload
  messageId        String?   @unique     // set after message sent; prevents reuse
  createdAt        DateTime  @default(now())
}

enum AttachmentTarget {
  ROOM
  DM
}
```

### Modified models

- `RoomMessage` — adds `attachmentId String? @unique` FK to `Attachment`
- `DirectMessage` — adds `attachmentId String? @unique` FK to `Attachment`

### Cascade behaviour

- Room deleted → `Attachment` rows deleted (MinIO objects cleaned up by `deleteAttachmentsByRoom`)
- DM thread deleted → same via `deleteAttachmentsByThread`
- User banned or leaves room → attachment rows survive; access denied at download time

---

## Backend: `AttachmentsModule`

### HTTP endpoints

| Route                           | Method | Rate limit | Description                                                                |
| ------------------------------- | ------ | ---------- | -------------------------------------------------------------------------- |
| `/api/attachments/upload-url`   | POST   | 20/min     | Validate, create pending row, return presigned PUT (5 min TTL)             |
| `/api/attachments/:id/commit`   | POST   | 20/min     | Magic-bytes check, EXIF strip + thumbnail, mark committed                  |
| `/api/attachments/:id/download` | GET    | 100/min    | Re-check access, return presigned GET (1 min TTL) + optional thumbnail URL |

All routes protected by `JwtAuthGuard`. DTOs use `class-validator` with `whitelist + forbidNonWhitelisted`.

### `AttachmentsService` methods

**`requestUploadUrl(userId, dto)`**

- Validate `mimeType` against allowlist; validate `size` (images ≤ 3MB, others ≤ 20MB)
- Guard: for `ROOM` → caller is current non-banned member; for `DM` → active mutual friendship, no block
- Create pending `Attachment` row (`committedAt = null`)
- Return `{ attachmentId, presignedUrl }` (PUT URL, 5 min TTL)

**`commitUpload(userId, attachmentId)`**

- Assert `uploaderId === userId`; assert not already committed
- `HeadObject` — confirm object exists in MinIO (`BadRequestException('Upload not found')` if missing)
- Download first 4100 bytes; run `file-type` magic-bytes check — mismatch → delete MinIO object + DB row + `BadRequestException('MIME type mismatch')`
- For images: stream full object through `sharp` — strip EXIF, auto-rotate, re-upload to same `objectKey`; generate 400px thumbnail, upload to `thumbnailKey = uploads/{roomId|dmId}/{uuid}/thumb_{filename}`; update `thumbnailKey` on row
- Set `committedAt = now()`; return `AttachmentPayload`

**`getDownloadUrl(userId, attachmentId)`**

- Load attachment; re-check current access (same guard as `requestUploadUrl`)
- Return `{ url, thumbnailUrl? }` — presigned GET URLs, 1 min TTL

**`deleteAttachmentsByRoom(roomId)` / `deleteAttachmentsByThread(dmThreadId)`**

- Delete all MinIO objects for the target; delete all `Attachment` rows
- Called from `RoomsService.deleteRoom` and `DmService.deleteThread` respectively before the room/thread row is removed

### Dependencies

`AttachmentsService` depends on `PrismaService` and `ConfigService` only. S3 client is an inline factory using existing `MINIO_*` env vars. No separate `MinioService`.

---

## Shared types (`packages/shared`)

```ts
interface AttachmentPayload {
  id: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  thumbnailAvailable: boolean;
}
```

- `RoomMessagePayload` gains `attachment?: AttachmentPayload | null`
- DM message payload gains `attachment?: AttachmentPayload | null`

No raw URLs in the payload — URLs fetched on demand via the download endpoint.

---

## Frontend

### New files

| File                                          | Purpose                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `features/attachments/attachmentsApi.ts`      | `requestUploadUrl`, `commitUpload`, `getDownloadUrl` — pure fetch functions      |
| `features/attachments/useAttachmentUpload.ts` | Hook: `upload(file)` → `AttachmentPayload`; exposes `progress`, `error`, `reset` |
| `features/attachments/AttachmentPreview.tsx`  | Renders inline image or file chip inside a message                               |

Shared under `features/attachments/` because both rooms and DMs import them (CLAUDE.md: cross-feature sharing via a dedicated feature folder). Only `targetType`/`targetId` arg differs between contexts.

### `RoomMessageInput` changes

- Paperclip icon button (and clipboard `paste` handler) triggers upload
- Preview strip above input: thumbnail or file icon, filename, linear progress bar, ✕ cancel
- Send disabled during upload; re-enabled once commit returns
- On send: emits `MESSAGE_SEND` with `{ roomId, content, attachmentId }` — `content` may be empty string

### `AttachmentPreview`

- **Images** (`image/*`): fetches download URL on mount, renders `<img>` (max 320px wide); click → MUI `Dialog` lightbox
- **Files**: MUI `Chip` with `InsertDriveFileIcon`, filename, download button → `getDownloadUrl` → `window.open`
- **Loading**: `Skeleton`
- **Error**: grey "File unavailable" chip — no retry

### `RoomMessageItem`

Renders `<AttachmentPreview>` below text content when `message.attachment` is set and message is not deleted.

---

## Validation changes

`SendMessageDto.content` relaxed from `MinLength(1)` to `MinLength(0)` with a cross-field validator: at least one of `content` (non-empty trimmed string) or `attachmentId` must be present.

---

## Error handling

| Scenario                                  | Handling                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| File too large (client-side)              | Inline error below preview strip before upload starts                                     |
| MinIO PUT fails mid-upload                | XHR `onerror` → error snackbar, strip dismissed; pending row orphaned (pruned after 1 hr) |
| Magic-bytes mismatch                      | Backend deletes object + row; frontend shows error snackbar                               |
| Object not found on commit                | `BadRequestException` → error snackbar                                                    |
| Download by non-member/banned user        | `ForbiddenException` → "File unavailable" chip                                            |
| Friendship broken between upload and send | Commit succeeds; send rejected by DM guard; attachment orphaned and pruned                |

### Orphan cleanup

Pending `Attachment` rows (no `committedAt`) and committed rows with no `messageId` older than 1 hour are pruned on a scheduled job (or backend startup sweep). MinIO objects are deleted alongside.

---

## Nginx

`client_max_body_size 21m;` on the `/api/attachments` location block (accommodates 20MB file + headers). The presigned PUT goes directly to MinIO, not through Nginx, so this only covers the commit/download proxy routes.

---

## Out of scope

- Multiple attachments per message
- Resumable chunked upload
- Attachment search / media gallery
- XMPP attachment federation
