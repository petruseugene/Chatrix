import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { RoomDetail, RoomMember, RoomRole, RoomSummary } from '@chatrix/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRoomDto } from './dto/create-room.dto';
import type { UpdateRoomDto } from './dto/update-room.dto';

const ROLE_RANK = { OWNER: 2, ADMIN: 1, MEMBER: 0 } as const;

type RoomForSummary = {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  _count: { memberships: number };
};

type MembershipRow = { role: string; joinedAt: Date };

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async getMembership(roomId: string, userId: string) {
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
      myRole: membership?.role as RoomRole | undefined,
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
    return memberships.map((m) => this.buildRoomSummary(m.room, m));
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

  async inviteUser(roomId: string, actorId: string, targetUsername: string): Promise<void> {
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
  }

  async kickMember(roomId: string, actorId: string, targetId: string): Promise<void> {
    const [actorMembership, targetMembership] = await Promise.all([
      this.getMembership(roomId, actorId),
      this.getMembership(roomId, targetId),
    ]);
    if (!actorMembership) throw new ForbiddenException('Not a member');
    if (!targetMembership) throw new NotFoundException('Target is not a member');
    if (ROLE_RANK[actorMembership.role] <= ROLE_RANK[targetMembership.role]) {
      throw new ForbiddenException('Insufficient role to kick this member');
    }
    await this.prisma.roomMembership.delete({
      where: { roomId_userId: { roomId, userId: targetId } },
    });
  }

  async banUser(roomId: string, actorId: string, targetId: string, reason?: string): Promise<void> {
    const [actorMembership, targetMembership] = await Promise.all([
      this.getMembership(roomId, actorId),
      this.getMembership(roomId, targetId),
    ]);
    if (!actorMembership) throw new ForbiddenException('Not a member');
    if (targetMembership && ROLE_RANK[actorMembership.role] <= ROLE_RANK[targetMembership.role]) {
      throw new ForbiddenException('Insufficient role to ban this member');
    }
    await this.prisma.$transaction([
      this.prisma.roomBan.create({
        data: { roomId, userId: targetId, bannedById: actorId, reason },
      }),
      this.prisma.roomMembership.deleteMany({
        where: { roomId, userId: targetId },
      }),
    ]);
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
}
