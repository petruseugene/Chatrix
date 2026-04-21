import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type RelationshipStatus = 'friend' | 'pending_sent' | 'pending_received' | 'none';

export interface UserSearchResult {
  id: string;
  username: string;
  relationshipStatus: RelationshipStatus;
  friendRequestId?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async searchUsers(callerId: string, q: string): Promise<UserSearchResult[]> {
    // Find up to 20 users whose username contains q (case-insensitive),
    // excluding the caller and users with an active Block in either direction.
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: callerId } },
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

    // Determine relationship status for each user
    const results: UserSearchResult[] = await Promise.all(
      users.map(async (user) => {
        // Check friendship first
        const friendship = await this.prisma.friendship.findFirst({
          where: {
            OR: [
              { userAId: callerId, userBId: user.id },
              { userAId: user.id, userBId: callerId },
            ],
          },
          select: { id: true },
        });

        if (friendship) {
          return { id: user.id, username: user.username, relationshipStatus: 'friend' as const };
        }

        // Check pending_sent: caller sent a request to this user
        const sentRequest = await this.prisma.friendRequest.findFirst({
          where: { fromUserId: callerId, toUserId: user.id },
          select: { id: true },
        });

        if (sentRequest) {
          return {
            id: user.id,
            username: user.username,
            relationshipStatus: 'pending_sent' as const,
          };
        }

        // Check pending_received: this user sent a request to the caller
        const receivedRequest = await this.prisma.friendRequest.findFirst({
          where: { fromUserId: user.id, toUserId: callerId },
          select: { id: true },
        });

        if (receivedRequest) {
          return {
            id: user.id,
            username: user.username,
            relationshipStatus: 'pending_received' as const,
            friendRequestId: receivedRequest.id,
          };
        }

        return { id: user.id, username: user.username, relationshipStatus: 'none' as const };
      }),
    );

    return results;
  }
}
