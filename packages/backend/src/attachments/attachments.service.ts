import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import type { AttachmentPayload } from '@chatrix/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipService } from '../friendship/friendship.service';
import type { AppConfig } from '../config/config.schema';
import type { Readable } from 'stream';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/zip',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// ---------------------------------------------------------------------------
// DTO types
// ---------------------------------------------------------------------------

export interface RequestUploadDto {
  targetType: 'ROOM' | 'DM';
  roomId?: string;
  dmThreadId?: string;
  originalFilename: string;
  mimeType: string;
  size: number;
}

export interface RequestUploadResult {
  attachmentId: string;
  presignedUrl: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AttachmentsService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly friendshipService: FriendshipService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    const endpoint = this.config.get('MINIO_ENDPOINT', { infer: true });
    const port = this.config.get('MINIO_PORT', { infer: true });
    const accessKeyId = this.config.get('MINIO_ACCESS_KEY', { infer: true });
    const secretAccessKey = this.config.get('MINIO_SECRET_KEY', { infer: true });
    const useSsl = this.config.get('MINIO_USE_SSL', { infer: true });

    this.bucket = this.config.get('MINIO_BUCKET', { infer: true });

    this.s3 = new S3Client({
      endpoint: `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`,
      region: 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public methods
  // ─────────────────────────────────────────────────────────────────────────

  async requestUploadUrl(userId: string, dto: RequestUploadDto): Promise<RequestUploadResult> {
    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(dto.mimeType)) {
      throw new BadRequestException(`MIME type "${dto.mimeType}" is not allowed`);
    }

    // Validate size limits
    const isImage = dto.mimeType.startsWith('image/');
    const limit = isImage ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
    if (dto.size > limit) {
      const limitMb = limit / (1024 * 1024);
      throw new BadRequestException(
        `File exceeds the ${limitMb}MB limit for ${isImage ? 'images' : 'files'}`,
      );
    }

    // Assert access (room or DM)
    await this.assertAccess(dto.targetType, dto.roomId, dto.dmThreadId, userId);

    // Generate a unique object key
    const ext = dto.originalFilename.includes('.') ? dto.originalFilename.split('.').pop() : 'bin';
    const objectKey = `uploads/${randomUUID()}.${ext}`;

    // Create Attachment row in DB (uncommitted)
    const attachment = await this.prisma.attachment.create({
      data: {
        uploaderId: userId,
        targetType: dto.targetType,
        roomId: dto.roomId ?? null,
        dmThreadId: dto.dmThreadId ?? null,
        objectKey,
        originalFilename: dto.originalFilename,
        mimeType: dto.mimeType,
        size: BigInt(dto.size),
      },
    });

    // Issue presigned PUT URL (5 min TTL)
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: dto.mimeType,
      ContentLength: dto.size,
    });
    const presignedUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });

    return { attachmentId: attachment.id, presignedUrl };
  }

  async commitUpload(userId: string, attachmentId: string): Promise<AttachmentPayload> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    if (attachment.uploaderId !== userId) {
      throw new ForbiddenException('You can only commit your own uploads');
    }

    // Verify object exists in MinIO
    await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: attachment.objectKey }));

    // Magic-bytes MIME validation (ESM-only file-type imported dynamically)
    const objectResponse = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: attachment.objectKey }),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ESM dynamic import
    let detectedMime: string | undefined;
    try {
      const stream = objectResponse.Body as Readable;
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      const buffer = Buffer.concat(chunks);

      // file-type v22 is ESM-only; dynamic import() at runtime works even from CJS.
      // TypeScript's CommonJS resolver rejects the bare specifier at compile time,
      // so we use a string variable to bypass the static analysis.
      const fileTypeModule = 'file-type';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ESM interop bypass
      const { fileTypeFromBuffer } = (await import(
        /* webpackIgnore: true */ fileTypeModule
      )) as any;
      const result = await fileTypeFromBuffer(buffer);
      detectedMime = result?.mime;

      // Process thumbnail for non-gif images using sharp
      let thumbnailKey: string | null = null;
      if (detectedMime && IMAGE_MIME_TYPES.has(detectedMime)) {
        try {
          const sharp = (await import('sharp')).default;
          const stripped = await sharp(buffer)
            .withMetadata({ exif: {} }) // strip EXIF
            .toBuffer();

          const thumbnail = await sharp(stripped)
            .resize(200, 200, { fit: 'inside' })
            .jpeg()
            .toBuffer();

          thumbnailKey = `thumbnails/${attachment.objectKey}`;
          await this.s3.send(
            new PutObjectCommand({
              Bucket: this.bucket,
              Key: thumbnailKey,
              Body: thumbnail,
              ContentType: 'image/jpeg',
            }),
          );
        } catch {
          // Thumbnail generation failure is non-fatal
          thumbnailKey = null;
        }
      }

      // Update the attachment row
      const updated = await this.prisma.attachment.update({
        where: { id: attachmentId },
        data: {
          committedAt: new Date(),
          ...(thumbnailKey ? { thumbnailKey } : {}),
        },
      });

      return {
        id: updated.id,
        originalFilename: updated.originalFilename,
        mimeType: updated.mimeType,
        size: Number(updated.size),
        thumbnailAvailable: !!updated.thumbnailKey,
      };
    } catch (err) {
      if (err instanceof ForbiddenException || err instanceof NotFoundException) {
        throw err;
      }
      // Re-throw S3 errors or other failures
      throw err;
    }
  }

  async getDownloadUrl(
    userId: string,
    attachmentId: string,
  ): Promise<{ url: string; thumbnailUrl?: string }> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Assert access
    await this.assertAccess(
      attachment.targetType,
      attachment.roomId ?? undefined,
      attachment.dmThreadId ?? undefined,
      userId,
    );

    // Presigned GET (60s TTL)
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: attachment.objectKey,
    });
    const url = await getSignedUrl(this.s3, command, { expiresIn: 60 });

    let thumbnailUrl: string | undefined;
    if (attachment.thumbnailKey) {
      const thumbCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: attachment.thumbnailKey,
      });
      thumbnailUrl = await getSignedUrl(this.s3, thumbCommand, { expiresIn: 60 });
    }

    return { url, ...(thumbnailUrl ? { thumbnailUrl } : {}) };
  }

  async deleteAttachmentsByRoom(roomId: string): Promise<void> {
    const attachments = await this.prisma.attachment.findMany({
      where: { roomId },
    });
    await this.deleteMinioObjects(attachments.map((a) => a.objectKey));
    await this.prisma.attachment.deleteMany({ where: { roomId } });
  }

  async deleteAttachmentsByThread(dmThreadId: string): Promise<void> {
    const attachments = await this.prisma.attachment.findMany({
      where: { dmThreadId },
    });
    await this.deleteMinioObjects(attachments.map((a) => a.objectKey));
    await this.prisma.attachment.deleteMany({ where: { dmThreadId } });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async assertRoomAccess(roomId: string, userId: string): Promise<void> {
    const membership = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this room');
    }
    const ban = await this.prisma.roomBan.findFirst({
      where: { roomId, userId, liftedAt: null },
    });
    if (ban) {
      throw new ForbiddenException('You are banned from this room');
    }
  }

  private async assertDmAccess(dmThreadId: string, userId: string): Promise<void> {
    const thread = await this.prisma.directMessageThread.findFirst({
      where: {
        id: dmThreadId,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
    });
    if (!thread) {
      throw new ForbiddenException('Not a participant of this DM thread');
    }
  }

  private async assertAccess(
    targetType: string,
    roomId: string | undefined,
    dmThreadId: string | undefined,
    userId: string,
  ): Promise<void> {
    if (targetType === 'ROOM') {
      if (!roomId) throw new BadRequestException('roomId is required for ROOM attachments');
      await this.assertRoomAccess(roomId, userId);
    } else {
      if (!dmThreadId) throw new BadRequestException('dmThreadId is required for DM attachments');
      await this.assertDmAccess(dmThreadId, userId);
    }
  }

  private async deleteMinioObjects(objectKeys: string[]): Promise<void> {
    if (objectKeys.length === 0) return;

    const objects = objectKeys.map((key) => ({ Key: key }));
    await this.s3.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: objects },
      }),
    );
  }
}
