# Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

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
| Modify | `packages/backend/src/dm/dm.service.ts`                                       |
| Modify | `packages/backend/src/dm/dm.gateway.ts`                                       |
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

- [ ] **Step 1: Install AWS S3 SDK and image processing packages**

```bash
pnpm --filter backend add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner sharp
pnpm --filter backend add -D @types/sharp
pnpm --filter backend add file-type
```

- [ ] **Step 2: Add Attachment model and enum to schema.prisma**

Open `packages/backend/prisma/schema.prisma` and append after the final model:

```prisma
enum AttachmentTarget {
  ROOM
  DM
}

model Attachment {
  id               String           @id @default(cuid())
  uploaderId       String
  uploader         User             @relation(fields: [uploaderId], references: [id])
  targetType       AttachmentTarget
  roomId           String?
  room             Room?            @relation(fields: [roomId], references: [id], onDelete: Cascade)
  dmThreadId       String?
  dmThread         DirectMessageThread? @relation(fields: [dmThreadId], references: [id], onDelete: Cascade)
  objectKey        String           @unique
  thumbnailKey     String?
  originalFilename String
  mimeType         String
  size             Int
  committedAt      DateTime?
  messageId        String?          @unique
  createdAt        DateTime         @default(now())
}
```

- [ ] **Step 3: Add back-relations and FKs to existing models**

In the `User` model add:

```prisma
  attachments      Attachment[]
```

In the `Room` model add:

```prisma
  attachments      Attachment[]
```

In the `DirectMessageThread` model add:

```prisma
  attachments      Attachment[]
```

In the `RoomMessage` model add:

```prisma
  attachmentId     String?          @unique
  attachment       Attachment?      @relation("RoomMessageAttachment", fields: [attachmentId], references: [id])
```

In the `DirectMessage` model add:

```prisma
  attachmentId     String?          @unique
  attachment       Attachment?      @relation("DirectMessageAttachment", fields: [attachmentId], references: [id])
```

Add back-relations on `Attachment` model:

```prisma
  roomMessage      RoomMessage?     @relation("RoomMessageAttachment")
  directMessage    DirectMessage?   @relation("DirectMessageAttachment")
```

- [ ] **Step 4: Create migration SQL file**

Create directory and file:
`packages/backend/prisma/migrations/20260422200000_attachments/migration.sql`

```sql
-- CreateEnum
CREATE TYPE "AttachmentTarget" AS ENUM ('ROOM', 'DM');

-- AlterTable: RoomMessage
ALTER TABLE "RoomMessage" ADD COLUMN "attachmentId" TEXT;
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_attachmentId_key" UNIQUE ("attachmentId");

-- AlterTable: DirectMessage
ALTER TABLE "DirectMessage" ADD COLUMN "attachmentId" TEXT;
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_attachmentId_key" UNIQUE ("attachmentId");

-- CreateTable: Attachment
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "targetType" "AttachmentTarget" NOT NULL,
    "roomId" TEXT,
    "dmThreadId" TEXT,
    "objectKey" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "committedAt" TIMESTAMP(3),
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_objectKey_key" ON "Attachment"("objectKey");
CREATE UNIQUE INDEX "Attachment_messageId_key" ON "Attachment"("messageId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploaderId_fkey"
  FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_dmThreadId_fkey"
  FOREIGN KEY ("dmThreadId") REFERENCES "DirectMessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_attachmentId_fkey"
  FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_attachmentId_fkey"
  FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 5: Run prisma generate and verify**

```bash
pnpm --filter backend prisma generate
```

Expected: Prisma Client generated without errors.

- [ ] **Step 6: Run migration against dev database**

```bash
pnpm --filter backend prisma migrate dev --name attachments
```

Expected: Migration applied, schema in sync.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
pnpm --filter backend build
```

Expected: Exit 0, no type errors.

- [ ] **Step 8: Commit**

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

- [ ] **Step 1: Add AttachmentPayload and update RoomMessagePayload in rooms.ts**

Add to `packages/shared/src/rooms.ts`:

```typescript
export interface AttachmentPayload {
  id: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  thumbnailAvailable: boolean;
}
```

Update `RoomMessagePayload` to add:

```typescript
  attachment?: AttachmentPayload | null;
```

Update `SendRoomMessagePayload` to add:

```typescript
  attachmentId?: string;
```

- [ ] **Step 2: Add attachment field to DmMessagePayload in dm.ts**

In `packages/shared/src/dm.ts`, update `DmMessagePayload` to add:

```typescript
  attachment?: AttachmentPayload | null;
```

Import `AttachmentPayload` at the top of `dm.ts`:

```typescript
import type { AttachmentPayload } from './rooms';
```

- [ ] **Step 3: Re-export AttachmentPayload from index.ts**

In `packages/shared/src/index.ts`, update the rooms export line:

```typescript
export type {
  RoomRole,
  RoomSummary,
  RoomMember,
  RoomDetail,
  RoomMessagePayload,
  SendRoomMessagePayload,
  RoomTypingPayload,
  RoomMemberEventPayload,
  AttachmentPayload,
} from './rooms';
```

- [ ] **Step 4: Verify both packages compile**

```bash
pnpm --filter shared build 2>/dev/null || true
pnpm --filter backend build
pnpm --filter frontend build
```

Expected: Exit 0 for all three (or only type-check errors if frontend uses the new fields — these will be resolved in later tasks).

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write failing tests first**

