import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RelationshipStatus, UserSearchResult } from '@chatrix/shared';

export type { RelationshipStatus, UserSearchResult };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async searchUsers(callerId: string, q: string): Promise<UserSearchResult[]> {
    // Find up to 20 users whose username contains q (case-insensitive),
    // excluding the caller, soft-deleted users, and users with an active Block
    // in either direction.
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: callerId } },
          { deletedAt: null },
          { username: { contains: q, mode: 'insensitive' } },
          {
            blocking: { none: { blockedId: callerId } },
          },
          {
            blockedBy: { none: { blockerId: callerId } },
          },
        ],
      },
      select: { id: true, username: true },
      orderBy: { username: 'asc' },
      take: 20,
    });

    if (users.length === 0) return [];

    // Batch-fetch all relationship data in 2 queries instead of N*3 queries.
    const userIds = users.map((u) => u.id);

    const [friendships, friendRequests] = await Promise.all([
      this.prisma.friendship.findMany({
        where: {
          OR: [
            { userAId: callerId, userBId: { in: userIds } },
            { userAId: { in: userIds }, userBId: callerId },
          ],
        },
        select: { userAId: true, userBId: true },
      }),
      this.prisma.friendRequest.findMany({
        where: {
          OR: [
            { fromUserId: callerId, toUserId: { in: userIds } },
            { fromUserId: { in: userIds }, toUserId: callerId },
          ],
        },
        select: { id: true, fromUserId: true, toUserId: true },
      }),
    ]);

    // Build in-memory lookup sets for O(1) access per user.
    const friendSet = new Set<string>();
    for (const f of friendships) {
      const otherId = f.userAId === callerId ? f.userBId : f.userAId;
      friendSet.add(otherId);
    }

    // Map: otherUserId -> { id, direction }
    const requestMap = new Map<string, { id: string; direction: 'sent' | 'received' }>();
    for (const r of friendRequests) {
      if (r.fromUserId === callerId) {
        requestMap.set(r.toUserId, { id: r.id, direction: 'sent' });
      } else {
        requestMap.set(r.fromUserId, { id: r.id, direction: 'received' });
      }
    }

    return users.map((user): UserSearchResult => {
      if (friendSet.has(user.id)) {
        return { id: user.id, username: user.username, relationshipStatus: 'friend' };
      }

      const request = requestMap.get(user.id);
      if (request) {
        if (request.direction === 'sent') {
          return { id: user.id, username: user.username, relationshipStatus: 'pending_sent' };
        }
        return {
          id: user.id,
          username: user.username,
          relationshipStatus: 'pending_received',
          friendRequestId: request.id,
        };
      }

      return { id: user.id, username: user.username, relationshipStatus: 'none' };
    });
  }
}
