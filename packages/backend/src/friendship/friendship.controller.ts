import { Controller, Post, Delete, Get, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { JwtPayload } from '@chatrix/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FriendshipService } from './friendship.service';
import { SendFriendRequestDto } from './dto/send-request.dto';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendshipController {
  constructor(private readonly friendshipService: FriendshipService) {}

  /** POST /friends/request — send a friend request (rate-limited 10/min) */
  @Post('request')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async sendRequest(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendFriendRequestDto,
  ): Promise<void> {
    await this.friendshipService.sendRequest(user.sub, dto.username);
  }

  /** POST /friends/accept/:requestId — accept an incoming friend request */
  @Post('accept/:requestId')
  @HttpCode(204)
  async acceptRequest(
    @CurrentUser() user: JwtPayload,
    @Param('requestId') requestId: string,
  ): Promise<void> {
    await this.friendshipService.acceptRequest(requestId, user.sub);
  }

  /** DELETE /friends/decline/:requestId — decline an incoming friend request */
  @Delete('decline/:requestId')
  @HttpCode(204)
  async declineRequest(
    @CurrentUser() user: JwtPayload,
    @Param('requestId') requestId: string,
  ): Promise<void> {
    await this.friendshipService.declineRequest(requestId, user.sub);
  }

  /** DELETE /friends/:friendId — remove an existing friend */
  @Delete(':friendId')
  @HttpCode(204)
  async removeFriend(
    @CurrentUser() user: JwtPayload,
    @Param('friendId') friendId: string,
  ): Promise<void> {
    await this.friendshipService.removeFriend(user.sub, friendId);
  }

  /** POST /friends/block/:userId — block a user */
  @Post('block/:userId')
  @HttpCode(204)
  async blockUser(@CurrentUser() user: JwtPayload, @Param('userId') userId: string): Promise<void> {
    await this.friendshipService.blockUser(user.sub, userId);
  }

  /** DELETE /friends/block/:userId — unblock a user */
  @Delete('block/:userId')
  @HttpCode(204)
  async unblockUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.friendshipService.unblockUser(user.sub, userId);
  }

  /** GET /friends — list all friends */
  @Get()
  async listFriends(
    @CurrentUser() user: JwtPayload,
  ): Promise<Array<{ friendId: string; username: string; createdAt: Date }>> {
    return this.friendshipService.listFriends(user.sub);
  }

  /** GET /friends/requests — list incoming pending friend requests */
  @Get('requests')
  async listPendingRequests(
    @CurrentUser() user: JwtPayload,
  ): Promise<
    Array<{
      id: string;
      fromUserId: string;
      fromUsername: string;
      fromUserCreatedAt: Date;
      createdAt: Date;
    }>
  > {
    return this.friendshipService.listPendingRequests(user.sub);
  }
}
