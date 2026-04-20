import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ArgonService } from './argon.service';
import { MailService } from './mail.service';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { JwtPayload } from '@chatrix/shared';
import type { AppConfig } from '../config/config.schema';

export interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResponse {
  accessToken: string;
  rawRefreshToken: string;
}

export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastUsedAt: Date;
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function generateToken(): string {
  return randomBytes(64).toString('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private argon: ArgonService,
    private mail: MailService,
    private config: ConfigService<AppConfig, true>,
  ) {}

  async register(dto: RegisterDto, meta: SessionMeta): Promise<AuthResponse> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing?.email === dto.email) throw new ConflictException('Email already registered');
    if (existing?.username === dto.username) throw new ConflictException('Username already taken');

    const passwordHash = await this.argon.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { email: dto.email, username: dto.username, passwordHash },
    });

    return this.issueTokens(user.id, user.email, user.username, meta);
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<{
    id: string;
    email: string;
    username: string;
    passwordHash: string;
    deletedAt: Date | null;
    createdAt: Date;
  }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) throw new UnauthorizedException();
    const valid = await this.argon.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException();
    return user;
  }

  async login(
    userId: string,
    email: string,
    username: string,
    meta: SessionMeta,
  ): Promise<AuthResponse> {
    return this.issueTokens(userId, email, username, meta);
  }

  async refreshToken(sessionId: string, userId: string, meta: SessionMeta): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new UnauthorizedException();

    const rawRefreshToken = generateToken();
    const hashed = hashToken(rawRefreshToken);

    await this.prisma.$transaction([
      this.prisma.session.delete({ where: { id: sessionId } }),
      this.prisma.session.create({
        data: {
          userId,
          refreshToken: hashed,
          userAgent: meta.userAgent ?? null,
          ipAddress: meta.ipAddress ?? null,
        },
      }),
    ]);

    const payload: JwtPayload = { sub: user.id, email: user.email, username: user.username };
    const accessToken = this.jwt.sign(payload);
    return { accessToken, rawRefreshToken };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  async getSessions(userId: string): Promise<SessionInfo[]> {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastUsedAt: true },
    });
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId, userId } });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.deletedAt) throw new UnauthorizedException('Account deleted');
    const valid = await this.argon.verify(user.passwordHash, dto.currentPassword);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const newHash = await this.argon.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } }),
      this.prisma.session.deleteMany({ where: { userId } }),
    ]);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) return;

    const rawToken = generateToken();
    const hashed = hashToken(rawToken);

    await this.prisma.$transaction([
      this.prisma.passwordReset.deleteMany({ where: { userId: user.id } }),
      this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          token: hashed,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      }),
    ]);

    await this.mail.sendPasswordReset(email, rawToken);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const hashed = hashToken(dto.token);
    const reset = await this.prisma.passwordReset.findUnique({ where: { token: hashed } });

    if (!reset) throw new BadRequestException('Invalid or expired reset token');
    if (reset.usedAt) throw new BadRequestException('Reset token already used');
    if (reset.expiresAt < new Date()) throw new BadRequestException('Reset token has expired');

    const newHash = await this.argon.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: newHash } }),
      this.prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      this.prisma.session.deleteMany({ where: { userId: reset.userId } }),
    ]);
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.session.deleteMany({ where: { userId } }),
      this.prisma.passwordReset.deleteMany({ where: { userId } }),
      this.prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } }),
    ]);
  }

  private async issueTokens(
    userId: string,
    email: string,
    username: string,
    meta: SessionMeta,
  ): Promise<AuthResponse> {
    const rawRefreshToken = generateToken();
    const hashed = hashToken(rawRefreshToken);

    await this.prisma.session.create({
      data: {
        userId,
        refreshToken: hashed,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
      },
    });

    const payload: JwtPayload = { sub: userId, email, username };
    const accessToken = this.jwt.sign(payload);
    return { accessToken, rawRefreshToken };
  }
}