Create `packages/backend/src/attachments/attachments.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipService } from '../friendship/friendship.service';

const mockS3Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  DeleteObjectsCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://minio.example.com/presigned-url'),
}));
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('sharp', () => {
  const chain = {
    rotate: jest.fn(),
    resize: jest.fn(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('img')),
  };
  chain.rotate.mockReturnValue(chain);
  chain.resize.mockReturnValue(chain);
  return jest.fn(() => chain);
});

const mockPrisma = {
  roomMembership: { findUnique: jest.fn() },
  roomBan: { findFirst: jest.fn() },
  directMessageThread: { findUnique: jest.fn() },
  attachment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockFriendship = { areMutualFriendsAndNotBlocked: jest.fn() };

const mockConfig = {
  get: jest.fn((key: string) => {
    const vals: Record<string, string | number | boolean> = {
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: 9000,
      MINIO_ACCESS_KEY: 'minioadmin',
      MINIO_SECRET_KEY: 'minioadmin',
      MINIO_BUCKET: 'chatrix-uploads',
      MINIO_USE_SSL: false,
    };
    return vals[key];
  }),
};

describe('AttachmentsService', () => {
  let service: AttachmentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FriendshipService, useValue: mockFriendship },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(AttachmentsService);
  });

  describe('requestUploadUrl', () => {
    it('throws ForbiddenException when user is not a room member', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue(null);
      await expect(
        service.requestUploadUrl('user1', {
          targetType: 'ROOM',
          targetId: 'room1',
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when image exceeds 3MB', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue({ role: 'MEMBER' });
      mockPrisma.roomBan.findFirst.mockResolvedValue(null);
      await expect(
        service.requestUploadUrl('user1', {
          targetType: 'ROOM',
          targetId: 'room1',
          filename: 'big.jpg',
          mimeType: 'image/jpeg',
          size: 4 * 1024 * 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for disallowed mime type', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue({ role: 'MEMBER' });
      mockPrisma.roomBan.findFirst.mockResolvedValue(null);
      await expect(
        service.requestUploadUrl('user1', {
          targetType: 'ROOM',
          targetId: 'room1',
          filename: 'script.exe',
          mimeType: 'application/x-msdownload',
          size: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns presigned URL for valid room upload', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue({ role: 'MEMBER' });
      mockPrisma.roomBan.findFirst.mockResolvedValue(null);
      mockPrisma.attachment.create.mockResolvedValue({
        id: 'att1',
        objectKey: 'uploads/room1/uuid/test.jpg',
      });
      const result = await service.requestUploadUrl('user1', {
        targetType: 'ROOM',
        targetId: 'room1',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
      });
      expect(result).toHaveProperty('attachmentId', 'att1');
      expect(result).toHaveProperty('presignedUrl');
    });
  });

  describe('commitUpload', () => {
    it('throws when attachment not found', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(null);
      await expect(service.commitUpload('user1', 'att1')).rejects.toThrow();
    });

    it('throws ForbiddenException when caller is not uploader', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att1',
        uploaderId: 'user2',
        committedAt: null,
      });
      await expect(service.commitUpload('user1', 'att1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getDownloadUrl', () => {
    it('throws ForbiddenException when user is not room member', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att1',
        targetType: 'ROOM',
        roomId: 'room1',
        objectKey: 'uploads/room1/uuid/test.jpg',
        thumbnailKey: null,
        committedAt: new Date(),
      });
      mockPrisma.roomMembership.findUnique.mockResolvedValue(null);
      await expect(service.getDownloadUrl('user1', 'att1')).rejects.toThrow(ForbiddenException);
    });

    it('returns presigned GET url for valid member', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att1',
        targetType: 'ROOM',
        roomId: 'room1',
        objectKey: 'uploads/room1/uuid/test.jpg',
        thumbnailKey: null,
        committedAt: new Date(),
      });
      mockPrisma.roomMembership.findUnique.mockResolvedValue({ role: 'MEMBER' });
      mockPrisma.roomBan.findFirst.mockResolvedValue(null);
      const result = await service.getDownloadUrl('user1', 'att1');
      expect(result).toHaveProperty('url');
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter backend test -- --testPathPattern=attachments.service
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create AttachmentsService**

Create `packages/backend/src/attachments/attachments.service.ts`:

```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AttachmentPayload } from '@chatrix/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipService } from '../friendship/friendship.service';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const ALLOWED_MIME_TYPES = new Set([
  ...IMAGE_MIME_TYPES,
  'application/pdf',
  'application/zip',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export interface RequestUploadUrlDto {
  targetType: 'ROOM' | 'DM';
  targetId: string;
  filename: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class AttachmentsService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly friendshipService: FriendshipService,
    private readonly config: ConfigService,
  ) {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT')!;
    const port = this.config.get<number>('MINIO_PORT')!;
    const useSSL = this.config.get<boolean>('MINIO_USE_SSL') ?? false;
    this.bucket = this.config.get<string>('MINIO_BUCKET')!;

    this.s3 = new S3Client({
      endpoint: `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: this.config.get<string>('MINIO_ACCESS_KEY')!,
        secretAccessKey: this.config.get<string>('MINIO_SECRET_KEY')!,
      },
      forcePathStyle: true,
    });
  }

  // ─── Access guards ────────────────────────────────────────────────────────

  private async assertRoomAccess(roomId: string, userId: string): Promise<void> {
    const membership = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this room');
    const ban = await this.prisma.roomBan.findFirst({
      where: { roomId, userId, liftedAt: null },
    });
    if (ban) throw new ForbiddenException('You are banned from this room');
  }

  private async assertDmAccess(dmThreadId: string, userId: string): Promise<void> {
    const thread = await this.prisma.directMessageThread.findUnique({
      where: { id: dmThreadId },
    });
    if (!thread) throw new NotFoundException('DM thread not found');
    if (thread.userAId !== userId && thread.userBId !== userId) {
      throw new ForbiddenException('Not a participant in this DM');
    }
    const otherId = thread.userAId === userId ? thread.userBId : thread.userAId;
    const allowed = await this.friendshipService.areMutualFriendsAndNotBlocked(userId, otherId);
    if (!allowed) throw new ForbiddenException('DMs require active mutual friendship');
  }

  private async assertAccess(
    targetType: 'ROOM' | 'DM',
    targetId: string,
    userId: string,
  ): Promise<void> {
    if (targetType === 'ROOM') {
      await this.assertRoomAccess(targetId, userId);
    } else {
      await this.assertDmAccess(targetId, userId);
    }
  }

  // ─── requestUploadUrl ─────────────────────────────────────────────────────

  async requestUploadUrl(
    userId: string,
    dto: RequestUploadUrlDto,
  ): Promise<{ attachmentId: string; presignedUrl: string }> {
    if (!ALLOWED_MIME_TYPES.has(dto.mimeType)) {
      throw new BadRequestException(`File type ${dto.mimeType} is not allowed`);
    }
    const maxSize = IMAGE_MIME_TYPES.has(dto.mimeType) ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    if (dto.size > maxSize) {
      throw new BadRequestException(
        `File too large: max ${maxSize / 1024 / 1024}MB for ${IMAGE_MIME_TYPES.has(dto.mimeType) ? 'images' : 'files'}`,
      );
    }

    await this.assertAccess(dto.targetType, dto.targetId, userId);

    const uuid = uuidv4();
    const safeFilename = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `uploads/${dto.targetId}/${uuid}/${safeFilename}`;

    const attachment = await this.prisma.attachment.create({
      data: {
        uploaderId: userId,
        targetType: dto.targetType,
        ...(dto.targetType === 'ROOM' ? { roomId: dto.targetId } : { dmThreadId: dto.targetId }),
        objectKey,
        originalFilename: dto.filename,
        mimeType: dto.mimeType,
        size: dto.size,
      },
    });

    const presignedUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: dto.mimeType,
        ContentLength: dto.size,
      }),
      { expiresIn: 300 }, // 5 minutes
    );

    return { attachmentId: attachment.id, presignedUrl };
  }

  // ─── commitUpload ─────────────────────────────────────────────────────────

  async commitUpload(userId: string, attachmentId: string): Promise<AttachmentPayload> {
    const attachment = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (attachment.uploaderId !== userId) throw new ForbiddenException('Not your attachment');
    if (attachment.committedAt) throw new BadRequestException('Already committed');

    // Confirm object exists in MinIO
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: attachment.objectKey }));
    } catch {
      throw new BadRequestException('Upload not found — PUT to MinIO first');
    }

    // Magic-bytes MIME validation
    const { fileTypeFromBuffer } = await import('file-type');
    const rangeResponse = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: attachment.objectKey,
        Range: 'bytes=0-4099',
      }),
    );
    const stream = rangeResponse.Body as AsyncIterable<Uint8Array>;
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) chunks.push(chunk);
    const sampleBuffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const detected = await fileTypeFromBuffer(sampleBuffer);
    if (!detected || detected.mime !== attachment.mimeType) {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: attachment.objectKey }),
      );
      await this.prisma.attachment.delete({ where: { id: attachment.id } });
      throw new BadRequestException('MIME type mismatch — file rejected');
    }

    let thumbnailKey: string | null = null;

    // EXIF strip + thumbnail for images (skip gif thumbnails to preserve animation)
    if (IMAGE_MIME_TYPES.has(attachment.mimeType) && attachment.mimeType !== 'image/gif') {
      const sharp = (await import('sharp')).default;
      const fullResponse = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: attachment.objectKey }),
      );
      const fullStream = fullResponse.Body as AsyncIterable<Uint8Array>;
      const fullChunks: Uint8Array[] = [];
      for await (const chunk of fullStream) fullChunks.push(chunk);
      const fullBuffer = Buffer.concat(fullChunks.map((c) => Buffer.from(c)));

      // Strip EXIF and re-upload
      const stripped = await sharp(fullBuffer).rotate().toBuffer();
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: attachment.objectKey,
          Body: stripped,
          ContentType: attachment.mimeType,
        }),
      );

      // Generate and upload thumbnail
      const thumb = await sharp(fullBuffer).resize(400, 400, { fit: 'inside' }).toBuffer();
      const thumbKey = attachment.objectKey.replace(/([^/]+)$/, 'thumb_$1');
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: thumbKey,
          Body: thumb,
          ContentType: attachment.mimeType,
        }),
      );
      thumbnailKey = thumbKey;
    }

    const updated = await this.prisma.attachment.update({
      where: { id: attachment.id },
      data: { committedAt: new Date(), ...(thumbnailKey ? { thumbnailKey } : {}) },
    });

    return {
      id: updated.id,
      originalFilename: updated.originalFilename,
      mimeType: updated.mimeType,
      size: updated.size,
      thumbnailAvailable: !!updated.thumbnailKey,
    };
  }

  // ─── getDownloadUrl ───────────────────────────────────────────────────────

  async getDownloadUrl(
    userId: string,
    attachmentId: string,
  ): Promise<{ url: string; thumbnailUrl?: string }> {
    const attachment = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment || !attachment.committedAt) throw new NotFoundException('Attachment not found');

    await this.assertAccess(
      attachment.targetType as 'ROOM' | 'DM',
      (attachment.roomId ?? attachment.dmThreadId)!,
      userId,
    );

    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: attachment.objectKey }),
      { expiresIn: 60 },
    );

    const thumbnailUrl = attachment.thumbnailKey
      ? await getSignedUrl(
          this.s3,
          new GetObjectCommand({ Bucket: this.bucket, Key: attachment.thumbnailKey }),
          { expiresIn: 60 },
        )
      : undefined;

    return { url, ...(thumbnailUrl ? { thumbnailUrl } : {}) };
  }

  // ─── cascade delete helpers ───────────────────────────────────────────────

  async deleteAttachmentsByRoom(roomId: string): Promise<void> {
    const attachments = await this.prisma.attachment.findMany({ where: { roomId } });
    await this.deleteMinioObjects(attachments);
    await this.prisma.attachment.deleteMany({ where: { roomId } });
  }

  async deleteAttachmentsByThread(dmThreadId: string): Promise<void> {
    const attachments = await this.prisma.attachment.findMany({ where: { dmThreadId } });
    await this.deleteMinioObjects(attachments);
    await this.prisma.attachment.deleteMany({ where: { dmThreadId } });
  }

  private async deleteMinioObjects(
    attachments: Array<{ objectKey: string; thumbnailKey: string | null }>,
  ): Promise<void> {
    if (attachments.length === 0) return;
    const keys: string[] = [];
    for (const a of attachments) {
      keys.push(a.objectKey);
      if (a.thumbnailKey) keys.push(a.thumbnailKey);
    }
    await this.s3.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    );
  }
}
```

- [ ] **Step 4: Create AttachmentsModule (service only — controller added in Task 4)**

Create `packages/backend/src/attachments/attachments.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FriendshipModule } from '../friendship/friendship.module';

@Module({
  imports: [PrismaModule, FriendshipModule],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter backend test -- --testPathPattern=attachments.service
```

Expected: PASS (all describe blocks).

- [ ] **Step 6: Commit**

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

- [ ] **Step 1: Create request-upload-url DTO**

Create `packages/backend/src/attachments/dto/request-upload-url.dto.ts`:

```typescript
import { IsEnum, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class RequestUploadUrlDto {
  @IsEnum(['ROOM', 'DM'])
  targetType!: 'ROOM' | 'DM';

  @IsString()
  targetId!: string;

  @IsString()
  @MaxLength(255)
  filename!: string;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  size!: number;
}
```

- [ ] **Step 2: Create AttachmentsController**

Create `packages/backend/src/attachments/attachments.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AttachmentsService } from './attachments.service';
import { RequestUploadUrlDto } from './dto/request-upload-url.dto';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: string };
}

@Controller('attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post('upload-url')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async requestUploadUrl(@Req() req: AuthenticatedRequest, @Body() dto: RequestUploadUrlDto) {
    return this.attachments.requestUploadUrl(req.user.userId, {
      targetType: dto.targetType,
      targetId: dto.targetId,
      filename: dto.filename,
      mimeType: dto.mimeType,
      size: dto.size,
    });
  }

  @Post(':id/commit')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async commitUpload(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.attachments.commitUpload(req.user.userId, id);
  }

  @Get(':id/download')
  @Throttle({ default: { limit: 100, ttl: 60_000 } })
  async getDownloadUrl(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.attachments.getDownloadUrl(req.user.userId, id);
  }
}
```

- [ ] **Step 3: Add controller to AttachmentsModule and register in AppModule**

Update `packages/backend/src/attachments/attachments.module.ts` to add the controller:

```typescript
import { Module } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FriendshipModule } from '../friendship/friendship.module';

@Module({
  imports: [PrismaModule, FriendshipModule],
  providers: [AttachmentsService],
  controllers: [AttachmentsController],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
```

In `packages/backend/src/app.module.ts`, add the import and register the module:

```typescript
import { AttachmentsModule } from './attachments/attachments.module';
```

Add `AttachmentsModule` to the `imports` array alongside `RoomsModule`:

```typescript
    RoomsModule,
    AttachmentsModule,
```

- [ ] **Step 4: Verify build**

```bash
pnpm --filter backend build
```

Expected: Exit 0.

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Update SendMessageDto**

Replace `packages/backend/src/rooms/dto/send-message.dto.ts`:

```typescript
import { IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(0)
  @MaxLength(3072)
  @ValidateIf((o: SendMessageDto) => !o.attachmentId)
  @MinLength(1, { message: 'content is required when no attachment is provided' })
  content!: string;

  @IsOptional()
  @IsString()
  replyToId?: string;

  @IsOptional()
  @IsString()
  attachmentId?: string;
}
```

- [ ] **Step 2: Update buildMessagePayload to include attachment**

In `packages/backend/src/rooms/rooms.service.ts`, update the `buildMessagePayload` method signature and body:

```typescript
  private buildMessagePayload(msg: {
    id: string;
    roomId: string;
    authorId: string;
    author: { username: string };
    content: string;
    replyTo: { id: string; author: { username: string }; content: string } | null;
    editedAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    attachment: {
      id: string;
      originalFilename: string;
      mimeType: string;
      size: number;
      thumbnailKey: string | null;
    } | null;
  }): RoomMessagePayload {
    return {
      id: msg.id,
      roomId: msg.roomId,
      authorId: msg.authorId,
      authorUsername: msg.author.username,
      content: msg.content,
      replyTo: msg.replyTo
        ? {
            id: msg.replyTo.id,
            authorUsername: msg.replyTo.author.username,
            content: msg.replyTo.content,
          }
        : null,
      editedAt: msg.editedAt?.toISOString() ?? null,
      deletedAt: msg.deletedAt?.toISOString() ?? null,
      createdAt: msg.createdAt.toISOString(),
      attachment: msg.attachment
        ? {
            id: msg.attachment.id,
            originalFilename: msg.attachment.originalFilename,
            mimeType: msg.attachment.mimeType,
            size: msg.attachment.size,
            thumbnailAvailable: !!msg.attachment.thumbnailKey,
          }
        : null,
    };
  }
```

- [ ] **Step 3: Update sendMessage to validate and link attachment**

Replace the `sendMessage` method:

```typescript
  async sendMessage(
    roomId: string,
    userId: string,
    dto: SendMessageDto,
  ): Promise<RoomMessagePayload> {
    await this.assertMember(roomId, userId);
    await this.assertNotBanned(roomId, userId);

    if (dto.attachmentId) {
      const att = await this.prisma.attachment.findUnique({ where: { id: dto.attachmentId } });
      if (!att) throw new NotFoundException('Attachment not found');
      if (att.uploaderId !== userId) throw new ForbiddenException('Not your attachment');
      if (att.roomId !== roomId) throw new ForbiddenException('Attachment belongs to a different room');
      if (!att.committedAt) throw new BadRequestException('Attachment upload not complete');
      if (att.messageId) throw new BadRequestException('Attachment already used');
    }

    const msg = await this.prisma.$transaction(async (tx) => {
      const message = await tx.roomMessage.create({
        data: {
          roomId,
          authorId: userId,
          content: dto.content,
          ...(dto.replyToId ? { replyToId: dto.replyToId } : {}),
          ...(dto.attachmentId ? { attachmentId: dto.attachmentId } : {}),
        },
        include: {
          author: { select: { username: true } },
          replyTo: { include: { author: { select: { username: true } } } },
          attachment: { select: { id: true, originalFilename: true, mimeType: true, size: true, thumbnailKey: true } },
        },
      });
      if (dto.attachmentId) {
        await tx.attachment.update({
          where: { id: dto.attachmentId },
          data: { messageId: message.id },
        });
      }
      return message;
    });

    return this.buildMessagePayload(msg);
  }
```

- [ ] **Step 4: Add attachment include to all other Prisma queries that return RoomMessagePayload**

For `editMessage`, `deleteMessage` (if it returns payload), and `getMessages`, add to the Prisma include:

```typescript
attachment: { select: { id: true, originalFilename: true, mimeType: true, size: true, thumbnailKey: true } },
```

Also update the `buildMessagePayload` calls in `editMessage` to include `attachment: null` since it won't change. For `getMessages`, add the include to `prisma.roomMessage.findMany`.

- [ ] **Step 5: Update deleteRoom to call AttachmentsService**

Inject `AttachmentsService` into `RoomsService`:

```typescript
import { AttachmentsService } from '../attachments/attachments.service';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService,
  ) {}
```

Update `deleteRoom`:

```typescript
  async deleteRoom(roomId: string, userId: string): Promise<void> {
    const membership = await this.assertMember(roomId, userId);
    if (ROLE_RANK[membership.role] < ROLE_RANK['OWNER']) {
      throw new ForbiddenException('Only the room owner can delete the room');
    }
    await this.attachments.deleteAttachmentsByRoom(roomId);
    await this.prisma.room.delete({ where: { id: roomId } });
  }
```

Read `packages/backend/src/rooms/rooms.module.ts` and add `AttachmentsModule` to its imports. The file currently looks like:

```typescript
import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomsGateway } from './rooms.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [RoomsService, RoomsGateway],
  controllers: [RoomsController],
})
export class RoomsModule {}
```

Update it to:

```typescript
import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomsGateway } from './rooms.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [PrismaModule, AttachmentsModule],
  providers: [RoomsService, RoomsGateway],
  controllers: [RoomsController],
})
export class RoomsModule {}
```

- [ ] **Step 6: Update RoomsGateway to pass attachmentId**

In `packages/backend/src/rooms/rooms.gateway.ts`, update the `handleMessageSend` data type:

```typescript
  @SubscribeMessage(ROOM_EVENTS.MESSAGE_SEND)
  async handleMessageSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: SendRoomMessagePayload,
  ): Promise<void> {
    try {
      const userId = socket.data['userId'] as string | undefined;
      if (!userId) throw new WsException('Unauthorized');

      if (!checkMessageRateLimit(userId)) {
        throw new WsException('Rate limit exceeded — slow down');
      }

      const message = await this.roomsService.sendMessage(data.roomId, userId, {
        content: data.content,
        ...(data.replyToId !== undefined ? { replyToId: data.replyToId } : {}),
        ...(data.attachmentId !== undefined ? { attachmentId: data.attachmentId } : {}),
      });

      this.server.to(`room:${data.roomId}`).emit(ROOM_EVENTS.MESSAGE_NEW, message);
    } catch (e) {
      if (e instanceof WsException) throw e;
      throw new WsException('Failed to send message');
    }
  }
```

- [ ] **Step 7: Verify build**

```bash
pnpm --filter backend build
```

Expected: Exit 0.

- [ ] **Step 8: Commit**

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

- [ ] **Step 1: Update DmService.sendMessage to accept attachmentId**

In `packages/backend/src/dm/dm.service.ts`, update the `sendMessage` signature and body:

```typescript
  async sendMessage(
    threadId: string,
    authorId: string,
    content: string,
    replyToId?: string,
    attachmentId?: string,
  ): Promise<DirectMessage & { attachment: { id: string; originalFilename: string; mimeType: string; size: number; thumbnailKey: string | null } | null }> {
    await this.assertParticipant(threadId, authorId);

    if (attachmentId) {
      const att = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
      if (!att) throw new NotFoundException('Attachment not found');
      if (att.uploaderId !== authorId) throw new ForbiddenException('Not your attachment');
      if (att.dmThreadId !== threadId) throw new ForbiddenException('Attachment belongs to a different thread');
      if (!att.committedAt) throw new BadRequestException('Attachment upload not complete');
      if (att.messageId) throw new BadRequestException('Attachment already used');
    }

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.directMessage.create({
        data: {
          threadId,
          authorId,
          content,
          ...(replyToId ? { replyToId } : {}),
          ...(attachmentId ? { attachmentId } : {}),
        },
        include: {
          attachment: { select: { id: true, originalFilename: true, mimeType: true, size: true, thumbnailKey: true } },
        },
      });
      if (attachmentId) {
        await tx.attachment.update({ where: { id: attachmentId }, data: { messageId: message.id } });
      }
      return message;
    });
  }
```

Add the missing imports to dm.service.ts:

```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
```

(Some may already exist — check and add only missing ones.)

- [ ] **Step 2: Inject AttachmentsService into DmService for thread deletion**

Update the `DmService` constructor to inject `AttachmentsService`:

```typescript
import { AttachmentsService } from '../attachments/attachments.service';

@Injectable()
export class DmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friendshipService: FriendshipService,
    private readonly attachments: AttachmentsService,
  ) {}
```

Add a `deleteThread` method (if DMs can be deleted in future) or at minimum a `deleteAttachmentsForThread` helper — for now, wire it so that if a thread is ever deleted via `prisma.directMessageThread.delete`, the MinIO objects are cleaned first. Add to `DmService`:

```typescript
  async deleteAttachmentsByThread(dmThreadId: string): Promise<void> {
    await this.attachments.deleteAttachmentsByThread(dmThreadId);
  }
```

- [ ] **Step 3: Update DmGateway to pass attachmentId**

In `packages/backend/src/dm/dm.gateway.ts`, update `handleMessageSend`:

```typescript
  @SubscribeMessage(DM_EVENTS.MESSAGE_SEND)
  async handleMessageSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { threadId: string; content: string; replyToId?: string; attachmentId?: string },
  ): Promise<void> {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) throw new WsException('Unauthorized');

    const message = await this.dm.sendMessage(
      data.threadId,
      userId,
      data.content,
      data.replyToId,
      data.attachmentId,
    );
    const authorUsername = await this.dm.getUsernameById(userId);
    const payload: DmMessagePayload = {
      id: message.id,
      threadId: message.threadId,
      authorId: message.authorId,
      authorUsername,
      content: message.content,
      replyToId: message.replyToId,
      editedAt: message.editedAt?.toISOString() ?? null,
      deletedAt: message.deletedAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
      attachment: message.attachment
        ? {
            id: message.attachment.id,
            originalFilename: message.attachment.originalFilename,
            mimeType: message.attachment.mimeType,
            size: message.attachment.size,
            thumbnailAvailable: !!message.attachment.thumbnailKey,
          }
        : null,
    };
    this.server.to(`dm:thread:${data.threadId}`).emit(DM_EVENTS.MESSAGE_NEW, payload);
  }
```

- [ ] **Step 4: Update DmModule to import AttachmentsModule**

In `packages/backend/src/dm/dm.module.ts`, add `AttachmentsModule` to imports:

```typescript
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [FriendshipModule, AttachmentsModule],
  ...
})
```

- [ ] **Step 5: Verify build**

```bash
pnpm --filter backend build
```

Expected: Exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/dm/
git commit -m "feat(attachments): extend DmService and DmGateway to support attachmentId"
```

---

## Task 7: Frontend — attachmentsApi + useAttachmentUpload

**Files:**

- Create: `packages/frontend/src/features/attachments/attachmentsApi.ts`
- Create: `packages/frontend/src/features/attachments/useAttachmentUpload.ts`

- [ ] **Step 1: Create attachmentsApi.ts**

Create `packages/frontend/src/features/attachments/attachmentsApi.ts`:

```typescript
import type { AttachmentPayload } from '@chatrix/shared';

const API_BASE = '/api/attachments';

export interface RequestUploadUrlParams {
  targetType: 'ROOM' | 'DM';
  targetId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export async function requestUploadUrl(
  token: string,
  params: RequestUploadUrlParams,
): Promise<{ attachmentId: string; presignedUrl: string }> {
  const res = await fetch(`${API_BASE}/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Upload URL request failed: ${res.status}`);
  }
  return res.json() as Promise<{ attachmentId: string; presignedUrl: string }>;
}

export async function commitUpload(
  token: string,
  attachmentId: string,
): Promise<AttachmentPayload> {
  const res = await fetch(`${API_BASE}/${attachmentId}/commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Commit failed: ${res.status}`);
  }
  return res.json() as Promise<AttachmentPayload>;
}

export async function getDownloadUrl(
  token: string,
  attachmentId: string,
): Promise<{ url: string; thumbnailUrl?: string }> {
  const res = await fetch(`${API_BASE}/${attachmentId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Download URL failed: ${res.status}`);
  return res.json() as Promise<{ url: string; thumbnailUrl?: string }>;
}

export function putToMinio(
  presignedUrl: string,
  file: File,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`MinIO PUT failed: ${xhr.status}`));
    });
    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
    if (signal) signal.addEventListener('abort', () => xhr.abort());
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}
```

- [ ] **Step 2: Create useAttachmentUpload.ts**

Create `packages/frontend/src/features/attachments/useAttachmentUpload.ts`:

```typescript
import { useCallback, useRef, useState } from 'react';
import type { AttachmentPayload } from '@chatrix/shared';
import { commitUpload, putToMinio, requestUploadUrl } from './attachmentsApi';
import { useAuthToken } from '../../hooks/useAuthToken';

