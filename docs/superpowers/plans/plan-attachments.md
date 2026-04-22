# Attachments Implementation Plan

> **Status: DONE** — Implemented 2026-04-22. All 13 tasks complete, backend build clean, 8/8 unit tests passing.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Allow users to attach one image or file per message in both room chats and DM threads, with two-phase presigned upload to MinIO and auth-gated download proxy.

**Architecture:** Client requests a presigned PUT URL from the backend, uploads the file directly to MinIO, then commits the upload (triggering magic-bytes validation, EXIF stripping, and thumbnail generation). The `attachmentId` is included when sending the message. Downloads are always proxied through the backend, which re-checks current room membership or DM friendship before issuing a short-lived presigned GET URL. Attachment rows survive bans and leaves; they are only deleted when the room or DM thread is deleted.

**Tech Stack:** NestJS `AttachmentsModule`, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, `sharp`, `file-type@19`, `class-validator`, `@nestjs/throttler`. Frontend: React + MUI v5, XHR for upload progress, TanStack Query for data fetching.

**Design spec:** `docs/superpowers/specs/2026-04-22-attachments-design.md`

---

## File Map

| Action | Path                                                                          |
| ------ | ----------------------------------------------------------------------------- |
| Modify | `packages/backend/prisma/schema.prisma`                                       |
| Create | `packages/backend/prisma/migrations/20260422200000_attachments/migration.sql` |
| Modify | `packages/shared/src/rooms.ts`                                                |
| Modify | `packages/shared/src/dm.ts`                                                   |
| Modify | `packages/shared/src/index.ts`                                                |
| Create | `packages/backend/src/attachments/attachments.module.ts`                      |
| Create | `packages/backend/src/attachments/attachments.service.ts`                     |
| Create | `packages/backend/src/attachments/attachments.service.spec.ts`                |
| Create | `packages/backend/src/attachments/attachments.controller.ts`                  |
| Create | `packages/backend/src/attachments/dto/request-upload-url.dto.ts`              |
| Modify | `packages/backend/src/app.module.ts`                                          |
| Modify | `packages/backend/src/rooms/rooms.service.ts`                                 |
| Modify | `packages/backend/src/rooms/dto/send-message.dto.ts`                          |
| Modify | `packages/backend/src/rooms/rooms.gateway.ts`                                 |
| Modify | `packages/backend/src/rooms/rooms.module.ts`                                  |
| Modify | `packages/backend/src/dm/dm.service.ts`                                       |
| Modify | `packages/backend/src/dm/dm.gateway.ts`                                       |
| Modify | `packages/backend/src/dm/dm.module.ts`                                        |
| Create | `packages/frontend/src/features/attachments/attachmentsApi.ts`                |
| Create | `packages/frontend/src/features/attachments/useAttachmentUpload.ts`           |
| Create | `packages/frontend/src/features/attachments/AttachmentPreview.tsx`            |
| Modify | `packages/frontend/src/features/rooms/RoomMessageInput.tsx`                   |
| Modify | `packages/frontend/src/features/rooms/RoomMessageItem.tsx`                    |
| Modify | `packages/frontend/src/features/dm/DmMessageInput.tsx`                        |
| Modify | `packages/frontend/src/features/dm/DmMessageItem.tsx`                         |
| Modify | `nginx/default.conf`                                                          |

---

## Task 1: Prisma schema — Attachment model + FKs

**Files:**

- Modify: `packages/backend/prisma/schema.prisma`
- Create: `packages/backend/prisma/migrations/20260422200000_attachments/migration.sql`

- [x] **Step 1: Install dependencies**

  ```bash
  pnpm --filter backend add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner sharp
  pnpm --filter backend add -D @types/sharp
  pnpm --filter backend add file-type
  ```

- [x] **Step 2: Add `AttachmentTarget` enum and `Attachment` model to `schema.prisma`**

  Fields: `id`, `uploaderId` (→ User), `targetType` (ROOM | DM), `roomId?` (→ Room, cascade), `dmThreadId?` (→ DirectMessageThread, cascade), `objectKey` (unique), `thumbnailKey?`, `originalFilename`, `mimeType`, `size`, `committedAt?`, `messageId?` (unique), `createdAt`.

