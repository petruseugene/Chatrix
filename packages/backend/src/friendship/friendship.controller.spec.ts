import { Test, TestingModule } from '@nestjs/testing';
import { FriendshipController } from './friendship.controller';
import { FriendshipService } from './friendship.service';
import type { JwtPayload } from '@chatrix/shared';

// ---------------------------------------------------------------------------
// Mock FriendshipService
// ---------------------------------------------------------------------------

const mockService = {
  sendRequest: jest.fn(),
  acceptRequest: jest.fn(),
  declineRequest: jest.fn(),
  removeFriend: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  listFriends: jest.fn(),
  listPendingRequests: jest.fn(),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const currentUser: JwtPayload = { sub: 'user-1', email: 'alice@example.com', username: 'alice' };

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('FriendshipController', () => {
  let controller: FriendshipController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FriendshipController],
      providers: [{ provide: FriendshipService, useValue: mockService }],
    }).compile();

    controller = module.get(FriendshipController);
  });

  describe('sendRequest', () => {
    it('calls service.sendRequest with current user id and dto username', async () => {
      mockService.sendRequest.mockResolvedValue(undefined);

      await controller.sendRequest(currentUser, { username: 'bob' });

      expect(mockService.sendRequest).toHaveBeenCalledWith('user-1', 'bob');
    });
  });

  describe('acceptRequest', () => {
    it('calls service.acceptRequest with requestId and current user id', async () => {
      mockService.acceptRequest.mockResolvedValue(undefined);

      await controller.acceptRequest(currentUser, 'req-123');

      expect(mockService.acceptRequest).toHaveBeenCalledWith('req-123', 'user-1');
    });
  });

  describe('declineRequest', () => {
    it('calls service.declineRequest with requestId and current user id', async () => {
      mockService.declineRequest.mockResolvedValue(undefined);

      await controller.declineRequest(currentUser, 'req-123');

      expect(mockService.declineRequest).toHaveBeenCalledWith('req-123', 'user-1');
    });
  });

  describe('removeFriend', () => {
    it('calls service.removeFriend with current user id and friendId param', async () => {
      mockService.removeFriend.mockResolvedValue(undefined);

      await controller.removeFriend(currentUser, 'friend-456');

      expect(mockService.removeFriend).toHaveBeenCalledWith('user-1', 'friend-456');
    });
  });

  describe('blockUser', () => {
    it('calls service.blockUser with current user id and userId param', async () => {
      mockService.blockUser.mockResolvedValue(undefined);

      await controller.blockUser(currentUser, 'target-789');

      expect(mockService.blockUser).toHaveBeenCalledWith('user-1', 'target-789');
    });
  });

  describe('unblockUser', () => {
    it('calls service.unblockUser with current user id and userId param', async () => {
      mockService.unblockUser.mockResolvedValue(undefined);

      await controller.unblockUser(currentUser, 'target-789');

      expect(mockService.unblockUser).toHaveBeenCalledWith('user-1', 'target-789');
    });
  });

  describe('listFriends', () => {
    it('returns the result of service.listFriends for the current user', async () => {
      const friends = [{ friendId: 'bbb', username: 'bob', createdAt: new Date() }];
      mockService.listFriends.mockResolvedValue(friends);

      const result = await controller.listFriends(currentUser);

      expect(mockService.listFriends).toHaveBeenCalledWith('user-1');
      expect(result).toBe(friends);
    });
  });

  describe('listPendingRequests', () => {
    it('returns the result of service.listPendingRequests for the current user', async () => {
      const requests = [
        { id: 'req-1', fromUserId: 'aaa', fromUsername: 'alice', createdAt: new Date() },
      ];
      mockService.listPendingRequests.mockResolvedValue(requests);

      const result = await controller.listPendingRequests(currentUser);

      expect(mockService.listPendingRequests).toHaveBeenCalledWith('user-1');
      expect(result).toBe(requests);
    });
  });
});