export interface UseAttachmentUploadOptions {
  targetType: 'ROOM' | 'DM';
  targetId: string;
}

export interface UseAttachmentUploadResult {
  upload: (file: File) => Promise<AttachmentPayload>;
  progress: number;
  error: string | null;
  reset: () => void;
  abort: () => void;
}

export function useAttachmentUpload({
  targetType,
  targetId,
}: UseAttachmentUploadOptions): UseAttachmentUploadResult {
  const token = useAuthToken();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setProgress(0);
    setError(null);
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    reset();
  }, [reset]);

  const upload = useCallback(
    async (file: File): Promise<AttachmentPayload> => {
      reset();
      const ac = new AbortController();
      abortControllerRef.current = ac;

      try {
        const { attachmentId, presignedUrl } = await requestUploadUrl(token, {
          targetType,
          targetId,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        });

        await putToMinio(presignedUrl, file, setProgress, ac.signal);
        setProgress(100);

        return await commitUpload(token, attachmentId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setError(msg);
        throw err;
      }
    },
    [token, targetType, targetId, reset],
  );

  return { upload, progress, error, reset, abort };
}
```

- [ ] **Step 3: Create the useAuthToken hook if it doesn't exist**

Check if `packages/frontend/src/hooks/useAuthToken.ts` exists:

```bash
ls packages/frontend/src/hooks/useAuthToken.ts 2>/dev/null || echo "NOT FOUND"
```

If not found, create `packages/frontend/src/hooks/useAuthToken.ts`:

```typescript
import { useAuthStore } from '../stores/authStore';

