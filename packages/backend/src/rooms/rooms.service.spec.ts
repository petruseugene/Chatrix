import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';

const mockAttachmentsService = {
  deleteAttachmentsByRoom: jest.fn(),
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const makeMockPrisma = () => ({
  room: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  roomMembership: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  roomBan: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  roomMessage: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  reaction: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROOM_ID = 'room-001';
const USER_ID = 'user-001';
const TARGET_ID = 'user-002';

const fakeMembership = (role: 'OWNER' | 'ADMIN' | 'MEMBER') => ({
  id: 'mem-001',
  roomId: ROOM_ID,
  userId: USER_ID,
  role,
  joinedAt: new Date(),
});

const fakeTargetMembership = (role: 'OWNER' | 'ADMIN' | 'MEMBER') => ({
  id: 'mem-002',
  roomId: ROOM_ID,
  userId: TARGET_ID,
  role,
  joinedAt: new Date(),
  user: { username: 'bob' },
});

const fakeRoom = (overrides: Record<string, unknown> = {}) => ({
  id: ROOM_ID,
  name: 'test-room',
  description: '',
  isPrivate: false,
  ownerId: USER_ID,
  createdAt: new Date(),
  ...overrides,
});

const fakeMessage = () => ({
  id: 'msg-001',
  roomId: ROOM_ID,
  authorId: USER_ID,
  content: 'Hello',
  replyToId: null,
  editedAt: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  author: { username: 'alice' },
  replyTo: null,
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('RoomsService', () => {
  let service: RoomsService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AttachmentsService, useValue: mockAttachmentsService },
      ],
    }).compile();

    service = module.get(RoomsService);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createRoom
  // ─────────────────────────────────────────────────────────────────────────

  describe('createRoom', () => {
    it('happy path — returns room summary with myRole OWNER', async () => {
      const room = fakeRoom();
      const membership = fakeMembership('OWNER');

      // $transaction receives a callback — invoke it with the mock as tx
      mockPrisma.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
      );
      mockPrisma.room.create.mockResolvedValue(room);
      mockPrisma.roomMembership.create.mockResolvedValue(membership);

      const result = await service.createRoom(USER_ID, { name: 'test-room' });

      expect(result.myRole).toBe('OWNER');
      expect(result.name).toBe('test-room');
      expect(result.memberCount).toBe(1);
    });

    it('duplicate name — throws ConflictException on P2002', async () => {
      mockPrisma.$transaction.mockRejectedValue(
        new PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: {},
        }),
      );

      await expect(service.createRoom(USER_ID, { name: 'test-room' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // joinRoom
  // ─────────────────────────────────────────────────────────────────────────

  describe('joinRoom', () => {
    it('banned user — throws ForbiddenException', async () => {
      mockPrisma.room.findUnique.mockResolvedValue(fakeRoom());
      mockPrisma.roomBan.findFirst.mockResolvedValue({ id: 'ban1', liftedAt: null });

      await expect(service.joinRoom(ROOM_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('already member — throws ConflictException', async () => {
      mockPrisma.room.findUnique.mockResolvedValue(fakeRoom());
      mockPrisma.roomBan.findFirst.mockResolvedValue(null);
      mockPrisma.roomMembership.findUnique.mockResolvedValue(fakeMembership('MEMBER'));

      await expect(service.joinRoom(ROOM_ID, USER_ID)).rejects.toThrow(ConflictException);
    });

    it('private room — throws ForbiddenException', async () => {
      mockPrisma.room.findUnique.mockResolvedValue(fakeRoom({ isPrivate: true }));

      await expect(service.joinRoom(ROOM_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // leaveRoom
  // ─────────────────────────────────────────────────────────────────────────

  describe('leaveRoom', () => {
    it('owner cannot leave — throws ForbiddenException', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue(fakeMembership('OWNER'));

      await expect(service.leaveRoom(ROOM_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // kickMember
  // ─────────────────────────────────────────────────────────────────────────

  describe('kickMember', () => {
    it('admin cannot kick another admin — throws ForbiddenException', async () => {
      // getMembership is called twice via Promise.all
      mockPrisma.roomMembership.findUnique
        .mockResolvedValueOnce(fakeMembership('ADMIN')) // actor
        .mockResolvedValueOnce(fakeTargetMembership('ADMIN')); // target

      await expect(service.kickMember(ROOM_ID, USER_ID, TARGET_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('owner is unkickable by an admin — throws ForbiddenException', async () => {
      mockPrisma.roomMembership.findUnique
        .mockResolvedValueOnce(fakeMembership('ADMIN')) // actor
        .mockResolvedValueOnce(fakeTargetMembership('OWNER')); // target

      await expect(service.kickMember(ROOM_ID, USER_ID, TARGET_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // banUser
  // ─────────────────────────────────────────────────────────────────────────

  describe('banUser', () => {
    it('membership removed atomically — $transaction called', async () => {
      mockPrisma.roomMembership.findUnique
        .mockResolvedValueOnce(fakeMembership('OWNER')) // actor
        .mockResolvedValueOnce(fakeTargetMembership('MEMBER')); // target
      // Array form of $transaction
      mockPrisma.$transaction.mockResolvedValue([
        { id: 'ban1', roomId: ROOM_ID, userId: TARGET_ID, liftedAt: null },
        { count: 1 },
      ]);

      await service.banUser(ROOM_ID, USER_ID, TARGET_ID, 'breaking rules');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deleteRoom
  // ─────────────────────────────────────────────────────────────────────────

  describe('deleteRoom', () => {
    it('non-owner cannot delete — throws ForbiddenException', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue(fakeMembership('MEMBER'));

      await expect(service.deleteRoom(ROOM_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // setRole
  // ─────────────────────────────────────────────────────────────────────────

  describe('setRole', () => {
    it('non-owner cannot change roles — throws ForbiddenException', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue(fakeMembership('ADMIN'));

      await expect(service.setRole(ROOM_ID, USER_ID, TARGET_ID, 'MEMBER')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('cannot set OWNER role — throws ForbiddenException', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue(fakeMembership('OWNER'));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberate invalid role to test guard
      await expect(service.setRole(ROOM_ID, USER_ID, TARGET_ID, 'OWNER' as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // sendMessage
  // ─────────────────────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('non-member — throws ForbiddenException', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue(null);

      await expect(service.sendMessage(ROOM_ID, USER_ID, { content: 'Hello' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('banned user — throws ForbiddenException after membership check passes', async () => {
      // assertMember succeeds (membership found)
      mockPrisma.roomMembership.findUnique.mockResolvedValue(fakeMembership('MEMBER'));
      // assertNotBanned finds an active ban
      mockPrisma.roomBan.findFirst.mockResolvedValue({ id: 'ban1', liftedAt: null });

      await expect(service.sendMessage(ROOM_ID, USER_ID, { content: 'Hello' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getMessages
  // ─────────────────────────────────────────────────────────────────────────

  describe('getMessages', () => {
    it('returns cursor-paginated results with nextCursor null when fewer than 50 rows', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue(fakeMembership('MEMBER'));

      const rows = [fakeMessage(), fakeMessage(), fakeMessage()];
      // Give each row a distinct id so they are differentiable
      rows[0]!.id = 'msg-001';
      rows[1]!.id = 'msg-002';
      rows[2]!.id = 'msg-003';
      mockPrisma.roomMessage.findMany.mockResolvedValue(rows);

      const result = await service.getMessages(ROOM_ID, USER_ID);

      expect(result.messages).toHaveLength(3);
      expect(result.nextCursor).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // toggleRoomReaction
  // ─────────────────────────────────────────────────────────────────────────

  describe('toggleRoomReaction', () => {
    const MSG_ID = 'msg-001';
    const EMOJI = '👍';

    it('adds a new reaction when none exists', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue(fakeMembership('MEMBER'));
      mockPrisma.roomBan.findFirst.mockResolvedValue(null);
      mockPrisma.reaction.findUnique.mockResolvedValue(null);
      mockPrisma.reaction.create.mockResolvedValue({
        id: 'rxn1',
        emoji: EMOJI,
        userId: USER_ID,
        user: { id: USER_ID },
      });
      mockPrisma.reaction.findMany.mockResolvedValue([
        { id: 'rxn1', emoji: EMOJI, userId: USER_ID, user: { id: USER_ID } },
      ]);

      const result = await service.toggleRoomReaction(ROOM_ID, USER_ID, MSG_ID, EMOJI);

      expect(mockPrisma.reaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ emoji: EMOJI, userId: USER_ID, roomMessageId: MSG_ID }),
        }),
      );
      expect(result).toEqual([{ emoji: EMOJI, count: 1, userIds: [USER_ID] }]);
    });

    it('removes an existing reaction', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue(fakeMembership('MEMBER'));
      mockPrisma.roomBan.findFirst.mockResolvedValue(null);
      mockPrisma.reaction.findUnique.mockResolvedValue({
        id: 'rxn1',
        emoji: EMOJI,
        userId: USER_ID,
        user: { id: USER_ID },
      });
      mockPrisma.reaction.findMany.mockResolvedValue([]);

      const result = await service.toggleRoomReaction(ROOM_ID, USER_ID, MSG_ID, EMOJI);

      expect(mockPrisma.reaction.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rxn1' } }),
      );
      expect(mockPrisma.reaction.create).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('throws ForbiddenException when caller is not a member', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue(null);

      await expect(service.toggleRoomReaction(ROOM_ID, USER_ID, MSG_ID, EMOJI)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when caller is banned', async () => {
      mockPrisma.roomMembership.findUnique.mockResolvedValue(fakeMembership('MEMBER'));
      mockPrisma.roomBan.findFirst.mockResolvedValue({ id: 'ban1', liftedAt: null });

      await expect(service.toggleRoomReaction(ROOM_ID, USER_ID, MSG_ID, EMOJI)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
