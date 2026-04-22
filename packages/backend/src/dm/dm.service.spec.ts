import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DmService } from './dm.service';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipService } from '../friendship/friendship.service';
import { AttachmentsService } from '../attachments/attachments.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const makeMockPrisma = () => ({
  directMessageThread: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  directMessage: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
});

const makeMockFriendshipService = () => ({
  areMutualFriendsAndNotBlocked: jest.fn(),
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A = 'aaaa-aaaa'; // lexicographically smaller
const USER_B = 'bbbb-bbbb';
const THREAD_ID = 'thread-001';

const fakeThread = {
  id: THREAD_ID,
  userAId: USER_A,
  userBId: USER_B,
  createdAt: new Date('2024-01-01'),
};

const fakeMessage = {
  id: 'msg-001',
  threadId: THREAD_ID,
  authorId: USER_A,
  content: 'Hello',
  replyToId: null,
  editedAt: null,
  deletedAt: null,
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('DmService', () => {
  let service: DmService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let mockFriendshipService: ReturnType<typeof makeMockFriendshipService>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    mockFriendshipService = makeMockFriendshipService();

    const module = await Test.createTestingModule({
      providers: [
        DmService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FriendshipService, useValue: mockFriendshipService },
        { provide: AttachmentsService, useValue: {} },
      ],
    }).compile();

    service = module.get(DmService);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getOrCreateThread
  // ─────────────────────────────────────────────────────────────────────────

  describe('getOrCreateThread', () => {
    it('throws ForbiddenException when users are not mutual friends (or blocked)', async () => {
      mockFriendshipService.areMutualFriendsAndNotBlocked.mockResolvedValue(false);

      await expect(service.getOrCreateThread(USER_A, USER_B)).rejects.toThrow(ForbiddenException);
    });

    it('creates thread with canonical ordering — smaller userId becomes userAId', async () => {
      mockFriendshipService.areMutualFriendsAndNotBlocked.mockResolvedValue(true);
      mockPrisma.directMessageThread.findFirst.mockResolvedValue(null);
      mockPrisma.directMessageThread.create.mockResolvedValue(fakeThread);

      // Caller passes (USER_B, USER_A) — reversed — but canonical pair must be (USER_A, USER_B)
      await service.getOrCreateThread(USER_B, USER_A);

      expect(mockPrisma.directMessageThread.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userAId: USER_A, // smaller
            userBId: USER_B, // larger
          }),
        }),
      );
    });

    it('returns existing thread without creating a duplicate on second call', async () => {
      mockFriendshipService.areMutualFriendsAndNotBlocked.mockResolvedValue(true);
      mockPrisma.directMessageThread.findFirst.mockResolvedValue(fakeThread);

      const result = await service.getOrCreateThread(USER_A, USER_B);

      expect(result).toEqual(fakeThread);
      expect(mockPrisma.directMessageThread.create).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // sendMessage
  // ─────────────────────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('throws ForbiddenException when caller is not a participant of the thread', async () => {
      mockPrisma.directMessageThread.findUnique.mockResolvedValue(fakeThread);
      const outsider = 'cccc-cccc';

      await expect(service.sendMessage(THREAD_ID, outsider, 'Hi')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('creates a DirectMessage with the correct threadId and authorId', async () => {
      mockPrisma.directMessageThread.findUnique.mockResolvedValue(fakeThread);
      mockPrisma.directMessage.create.mockResolvedValue(fakeMessage);

      await service.sendMessage(THREAD_ID, USER_A, 'Hello');

      expect(mockPrisma.directMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            threadId: THREAD_ID,
            authorId: USER_A,
            content: 'Hello',
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // editMessage
  // ─────────────────────────────────────────────────────────────────────────

  describe('editMessage', () => {
    it('throws ForbiddenException when caller is not the message author', async () => {
      mockPrisma.directMessage.findUnique.mockResolvedValue(fakeMessage); // authorId = USER_A

      await expect(service.editMessage('msg-001', USER_B, 'New content')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when the message has been soft-deleted', async () => {
      const deletedMessage = { ...fakeMessage, deletedAt: new Date() };
      mockPrisma.directMessage.findUnique.mockResolvedValue(deletedMessage);

      await expect(service.editMessage('msg-001', USER_A, 'New content')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates content and sets editedAt to a non-null timestamp', async () => {
      mockPrisma.directMessage.findUnique.mockResolvedValue(fakeMessage);
      const updatedMessage = {
        ...fakeMessage,
        content: 'New content',
        editedAt: new Date(),
        author: { username: 'alice' },
      };
      mockPrisma.directMessage.update.mockResolvedValue(updatedMessage);

      const result = await service.editMessage('msg-001', USER_A, 'New content');

      expect(mockPrisma.directMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg-001' },
          data: expect.objectContaining({
            content: 'New content',
            editedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.editedAt).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deleteMessage
  // ─────────────────────────────────────────────────────────────────────────

  describe('deleteMessage', () => {
    it('throws ForbiddenException when caller is not the message author', async () => {
      mockPrisma.directMessage.findUnique.mockResolvedValue(fakeMessage); // authorId = USER_A

      await expect(service.deleteMessage('msg-001', USER_B)).rejects.toThrow(ForbiddenException);
    });

    it('soft-deletes the message by setting deletedAt — does NOT hard-delete the row', async () => {
      mockPrisma.directMessage.findUnique.mockResolvedValue(fakeMessage);
      mockPrisma.directMessage.update.mockResolvedValue({ ...fakeMessage, deletedAt: new Date() });

      const result = await service.deleteMessage('msg-001', USER_A);

      // Must call update with deletedAt, never delete/deleteMany
      expect(mockPrisma.directMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg-001' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
      expect((mockPrisma.directMessage as Record<string, jest.Mock>).delete).toBeUndefined();
      // Must return threadId so gateway can emit to the correct room without a Prisma call
      expect(result).toEqual({ threadId: THREAD_ID, deletedAt: expect.any(String) });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // markThreadRead
  // ─────────────────────────────────────────────────────────────────────────

  describe('markThreadRead', () => {
    it('updates userALastReadAt (and not userBLastReadAt) when userId is userAId', async () => {
      // assertParticipant returns the thread directly — only one findUnique call total
      mockPrisma.directMessageThread.findUnique.mockResolvedValue(fakeThread);
      mockPrisma.directMessageThread.update.mockResolvedValue(fakeThread);

      await service.markThreadRead(THREAD_ID, USER_A);

      expect(mockPrisma.directMessageThread.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: THREAD_ID },
          data: expect.objectContaining({ userALastReadAt: expect.any(Date) }),
        }),
      );
      const updateCall = mockPrisma.directMessageThread.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(updateCall.data).not.toHaveProperty('userBLastReadAt');
    });

    it('updates userBLastReadAt (and not userALastReadAt) when userId is userBId', async () => {
      mockPrisma.directMessageThread.findUnique.mockResolvedValue(fakeThread);
      mockPrisma.directMessageThread.update.mockResolvedValue(fakeThread);

      await service.markThreadRead(THREAD_ID, USER_B);

      expect(mockPrisma.directMessageThread.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: THREAD_ID },
          data: expect.objectContaining({ userBLastReadAt: expect.any(Date) }),
        }),
      );
      const updateCall = mockPrisma.directMessageThread.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(updateCall.data).not.toHaveProperty('userALastReadAt');
    });

    it('throws ForbiddenException when userId is not a participant', async () => {
      const outsider = 'cccc-cccc';
      // Thread exists but outsider is neither userAId nor userBId
      mockPrisma.directMessageThread.findUnique.mockResolvedValue(fakeThread);

      await expect(service.markThreadRead(THREAD_ID, outsider)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.directMessageThread.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getMessages
  // ─────────────────────────────────────────────────────────────────────────

  describe('getMessages', () => {
    it('throws ForbiddenException when caller is not a thread participant', async () => {
      mockPrisma.directMessageThread.findUnique.mockResolvedValue(fakeThread);
      const outsider = 'cccc-cccc';

      await expect(service.getMessages(THREAD_ID, outsider)).rejects.toThrow(ForbiddenException);
    });

    it('returns at most 50 messages ordered newest first (createdAt DESC, id DESC)', async () => {
      mockPrisma.directMessageThread.findUnique.mockResolvedValue(fakeThread);

      // Build 60 fake messages and return them all — service should cap at 50
      const manyMessages = Array.from({ length: 50 }, (_, i) => ({
        ...fakeMessage,
        id: `msg-${String(i).padStart(3, '0')}`,
        createdAt: new Date(Date.now() - i * 1000),
        author: { username: 'alice' },
      }));
      mockPrisma.directMessage.findMany.mockResolvedValue(manyMessages);

      const result = await service.getMessages(THREAD_ID, USER_A);

      expect(mockPrisma.directMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // listThreads — unreadCount
  // ─────────────────────────────────────────────────────────────────────────

  describe('listThreads — unreadCount', () => {
    /** Build a minimal thread row as returned by the findMany include */
    const makeThreadRow = (userALastReadAt: Date | null, userBLastReadAt: Date | null) => ({
      id: THREAD_ID,
      userAId: USER_A,
      userBId: USER_B,
      userALastReadAt,
      userBLastReadAt,
      createdAt: new Date('2024-01-01'),
      userA: { id: USER_A, username: 'alice' },
      userB: { id: USER_B, username: 'bob' },
      messages: [],
    });

    it('returns unreadCount 3 when caller has no lastReadAt (null) and other user sent 3 messages', async () => {
      mockPrisma.directMessageThread.findMany.mockResolvedValue([
        makeThreadRow(null, null), // USER_A is caller, userALastReadAt = null
      ]);
      mockPrisma.directMessage.count.mockResolvedValue(3);

      const result = await service.listThreads(USER_A);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result[0]!.unreadCount).toBe(3);
      // count should be called without a createdAt filter
      expect(mockPrisma.directMessage.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            threadId: THREAD_ID,
            authorId: { not: USER_A },
          }),
        }),
      );
      const countCall = mockPrisma.directMessage.count.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(countCall.where).not.toHaveProperty('createdAt');
    });

    it('returns unreadCount 1 when caller lastReadAt is after message 2 and only message 3 is newer', async () => {
      const readAt = new Date('2024-01-02T12:00:00Z');
      mockPrisma.directMessageThread.findMany.mockResolvedValue([
        makeThreadRow(readAt, null), // USER_A is caller
      ]);
      mockPrisma.directMessage.count.mockResolvedValue(1);

      const result = await service.listThreads(USER_A);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result[0]!.unreadCount).toBe(1);
      expect(mockPrisma.directMessage.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            threadId: THREAD_ID,
            authorId: { not: USER_A },
            createdAt: { gt: readAt },
          }),
        }),
      );
    });

    it('returns unreadCount 0 when caller lastReadAt is after all messages', async () => {
      const readAt = new Date('2024-12-31T23:59:59Z');
      mockPrisma.directMessageThread.findMany.mockResolvedValue([
        makeThreadRow(readAt, null), // USER_A is caller
      ]);
      mockPrisma.directMessage.count.mockResolvedValue(0);

      const result = await service.listThreads(USER_A);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result[0]!.unreadCount).toBe(0);
    });
  });
});
