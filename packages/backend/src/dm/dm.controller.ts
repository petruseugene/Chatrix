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
import type { JwtPayload, DmThreadPayload, DmMessagePayload } from '@chatrix/shared';
import { DmService } from './dm.service';
import { DmGateway } from './dm.gateway';
import { CreateThreadDto } from './dto/create-thread.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import type { DirectMessageThread } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('dm')
export class DmController {
  constructor(
    private readonly dmService: DmService,
    private readonly gateway: DmGateway,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // POST /dm/threads  →  201
  // ─────────────────────────────────────────────────────────────────────────

  @Post('threads')
  @HttpCode(201)
  async createThread(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateThreadDto,
  ): Promise<DirectMessageThread> {
    const thread = await this.dmService.getOrCreateThread(user.sub, body.recipientId);

    // Both participants' sockets join the thread room so they receive future events
    await this.gateway.joinThread(user.sub, thread.id);
    await this.gateway.joinThread(body.recipientId, thread.id);

    return thread;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /dm/threads  →  200
  // ─────────────────────────────────────────────────────────────────────────

  @Get('threads')
  async listThreads(@CurrentUser() user: JwtPayload): Promise<DmThreadPayload[]> {
    return this.dmService.listThreads(user.sub);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /dm/threads/:threadId/read  →  204
  // ─────────────────────────────────────────────────────────────────────────

  @Post('threads/:threadId/read')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async markThreadRead(
    @Param('threadId') threadId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.dmService.markThreadRead(threadId, user.sub);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /dm/threads/:threadId/messages  →  200
  // ─────────────────────────────────────────────────────────────────────────

  @Get('threads/:threadId/messages')
  async getMessages(
    @CurrentUser() user: JwtPayload,
    @Param('threadId') threadId: string,
    @Query() query: GetMessagesDto,
  ): Promise<DmMessagePayload[]> {
    const cursor =
      query.before && query.beforeId ? { before: query.before, beforeId: query.beforeId } : null;

    return this.dmService.getMessages(threadId, user.sub, cursor, query.limit);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /dm/messages/:messageId  →  200
  // ─────────────────────────────────────────────────────────────────────────

  @Patch('messages/:messageId')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async editMessage(
    @CurrentUser() user: JwtPayload,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ): Promise<DmMessagePayload> {
    return this.dmService.editMessage(messageId, user.sub, dto.content);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /dm/messages/:messageId  →  204
  // ─────────────────────────────────────────────────────────────────────────

  @Delete('messages/:messageId')
  @HttpCode(204)
  async deleteMessage(
    @CurrentUser() user: JwtPayload,
    @Param('messageId') messageId: string,
  ): Promise<void> {
    await this.dmService.deleteMessage(messageId, user.sub);
  }
}