- [x] **Step 3: Add back-relations to existing models**
  - `User` → `attachments Attachment[]`
  - `Room` → `attachments Attachment[]`
  - `DirectMessageThread` → `attachments Attachment[]`
  - `RoomMessage` → `attachmentId? String @unique`, `attachment? Attachment? @relation("RoomMessageAttachment", ...)`
  - `DirectMessage` → `attachmentId? String @unique`, `attachment? Attachment? @relation("DirectMessageAttachment", ...)`
  - `Attachment` → `roomMessage RoomMessage? @relation("RoomMessageAttachment")`, `directMessage DirectMessage? @relation("DirectMessageAttachment")`

- [x] **Step 4: Create migration SQL file at `packages/backend/prisma/migrations/20260422200000_attachments/migration.sql`**

  Include: `CREATE TYPE "AttachmentTarget"`, `ALTER TABLE "RoomMessage"` + `"DirectMessage"` to add `attachmentId`, `CREATE TABLE "Attachment"`, unique indexes, and all foreign key constraints.

- [x] **Step 5: Run `prisma generate`**

  ```bash
  pnpm --filter backend prisma generate
  ```

  Expected: Prisma Client generated without errors.

- [x] **Step 6: Run migration**

  ```bash
  pnpm --filter backend prisma migrate dev --name attachments
  ```

  Expected: Migration applied, schema in sync.

- [x] **Step 7: Verify build**

  ```bash
  pnpm --filter backend build
  ```

  Expected: Exit 0.

- [x] **Step 8: Commit**

  ```bash
  git add packages/backend/prisma/
  git commit -m "feat(attachments): add Attachment model and FKs to schema"
  ```

---

## Task 2: Shared types — AttachmentPayload

**Files:**

- Modify: `packages/shared/src/rooms.ts`
- Modify: `packages/shared/src/dm.ts`
- Modify: `packages/shared/src/index.ts`

- [x] **Step 1: Add `AttachmentPayload` interface to `rooms.ts`**

  Fields: `id`, `originalFilename`, `mimeType`, `size`, `thumbnailAvailable: boolean`.
  Add `attachment?: AttachmentPayload | null` to `RoomMessagePayload`.
  Add `attachmentId?: string` to `SendRoomMessagePayload`.

- [x] **Step 2: Update `dm.ts`**

  Import `AttachmentPayload` from `./rooms`. Add `attachment?: AttachmentPayload | null` to `DmMessagePayload`.

- [x] **Step 3: Re-export `AttachmentPayload` from `index.ts`**

  Add `AttachmentPayload` to the rooms export block.

- [x] **Step 4: Verify all packages compile**

  ```bash
  pnpm --filter shared build 2>/dev/null || true
  pnpm --filter backend build
  pnpm --filter frontend build
  ```

  Expected: Exit 0 for all three.

- [x] **Step 5: Commit**

  ```bash
  git add packages/shared/
  git commit -m "feat(attachments): add AttachmentPayload shared type"
  ```

---

## Task 3: Backend AttachmentsService + module

**Files:**

- Create: `packages/backend/src/attachments/attachments.service.ts`
- Create: `packages/backend/src/attachments/attachments.module.ts`
- Create: `packages/backend/src/attachments/attachments.service.spec.ts`

