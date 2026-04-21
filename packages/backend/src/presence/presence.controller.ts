import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload, FriendPresence } from '@chatrix/shared';
import { PresenceService } from './presence.service';

@UseGuards(JwtAuthGuard)
@Controller('presence')
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Get('friends')
  async getFriendPresence(@CurrentUser() user: JwtPayload): Promise<FriendPresence[]> {
    return this.presenceService.getFriendPresence(user.sub);
  }
}
