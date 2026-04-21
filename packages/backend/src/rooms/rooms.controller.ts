import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EventsService } from '../events/events.service';
import type { JwtPayload } from '@chatrix/shared';
import { RoomsService } from './rooms.service';
import { RoomsGateway } from './rooms.gateway';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { SetRoleDto } from './dto/set-role.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { SearchRoomsDto } from './dto/search-rooms.dto';
import { SendMessageDto } from './dto/send-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly eventsService: EventsService,
    private readonly roomsGateway: RoomsGateway,
  ) {}

  // POST /rooms
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async createRoom(@CurrentUser() user: JwtPayload, @Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(user.sub, dto);
  }

  // GET /rooms
  @Get()
  async listMyRooms(@CurrentUser() user: JwtPayload) {
    return this.roomsService.listMyRooms(user.sub);
  }

  // GET /rooms/public — must come BEFORE GET /rooms/:id
  @Get('public')
  async searchPublic(@CurrentUser() _user: JwtPayload, @Query() query: SearchRoomsDto) {
    return this.roomsService.searchPublic(query.search, query.cursor);
  }

  // GET /rooms/:id
  @Get(':id')
  async getRoom(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.roomsService.getRoom(id, user.sub);
  }

  // PATCH /rooms/:id
  @Patch(':id')
  async updateRoom(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomsService.updateRoom(id, user.sub, dto);
  }

  // DELETE /rooms/:id
  @Delete(':id')
  @HttpCode(204)
  async deleteRoom(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.roomsService.deleteRoom(id, user.sub);
  }

  // POST /rooms/:id/join
  @Post(':id/join')
  @HttpCode(204)
  async joinRoom(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.roomsService.joinRoom(id, user.sub);
    await this.roomsGateway.joinRoomSockets(user.sub, id);
    this.eventsService.emitRoomMemberJoined(id, {
      roomId: id,
      userId: user.sub,
      username: user.username,
    });
  }

  // POST /rooms/:id/leave
  @Post(':id/leave')
  @HttpCode(204)
  async leaveRoom(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.roomsService.leaveRoom(id, user.sub);
    this.eventsService.emitRoomMemberLeft(id, {
      roomId: id,
      userId: user.sub,
      username: user.username,
    });
  }

  // POST /rooms/:id/invite
  @Post(':id/invite')
  @HttpCode(204)
  async inviteUser(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: InviteUserDto,
  ): Promise<void> {
    const { targetUserId } = await this.roomsService.inviteUser(id, user.sub, dto.username);
    await this.roomsGateway.joinRoomSockets(targetUserId, id);
    this.eventsService.emitRoomMemberJoined(id, {
      roomId: id,
      userId: targetUserId,
      username: dto.username,
    });
  }

  // GET /rooms/:id/members
  @Get(':id/members')
  async getMembers(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.roomsService.getMembers(id, user.sub);
  }

  // DELETE /rooms/:id/members/:userId
  @Delete(':id/members/:userId')
  @HttpCode(204)
  async kickMember(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('userId') targetId: string,
  ): Promise<void> {
    const { username } = await this.roomsService.kickMember(id, user.sub, targetId);
    this.eventsService.emitRoomMemberKicked(id, { roomId: id, userId: targetId, username });
  }

  // POST /rooms/:id/bans/:userId  (ban target in URL, matching DELETE pattern)
  @Post(':id/bans/:userId')
  @HttpCode(204)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async banUser(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('userId') targetId: string,
    @Body() dto: BanUserDto,
  ): Promise<void> {
    const { username } = await this.roomsService.banUser(id, user.sub, targetId, dto.reason);
    this.eventsService.emitRoomMemberBanned(id, { roomId: id, userId: targetId, username });
  }

  // DELETE /rooms/:id/bans/:userId
  @Delete(':id/bans/:userId')
  @HttpCode(204)
  async unbanUser(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('userId') targetId: string,
  ): Promise<void> {
    await this.roomsService.unbanUser(id, user.sub, targetId);
  }

  // GET /rooms/:id/bans
  @Get(':id/bans')
  async getActiveBans(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.roomsService.getActiveBans(id, user.sub);
  }

  // PATCH /rooms/:id/members/:userId/role
  @Patch(':id/members/:userId/role')
  @HttpCode(204)
  async setRole(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('userId') targetId: string,
    @Body() dto: SetRoleDto,
  ): Promise<void> {
    await this.roomsService.setRole(id, user.sub, targetId, dto.role);
  }

  // GET /rooms/:id/messages
  @Get(':id/messages')
  async getMessages(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query() query: GetMessagesDto,
  ) {
    return this.roomsService.getMessages(id, user.sub, query.cursor);
  }

  // POST /rooms/:id/messages
  @Post(':id/messages')
  @HttpCode(201)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const msg = await this.roomsService.sendMessage(id, user.sub, dto);
    this.eventsService.emitRoomMessageNew(msg.roomId, msg);
    return msg;
  }

  // PATCH /rooms/:id/messages/:messageId
  @Patch(':id/messages/:messageId')
  async editMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.roomsService.editMessage(id, user.sub, messageId, dto);
  }

  // DELETE /rooms/:id/messages/:messageId
  @Delete(':id/messages/:messageId')
  @HttpCode(204)
  async deleteMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ): Promise<void> {
    await this.roomsService.deleteMessage(id, user.sub, messageId);
  }
}
