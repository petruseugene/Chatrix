import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentsService } from './attachments.service';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipService } from '../friendship/friendship.service';

// ---------------------------------------------------------------------------
// Mock external modules
// ---------------------------------------------------------------------------

jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn();
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    HeadObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    DeleteObjectsCommand: jest.fn().mockImplementation((input) => ({ input })),
    __mockSend: mockSend,
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://minio.example.com/presigned-url'),
}));

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn().mockResolvedValue({ mime: 'image/jpeg', ext: 'jpg' }),
}));

jest.mock('sharp', () => {
  const sharpInstance = {
    withMetadata: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('stripped-image-data')),
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
  };
  return jest.fn().mockReturnValue(sharpInstance);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeMockPrisma = () => ({
  roomMembership: {
    findUnique: jest.fn(),
  },
  roomBan: {
    findFirst: jest.fn(),
  },
  directMessageThread: {
    findFirst: jest.fn(),
  },
  attachment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
});

const makeMockFriendship = () => ({
  areMutualFriendsAndNotBlocked: jest.fn(),
});

const makeMockConfig = () => ({
  get: jest.fn((key: string) => {
    const map: Record<string, unknown> = {
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: 9000,
      MINIO_ACCESS_KEY: 'minioaccess',
      MINIO_SECRET_KEY: 'miniosecret',
      MINIO_BUCKET: 'chatrix',
      MINIO_USE_SSL: false,
    };
    return map[key];
  }),
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-001';
const OTHER_USER_ID = 'user-002';
const ROOM_ID = 'room-001';
const _DM_THREAD_ID = 'dm-thread-001';
const ATTACHMENT_ID = 'att-001';

const fakeAttachment = (overrides: Record<string, unknown> = {}) => ({
  id: ATTACHMENT_ID,
  uploaderId: USER_ID,
  targetType: 'ROOM' as const,
  roomId: ROOM_ID,
  dmThreadId: null,
  objectKey: 'uploads/some-object-key.jpg',
  thumbnailKey: null,
  originalFilename: 'photo.jpg',
  mimeType: 'image/jpeg',
  size: BigInt(1024 * 1024),
  committedAt: null,
  createdAt: new Date(),
  ...overrides,
});

const fakeRoomMembership = () => ({
  id: 'mem-001',
  roomId: ROOM_ID,
  userId: USER_ID,
  role: 'MEMBER',
  joinedAt: new Date(),
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let mockFriendship: ReturnType<typeof makeMockFriendship>;
  let mockConfig: ReturnType<typeof makeMockConfig>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only mock access
  let mockSend: jest.Mock;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    mockFriendship = makeMockFriendship();
    mockConfig = makeMockConfig();

    // Get reference to the shared mock send function
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any -- test-only
    mockSend = (require('@aws-sdk/client-s3') as any).__mockSend;
    mockSend.mockReset();
    mockSend.mockResolvedValue({});

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

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // requestUploadUrl
  // ─────────────────────────────────────────────────────────────────────────

  describe('requestUploadUrl', () => {
    it('throws ForbiddenException when user is not a room member', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue(null);
      mockPrisma.roomBan.findFirst.mockResolvedValue(null);

      await expect(
        service.requestUploadUrl(USER_ID, {
          targetType: 'ROOM',
          roomId: ROOM_ID,
          originalFilename: 'photo.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when image exceeds 3MB', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue(fakeRoomMembership());
      mockPrisma.roomBan.findFirst.mockResolvedValue(null);

      const threeMbPlus = 3 * 1024 * 1024 + 1;
      await expect(
        service.requestUploadUrl(USER_ID, {
          targetType: 'ROOM',
          roomId: ROOM_ID,
          originalFilename: 'big-photo.jpg',
          mimeType: 'image/jpeg',
          size: threeMbPlus,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for disallowed MIME type', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue(fakeRoomMembership());
      mockPrisma.roomBan.findFirst.mockResolvedValue(null);

      await expect(
        service.requestUploadUrl(USER_ID, {
          targetType: 'ROOM',
          roomId: ROOM_ID,
          originalFilename: 'script.exe',
          mimeType: 'application/octet-stream',
          size: 512,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns { attachmentId, presignedUrl } for a valid room upload', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue(fakeRoomMembership());
      mockPrisma.roomBan.findFirst.mockResolvedValue(null);
      mockPrisma.attachment.create.mockResolvedValue(fakeAttachment());

      const result = await service.requestUploadUrl(USER_ID, {
        targetType: 'ROOM',
        roomId: ROOM_ID,
        originalFilename: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
      });

      expect(result).toHaveProperty('attachmentId');
      expect(result).toHaveProperty('presignedUrl');
      expect(typeof result.presignedUrl).toBe('string');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // commitUpload
  // ─────────────────────────────────────────────────────────────────────────

  describe('commitUpload', () => {
    it('throws NotFoundException when attachment not found', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(null);

      await expect(service.commitUpload(USER_ID, ATTACHMENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the uploader', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(
        fakeAttachment({ uploaderId: OTHER_USER_ID }),
      );

      await expect(service.commitUpload(USER_ID, ATTACHMENT_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getDownloadUrl
  // ─────────────────────────────────────────────────────────────────────────

  describe('getDownloadUrl', () => {
    it('throws ForbiddenException when user is not a room member', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(fakeAttachment());
      mockPrisma.roomMembership.findUnique.mockResolvedValue(null);
      mockPrisma.roomBan.findFirst.mockResolvedValue(null);

      await expect(service.getDownloadUrl(USER_ID, ATTACHMENT_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns { url } for a valid room member', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(
        fakeAttachment({ committedAt: new Date() }),
      );
      mockPrisma.roomMembership.findUnique.mockResolvedValue(fakeRoomMembership());
      mockPrisma.roomBan.findFirst.mockResolvedValue(null);

      const result = await service.getDownloadUrl(USER_ID, ATTACHMENT_ID);

      expect(result).toHaveProperty('url');
      expect(typeof result.url).toBe('string');
    });
  });
});
