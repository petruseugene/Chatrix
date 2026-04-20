import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipService } from './friendship.service';
import { PrismaService } from '../prisma/prisma.service';

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
// Test fixtures
// ---------------------------------------------------------------------------

const userAlice = { id: 'aaa', username: 'alice', email: 'alice@example.com' };
const userBob = { id: 'bbb', username: 'bob', email: 'bob@example.com' };

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
      providers: [FriendshipService, { provide: PrismaService, useValue: mockPrisma }],
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
      mockPrisma.friendRequest.delete.mockResolvedValue({});

      await service.declineRequest('req-1', 'bbb');

      expect(mockPrisma.friendRequest.delete).toHaveBeenCalledWith({ where: { id: 'req-1' } });
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
          fromUser: { id: 'aaa', username: 'alice' },
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
  });
});
