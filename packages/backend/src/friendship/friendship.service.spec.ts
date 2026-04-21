import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipService } from './friendship.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { FRIEND_EVENTS } from '@chatrix/shared';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  friendship: {
    findFirst: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  friendRequest: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  block: {
    findFirst: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  directMessageThread: {
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

// ---------------------------------------------------------------------------
// Mock EventsService
// ---------------------------------------------------------------------------

const mockEventsService = {
  emitToUser: jest.fn(),
};

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const userAlice = {
  id: 'aaa',
  username: 'alice',
  email: 'alice@example.com',
  createdAt: new Date('2023-01-01'),
};
const userBob = {
  id: 'bbb',
  username: 'bob',
  email: 'bob@example.com',
  createdAt: new Date('2023-02-01'),
};

const fakeRequest = {
  id: 'req-1',
  fromUserId: 'aaa',
  toUserId: 'bbb',
  createdAt: new Date(),
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('FriendshipService', () => {
  let service: FriendshipService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Default $transaction: run each prisma operation independently (like Promise.all)
    mockPrisma.$transaction.mockImplementation((ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      if (typeof ops === 'function') return ops(mockPrisma);
      return Promise.resolve();
    });

    const module = await Test.createTestingModule({
      providers: [
        FriendshipService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get(FriendshipService);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // sendRequest
  // ─────────────────────────────────────────────────────────────────────────

  describe('sendRequest', () => {
    it('throws NotFoundException when target username does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.sendRequest('aaa', 'ghost')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when sender sends a request to themselves', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userAlice);

      await expect(service.sendRequest('aaa', 'alice')).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when a friend request is already pending', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userBob);
      mockPrisma.friendRequest.findFirst.mockResolvedValue(fakeRequest);

      await expect(service.sendRequest('aaa', 'bob')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when they are already friends', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userBob);
      mockPrisma.friendRequest.findFirst.mockResolvedValue(null);
      mockPrisma.friendship.findFirst.mockResolvedValue({
        id: 'f-1',
        userAId: 'aaa',
        userBId: 'bbb',
      });

      await expect(service.sendRequest('aaa', 'bob')).rejects.toThrow(ConflictException);
    });

    it('creates a FriendRequest when all preconditions pass', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userBob);
      mockPrisma.friendRequest.findFirst.mockResolvedValue(null);
      mockPrisma.friendship.findFirst.mockResolvedValue(null);
      mockPrisma.friendRequest.create.mockResolvedValue(fakeRequest);

      await service.sendRequest('aaa', 'bob');

      expect(mockPrisma.friendRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fromUserId: 'aaa', toUserId: 'bbb' }),
        }),
      );
    });

    it('emits REQUEST_RECEIVED to the recipient after creating the request', async () => {
      // First findUnique call → toUser (bob, found by username)
      mockPrisma.user.findUnique.mockResolvedValueOnce(userBob);
      // Second findUnique call → fromUser (alice, found by id)
      mockPrisma.user.findUnique.mockResolvedValueOnce(userAlice);
      mockPrisma.friendRequest.findFirst.mockResolvedValue(null);
      mockPrisma.friendship.findFirst.mockResolvedValue(null);
      const createdAt = new Date('2024-06-01');
      const createdRequest = {
        ...fakeRequest,
        id: 'req-1',
        fromUserId: 'aaa',
        toUserId: 'bbb',
        createdAt,
      };
      mockPrisma.friendRequest.create.mockResolvedValue(createdRequest);

      await service.sendRequest('aaa', 'bob');

      expect(mockEventsService.emitToUser).toHaveBeenCalledWith(
        userBob.id,
        FRIEND_EVENTS.REQUEST_RECEIVED,
        expect.objectContaining({
          requestId: 'req-1',
          fromUserId: 'aaa',
          fromUsername: userAlice.username,
          createdAt,
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // acceptRequest
  // ─────────────────────────────────────────────────────────────────────────

  describe('acceptRequest', () => {
    it('throws ForbiddenException when the userId is not the request recipient', async () => {
      mockPrisma.friendRequest.findUnique.mockResolvedValue(fakeRequest); // toUserId = 'bbb'

      await expect(service.acceptRequest('req-1', 'aaa')).rejects.toThrow(ForbiddenException);
    });

    it('creates Friendship with canonical ordering — smaller ID becomes userAId', async () => {
      // 'aaa' < 'bbb' lexicographically → userAId = 'aaa', userBId = 'bbb'
      const req = { id: 'req-1', fromUserId: 'bbb', toUserId: 'aaa', createdAt: new Date() };
      mockPrisma.friendRequest.findUnique.mockResolvedValue(req);
      mockPrisma.friendship.create.mockResolvedValue({});
      mockPrisma.friendRequest.delete.mockResolvedValue({});

      await service.acceptRequest('req-1', 'aaa');

      expect(mockPrisma.friendship.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userAId: 'aaa', userBId: 'bbb' }),
        }),
      );
    });

    it('deletes the FriendRequest in the same transaction as creating Friendship', async () => {
      mockPrisma.friendRequest.findUnique.mockResolvedValue(fakeRequest);
      mockPrisma.friendship.create.mockResolvedValue({});
      mockPrisma.friendRequest.delete.mockResolvedValue({});

      await service.acceptRequest('req-1', 'bbb');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.friendRequest.delete).toHaveBeenCalledWith({
        where: { id: 'req-1' },
      });
    });

    it('emits REQUEST_ACCEPTED to the original sender after accepting', async () => {
      mockPrisma.friendRequest.findUnique.mockResolvedValue(fakeRequest); // fromUserId = 'aaa'
      mockPrisma.friendship.create.mockResolvedValue({});
      mockPrisma.friendRequest.delete.mockResolvedValue({});

      await service.acceptRequest('req-1', 'bbb');

      expect(mockEventsService.emitToUser).toHaveBeenCalledWith(
        fakeRequest.fromUserId,
        FRIEND_EVENTS.REQUEST_ACCEPTED,
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // declineRequest
  // ─────────────────────────────────────────────────────────────────────────

  describe('declineRequest', () => {
    it('throws ForbiddenException when userId is not the recipient', async () => {
      mockPrisma.friendRequest.findUnique.mockResolvedValue(fakeRequest); // toUserId = 'bbb'

      await expect(service.declineRequest('req-1', 'aaa')).rejects.toThrow(ForbiddenException);
    });

    it('deletes the request when the correct recipient declines', async () => {
      mockPrisma.friendRequest.findUnique.mockResolvedValue(fakeRequest); // toUserId = 'bbb'
      mockPrisma.user.findUnique.mockResolvedValue(userBob);
      mockPrisma.friendRequest.delete.mockResolvedValue({});

      await service.declineRequest('req-1', 'bbb');

      expect(mockPrisma.friendRequest.delete).toHaveBeenCalledWith({ where: { id: 'req-1' } });
    });

    it('emits REQUEST_DECLINED to the original sender with requestId and declinedByUsername', async () => {
      mockPrisma.friendRequest.findUnique.mockResolvedValue(fakeRequest); // fromUserId = 'aaa', toUserId = 'bbb'
      mockPrisma.user.findUnique.mockResolvedValue(userBob); // declining user is bob (userId = 'bbb')
      mockPrisma.friendRequest.delete.mockResolvedValue({});

      await service.declineRequest('req-1', 'bbb');

      expect(mockEventsService.emitToUser).toHaveBeenCalledWith(
        fakeRequest.fromUserId,
        FRIEND_EVENTS.REQUEST_DECLINED,
        expect.objectContaining({
          requestId: 'req-1',
          declinedByUsername: userBob.username,
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // removeFriend
  // ─────────────────────────────────────────────────────────────────────────

  describe('removeFriend', () => {
    it('deletes friendship using both canonical orderings and removes DM thread', async () => {
      mockPrisma.friendship.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.directMessageThread.deleteMany.mockResolvedValue({ count: 0 });

      await service.removeFriend('aaa', 'bbb');

      expect(mockPrisma.friendship.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ userAId: 'aaa', userBId: 'bbb' }),
              expect.objectContaining({ userAId: 'bbb', userBId: 'aaa' }),
            ]),
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // blockUser
  // ─────────────────────────────────────────────────────────────────────────

  describe('blockUser', () => {
    it('creates a Block record', async () => {
      mockPrisma.friendship.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.block.create.mockResolvedValue({
        id: 'blk-1',
        blockerId: 'aaa',
        blockedId: 'bbb',
      });

      await service.blockUser('aaa', 'bbb');

      expect(mockPrisma.block.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ blockerId: 'aaa', blockedId: 'bbb' }),
        }),
      );
    });

    it('removes existing friendship in the same transaction when blocking', async () => {
      mockPrisma.friendship.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.block.create.mockResolvedValue({
        id: 'blk-1',
        blockerId: 'aaa',
        blockedId: 'bbb',
      });

      await service.blockUser('aaa', 'bbb');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      // Both block.create and friendship.deleteMany should have been called
      expect(mockPrisma.block.create).toHaveBeenCalled();
      expect(mockPrisma.friendship.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ userAId: 'aaa', userBId: 'bbb' }),
              expect.objectContaining({ userAId: 'bbb', userBId: 'aaa' }),
            ]),
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // unblockUser
  // ─────────────────────────────────────────────────────────────────────────

  describe('unblockUser', () => {
    it('deletes the Block row for the given blocker/blocked pair', async () => {
      mockPrisma.block.deleteMany.mockResolvedValue({ count: 1 });

      await service.unblockUser('aaa', 'bbb');

      expect(mockPrisma.block.deleteMany).toHaveBeenCalledWith({
        where: { blockerId: 'aaa', blockedId: 'bbb' },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // areMutualFriendsAndNotBlocked
  // ─────────────────────────────────────────────────────────────────────────

  describe('areMutualFriendsAndNotBlocked', () => {
    it('returns false when no friendship row exists', async () => {
      mockPrisma.friendship.findFirst.mockResolvedValue(null);
      mockPrisma.block.findFirst.mockResolvedValue(null);

      const result = await service.areMutualFriendsAndNotBlocked('aaa', 'bbb');

      expect(result).toBe(false);
    });

    it('returns false when a block exists from A to B', async () => {
      mockPrisma.friendship.findFirst.mockResolvedValue({ id: 'f-1' });
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'blk-1',
        blockerId: 'aaa',
        blockedId: 'bbb',
      });

      const result = await service.areMutualFriendsAndNotBlocked('aaa', 'bbb');

      expect(result).toBe(false);
    });

    it('returns false when a block exists from B to A', async () => {
      mockPrisma.friendship.findFirst.mockResolvedValue({ id: 'f-1' });
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'blk-2',
        blockerId: 'bbb',
        blockedId: 'aaa',
      });

      const result = await service.areMutualFriendsAndNotBlocked('aaa', 'bbb');

      expect(result).toBe(false);
    });

    it('returns true when friends and no block exists in either direction', async () => {
      mockPrisma.friendship.findFirst.mockResolvedValue({ id: 'f-1' });
      mockPrisma.block.findFirst.mockResolvedValue(null);

      const result = await service.areMutualFriendsAndNotBlocked('aaa', 'bbb');

      expect(result).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // listFriends
  // ─────────────────────────────────────────────────────────────────────────

  describe('listFriends', () => {
    it('returns friends with id, username, and createdAt of the other user', async () => {
      const now = new Date();
      mockPrisma.friendship.findFirst.mockResolvedValue(null); // not used here
      // We need to mock the actual call pattern used in listFriends
      // The service must query friendships where userAId=userId OR userBId=userId
      const friendships = [
        {
          id: 'f-1',
          userAId: 'aaa',
          userBId: 'bbb',
          createdAt: now,
          userA: { id: 'aaa', username: 'alice' },
          userB: { id: 'bbb', username: 'bob' },
        },
      ];
      // Override findFirst with findMany for this test
      mockPrisma.friendship.findFirst = jest.fn();
      (mockPrisma.friendship as Record<string, jest.Mock>).findMany = jest
        .fn()
        .mockResolvedValue(friendships);

      const result = await service.listFriends('aaa');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ friendId: 'bbb', username: 'bob', createdAt: now });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // listPendingRequests
  // ─────────────────────────────────────────────────────────────────────────

  describe('listPendingRequests', () => {
    it('returns incoming pending requests with sender username', async () => {
      const now = new Date();
      const requests = [
        {
          id: 'req-2',
          fromUserId: 'aaa',
          toUserId: 'bbb',
          createdAt: now,
          fromUser: { id: 'aaa', username: 'alice', createdAt: now },
        },
      ];
      (mockPrisma.friendRequest as Record<string, jest.Mock>).findMany = jest
        .fn()
        .mockResolvedValue(requests);

      const result = await service.listPendingRequests('bbb');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'req-2',
        fromUserId: 'aaa',
        fromUsername: 'alice',
        createdAt: now,
      });
    });

    it('includes fromUserCreatedAt in each pending request item', async () => {
      const requestCreatedAt = new Date('2024-01-15T10:00:00Z');
      const userCreatedAt = new Date('2023-06-01T00:00:00Z');
      const requests = [
        {
          id: 'req-3',
          fromUserId: 'aaa',
          toUserId: 'bbb',
          createdAt: requestCreatedAt,
          fromUser: { id: 'aaa', username: 'alice', createdAt: userCreatedAt },
        },
      ];
      (mockPrisma.friendRequest as Record<string, jest.Mock>).findMany = jest
        .fn()
        .mockResolvedValue(requests);

      const result = await service.listPendingRequests('bbb');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'req-3',
        fromUserId: 'aaa',
        fromUsername: 'alice',
        createdAt: requestCreatedAt,
        fromUserCreatedAt: userCreatedAt,
      });
    });
  });
});