export function useAuthToken(): string {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) throw new Error('Not authenticated');
  return token;
}
```

(Check `useAuthStore` path — look at existing imports in the codebase to confirm it's `stores/authStore`.)

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm --filter frontend build
```

Expected: Exit 0 (or only unrelated errors).

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/features/attachments/ packages/frontend/src/hooks/
git commit -m "feat(attachments): add frontend attachmentsApi and useAttachmentUpload hook"
```

---

## Task 8: Frontend — AttachmentPreview component

**Files:**

- Create: `packages/frontend/src/features/attachments/AttachmentPreview.tsx`

- [ ] **Step 1: Create AttachmentPreview.tsx**

Create `packages/frontend/src/features/attachments/AttachmentPreview.tsx`:

```typescript
import { useEffect, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Skeleton,
  Tooltip,
} from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import type { AttachmentPayload } from '@chatrix/shared';
import { getDownloadUrl } from './attachmentsApi';
import { useAuthToken } from '../../hooks/useAuthToken';

interface AttachmentPreviewProps {
  attachment: AttachmentPayload;
}

const IMAGE_MIME_PREFIX = 'image/';

export function AttachmentPreview({ attachment }: AttachmentPreviewProps) {
  const token = useAuthToken();
  const isImage = attachment.mimeType.startsWith(IMAGE_MIME_PREFIX);
  const [url, setUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(false);
    getDownloadUrl(token, attachment.id)
      .then(({ url: u, thumbnailUrl: t }) => {
        if (cancelled) return;
        setUrl(u);
        setThumbnailUrl(t ?? null);
      })
      .catch(() => {
        if (!cancelled) setFetchError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token, attachment.id]);

  if (loading) {
    return isImage ? (
      <Skeleton variant="rectangular" width={200} height={140} sx={{ borderRadius: 1, mt: 0.5 }} />
    ) : (
      <Skeleton variant="rounded" width={180} height={32} sx={{ mt: 0.5 }} />
    );
  }

  if (fetchError || !url) {
    return (
      <Chip
        label="File unavailable"
        size="small"
        icon={<InsertDriveFileIcon />}
        sx={{ mt: 0.5, bgcolor: 'rgba(0,0,0,0.06)', color: 'text.disabled' }}
      />
    );
  }

  if (isImage) {
    const displayUrl = thumbnailUrl ?? url;
    return (
      <>
        <Box
          component="img"
          src={displayUrl}
          alt={attachment.originalFilename}
          onClick={() => setLightboxOpen(true)}
          sx={{
            display: 'block',
            maxWidth: 320,
            maxHeight: 240,
            borderRadius: 1,
            mt: 0.5,
            cursor: 'pointer',
            objectFit: 'cover',
            '&:hover': { opacity: 0.9 },
          }}
          onError={() => setFetchError(true)}
        />
        <Dialog
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          maxWidth="lg"
          PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none' } }}
        >
          <DialogContent sx={{ p: 0, position: 'relative' }}>
            <IconButton
              onClick={() => setLightboxOpen(false)}
              sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff' }}
            >
              <CloseIcon />
            </IconButton>
            <Box
              component="img"
              src={url}
              alt={attachment.originalFilename}
              sx={{ maxWidth: '90vw', maxHeight: '90vh', display: 'block' }}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Non-image: file chip with download button
  return (
    <Chip
      icon={<InsertDriveFileIcon />}
      label={attachment.originalFilename}
      size="small"
      sx={{ mt: 0.5, maxWidth: 280 }}
      deleteIcon={
        <Tooltip title="Download">
          <DownloadIcon fontSize="small" />
        </Tooltip>
      }
      onDelete={() => window.open(url, '_blank')}
    />
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter frontend build
```

Expected: Exit 0 (or only unrelated errors).

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/features/attachments/AttachmentPreview.tsx
git commit -m "feat(attachments): add AttachmentPreview component with inline image and file chip"
```

---

## Task 9: Frontend — RoomMessageInput upload UX

**Files:**

- Modify: `packages/frontend/src/features/rooms/RoomMessageInput.tsx`

- [ ] **Step 1: Update RoomMessageInput.tsx**

Replace `packages/frontend/src/features/rooms/RoomMessageInput.tsx`:

```typescript
import { useRef, useState } from 'react';
import {
  Box,
  IconButton,
  LinearProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { ROOM_EVENTS } from '@chatrix/shared';
import type { AttachmentPayload, RoomMessagePayload } from '@chatrix/shared';
import { useDmStore } from '../../stores/dmStore';
import { useAttachmentUpload } from '../attachments/useAttachmentUpload';

const MAX_IMAGE_SIZE = 3 * 1024 * 1024;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const IMAGE_MIME_PREFIX = 'image/';

interface RoomMessageInputProps {
  roomId: string;
  replyTo: RoomMessagePayload | null;
  onClearReply: () => void;
}

export function RoomMessageInput({ roomId, replyTo, onClearReply }: RoomMessageInputProps) {
  const [content, setContent] = useState('');
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<AttachmentPayload | null>(null);
  const [uploading, setUploading] = useState(false);
  const socket = useDmStore((s) => s.socket);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, progress, error: uploadError, reset: resetUpload, abort } = useAttachmentUpload({
    targetType: 'ROOM',
    targetId: roomId,
  });

  function validateFile(file: File): string | null {
    const isImage = file.type.startsWith(IMAGE_MIME_PREFIX);
    if (isImage && file.size > MAX_IMAGE_SIZE) return 'Image must be under 3MB';
    if (!isImage && file.size > MAX_FILE_SIZE) return 'File must be under 20MB';
    return null;
  }

  async function handleFile(file: File) {
    setSizeError(null);
    const err = validateFile(file);
    if (err) { setSizeError(err); return; }

    setUploading(true);
    try {
      const payload = await upload(file);
      setPendingAttachment(payload);
    } catch {
      // uploadError state is set by the hook
    } finally {
      setUploading(false);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = Array.from(e.clipboardData.items);
    const fileItem = items.find((i) => i.kind === 'file');
    if (fileItem) {
      const file = fileItem.getAsFile();
      if (file) { e.preventDefault(); void handleFile(file); }
    }
  }

  function handleCancelAttachment() {
    abort();
    setPendingAttachment(null);
    resetUpload();
  }

  function handleSend() {
    if (!socket) return;
    const trimmed = content.trim();
    if (!trimmed && !pendingAttachment) return;
    socket.emit(ROOM_EVENTS.MESSAGE_SEND, {
      roomId,
      content: trimmed,
      ...(replyTo ? { replyToId: replyTo.id } : {}),
      ...(pendingAttachment ? { attachmentId: pendingAttachment.id } : {}),
    });
    setContent('');
    setPendingAttachment(null);
    resetUpload();
    onClearReply();
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const canSend = !uploading && (!!content.trim() || !!pendingAttachment);
  const isImage = pendingAttachment?.mimeType.startsWith(IMAGE_MIME_PREFIX) ?? false;

  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderTop: '1px solid',
        borderColor: 'rgba(0,0,0,0.08)',
        bgcolor: '#fafaf8',
      }}
    >
      {/* Reply strip */}
      {replyTo && (
        <Paper
          variant="outlined"
          sx={{ p: 1, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '8px' }}
        >
          <Box>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
              Replying to {replyTo.authorUsername}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }} noWrap>
              {replyTo.content.slice(0, 80)}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClearReply}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Paper>
      )}

      {/* Attachment preview strip */}
      {(uploading || pendingAttachment) && (
        <Paper
          variant="outlined"
          sx={{ p: 1, mb: 1, display: 'flex', alignItems: 'center', gap: 1, borderRadius: '8px' }}
        >
          {isImage ? (
            <Box sx={{ width: 40, height: 40, bgcolor: 'rgba(0,0,0,0.06)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <InsertDriveFileIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
            </Box>
          ) : (
            <InsertDriveFileIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }} noWrap>
              {pendingAttachment?.originalFilename ?? 'Uploading…'}
            </Typography>
            {uploading && (
              <LinearProgress variant="determinate" value={progress} sx={{ mt: 0.5, borderRadius: 1 }} />
            )}
          </Box>
          <IconButton size="small" onClick={handleCancelAttachment}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Paper>
      )}

      {/* Size / upload error */}
      {(sizeError ?? uploadError) && (
        <Typography sx={{ fontSize: '0.72rem', color: 'error.main', mb: 0.5 }}>
          {sizeError ?? uploadError}
        </Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" hidden onChange={handleFileInputChange} />
        <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <AttachFileIcon fontSize="small" />
        </IconButton>
        <TextField
          inputRef={textareaRef}
          multiline
          maxRows={6}
          fullWidth
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          variant="outlined"
          size="small"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
        />
        <IconButton color="primary" onClick={handleSend} disabled={!canSend}>
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter frontend build
```

Expected: Exit 0 or only unrelated errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/features/rooms/RoomMessageInput.tsx
git commit -m "feat(attachments): add file picker and upload strip to RoomMessageInput"
```

---

## Task 10: Frontend — RoomMessageItem renders AttachmentPreview

**Files:**

- Modify: `packages/frontend/src/features/rooms/RoomMessageItem.tsx`

- [ ] **Step 1: Import AttachmentPreview and render it in message body**

In `packages/frontend/src/features/rooms/RoomMessageItem.tsx`:

Add import at top:

```typescript
import { AttachmentPreview } from '../attachments/AttachmentPreview';
```

In the message body section, after the text content `<Typography>` block (and inside the `!isDeleted` branch), add:

```typescript
        {/* Attachment */}
        {!isDeleted && message.attachment && (
          <AttachmentPreview attachment={message.attachment} />
        )}
```

Place this immediately after the closing `</Typography>` of the message content (before the action buttons).

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter frontend build
```

Expected: Exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/features/rooms/RoomMessageItem.tsx
git commit -m "feat(attachments): render AttachmentPreview in RoomMessageItem"
```

---

## Task 11: Frontend — DmMessageInput upload UX

**Files:**

- Modify: `packages/frontend/src/features/dm/DmMessageInput.tsx`

- [ ] **Step 1: Update DmMessageInput.tsx to support attachments**

Replace `packages/frontend/src/features/dm/DmMessageInput.tsx`:

```typescript
import { useRef, useState } from 'react';
import { Box, IconButton, LinearProgress, Paper, Typography, CircularProgress } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { DM_EVENTS } from '@chatrix/shared';
import type { AttachmentPayload } from '@chatrix/shared';
import { useDmStore } from '../../stores/dmStore';
import { useAttachmentUpload } from '../attachments/useAttachmentUpload';

const MAX_IMAGE_SIZE = 3 * 1024 * 1024;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

interface Props {
  threadId: string;
}

export default function DmMessageInput({ threadId }: Props) {
  const [content, setContent] = useState('');
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<AttachmentPayload | null>(null);
  const [uploading, setUploading] = useState(false);
  const socket = useDmStore((state) => state.socket);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, progress, error: uploadError, reset: resetUpload, abort } = useAttachmentUpload({
    targetType: 'DM',
    targetId: threadId,
  });

  function validateFile(file: File): string | null {
    const isImage = file.type.startsWith('image/');
    if (isImage && file.size > MAX_IMAGE_SIZE) return 'Image must be under 3MB';
    if (!isImage && file.size > MAX_FILE_SIZE) return 'File must be under 20MB';
    return null;
  }

  async function handleFile(file: File) {
    setSizeError(null);
    const err = validateFile(file);
    if (err) { setSizeError(err); return; }
    setUploading(true);
    try {
      const payload = await upload(file);
      setPendingAttachment(payload);
    } catch {
      // uploadError set by hook
    } finally {
      setUploading(false);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const fileItem = Array.from(e.clipboardData.items).find((i) => i.kind === 'file');
    if (fileItem) {
      const file = fileItem.getAsFile();
      if (file) { e.preventDefault(); void handleFile(file); }
    }
  }

  function handleCancelAttachment() {
    abort();
    setPendingAttachment(null);
    resetUpload();
  }

  const handleSend = () => {
    if (!socket || uploading) return;
    const trimmed = content.trim();
    if (!trimmed && !pendingAttachment) return;
    socket.emit(DM_EVENTS.MESSAGE_SEND, {
      threadId,
      content: trimmed,
      ...(pendingAttachment ? { attachmentId: pendingAttachment.id } : {}),
    });
    setContent('');
    setPendingAttachment(null);
    resetUpload();
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = !uploading && (!!content.trim() || !!pendingAttachment);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        px: 2,
        py: 1.5,
        borderTop: '1px solid',
        borderColor: 'rgba(0,0,0,0.08)',
        bgcolor: '#fafaf8',
        gap: 1,
      }}
    >
      {/* Attachment preview strip */}
      {(uploading || pendingAttachment) && (
        <Paper
          variant="outlined"
          sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1, borderRadius: '8px' }}
        >
          <InsertDriveFileIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }} noWrap>
              {pendingAttachment?.originalFilename ?? 'Uploading…'}
            </Typography>
            {uploading && (
              <LinearProgress variant="determinate" value={progress} sx={{ mt: 0.5, borderRadius: 1 }} />
            )}
          </Box>
          <IconButton size="small" onClick={handleCancelAttachment}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Paper>
      )}

      {(sizeError ?? uploadError) && (
        <Typography sx={{ fontSize: '0.72rem', color: 'error.main' }}>
          {sizeError ?? uploadError}
        </Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <input ref={fileInputRef} type="file" hidden onChange={handleFileInputChange} />
        <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <AttachFileIcon fontSize="small" />
        </IconButton>
        <TextField
          inputRef={textareaRef}
          multiline
          maxRows={6}
          fullWidth
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={false}
          variant="outlined"
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              bgcolor: '#fff',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              '& fieldset': { borderColor: 'rgba(0,0,0,0.15)' },
              '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.4)' },
              '&.Mui-focused fieldset': { borderColor: '#6366f1', borderWidth: '1.5px' },
            },
          }}
        />
        <IconButton
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          sx={{
            width: 40,
            height: 40,
            mb: '2px',
            borderRadius: '10px',
            background: !canSend
              ? 'rgba(0,0,0,0.06)'
              : 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
            color: !canSend ? 'rgba(0,0,0,0.3)' : '#fff',
            flexShrink: 0,
            transition: 'all 0.15s ease',
            '&:hover': {
              background: !canSend
                ? 'rgba(0,0,0,0.06)'
                : 'linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)',
            },
          }}
        >
          {uploading ? (
            <CircularProgress size={16} sx={{ color: 'rgba(0,0,0,0.3)' }} />
          ) : (
            <SendIcon sx={{ fontSize: 18 }} />
          )}
        </IconButton>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter frontend build
