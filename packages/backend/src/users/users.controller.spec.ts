import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload, UserSearchResult } from '@chatrix/shared';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUsersService = {
  searchUsers: jest.fn(),
};

const mockAuthService = {
  getSessions: jest.fn(),
  revokeSession: jest.fn(),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const callerPayload: JwtPayload = {
  sub: 'caller-id',
  email: 'caller@example.com',
  username: 'caller',
};

const searchResults: UserSearchResult[] = [
  { id: 'bob-id', username: 'bob', relationshipStatus: 'none' },
];

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get(UsersController);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /users/search
  // ─────────────────────────────────────────────────────────────────────────

  describe('searchUsers', () => {
    it('delegates to usersService.searchUsers with caller sub and query string', async () => {
      mockUsersService.searchUsers.mockResolvedValue(searchResults);

      const result = await controller.searchUsers({ q: 'bob' }, callerPayload);

      expect(mockUsersService.searchUsers).toHaveBeenCalledWith('caller-id', 'bob');
      expect(result).toEqual(searchResults);
    });

    it('returns the array from usersService.searchUsers unchanged', async () => {
      const expected: UserSearchResult[] = [
        { id: 'alice-id', username: 'alice', relationshipStatus: 'friend' },
        { id: 'carol-id', username: 'carol', relationshipStatus: 'pending_sent' },
      ];
      mockUsersService.searchUsers.mockResolvedValue(expected);

      const result = await controller.searchUsers({ q: 'al' }, callerPayload);

      expect(result).toStrictEqual(expected);
    });

    it('returns an empty array when usersService.searchUsers returns []', async () => {
      mockUsersService.searchUsers.mockResolvedValue([]);

      const result = await controller.searchUsers({ q: 'xyz' }, callerPayload);

      expect(result).toEqual([]);
    });

    it('calls usersService.searchUsers exactly once per request', async () => {
      mockUsersService.searchUsers.mockResolvedValue([]);

      await controller.searchUsers({ q: 'test' }, callerPayload);

      expect(mockUsersService.searchUsers).toHaveBeenCalledTimes(1);
    });
  });
});
