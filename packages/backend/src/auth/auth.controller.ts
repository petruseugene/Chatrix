import { Controller, Post, Delete, Body, Req, Res, UseGuards, HttpCode } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, SessionMeta } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard, RefreshUser } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestResetDto } from './dto/request-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { JwtPayload } from '@chatrix/shared';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  @HttpCode(201)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const result = await this.auth.register(dto, this.meta(req));
    this.setRefreshCookie(res, result.rawRefreshToken);
    return { accessToken: result.accessToken };
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(200)
  async login(
    @CurrentUser() user: { id: string; email: string; username: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const result = await this.auth.login(user.id, user.email, user.username, this.meta(req));
    this.setRefreshCookie(res, result.rawRefreshToken);
    return { accessToken: result.accessToken };
  }

  @UseGuards(JwtRefreshGuard)
  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentUser() user: RefreshUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(user.sessionId);
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
    });
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @CurrentUser() user: RefreshUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const result = await this.auth.refreshToken(user.sessionId, user.userId, this.meta(req));
    this.setRefreshCookie(res, result.rawRefreshToken);
    return { accessToken: result.accessToken };
  }

  @Post('request-reset')
  @HttpCode(200)
  async requestReset(@Body() dto: RequestResetDto): Promise<void> {
    await this.auth.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('account')
  @HttpCode(204)
  async deleteAccount(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.auth.deleteAccount(user.sub);
  }

  private meta(req: Request): SessionMeta {
    return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}