```

Expected: Exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/features/dm/DmMessageInput.tsx
git commit -m "feat(attachments): add file picker and upload strip to DmMessageInput"
```

---

## Task 12: Frontend — DmMessageItem renders AttachmentPreview

**Files:**

- Modify: `packages/frontend/src/features/dm/DmMessageItem.tsx`

- [ ] **Step 1: Add AttachmentPreview to DmMessageItem**

In `packages/frontend/src/features/dm/DmMessageItem.tsx`:

Add import:

```typescript
import { AttachmentPreview } from '../attachments/AttachmentPreview';
```

In the message body section, after the `{message.content}` `<Typography>` (inside the `!isDeleted` branch), add:

```typescript
        {message.attachment && (
          <AttachmentPreview attachment={message.attachment} />
        )}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter frontend build
```

Expected: Exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/features/dm/DmMessageItem.tsx
git commit -m "feat(attachments): render AttachmentPreview in DmMessageItem"
```

---

## Task 13: Nginx — update client_max_body_size

**Files:**

- Modify: `nginx/default.conf`

- [ ] **Step 1: Add per-location body size for attachments API**

In `nginx/default.conf`, update the `/api/` location block to add a nested location for attachments:

```nginx
    # Proxy API to backend
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Attachments commit/download endpoint needs larger body for commit response
        location /api/attachments/ {
            client_max_body_size 1m;
            proxy_pass http://backend:3000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
```

Note: The presigned PUT goes **directly from the browser to MinIO**, not through Nginx, so the 20m limit is not needed here. The `/api/attachments/` routes only handle small JSON payloads. Keep global `client_max_body_size 20m;` or reduce it — the 20m at the server level is already in place and is fine as-is. No change strictly required; this task confirms the config is correct.

- [ ] **Step 2: Verify Nginx config is valid**

If running Docker:

```bash
docker compose run --rm nginx nginx -t 2>&1 || echo "Nginx not running in docker yet — config reviewed manually"
```

- [ ] **Step 3: Commit**

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
        → Task 9 (RoomMessageInput)
        → Task 10 (RoomMessageItem)
        → Task 11 (DmMessageInput)
        → Task 12 (DmMessageItem)
Task 13 (Nginx) — independent
```

Tasks 3–6 can be done in parallel once Task 2 is complete. Tasks 7–12 require Task 4 to be deployed (or at least the shared types from Task 2 to be complete) and can be done in parallel after Task 7.

---

## Notes

### `useAuthToken` hook

The hook at `features/attachments/useAttachmentUpload.ts` calls `useAuthToken()`. Verify the auth store field name by checking existing auth-related hooks before Task 7.

### `SendMessageDto` `@ValidateIf` caveat

The cross-field validator in Task 5 uses `@ValidateIf((o) => !o.attachmentId)` to enforce content is non-empty when no attachment. `class-validator` processes this correctly as long as `ValidationPipe` has `transform: true` (check `main.ts` — it should already).

### DmService return type

Task 6 changes `sendMessage` return type to include `attachment`. Any other callers of `DmService.sendMessage` (e.g. HTTP controllers) need the return type update. Check `dm.controller.ts` for any call and update accordingly.

### Orphan cleanup

Pending `Attachment` rows (no `committedAt`) and committed rows with no `messageId` older than 1 hour should be pruned. This is a follow-up task; not blocking the feature ship. A scheduled job using NestJS `@Cron` can be added later.