- [x] **Step 1: Write failing tests first**

  Create `attachments.service.spec.ts`. Mock `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `file-type`, and `sharp`. Mock `PrismaService`, `FriendshipService`, and `ConfigService`.

  Test cases:
  - `requestUploadUrl` → throws `ForbiddenException` when user is not a room member
  - `requestUploadUrl` → throws `BadRequestException` when image exceeds 3MB
  - `requestUploadUrl` → throws `BadRequestException` for disallowed MIME type
  - `requestUploadUrl` → returns `{ attachmentId, presignedUrl }` for valid room upload
  - `commitUpload` → throws when attachment not found
  - `commitUpload` → throws `ForbiddenException` when caller is not uploader
  - `getDownloadUrl` → throws `ForbiddenException` when user is not room member
  - `getDownloadUrl` → returns `{ url }` for valid member

- [x] **Step 2: Run tests to confirm they fail**

  ```bash
  pnpm --filter backend test -- --testPathPattern=attachments.service
  ```

  Expected: FAIL — module not found.

- [x] **Step 3: Create `AttachmentsService`**

  Inject: `PrismaService`, `FriendshipService`, `ConfigService`. Initialize `S3Client` from env vars (`MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_USE_SSL`) with `forcePathStyle: true`.

  Allowed MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `application/zip`, `text/plain`, Word, Excel.
  Max image: 3MB. Max file: 20MB.

  Methods:
  - `requestUploadUrl(userId, dto)` — validate MIME + size, assert access, create Attachment row, return presigned PUT (5min TTL).
  - `commitUpload(userId, attachmentId)` — verify ownership, `HeadObject` check, magic-bytes MIME validation via `file-type`, EXIF strip + thumbnail via `sharp` (skip gif), update row with `committedAt` + `thumbnailKey`, return `AttachmentPayload`.
  - `getDownloadUrl(userId, attachmentId)` — assert access, return presigned GET (60s TTL) + optional `thumbnailUrl`.
  - `deleteAttachmentsByRoom(roomId)` — delete MinIO objects + DB rows.
  - `deleteAttachmentsByThread(dmThreadId)` — delete MinIO objects + DB rows.

  Private helpers: `assertRoomAccess`, `assertDmAccess`, `assertAccess`, `deleteMinioObjects`.

- [x] **Step 4: Create `AttachmentsModule` (service only — controller added in Task 4)**

  Imports: `PrismaModule`, `FriendshipModule`. Provides + exports: `AttachmentsService`.

- [x] **Step 5: Run tests**

  ```bash
  pnpm --filter backend test -- --testPathPattern=attachments.service
  ```

  Expected: All tests pass.

- [x] **Step 6: Commit**

  ```bash
  git add packages/backend/src/attachments/
  git commit -m "feat(attachments): add AttachmentsService with S3 presigned upload, commit, and download"
  ```

---

## Task 4: Backend AttachmentsController + DTOs + AppModule

**Files:**

- Create: `packages/backend/src/attachments/attachments.controller.ts`
- Create: `packages/backend/src/attachments/dto/request-upload-url.dto.ts`
- Modify: `packages/backend/src/app.module.ts`

- [x] **Step 1: Create `RequestUploadUrlDto`**

  Fields with class-validator decorators: `targetType` (`@IsEnum(['ROOM', 'DM'])`), `targetId` (`@IsString()`), `filename` (`@IsString() @MaxLength(255)`), `mimeType` (`@IsString()`), `size` (`@IsInt() @Min(1) @Max(20 * 1024 * 1024)`).

- [x] **Step 2: Create `AttachmentsController`**

  Guard: `JwtAuthGuard` on entire controller.
  Routes:
  - `POST /attachments/upload-url` — throttle 20/min — calls `requestUploadUrl`
  - `POST /attachments/:id/commit` — throttle 20/min — calls `commitUpload`
  - `GET /attachments/:id/download` — throttle 100/min — calls `getDownloadUrl`

- [x] **Step 3: Add controller to `AttachmentsModule` and register module in `AppModule`**

  Update `attachments.module.ts` to include `AttachmentsController`.
  Add `AttachmentsModule` to `app.module.ts` imports alongside `RoomsModule`.

- [x] **Step 4: Verify build**

  ```bash
  pnpm --filter backend build
  ```

  Expected: Exit 0.

- [x] **Step 5: Commit**

  ```bash
  git add packages/backend/src/attachments/ packages/backend/src/app.module.ts
  git commit -m "feat(attachments): add AttachmentsController and wire into AppModule"
  ```

---

## Task 5: Extend RoomsService — attachment in sendMessage

**Files:**

- Modify: `packages/backend/src/rooms/rooms.service.ts`
- Modify: `packages/backend/src/rooms/dto/send-message.dto.ts`
- Modify: `packages/backend/src/rooms/rooms.gateway.ts`
- Modify: `packages/backend/src/rooms/rooms.module.ts`

- [x] **Step 1: Update `SendMessageDto`**

  Add `attachmentId?: string` (`@IsOptional() @IsString()`). Apply `@ValidateIf((o) => !o.attachmentId) @MinLength(1)` to `content` so content is required only when no attachment is provided.

- [x] **Step 2: Update `buildMessagePayload` to include `attachment`**

  Extend the message parameter type to include `attachment: { id, originalFilename, mimeType, size, thumbnailKey } | null`. Map to `AttachmentPayload` shape (`thumbnailAvailable: !!thumbnailKey`).

- [x] **Step 3: Update `sendMessage` to validate and link attachment**

  Before creating the message: look up attachment by ID, assert ownership + same roomId + committed + not already linked. Use `prisma.$transaction` to create the message and update `attachment.messageId`. Include `attachment` in the Prisma `include` clause.

- [x] **Step 4: Add `attachment` include to all other queries that return `RoomMessagePayload`**

  `getMessages`, `editMessage`, `deleteMessage` — add `attachment: { select: { id, originalFilename, mimeType, size, thumbnailKey } }` to their Prisma includes.

- [x] **Step 5: Inject `AttachmentsService` and update `deleteRoom`**

  Inject `AttachmentsService` into `RoomsService`. In `deleteRoom`, call `this.attachments.deleteAttachmentsByRoom(roomId)` before deleting the room.
  Update `rooms.module.ts` to import `AttachmentsModule`.

- [x] **Step 6: Update `RoomsGateway.handleMessageSend`**

  Forward `data.attachmentId` (if present) when calling `roomsService.sendMessage`.

- [x] **Step 7: Verify build**

  ```bash
  pnpm --filter backend build
  ```

  Expected: Exit 0.

- [x] **Step 8: Commit**

  ```bash
  git add packages/backend/src/rooms/
  git commit -m "feat(attachments): extend RoomsService and gateway to support attachmentId"
  ```

---

## Task 6: Extend DmService and DmGateway

**Files:**

- Modify: `packages/backend/src/dm/dm.service.ts`
- Modify: `packages/backend/src/dm/dm.gateway.ts`
- Modify: `packages/backend/src/dm/dm.module.ts`

- [x] **Step 1: Update `DmService.sendMessage` to accept `attachmentId?`**

  Before creating the message: look up attachment, assert ownership + same `dmThreadId` + committed + not already linked. Use `prisma.$transaction` to create the message and update `attachment.messageId`. Include `attachment` in the Prisma `include`.

- [x] **Step 2: Inject `AttachmentsService` into `DmService`**

  Add `deleteAttachmentsByThread(dmThreadId)` helper that delegates to `attachments.deleteAttachmentsByThread`.

- [x] **Step 3: Update `DmGateway.handleMessageSend`**

  Forward `data.attachmentId` (if present) to `dm.sendMessage`. Map `message.attachment` to `AttachmentPayload` shape in the emitted `DmMessagePayload`.

- [x] **Step 4: Update `DmModule` to import `AttachmentsModule`**

- [x] **Step 5: Verify build**

  ```bash
  pnpm --filter backend build
  ```

  Expected: Exit 0.

- [x] **Step 6: Commit**

  ```bash
  git add packages/backend/src/dm/
  git commit -m "feat(attachments): extend DmService and DmGateway to support attachmentId"
  ```

---

## Task 7: Frontend — attachmentsApi + useAttachmentUpload

**Files:**

- Create: `packages/frontend/src/features/attachments/attachmentsApi.ts`
- Create: `packages/frontend/src/features/attachments/useAttachmentUpload.ts`
- Create (if missing): `packages/frontend/src/hooks/useAuthToken.ts`

- [x] **Step 1: Create `attachmentsApi.ts`**

  Functions:
  - `requestUploadUrl(token, params)` → `POST /api/attachments/upload-url` → `{ attachmentId, presignedUrl }`
  - `commitUpload(token, attachmentId)` → `POST /api/attachments/:id/commit` → `AttachmentPayload`
  - `getDownloadUrl(token, attachmentId)` → `GET /api/attachments/:id/download` → `{ url, thumbnailUrl? }`
  - `putToMinio(presignedUrl, file, onProgress, signal?)` → XHR PUT with upload progress callback, returns `Promise<void>`

- [x] **Step 2: Create `useAttachmentUpload.ts`**

  Options: `{ targetType: 'ROOM' | 'DM', targetId }`. Returns: `{ upload(file): Promise<AttachmentPayload>, progress, error, reset, abort }`.
  Uses `useAuthToken()`. Manages `AbortController` ref. On upload: call `requestUploadUrl` → `putToMinio` → `commitUpload`.

- [x] **Step 3: Create `useAuthToken.ts` if missing**

  Check with `ls packages/frontend/src/hooks/useAuthToken.ts`. If absent, create it: reads `accessToken` from auth store (confirm store path from existing imports — likely `stores/authStore`), throws if null.

- [x] **Step 4: Verify TypeScript compiles**

  ```bash
  pnpm --filter frontend build
  ```

  Expected: Exit 0.

- [x] **Step 5: Commit**

  ```bash
  git add packages/frontend/src/features/attachments/ packages/frontend/src/hooks/
  git commit -m "feat(attachments): add frontend attachmentsApi and useAttachmentUpload hook"
  ```

---

## Task 8: Frontend — AttachmentPreview component

**Files:**

- Create: `packages/frontend/src/features/attachments/AttachmentPreview.tsx`

- [x] **Step 1: Create `AttachmentPreview.tsx`**

  Props: `{ attachment: AttachmentPayload }`. On mount, call `getDownloadUrl` and store `url` + `thumbnailUrl`.
  - While loading: show `Skeleton` (rectangular for images, rounded for files).
  - On error: show disabled `Chip` with "File unavailable".
  - Images: show thumbnail (or full URL) capped at 320×240, click opens full-size lightbox (`Dialog` with close button).
  - Non-images: show `Chip` with filename + download `IconButton` that opens `url` in new tab.

- [x] **Step 2: Verify TypeScript compiles**

  ```bash
  pnpm --filter frontend build
  ```

  Expected: Exit 0.

- [x] **Step 3: Commit**

  ```bash
  git add packages/frontend/src/features/attachments/AttachmentPreview.tsx
  git commit -m "feat(attachments): add AttachmentPreview component with inline image and file chip"
  ```

---

## Task 9: Frontend — RoomMessageInput upload UX

**Files:**

- Modify: `packages/frontend/src/features/rooms/RoomMessageInput.tsx`

- [x] **Step 1: Add attachment support to `RoomMessageInput`**

  State: `pendingAttachment: AttachmentPayload | null`, `uploading: boolean`, `sizeError`.
  Use `useAttachmentUpload({ targetType: 'ROOM', targetId: roomId })`.

  Add:
  - Hidden `<input type="file">` + paperclip `IconButton` to trigger it
  - Paste handler to detect pasted files (`clipboardData.items`)
  - File validation: images ≤3MB, others ≤20MB (client-side pre-check)
  - Attachment preview strip (filename + `LinearProgress` while uploading, cancel button)
  - Error display for size/upload errors
  - `handleSend`: include `attachmentId` in socket emit if `pendingAttachment` set; allow send with empty content when attachment present

- [x] **Step 2: Verify TypeScript compiles**

  ```bash
  pnpm --filter frontend build
  ```

  Expected: Exit 0.

- [x] **Step 3: Commit**

  ```bash
  git add packages/frontend/src/features/rooms/RoomMessageInput.tsx
  git commit -m "feat(attachments): add file picker and upload strip to RoomMessageInput"
  ```

---

## Task 10: Frontend — RoomMessageItem renders AttachmentPreview

**Files:**

- Modify: `packages/frontend/src/features/rooms/RoomMessageItem.tsx`

- [x] **Step 1: Render `AttachmentPreview` in message body**

  Import `AttachmentPreview`. After the message content `<Typography>` (inside the non-deleted branch), add `{message.attachment && <AttachmentPreview attachment={message.attachment} />}`.

- [x] **Step 2: Verify TypeScript compiles**

  ```bash
  pnpm --filter frontend build
  ```

  Expected: Exit 0.

- [x] **Step 3: Commit**

  ```bash
  git add packages/frontend/src/features/rooms/RoomMessageItem.tsx
  git commit -m "feat(attachments): render AttachmentPreview in RoomMessageItem"
  ```

---

## Task 11: Frontend — DmMessageInput upload UX

**Files:**

- Modify: `packages/frontend/src/features/dm/DmMessageInput.tsx`

- [x] **Step 1: Add attachment support to `DmMessageInput`**

  Mirror the approach from Task 9 using `useAttachmentUpload({ targetType: 'DM', targetId: threadId })`. Include `attachmentId` in `DM_EVENTS.MESSAGE_SEND` emit when `pendingAttachment` is set.

- [x] **Step 2: Verify TypeScript compiles**

  ```bash
  pnpm --filter frontend build
  ```

  Expected: Exit 0.

- [x] **Step 3: Commit**

  ```bash
  git add packages/frontend/src/features/dm/DmMessageInput.tsx
  git commit -m "feat(attachments): add file picker and upload strip to DmMessageInput"
  ```

---

## Task 12: Frontend — DmMessageItem renders AttachmentPreview

**Files:**

- Modify: `packages/frontend/src/features/dm/DmMessageItem.tsx`

- [x] **Step 1: Render `AttachmentPreview` in DM message body**

  Import `AttachmentPreview`. After message content (inside non-deleted branch), add `{message.attachment && <AttachmentPreview attachment={message.attachment} />}`.

- [x] **Step 2: Verify TypeScript compiles**

  ```bash
  pnpm --filter frontend build
  ```

  Expected: Exit 0.

- [x] **Step 3: Commit**

  ```bash
  git add packages/frontend/src/features/dm/DmMessageItem.tsx
  git commit -m "feat(attachments): render AttachmentPreview in DmMessageItem"
  ```

---

## Task 13: Nginx — verify client_max_body_size

**Files:**

- Modify: `nginx/default.conf`

- [x] **Step 1: Confirm config is correct**

  The presigned PUT goes directly browser → MinIO, bypassing Nginx. Only small JSON payloads hit `/api/attachments/`. Verify `client_max_body_size` at the server level is sufficient (existing `20m` is fine). No change strictly required; confirm and document if already correct.

- [x] **Step 2: Test Nginx config**

  ```bash
  docker compose run --rm nginx nginx -t 2>&1 || echo "Nginx not running — config reviewed manually"
  ```

- [x] **Step 3: Commit**

  ```bash
  git add nginx/default.conf
  git commit -m "feat(attachments): verify nginx config for attachment routes"
  ```

---

## Dependency Order

```
Task 1 (schema)
  → Task 2 (shared types)
    → Task 3 (AttachmentsService)
      → Task 4 (AttachmentsController)
      → Task 5 (RoomsService extension)
      → Task 6 (DmService extension)
    → Task 7 (frontend API + hook)
      → Task 8 (AttachmentPreview)
        → Task 9  (RoomMessageInput)
        → Task 10 (RoomMessageItem)
        → Task 11 (DmMessageInput)
        → Task 12 (DmMessageItem)
Task 13 (Nginx) — independent
```

Tasks 3–6 can be done in parallel once Task 2 is complete. Tasks 9–12 can be done in parallel once Task 8 is complete.

---

## Notes

- **`useAuthToken`:** Verify auth store field name by checking existing auth-related hooks before Task 7.
- **`SendMessageDto` `@ValidateIf`:** Requires `ValidationPipe` with `transform: true` (check `main.ts`).
- **DmService return type:** Task 6 changes `sendMessage` to include `attachment`. Check `dm.controller.ts` for any callers and update their handling.
- **Orphan cleanup:** Pending Attachment rows (no `committedAt`) and committed rows with no `messageId` older than 1 hour should be pruned in a future `@Cron` job — not blocking for this feature.
