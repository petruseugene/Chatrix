import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  UsePipes,
  HttpCode,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService, SessionInfo } from '../auth/auth.service';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SearchUsersQueryDto } from './dto/search-users-query.dto';
import type { JwtPayload, UserSearchResult } from '@chatrix/shared';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private auth: AuthService,
    private usersService: UsersService,
  ) {}

  @Get('search')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  searchUsers(
    @Query() query: SearchUsersQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<UserSearchResult[]> {
    return this.usersService.searchUsers(user.sub, query.q);
  }

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
