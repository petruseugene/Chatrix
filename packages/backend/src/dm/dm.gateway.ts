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
import type { JwtPayload } from '@chatrix/shared';
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

      // Join personal notification room
      await socket.join(`user:${payload.sub}`);

      // Join all existing DM thread rooms so the client receives events immediately
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
    @MessageBody() data: { threadId: string; content: string; replyToId?: string },
  ): Promise<void> {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) throw new WsException('Unauthorized');

    const message = await this.dm.sendMessage(data.threadId, userId, data.content, data.replyToId);
    this.server.to(`dm:thread:${data.threadId}`).emit(DM_EVENTS.MESSAGE_NEW, message);
  }

  @SubscribeMessage(DM_EVENTS.MESSAGE_EDIT)
  async handleMessageEdit(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string; content: string },
  ): Promise<void> {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) throw new WsException('Unauthorized');

    const message = await this.dm.editMessage(data.messageId, userId, data.content);
    this.server.to(`dm:thread:${message.threadId}`).emit(DM_EVENTS.MESSAGE_EDITED, message);
  }

  @SubscribeMessage(DM_EVENTS.MESSAGE_DELETE)
  async handleMessageDelete(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string },
  ): Promise<void> {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) throw new WsException('Unauthorized');

    const { threadId } = await this.dm.deleteMessage(data.messageId, userId);
    this.server
      .to(`dm:thread:${threadId}`)
      .emit(DM_EVENTS.MESSAGE_DELETED, { messageId: data.messageId });
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
