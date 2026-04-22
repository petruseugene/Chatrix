import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { DM_EVENTS } from '@chatrix/shared';
import type { JwtPayload, DmMessagePayload } from '@chatrix/shared';
import { DmService } from './dm.service';

@WebSocketGateway({ cors: { origin: process.env['CORS_ORIGIN'], credentials: true } })
export class DmGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly dm: DmService,
    private readonly jwt: JwtService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ─────────────────────────────────────────────────────────────────────────

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = socket.handshake.auth['token'] as string | undefined;
      if (!token) {
        socket.disconnect();
        return;
      }

      const payload = this.jwt.verify<JwtPayload>(token);
      socket.data['userId'] = payload.sub;

      await socket.join(`user:${payload.sub}`);

      const threads = await this.dm.listThreads(payload.sub);
      for (const t of threads) {
        await socket.join(`dm:thread:${t.id}`);
      }
    } catch {
      socket.disconnect();
    }
  }

  handleDisconnect(_socket: Socket): void {
    // Socket.IO handles room cleanup automatically on disconnect
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Message events
  // ─────────────────────────────────────────────────────────────────────────

  @SubscribeMessage(DM_EVENTS.MESSAGE_SEND)
  async handleMessageSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    data: { threadId: string; content: string; replyToId?: string; attachmentId?: string },
  ): Promise<void> {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) throw new WsException('Unauthorized');

    const message = await this.dm.sendMessage(
      data.threadId,
      userId,
      data.content,
      data.replyToId,
      data.attachmentId,
    );
    const authorUsername = await this.dm.getUsernameById(userId);
    const payload: DmMessagePayload = {
      id: message.id,
      threadId: message.threadId,
      authorId: message.authorId,
      authorUsername,
      content: message.content,
      replyToId: message.replyToId,
      editedAt: message.editedAt?.toISOString() ?? null,
      deletedAt: message.deletedAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
      attachment: message.attachment
        ? {
            id: message.attachment.id,
            originalFilename: message.attachment.originalFilename,
            mimeType: message.attachment.mimeType,
            size: Number(message.attachment.size),
            thumbnailAvailable: !!message.attachment.thumbnailKey,
          }
        : null,
    };
    this.server.to(`dm:thread:${data.threadId}`).emit(DM_EVENTS.MESSAGE_NEW, payload);
  }

  @SubscribeMessage(DM_EVENTS.MESSAGE_EDIT)
  async handleMessageEdit(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string; content: string },
  ): Promise<void> {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) throw new WsException('Unauthorized');

    const payload: DmMessagePayload = await this.dm.editMessage(
      data.messageId,
      userId,
      data.content,
    );
    this.server.to(`dm:thread:${payload.threadId}`).emit(DM_EVENTS.MESSAGE_EDITED, payload);
  }

  @SubscribeMessage(DM_EVENTS.MESSAGE_DELETE)
  async handleMessageDelete(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string },
  ): Promise<void> {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) throw new WsException('Unauthorized');

    const deleted = await this.dm.deleteMessage(data.messageId, userId);
    this.server.to(`dm:thread:${deleted.threadId}`).emit(DM_EVENTS.MESSAGE_DELETED, {
      id: data.messageId,
      threadId: deleted.threadId,
      deletedAt: deleted.deletedAt,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Typing indicators (not persisted)
  // ─────────────────────────────────────────────────────────────────────────

  @SubscribeMessage(DM_EVENTS.TYPING_START)
  async handleTypingStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { threadId: string },
  ): Promise<void> {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) return;
    socket.to(`dm:thread:${data.threadId}`).emit(DM_EVENTS.TYPING_START, {
      threadId: data.threadId,
      userId,
    });
  }

  @SubscribeMessage(DM_EVENTS.TYPING_STOP)
  async handleTypingStop(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { threadId: string },
  ): Promise<void> {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) return;
    socket.to(`dm:thread:${data.threadId}`).emit(DM_EVENTS.TYPING_STOP, {
      threadId: data.threadId,
      userId,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public helper — called by DmController after creating a new thread
  // so all sockets for both participants can join the new room
  // ─────────────────────────────────────────────────────────────────────────

  async joinThread(userId: string, threadId: string): Promise<void> {
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    for (const s of sockets) {
      await s.join(`dm:thread:${threadId}`);
    }
  }
}
