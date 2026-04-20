import { Controller, Get, Delete, Param, UseGuards, HttpCode } from '@nestjs/common';
import { AuthService, SessionInfo } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '@chatrix/shared';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private auth: AuthService) {}

  @Get('sessions')
  getSessions(@CurrentUser() user: JwtPayload): Promise<SessionInfo[]> {
    return this.auth.getSessions(user.sub);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  revokeSession(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
    return this.auth.revokeSession(user.sub, id);
  }
}
