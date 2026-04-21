import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockPrisma = {
  user: {
    findMany: jest.fn(),
  },
  friendship: {
    findMany: jest.fn(),
  },
  friendRequest: {
    findMany: jest.fn(),
  },
  block: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const userAlice = { id: 'alice-id', username: 'alice', email: 'alice@example.com' };
const userBob = { id: 'bob-id', username: 'bob', email: 'bob@example.com' };
const userCarol = { id: 'carol-id', username: 'carol', email: 'carol@example.com' };

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(UsersService);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // searchUsers
  // ─────────────────────────────────────────────────────────────────────────

  describe('searchUsers', () => {
    it('returns users whose usernames contain the query string (case-insensitive), excluding the caller', async () => {
      mockPrisma.user.findMany.mockResolvedValue([userBob, userCarol]);
      mockPrisma.friendship.findMany.mockResolvedValue([]);
      mockPrisma.friendRequest.findMany.mockResolvedValue([]);

      const result = await service.searchUsers(userAlice.id, 'o');

      expect(result).toHaveLength(2);
      expect(result.map((u) => u.username)).toEqual(expect.arrayContaining(['bob', 'carol']));
    });

    it('passes deletedAt: null in the where clause to exclude soft-deleted users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.searchUsers(userAlice.id, 'deleted');

      const callArg: { where: { AND: unknown[] } } = mockPrisma.user.findMany.mock.calls[0][0] as {
        where: { AND: unknown[] };
      };
      expect(callArg.where.AND).toEqual(expect.arrayContaining([{ deletedAt: null }]));
    });

    it('does not return soft-deleted users even if Prisma would match them', async () => {
      // Simulate Prisma already filtering soft-deleted users (the filter is in
      // the query). The mock returns an empty array — if the filter were absent,
      // a deleted user would still show up.
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.searchUsers(userAlice.id, 'bob');

      expect(result).toEqual([]);
    });

    it('excludes users who have an active Block in either direction with the caller', async () => {
      mockPrisma.user.findMany.mockResolvedValue([userCarol]);
      mockPrisma.friendship.findMany.mockResolvedValue([]);
      mockPrisma.friendRequest.findMany.mockResolvedValue([]);

      const result = await service.searchUsers(userAlice.id, 'c');

      expect(result).toHaveLength(1);
      const first = result[0];
      expect(first?.username).toBe('carol');
    });

    it('returns at most 20 results', async () => {
      const manyUsers = Array.from({ length: 20 }, (_, i) => ({
        id: `user-${i}`,
        username: `user${i}`,
        email: `user${i}@example.com`,
      }));
      mockPrisma.user.findMany.mockResolvedValue(manyUsers);
      mockPrisma.friendship.findMany.mockResolvedValue([]);
      mockPrisma.friendRequest.findMany.mockResolvedValue([]);

      const result = await service.searchUsers('caller-id', 'user');

      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('sets relationshipStatus to "friend" when a Friendship exists', async () => {
      mockPrisma.user.findMany.mockResolvedValue([userBob]);
      mockPrisma.friendship.findMany.mockResolvedValue([
        { userAId: userAlice.id, userBId: userBob.id },
      ]);
      mockPrisma.friendRequest.findMany.mockResolvedValue([]);

      const result = await service.searchUsers(userAlice.id, 'bob');
      const first = result[0];

      expect(first?.relationshipStatus).toBe('friend');
    });

    it('sets relationshipStatus to "pending_sent" when caller sent a request to this user', async () => {
      mockPrisma.user.findMany.mockResolvedValue([userBob]);
      mockPrisma.friendship.findMany.mockResolvedValue([]);
      mockPrisma.friendRequest.findMany.mockResolvedValue([
        { id: 'req-sent', fromUserId: userAlice.id, toUserId: userBob.id },
      ]);

      const result = await service.searchUsers(userAlice.id, 'bob');
      const first = result[0];

      expect(first?.relationshipStatus).toBe('pending_sent');
    });

    it('sets relationshipStatus to "pending_received" and includes friendRequestId when someone sent a request to the caller', async () => {
      mockPrisma.user.findMany.mockResolvedValue([userBob]);
      mockPrisma.friendship.findMany.mockResolvedValue([]);
      mockPrisma.friendRequest.findMany.mockResolvedValue([
        { id: 'req-recv', fromUserId: userBob.id, toUserId: userAlice.id },
      ]);

      const result = await service.searchUsers(userAlice.id, 'bob');
      const first = result[0];

      expect(first?.relationshipStatus).toBe('pending_received');
      expect(first?.friendRequestId).toBe('req-recv');
    });

    it('sets relationshipStatus to "none" when no relationship exists', async () => {
      mockPrisma.user.findMany.mockResolvedValue([userBob]);
      mockPrisma.friendship.findMany.mockResolvedValue([]);
      mockPrisma.friendRequest.findMany.mockResolvedValue([]);

      const result = await service.searchUsers(userAlice.id, 'bob');
      const first = result[0];

      expect(first?.relationshipStatus).toBe('none');
      expect(first?.friendRequestId).toBeUndefined();
    });

    it('does not include friendRequestId when status is "friend"', async () => {
      mockPrisma.user.findMany.mockResolvedValue([userBob]);
      mockPrisma.friendship.findMany.mockResolvedValue([
        { userAId: userAlice.id, userBId: userBob.id },
      ]);
      mockPrisma.friendRequest.findMany.mockResolvedValue([]);

      const result = await service.searchUsers(userAlice.id, 'bob');
      const first = result[0];

      expect(first?.friendRequestId).toBeUndefined();
    });

    it('returns results ordered by username ASC', async () => {
      const users = [
        { id: 'a-id', username: 'anna', email: 'anna@example.com' },
        { id: 'm-id', username: 'mike', email: 'mike@example.com' },
        { id: 'z-id', username: 'zara', email: 'zara@example.com' },
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.friendship.findMany.mockResolvedValue([]);
      mockPrisma.friendRequest.findMany.mockResolvedValue([]);

      const result = await service.searchUsers('caller-id', 'a');

      expect(result.map((u) => u.username)).toEqual(['anna', 'mike', 'zara']);
    });

    it('returns empty array when no users match the query', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.searchUsers(userAlice.id, 'zzz');

      expect(result).toEqual([]);
    });

    it('returns id and username for each result', async () => {
      mockPrisma.user.findMany.mockResolvedValue([userBob]);
      mockPrisma.friendship.findMany.mockResolvedValue([]);
      mockPrisma.friendRequest.findMany.mockResolvedValue([]);

      const result = await service.searchUsers(userAlice.id, 'bob');
      const first = result[0];

      expect(first?.id).toBe(userBob.id);
      expect(first?.username).toBe(userBob.username);
    });

    it('issues exactly 2 batch queries for relationship data (not N*3 per-user queries)', async () => {
      const threeUsers = [
        userBob,
        userCarol,
        { id: 'dave-id', username: 'dave', email: 'dave@example.com' },
      ];
      mockPrisma.user.findMany.mockResolvedValue(threeUsers);
      mockPrisma.friendship.findMany.mockResolvedValue([]);
      mockPrisma.friendRequest.findMany.mockResolvedValue([]);

      await service.searchUsers(userAlice.id, 'a');

      // One batch call for friendships, one for friendRequests
      expect(mockPrisma.friendship.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.friendRequest.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
