import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import type { PresenceStatus, FriendPresence } from '@chatrix/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

const TRACKED_KEY = 'presence:tracked';
const TAB_TTL_MS = 45_000;
const AFK_THRESHOLD_MS = 60_000;
const SWEEP_INTERVAL_MS = 10_000;

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private sweepInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  onModuleInit(): void {
    this.sweepInterval = setInterval(() => {
      void this.runSweep();
    }, SWEEP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.sweepInterval !== null) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
  }

  async recordHeartbeat(userId: string, tabId: string, isActive: boolean): Promise<void> {
    const expireAt = Date.now() + TAB_TTL_MS;
    await this.redis.zadd(this.tabsKey(userId), expireAt, tabId);
    if (isActive) {
      await this.redis.zadd(this.activityKey(userId), Date.now(), tabId);
    }
    await this.redis.sadd(TRACKED_KEY, userId);
  }

  async removeTab(userId: string, tabId: string): Promise<void> {
    await this.redis.zrem(this.tabsKey(userId), tabId);
    await this.redis.zrem(this.activityKey(userId), tabId);
    await this.maybeEmit(userId, await this.deriveStatus(userId));
  }

  async getFriendPresence(userId: string): Promise<FriendPresence[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: { select: { id: true, username: true } },
        userB: { select: { id: true, username: true } },
      },
    });

    if (friendships.length === 0) {
      return [];
    }

    const friends = friendships.map((f) => (f.userAId === userId ? f.userB : f.userA));
    const statusKeys = friends.map((f) => this.statusKey(f.id));
    const statuses = await this.redis.mget(...statusKeys);

    return friends.map((friend, i) => ({
      userId: friend.id,
      username: friend.username,
      status: (statuses[i] as PresenceStatus | null) ?? 'offline',
    }));
  }

  async runSweep(): Promise<void> {
    const userIds = await this.redis.smembers(TRACKED_KEY);
    for (const userId of userIds) {
      const status = await this.deriveStatus(userId);
      await this.maybeEmit(userId, status);
    }
  }

  private async deriveStatus(userId: string): Promise<PresenceStatus> {
    await this.redis.zremrangebyscore(this.tabsKey(userId), '-inf', Date.now() - 1);
    const liveTabCount = await this.redis.zcard(this.tabsKey(userId));

    if (liveTabCount === 0) {
      return 'offline';
    }

    const result = await this.redis.zrevrange(this.activityKey(userId), 0, 0, 'WITHSCORES');

    if (result.length < 2) {
      return 'afk';
    }

    const lastActivityScore = Number(result[1]);
    return Date.now() - lastActivityScore <= AFK_THRESHOLD_MS ? 'online' : 'afk';
  }

  private async maybeEmit(userId: string, newStatus: PresenceStatus): Promise<void> {
    const currentStatus = (await this.redis.get(this.statusKey(userId))) as PresenceStatus | null;

    if (currentStatus === newStatus) {
      return;
    }

    await this.redis.set(this.statusKey(userId), newStatus);

    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      select: { userAId: true, userBId: true },
    });

    const friendIds = friendships.map((f) => (f.userAId === userId ? f.userBId : f.userAId));

    this.eventsService.emitPresenceChanged(friendIds, { userId, status: newStatus });

    if (newStatus === 'offline') {
      await this.redis.del(this.tabsKey(userId));
      await this.redis.del(this.activityKey(userId));
      await this.redis.srem(TRACKED_KEY, userId);
    }
  }

  private tabsKey(userId: string): string {
    return `presence:user:${userId}:tabs`;
  }

  private activityKey(userId: string): string {
    return `presence:user:${userId}:activity`;
  }

  private statusKey(userId: string): string {
    return `presence:user:${userId}:status`;
  }
}
