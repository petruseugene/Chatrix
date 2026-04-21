import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FRIEND_EVENTS } from '@chatrix/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipGateway } from './friendship.gateway';

/** Canonical pair ordering: min(a, b) → first element */
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

@Injectable()
export class FriendshipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: FriendshipGateway,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // sendRequest
  // ─────────────────────────────────────────────────────────────────────────

  async sendRequest(fromUserId: string, toUsername: string): Promise<void> {
    const toUser = await this.prisma.user.findUnique({ where: { username: toUsername } });
    if (!toUser) {
      throw new NotFoundException(`User "${toUsername}" not found`);
    }

    if (fromUserId === toUser.id) {
      throw new BadRequestException('You cannot send a friend request to yourself');
    }

    const existingRequest = await this.prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId, toUserId: toUser.id },
          { fromUserId: toUser.id, toUserId: fromUserId },
        ],
      },
    });
    if (existingRequest) {
      throw new ConflictException('A friend request is already pending between these users');
    }

    const existingFriendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { userAId: fromUserId, userBId: toUser.id },
          { userAId: toUser.id, userBId: fromUserId },
        ],
      },
    });
    if (existingFriendship) {
      throw new ConflictException('You are already friends with this user');
    }

    const fromUser = await this.prisma.user.findUnique({ where: { id: fromUserId } });

    const created = await this.prisma.friendRequest.create({
      data: { fromUserId, toUserId: toUser.id },
    });

    if (fromUser) {
      this.gateway.emitToUser(toUser.id, FRIEND_EVENTS.REQUEST_RECEIVED, {
        requestId: created.id,
        fromUserId,
        fromUsername: fromUser.username,
        fromUserCreatedAt: fromUser.createdAt,
        createdAt: created.createdAt,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // acceptRequest
  // ─────────────────────────────────────────────────────────────────────────

  async acceptRequest(requestId: string, userId: string): Promise<void> {
    const request = await this.prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request || request.toUserId !== userId) {
      throw new ForbiddenException('You cannot accept this friend request');
    }

    // Canonical ordering: smaller ID → userAId
    const [userAId, userBId] = canonicalPair(request.fromUserId, request.toUserId);

    await this.prisma.$transaction([
      this.prisma.friendship.create({ data: { userAId, userBId } }),
      this.prisma.friendRequest.delete({ where: { id: requestId } }),
    ]);

    this.gateway.emitToUser(request.fromUserId, FRIEND_EVENTS.REQUEST_ACCEPTED, { requestId });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // declineRequest
  // ─────────────────────────────────────────────────────────────────────────

  async declineRequest(requestId: string, userId: string): Promise<void> {
    const request = await this.prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request || request.toUserId !== userId) {
      throw new ForbiddenException('You cannot decline this friend request');
    }

    const decliningUser = await this.prisma.user.findUnique({ where: { id: userId } });

    await this.prisma.friendRequest.delete({ where: { id: requestId } });

    if (decliningUser) {
      this.gateway.emitToUser(request.fromUserId, FRIEND_EVENTS.REQUEST_DECLINED, {
        requestId,
        declinedByUsername: decliningUser.username,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // removeFriend
  // ─────────────────────────────────────────────────────────────────────────

  async removeFriend(userId: string, friendId: string): Promise<void> {
    await this.prisma.friendship.deleteMany({
      where: {
        OR: [
          { userAId: userId, userBId: friendId },
          { userAId: friendId, userBId: userId },
        ],
      },
    });

    // Remove DM thread if it exists (canonical ordering)
    const [dmUserAId, dmUserBId] = canonicalPair(userId, friendId);
    await this.prisma.directMessageThread.deleteMany({
      where: { userAId: dmUserAId, userBId: dmUserBId },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // blockUser
  // ─────────────────────────────────────────────────────────────────────────

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.friendship.deleteMany({
        where: {
          OR: [
            { userAId: blockerId, userBId: blockedId },
            { userAId: blockedId, userBId: blockerId },
          ],
        },
      }),
      this.prisma.block.create({ data: { blockerId, blockedId } }),
    ]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // unblockUser
  // ─────────────────────────────────────────────────────────────────────────

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.prisma.block.deleteMany({ where: { blockerId, blockedId } });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // areMutualFriendsAndNotBlocked
  // ─────────────────────────────────────────────────────────────────────────

  async areMutualFriendsAndNotBlocked(userAId: string, userBId: string): Promise<boolean> {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { userAId, userBId },
          { userAId: userBId, userBId: userAId },
        ],
      },
    });

    if (!friendship) return false;

    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userAId, blockedId: userBId },
          { blockerId: userBId, blockedId: userAId },
        ],
      },
    });

    return block === null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // listFriends
  // ─────────────────────────────────────────────────────────────────────────

  async listFriends(
    userId: string,
  ): Promise<Array<{ friendId: string; username: string; createdAt: Date }>> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: { select: { id: true, username: true } },
        userB: { select: { id: true, username: true } },
      },
    } satisfies Prisma.FriendshipFindManyArgs);

    return friendships.map((f) => {
      const friend = f.userAId === userId ? f.userB : f.userA;
      return { friendId: friend.id, username: friend.username, createdAt: f.createdAt };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // listPendingRequests
  // ─────────────────────────────────────────────────────────────────────────

  async listPendingRequests(userId: string): Promise<
    Array<{
      id: string;
      fromUserId: string;
      fromUsername: string;
      fromUserCreatedAt: Date;
      createdAt: Date;
    }>
  > {
    const requests = await this.prisma.friendRequest.findMany({
      where: { toUserId: userId },
      include: {
        fromUser: { select: { id: true, username: true, createdAt: true } },
      },
    } satisfies Prisma.FriendRequestFindManyArgs);

    return requests.map((r) => ({
      id: r.id,
      fromUserId: r.fromUserId,
      fromUsername: r.fromUser.username,
      fromUserCreatedAt: r.fromUser.createdAt,
      createdAt: r.createdAt,
    }));
  }
}
