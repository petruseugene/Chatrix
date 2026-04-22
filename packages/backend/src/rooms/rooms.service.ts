import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type {
  ReactionSummary,
  RoomDetail,
  RoomMember,
  RoomMessagePayload,
  RoomRole,
  RoomSummary,
} from '@chatrix/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import type { CreateRoomDto } from './dto/create-room.dto';
import type { UpdateRoomDto } from './dto/update-room.dto';
import type { SendMessageDto } from './dto/send-message.dto';
import type { EditMessageDto } from './dto/edit-message.dto';

const ROLE_RANK = { OWNER: 2, ADMIN: 1, MEMBER: 0 } as const;

type RoomForSummary = {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  _count: { memberships: number };
};

type MembershipRow = { role: string; joinedAt: Date };

const ATTACHMENT_SELECT = {
  id: true,
  originalFilename: true,
  mimeType: true,
  size: true,
  thumbnailKey: true,
} as const;

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async assertMember(roomId: string, userId: string) {
    const membership = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this room');
    return membership;
  }

  private async assertNotBanned(roomId: string, userId: string) {
    const ban = await this.prisma.roomBan.findFirst({
      where: { roomId, userId, liftedAt: null },
    });
    if (ban) throw new ForbiddenException('You are banned from this room');
  }

  async getMembership(roomId: string, userId: string) {
    return this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
  }

  private buildRoomSummary(room: RoomForSummary, membership?: MembershipRow | null): RoomSummary {
    return {
      id: room.id,
      name: room.name,
      description: room.description,
      isPrivate: room.isPrivate,
      memberCount: room._count.memberships,
      ...(membership ? { myRole: membership.role as RoomRole } : {}),
      unreadCount: 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public methods
  // ─────────────────────────────────────────────────────────────────────────

  async createRoom(userId: string, dto: CreateRoomDto): Promise<RoomSummary> {
    try {
      const { room, membership } = await this.prisma.$transaction(async (tx) => {
        const room = await tx.room.create({
          data: {
            name: dto.name,
            description: dto.description ?? '',
            isPrivate: dto.isPrivate ?? false,
            ownerId: userId,
          },
        });
        const membership = await tx.roomMembership.create({
          data: { roomId: room.id, userId, role: 'OWNER' },
        });
        return { room, membership };
      });
      return this.buildRoomSummary({ ...room, _count: { memberships: 1 } }, membership);
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Room name already taken');
      }
      throw e;
    }
  }

  async listMyRooms(userId: string): Promise<RoomSummary[]> {
    const memberships = await this.prisma.roomMembership.findMany({
      where: { userId },
      include: {
        room: {
          include: { _count: { select: { memberships: true } } },
        },
      },
    });
    return Promise.all(
      memberships.map(async (m) => {
        const unreadCount = m.lastReadAt
          ? await this.prisma.roomMessage.count({
              where: { roomId: m.roomId, deletedAt: null, createdAt: { gt: m.lastReadAt } },
            })
          : 0;
        return { ...this.buildRoomSummary(m.room, m), unreadCount };
      }),
    );
  }

  async markRoomRead(roomId: string, userId: string): Promise<void> {
    const membership = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this room');
    await this.prisma.roomMembership.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  async searchPublic(search?: string, cursor?: string): Promise<RoomSummary[]> {
    const rooms = await this.prisma.room.findMany({
      where: {
        isPrivate: false,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { _count: { select: { memberships: true } } },
      take: 20,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { name: 'asc' },
    });
    return rooms.map((r) => this.buildRoomSummary(r));
  }

  async getRoom(roomId: string, userId: string): Promise<RoomDetail> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        memberships: { include: { user: { select: { id: true, username: true } } } },
        _count: { select: { memberships: true } },
      },
    });
    if (!room) throw new NotFoundException('Room not found');
    const callerMembership = room.memberships.find((m) => m.userId === userId);
    if (room.isPrivate && !callerMembership) {
      throw new ForbiddenException('Access denied');
    }
    const members: RoomMember[] = room.memberships.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      role: m.role as RoomRole,
      joinedAt: m.joinedAt.toISOString(),
    }));
    return {
      ...this.buildRoomSummary(room, callerMembership),
      ownerId: room.ownerId,
      members,
    };
  }

  async updateRoom(roomId: string, userId: string, dto: UpdateRoomDto): Promise<RoomSummary> {
    const membership = await this.getMembership(roomId, userId);
    if (!membership || ROLE_RANK[membership.role] < ROLE_RANK['OWNER']) {
      throw new ForbiddenException('Only the room owner can update room settings');
    }
    try {
      const updated = await this.prisma.room.update({
        where: { id: roomId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.isPrivate !== undefined ? { isPrivate: dto.isPrivate } : {}),
        },
        include: { _count: { select: { memberships: true } } },
      });
      return this.buildRoomSummary(updated, membership);
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Room name already taken');
      }
      throw e;
    }
  }

  async deleteRoom(roomId: string, userId: string): Promise<void> {
    const membership = await this.assertMember(roomId, userId);
    if (ROLE_RANK[membership.role] < ROLE_RANK['OWNER']) {
      throw new ForbiddenException('Only the room owner can delete the room');
    }
    await this.attachmentsService.deleteAttachmentsByRoom(roomId);
    await this.prisma.room.delete({ where: { id: roomId } });
  }

  async joinRoom(roomId: string, userId: string): Promise<void> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.isPrivate) throw new ForbiddenException('This room is private — you need an invite');
    await this.assertNotBanned(roomId, userId);
    const existing = await this.getMembership(roomId, userId);
    if (existing) throw new ConflictException('Already a member of this room');
    await this.prisma.roomMembership.create({
      data: { roomId, userId, role: 'MEMBER' },
    });
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const membership = await this.assertMember(roomId, userId);
    if (membership.role === 'OWNER') {
      throw new ForbiddenException(
        'Owner cannot leave the room — delete it or transfer ownership first',
      );
    }
    await this.prisma.roomMembership.delete({
      where: { roomId_userId: { roomId, userId } },
    });
  }

  async inviteUser(
    roomId: string,
    actorId: string,
    targetUsername: string,
  ): Promise<{ targetUserId: string }> {
    const actorMembership = await this.getMembership(roomId, actorId);
    if (!actorMembership || ROLE_RANK[actorMembership.role] < ROLE_RANK['ADMIN']) {
      throw new ForbiddenException('Only admins and owners can invite users');
    }
    const target = await this.prisma.user.findUnique({ where: { username: targetUsername } });
    if (!target) throw new NotFoundException(`User "${targetUsername}" not found`);
    const existing = await this.getMembership(roomId, target.id);
    if (existing) throw new ConflictException('User is already a member of this room');
    await this.assertNotBanned(roomId, target.id);
    await this.prisma.roomMembership.create({
      data: { roomId, userId: target.id, role: 'MEMBER' },
    });
    return { targetUserId: target.id };
  }

  async kickMember(
    roomId: string,
    actorId: string,
    targetId: string,
  ): Promise<{ username: string }> {
    const [actorMembership, targetMembership] = await Promise.all([
      this.getMembership(roomId, actorId),
      this.prisma.roomMembership.findUnique({
        where: { roomId_userId: { roomId, userId: targetId } },
        include: { user: { select: { username: true } } },
      }),
    ]);
    if (!actorMembership) throw new ForbiddenException('Not a member');
    if (!targetMembership) throw new NotFoundException('Target is not a member');
    if (ROLE_RANK[actorMembership.role] <= ROLE_RANK[targetMembership.role]) {
      throw new ForbiddenException('Insufficient role to kick this member');
    }
    await this.prisma.roomMembership.delete({
      where: { roomId_userId: { roomId, userId: targetId } },
    });
    return { username: targetMembership.user.username };
  }

  async banUser(
    roomId: string,
    actorId: string,
    targetId: string,
    reason?: string,
  ): Promise<{ username: string }> {
    const [actorMembership, targetMembership] = await Promise.all([
      this.getMembership(roomId, actorId),
      this.prisma.roomMembership.findUnique({
        where: { roomId_userId: { roomId, userId: targetId } },
        include: { user: { select: { username: true } } },
      }),
    ]);
    if (!actorMembership || ROLE_RANK[actorMembership.role] < ROLE_RANK['ADMIN']) {
      throw new ForbiddenException('Insufficient role to ban');
    }
    if (targetMembership && ROLE_RANK[actorMembership.role] <= ROLE_RANK[targetMembership.role]) {
      throw new ForbiddenException('Insufficient role to ban this member');
    }
    // Look up username even if target has no current membership (may be banning a non-member)
    const targetUser =
      targetMembership?.user ??
      (await this.prisma.user.findUnique({
        where: { id: targetId },
        select: { username: true },
      }));
    await this.prisma.$transaction([
      this.prisma.roomBan.create({
        data: {
          roomId,
          userId: targetId,
          bannedById: actorId,
          ...(reason !== undefined ? { reason } : {}),
        },
      }),
      this.prisma.roomMembership.deleteMany({
        where: { roomId, userId: targetId },
      }),
    ]);
    return { username: targetUser?.username ?? '' };
  }

  async unbanUser(roomId: string, actorId: string, targetId: string): Promise<void> {
    const actorMembership = await this.getMembership(roomId, actorId);
    if (!actorMembership || ROLE_RANK[actorMembership.role] < ROLE_RANK['ADMIN']) {
      throw new ForbiddenException('Only admins and owners can unban users');
    }
    const ban = await this.prisma.roomBan.findFirst({
      where: { roomId, userId: targetId, liftedAt: null },
    });
    if (!ban) throw new NotFoundException('No active ban found for this user');
    await this.prisma.roomBan.update({
      where: { id: ban.id },
      data: { liftedAt: new Date() },
    });
  }

  async setRole(
    roomId: string,
    actorId: string,
    targetId: string,
    role: 'ADMIN' | 'MEMBER',
  ): Promise<void> {
    const actorMembership = await this.getMembership(roomId, actorId);
    if (!actorMembership || actorMembership.role !== 'OWNER') {
      throw new ForbiddenException('Only the room owner can change member roles');
    }
    // role === 'OWNER' is already prevented by SetRoleDto, but guard defensively
    if ((role as string) === 'OWNER') {
      throw new ForbiddenException('Cannot promote to OWNER via setRole — use transferOwnership');
    }
    const targetMembership = await this.getMembership(roomId, targetId);
    if (!targetMembership) throw new NotFoundException('Target is not a member');
    await this.prisma.roomMembership.update({
      where: { roomId_userId: { roomId, userId: targetId } },
      data: { role },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Messaging
  // ─────────────────────────────────────────────────────────────────────────

  private buildMessagePayload(msg: {
    id: string;
    roomId: string;
    authorId: string;
    author: { username: string };
    content: string;
    replyTo: { id: string; author: { username: string }; content: string } | null;
    editedAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    attachment?: {
      id: string;
      originalFilename: string;
      mimeType: string;
      size: bigint;
      thumbnailKey: string | null;
    } | null;
    reactions?: Array<{ emoji: string; user: { id: string } }>;
  }): RoomMessagePayload {
    return {
      id: msg.id,
      roomId: msg.roomId,
      authorId: msg.authorId,
      authorUsername: msg.author.username,
      content: msg.content,
      replyTo: msg.replyTo
        ? {
            id: msg.replyTo.id,
            authorUsername: msg.replyTo.author.username,
            content: msg.replyTo.content,
          }
        : null,
      editedAt: msg.editedAt?.toISOString() ?? null,
      deletedAt: msg.deletedAt?.toISOString() ?? null,
      createdAt: msg.createdAt.toISOString(),
      attachment: msg.attachment
        ? {
            id: msg.attachment.id,
            originalFilename: msg.attachment.originalFilename,
            mimeType: msg.attachment.mimeType,
            size: Number(msg.attachment.size),
            thumbnailAvailable: !!msg.attachment.thumbnailKey,
          }
        : null,
      reactions: this.aggregateReactions(msg.reactions ?? []),
    };
  }

  private aggregateReactions(
    reactions: Array<{ emoji: string; user: { id: string } }>,
  ): ReactionSummary[] {
    const map = new Map<string, { count: number; userIds: string[] }>();
    for (const r of reactions) {
      const entry = map.get(r.emoji) ?? { count: 0, userIds: [] };
      entry.count++;
      entry.userIds.push(r.user.id);
      map.set(r.emoji, entry);
    }
    return Array.from(map.entries()).map(([emoji, { count, userIds }]) => ({
      emoji,
      count,
      userIds,
    }));
  }

  async sendMessage(
    roomId: string,
    userId: string,
    dto: SendMessageDto,
  ): Promise<RoomMessagePayload> {
    await this.assertMember(roomId, userId);
    await this.assertNotBanned(roomId, userId);

    if (dto.attachmentId) {
      const attachment = await this.prisma.attachment.findUnique({
        where: { id: dto.attachmentId },
      });
      if (!attachment) throw new NotFoundException('Attachment not found');
      if (attachment.uploaderId !== userId) {
        throw new ForbiddenException('You do not own this attachment');
      }
      if (attachment.roomId !== roomId) {
        throw new BadRequestException('Attachment does not belong to this room');
      }
      if (!attachment.committedAt) {
        throw new BadRequestException('Attachment has not been committed yet');
      }

      // Check that attachment is not already linked to a message
      const alreadyLinked = await this.prisma.roomMessage.findFirst({
        where: { attachmentId: dto.attachmentId },
      });
      if (alreadyLinked) {
        throw new BadRequestException('Attachment is already linked to a message');
      }

      const msg = await this.prisma.roomMessage.create({
        data: {
          roomId,
          authorId: userId,
          content: dto.content ?? '',
          ...(dto.replyToId ? { replyToId: dto.replyToId } : {}),
          attachmentId: dto.attachmentId ?? null,
        },
        include: {
          author: { select: { username: true } },
          replyTo: { include: { author: { select: { username: true } } } },
          attachment: { select: ATTACHMENT_SELECT },
        },
      });

      return this.buildMessagePayload(msg);
    }

    const msg = await this.prisma.roomMessage.create({
      data: {
        roomId,
        authorId: userId,
        content: dto.content,
        ...(dto.replyToId ? { replyToId: dto.replyToId } : {}),
      },
      include: {
        author: { select: { username: true } },
        replyTo: { include: { author: { select: { username: true } } } },
        attachment: { select: ATTACHMENT_SELECT },
      },
    });
    return this.buildMessagePayload(msg);
  }

  async editMessage(
    roomId: string,
    userId: string,
    messageId: string,
    dto: EditMessageDto,
  ): Promise<RoomMessagePayload> {
    await this.assertMember(roomId, userId);
    const message = await this.prisma.roomMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.roomId !== roomId) throw new NotFoundException('Message not found');
    if (message.authorId !== userId)
      throw new ForbiddenException('Only the author can edit this message');
    const updated = await this.prisma.roomMessage.update({
      where: { id: messageId },
      data: { content: dto.content, editedAt: new Date() },
      include: {
        author: { select: { username: true } },
        replyTo: { include: { author: { select: { username: true } } } },
        attachment: { select: ATTACHMENT_SELECT },
      },
    });
    return this.buildMessagePayload(updated);
  }

  async deleteMessage(roomId: string, userId: string, messageId: string): Promise<void> {
    const membership = await this.assertMember(roomId, userId);
    const message = await this.prisma.roomMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.roomId !== roomId) throw new NotFoundException('Message not found');
    const canDelete = message.authorId === userId || ROLE_RANK[membership.role] >= 1;
    if (!canDelete) throw new ForbiddenException('Insufficient permission to delete this message');
    await this.prisma.roomMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
  }

  async getMessages(
    roomId: string,
    userId: string,
    cursor?: string,
  ): Promise<{ messages: RoomMessagePayload[]; nextCursor: string | null }> {
    await this.assertMember(roomId, userId);
    const limit = 50;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic Prisma where
    const where: any = { roomId };
    if (cursor) {
      const parts = cursor.split('_');
      if (parts.length !== 2) throw new BadRequestException('Invalid cursor');
      const dateStr = parts[0] as string;
      const id = parts[1] as string;
      const cursorDate = new Date(dateStr);
      if (isNaN(cursorDate.getTime())) throw new BadRequestException('Invalid cursor');
      where.OR = [{ createdAt: { lt: cursorDate } }, { createdAt: cursorDate, id: { lt: id } }];
    }
    const rows = await this.prisma.roomMessage.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        author: { select: { username: true } },
        replyTo: { include: { author: { select: { username: true } } } },
        attachment: { select: ATTACHMENT_SELECT },
        reactions: {
          include: {
            user: { select: { id: true } },
          },
        },
      },
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const messages = page.map((m) => this.buildMessagePayload(m));
    const lastRow = page[page.length - 1];
    const nextCursor =
      hasMore && lastRow ? `${lastRow.createdAt.toISOString()}_${lastRow.id}` : null;
    return { messages, nextCursor };
  }

  async getMembers(roomId: string, userId: string): Promise<RoomMember[]> {
    await this.assertMember(roomId, userId);
    const memberships = await this.prisma.roomMembership.findMany({
      where: { roomId },
      include: { user: { select: { id: true, username: true } } },
    });
    return memberships.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      role: m.role as RoomRole,
      joinedAt: m.joinedAt.toISOString(),
    }));
  }

  async getActiveBans(
    roomId: string,
    actorId: string,
  ): Promise<
    Array<{
      id: string;
      userId: string;
      username: string;
      reason: string | null;
      createdAt: string;
    }>
  > {
    const actorMembership = await this.getMembership(roomId, actorId);
    if (!actorMembership || ROLE_RANK[actorMembership.role] < ROLE_RANK['ADMIN']) {
      throw new ForbiddenException('Only admins and owners can view bans');
    }
    const bans = await this.prisma.roomBan.findMany({
      where: { roomId, liftedAt: null },
      include: { user: { select: { id: true, username: true } } },
    });
    return bans.map((b) => ({
      id: b.id,
      userId: b.userId,
      username: b.user.username,
      reason: b.reason,
      createdAt: b.createdAt.toISOString(),
    }));
  }

  async toggleRoomReaction(
    roomId: string,
    userId: string,
    messageId: string,
    emoji: string,
  ): Promise<ReactionSummary[]> {
    await this.assertMember(roomId, userId);
    await this.assertNotBanned(roomId, userId);
    const existing = await this.prisma.reaction.findUnique({
      where: { userId_emoji_roomMessageId: { userId, emoji, roomMessageId: messageId } },
    });
    if (existing) {
      await this.prisma.reaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.reaction.create({
        data: { emoji, userId, roomMessageId: messageId },
      });
    }
    const reactions = await this.prisma.reaction.findMany({
      where: { roomMessageId: messageId },
      include: { user: { select: { id: true } } },
    });
    return this.aggregateReactions(reactions);
  }
}
