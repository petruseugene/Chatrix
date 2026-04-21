import { Test, TestingModule } from '@nestjs/testing';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload, FriendPresence } from '@chatrix/shared';

const makeMockPresenceService = () => ({
  getFriendPresence: jest.fn(),
});

const CALLER_ID = 'user-abc-123';
const jwtUser: JwtPayload = { sub: CALLER_ID, email: 'user@example.com', username: 'testuser' };

const fakeFriendPresence: FriendPresence[] = [
  { userId: 'friend-1', username: 'alice', status: 'online' },
  { userId: 'friend-2', username: 'bob', status: 'offline' },
];

describe('PresenceController', () => {
  let controller: PresenceController;
  let mockPresenceService: ReturnType<typeof makeMockPresenceService>;

  beforeEach(async () => {
    mockPresenceService = makeMockPresenceService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PresenceController],
      providers: [{ provide: PresenceService, useValue: mockPresenceService }],
    }).compile();

    controller = module.get(PresenceController);
  });

  describe('GET /presence/friends', () => {
    it('calls PresenceService.getFriendPresence with the current user id', async () => {
      mockPresenceService.getFriendPresence.mockResolvedValue(fakeFriendPresence);

      await controller.getFriendPresence(jwtUser);

      expect(mockPresenceService.getFriendPresence).toHaveBeenCalledWith(CALLER_ID);
    });

    it('returns the FriendPresence array from the service', async () => {
      mockPresenceService.getFriendPresence.mockResolvedValue(fakeFriendPresence);

      const result = await controller.getFriendPresence(jwtUser);

      expect(result).toEqual(fakeFriendPresence);
    });

    it('returns an empty array when the user has no friends', async () => {
      mockPresenceService.getFriendPresence.mockResolvedValue([]);

      const result = await controller.getFriendPresence(jwtUser);

      expect(result).toEqual([]);
    });
  });

  describe('JwtAuthGuard metadata', () => {
    it('applies JwtAuthGuard to the controller class', () => {
      const guards = Reflect.getMetadata('__guards__', PresenceController);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
    });
  });
});
