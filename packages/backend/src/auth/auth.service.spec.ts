import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { ArgonService } from './argon.service';
import { MailService } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  session: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  passwordReset: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
};

const mockArgon = {
  hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
  verify: jest.fn(),
};

const mockMail = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };
const mockJwt = { sign: jest.fn().mockReturnValue('access-token-123') };
const mockConfig = { get: jest.fn() };

const meta = { userAgent: 'jest', ipAddress: '127.0.0.1' };

const fakeUser = {
  id: 'user-1',
  email: 'alice@example.com',
  username: 'alice',
  passwordHash: '$argon2id$hashed',
  deletedAt: null,
  createdAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ArgonService, useValue: mockArgon },
        { provide: MailService, useValue: mockMail },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        email: 'alice@example.com',
        username: 'other',
      });
      await expect(
        service.register(
          { email: 'alice@example.com', password: 'pass1234', username: 'new' },
          meta,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when username already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        email: 'other@example.com',
        username: 'alice',
      });
      await expect(
        service.register(
          { email: 'new@example.com', password: 'pass1234', username: 'alice' },
          meta,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('creates user with hashed password and returns tokens', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(fakeUser);
      mockPrisma.session.create.mockResolvedValue({ id: 'sess-1' });

      const result = await service.register(
        { email: 'alice@example.com', password: 'pass1234', username: 'alice' },
        meta,
      );

      expect(mockArgon.hash).toHaveBeenCalledWith('pass1234');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ passwordHash: '$argon2id$hashed' }),
        }),
      );
      expect(result.accessToken).toBe('access-token-123');
      expect(typeof result.rawRefreshToken).toBe('string');
      expect(result.rawRefreshToken.length).toBeGreaterThan(0);
    });

    it('does not store the raw refresh token in DB (stores hash)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(fakeUser);
      mockPrisma.session.create.mockResolvedValue({ id: 'sess-1' });

      const result = await service.register(
        { email: 'alice@example.com', password: 'pass1234', username: 'alice' },
        meta,
      );

      const sessionCreateArg = mockPrisma.session.create.mock.calls[0][0];
      expect(sessionCreateArg.data.refreshToken).not.toBe(result.rawRefreshToken);
    });
  });

  describe('validateUser', () => {
    it('throws UnauthorizedException for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.validateUser('nobody@example.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for soft-deleted user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...fakeUser, deletedAt: new Date() });
      await expect(service.validateUser('alice@example.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockArgon.verify.mockResolvedValue(false);
      await expect(service.validateUser('alice@example.com', 'wrongpass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns the user for correct credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockArgon.verify.mockResolvedValue(true);
      const user = await service.validateUser('alice@example.com', 'pass1234');
      expect(user.id).toBe('user-1');
    });
  });

  describe('login', () => {
    it('returns access token and raw refresh token', async () => {
      mockPrisma.session.create.mockResolvedValue({ id: 'sess-1' });
      const result = await service.login('user-1', 'alice@example.com', 'alice', meta);
      expect(result.accessToken).toBe('access-token-123');
      expect(typeof result.rawRefreshToken).toBe('string');
    });
  });

  describe('getSessions', () => {
    it('returns sessions for the user ordered by lastUsedAt desc', async () => {
      const sessions = [
        {
          id: 's1',
          userAgent: 'Chrome',
          ipAddress: '1.2.3.4',
          createdAt: new Date(),
          lastUsedAt: new Date(),
        },
      ];
      mockPrisma.session.findMany.mockResolvedValue(sessions);
      const result = await service.getSessions('user-1');
      expect(result).toEqual(sessions);
      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });
  });

  describe('revokeSession', () => {
    it('deletes only sessions belonging to the caller', async () => {
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });
      await service.revokeSession('user-1', 'sess-abc');
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'sess-abc', userId: 'user-1' },
      });
    });
  });

  describe('refreshToken', () => {
    it('throws UnauthorizedException when user is deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...fakeUser, deletedAt: new Date() });
      await expect(service.refreshToken('sess-1', 'user-1', meta)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('issues new tokens and deletes old session in a transaction', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockPrisma.session.delete.mockResolvedValue({ id: 'sess-1' });
      mockPrisma.session.create.mockResolvedValue({ id: 'sess-2' });

      const result = await service.refreshToken('sess-1', 'user-1', meta);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.session.delete).toHaveBeenCalledWith({ where: { id: 'sess-1' } });
      expect(result.accessToken).toBe('access-token-123');
      expect(typeof result.rawRefreshToken).toBe('string');
    });

    it('stores the SHA-256 hash of the new token in DB, not the raw value', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockPrisma.session.delete.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({ id: 'sess-2' });

      const result = await service.refreshToken('sess-1', 'user-1', meta);

      const createArg = mockPrisma.session.create.mock.calls.at(-1)?.[0] as {
        data: { refreshToken: string };
      };
      const { createHash } = await import('crypto');
      const expectedHash = createHash('sha256').update(result.rawRefreshToken).digest('hex');
      expect(createArg.data.refreshToken).toBe(expectedHash);
    });
  });

  describe('logout', () => {
    it('deletes only the specified session', async () => {
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });
      await service.logout('sess-xyz');
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { id: 'sess-xyz' } });
    });
  });

  describe('changePassword', () => {
    it('throws UnauthorizedException when current password is wrong', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(fakeUser);
      mockArgon.verify.mockResolvedValue(false);
      await expect(
        service.changePassword('user-1', { currentPassword: 'wrong', newPassword: 'newpass123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for soft-deleted user', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ ...fakeUser, deletedAt: new Date() });
      await expect(
        service.changePassword('user-1', { currentPassword: 'any', newPassword: 'newpass123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('hashes new password and revokes all sessions on success', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(fakeUser);
      mockArgon.verify.mockResolvedValue(true);
      mockArgon.hash.mockResolvedValue('$argon2id$newhash');
      mockPrisma.user.update.mockResolvedValue(fakeUser);
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 2 });

      await service.changePassword('user-1', {
        currentPassword: 'oldpass',
        newPassword: 'newpass123',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockArgon.hash).toHaveBeenCalledWith('newpass123');
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });
  });

  describe('requestPasswordReset', () => {
    it('returns silently for unknown email (no user enumeration)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.requestPasswordReset('nobody@x.com')).resolves.toBeUndefined();
      expect(mockMail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('returns silently for deleted user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...fakeUser, deletedAt: new Date() });
      await expect(service.requestPasswordReset('alice@example.com')).resolves.toBeUndefined();
      expect(mockMail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('creates a PasswordReset row and sends email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockPrisma.passwordReset.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.passwordReset.create.mockResolvedValue({ id: 'pr-1' });

      await service.requestPasswordReset('alice@example.com');

      expect(mockPrisma.passwordReset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            token: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );
      expect(mockMail.sendPasswordReset).toHaveBeenCalledWith(
        'alice@example.com',
        expect.any(String),
      );
    });

    it('stores the hash in DB, not the raw token, and emails the raw token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockPrisma.passwordReset.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.passwordReset.create.mockResolvedValue({ id: 'pr-1' });

      await service.requestPasswordReset('alice@example.com');

      const createCall = mockPrisma.passwordReset.create.mock.calls[0][0] as {
        data: { token: string };
      };
      const mailCall = mockMail.sendPasswordReset.mock.calls[0] as [string, string];
      expect(mailCall[1]).not.toBe(createCall.data.token);
      expect(createCall.data.token).toHaveLength(64); // SHA-256 hex
    });
  });

  describe('resetPassword', () => {
    const fakeReset = {
      id: 'pr-1',
      userId: 'user-1',
      token: 'stored-hash',
      expiresAt: new Date(Date.now() + 3600_000),
      usedAt: null,
    };

    it('throws BadRequestException for unknown token', async () => {
      mockPrisma.passwordReset.findUnique.mockResolvedValue(null);
      await expect(
        service.resetPassword({ token: 'bad-token', newPassword: 'newpass123' }),
      ).rejects.toThrow(expect.objectContaining({ status: 400 }));
    });

    it('throws BadRequestException for already-used token', async () => {
      mockPrisma.passwordReset.findUnique.mockResolvedValue({ ...fakeReset, usedAt: new Date() });
      await expect(
        service.resetPassword({ token: 'used-token', newPassword: 'newpass123' }),
      ).rejects.toThrow(expect.objectContaining({ status: 400 }));
    });

    it('throws BadRequestException for expired token', async () => {
      mockPrisma.passwordReset.findUnique.mockResolvedValue({
        ...fakeReset,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.resetPassword({ token: 'expired-token', newPassword: 'newpass123' }),
      ).rejects.toThrow(expect.objectContaining({ status: 400 }));
    });

    it('updates password, marks token used, revokes all sessions on success', async () => {
      mockPrisma.passwordReset.findUnique.mockResolvedValue(fakeReset);
      mockArgon.hash.mockResolvedValue('$argon2id$newhash');
      mockPrisma.user.update.mockResolvedValue(fakeUser);
      mockPrisma.passwordReset.update.mockResolvedValue({ ...fakeReset, usedAt: new Date() });
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.resetPassword({ token: 'valid-raw-token', newPassword: 'newpass123' });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockArgon.hash).toHaveBeenCalledWith('newpass123');
      expect(mockPrisma.passwordReset.update).toHaveBeenCalledWith({
        where: { id: 'pr-1' },
        data: { usedAt: expect.any(Date) },
      });
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });
  });
});
