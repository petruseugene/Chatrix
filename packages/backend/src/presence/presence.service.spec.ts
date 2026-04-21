import { Test, TestingModule } from '@nestjs/testing';
import { PresenceService } from './presence.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

// ---------------------------------------------------------------------------
// Mock Redis
// ---------------------------------------------------------------------------

const mockRedis = {
  zadd: jest.fn(),
  zrem: jest.fn(),
  zremrangebyscore: jest.fn(),
  zcard: jest.fn(),
  zrevrange: jest.fn(),
  sadd: jest.fn(),
  srem: jest.fn(),
  smembers: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  mget: jest.fn(),
};

// ---------------------------------------------------------------------------
// Mock PrismaService
// ---------------------------------------------------------------------------

const mockPrisma = {
  friendship: {
    findMany: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Mock EventsService
// ---------------------------------------------------------------------------

const mockEventsService = {
  emitPresenceChanged: jest.fn(),
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PresenceService', () => {
  let service: PresenceService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get(PresenceService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // recordHeartbeat
  // ─────────────────────────────────────────────────────────────────────────

  describe('recordHeartbeat', () => {
    it('calls ZADD on both tabs and activity ZSETs when isActive is true', async () => {
      await service.recordHeartbeat('user-1', 'tab-a', true);

      expect(mockRedis.zadd).toHaveBeenCalledTimes(2);

      const calls: [string, ...unknown[]][] = mockRedis.zadd.mock.calls as [string, ...unknown[]][];

      const tabsCall = calls.find((c) => (c[0] as string).includes(':tabs'));
      const activityCall = calls.find((c) => (c[0] as string).includes(':activity'));

      expect(tabsCall).toBeDefined();
      expect(activityCall).toBeDefined();

      expect(tabsCall![0]).toBe('presence:user:user-1:tabs');
      expect(activityCall![0]).toBe('presence:user:user-1:activity');
    });

    it('calls ZADD only on tabs ZSET when isActive is false', async () => {
      await service.recordHeartbeat('user-1', 'tab-a', false);

      expect(mockRedis.zadd).toHaveBeenCalledTimes(1);

      const calls: [string, ...unknown[]][] = mockRedis.zadd.mock.calls as [string, ...unknown[]][];

      const tabsCall = calls.find((c) => (c[0] as string).includes(':tabs'));
      const activityCall = calls.find((c) => (c[0] as string).includes(':activity'));

      expect(tabsCall).toBeDefined();
      expect(activityCall).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deriveStatus
  // ─────────────────────────────────────────────────────────────────────────

  describe('deriveStatus (via removeTab / sweep internals)', () => {
    it('returns offline when there are 0 live tabs', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(0);
      mockRedis.zrevrange.mockResolvedValue([]);

      const status = await (
        service as unknown as { deriveStatus(userId: string): Promise<string> }
      ).deriveStatus('user-1');

      expect(status).toBe('offline');
    });

    it('returns online when tabs present and last activity score ≤60s ago', async () => {
      const now = Date.now();
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(2);
      mockRedis.zrevrange.mockResolvedValue(['tab-a', String(now - 30_000)]);

      const status = await (
        service as unknown as { deriveStatus(userId: string): Promise<string> }
      ).deriveStatus('user-1');

      expect(status).toBe('online');
    });

    it('returns afk when tabs present and last activity score >60s ago', async () => {
      const now = Date.now();
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.zrevrange.mockResolvedValue(['tab-a', String(now - 90_000)]);

      const status = await (
        service as unknown as { deriveStatus(userId: string): Promise<string> }
      ).deriveStatus('user-1');

      expect(status).toBe('afk');
    });

    it('returns afk when tabs present but no activity entry', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.zrevrange.mockResolvedValue([]);

      const status = await (
        service as unknown as { deriveStatus(userId: string): Promise<string> }
      ).deriveStatus('user-1');

      expect(status).toBe('afk');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // removeTab
  // ─────────────────────────────────────────────────────────────────────────

  describe('removeTab', () => {
    it('calls emitPresenceChanged with offline when last tab is removed and status changes', async () => {
      mockRedis.zrem.mockResolvedValue(1);
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(0);
      mockRedis.zrevrange.mockResolvedValue([]);
      mockRedis.get.mockResolvedValue('online');
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);
      mockRedis.srem.mockResolvedValue(1);
      mockPrisma.friendship.findMany.mockResolvedValue([]);

      await service.removeTab('user-1', 'tab-a');

      expect(mockEventsService.emitPresenceChanged).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ userId: 'user-1', status: 'offline' }),
      );
    });

    it('does not call emitPresenceChanged when other tabs are still live', async () => {
      const now = Date.now();
      mockRedis.zrem.mockResolvedValue(1);
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(2);
      mockRedis.zrevrange.mockResolvedValue(['tab-b', String(now - 10_000)]);
      mockRedis.get.mockResolvedValue('online');

      await service.removeTab('user-1', 'tab-a');

      expect(mockEventsService.emitPresenceChanged).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Sweep (via onModuleInit interval)
  // ─────────────────────────────────────────────────────────────────────────

  describe('sweep', () => {
    it('does not call emitPresenceChanged when status is unchanged', async () => {
      mockRedis.smembers.mockResolvedValue(['user-1']);
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(1);
      const now = Date.now();
      mockRedis.zrevrange.mockResolvedValue(['tab-a', String(now - 10_000)]);
      mockRedis.get.mockResolvedValue('online');

      await (service as unknown as { runSweep(): Promise<void> }).runSweep();

      expect(mockEventsService.emitPresenceChanged).not.toHaveBeenCalled();
    });

    it('cleans up keys and removes user from tracked set when status changes to offline', async () => {
      mockRedis.smembers.mockResolvedValue(['user-1']);
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(0);
      mockRedis.zrevrange.mockResolvedValue([]);
      mockRedis.get.mockResolvedValue('online');
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);
      mockRedis.srem.mockResolvedValue(1);
      mockPrisma.friendship.findMany.mockResolvedValue([]);

      await (service as unknown as { runSweep(): Promise<void> }).runSweep();

      expect(mockRedis.del).toHaveBeenCalledWith('presence:user:user-1:tabs');
      expect(mockRedis.del).toHaveBeenCalledWith('presence:user:user-1:activity');
      expect(mockRedis.srem).toHaveBeenCalledWith('presence:tracked', 'user-1');
      expect(mockEventsService.emitPresenceChanged).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ userId: 'user-1', status: 'offline' }),
      );
    });
  });
});
