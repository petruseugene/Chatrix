import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ROOM_EVENTS } from '@chatrix/shared';
import type { JwtPayload, SendRoomMessagePayload } from '@chatrix/shared';
import { RoomsService } from './rooms.service';
import { ReactRoomMessageDto } from './dto/react-message.dto';

// Simple in-memory rate limiter: userId → { count, resetAt }
const messageRateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10_000;

function checkMessageRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = messageRateMap.get(userId);
  if (!entry || now >= entry.resetAt) {
    messageRateMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

@WebSocketGateway({ cors: { origin: process.env['CORS_ORIGIN'], credentials: true } })
export class RoomsGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly roomsService: RoomsService,
    private readonly jwt: JwtService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = socket.handshake.auth['token'] as string | undefined;
      if (!token) {
        socket.disconnect();
        return;
      }

      const payload = this.jwt.verify<JwtPayload>(token);
      socket.data['userId'] = payload.sub;
      socket.data['username'] = payload.username;

      // Join all room:* socket rooms the user is a member of
      const rooms = await this.roomsService.listMyRooms(payload.sub);
      for (const r of rooms) {
        await socket.join(`room:${r.id}`);
      }
    } catch {
      socket.disconnect();
    }
  }

  @SubscribeMessage(ROOM_EVENTS.MESSAGE_SEND)
  async handleMessageSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: SendRoomMessagePayload,
  ): Promise<void> {
    try {
      const userId = socket.data['userId'] as string | undefined;
      if (!userId) throw new WsException('Unauthorized');

      if (!checkMessageRateLimit(userId)) {
        throw new WsException('Rate limit exceeded — slow down');
      }

      const message = await this.roomsService.sendMessage(data.roomId, userId, {
        content: data.content,
        ...(data.replyToId !== undefined ? { replyToId: data.replyToId } : {}),
        ...(data.attachmentId !== undefined ? { attachmentId: data.attachmentId } : {}),
      });

      this.server.to(`room:${data.roomId}`).emit(ROOM_EVENTS.MESSAGE_NEW, message);
    } catch (e) {
      if (e instanceof WsException) throw e;
      throw new WsException('Failed to send message');
    }
  }

  @SubscribeMessage(ROOM_EVENTS.MESSAGE_EDIT)
  async handleMessageEdit(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { roomId: string; messageId: string; content: string },
  ): Promise<void> {
    try {
      const userId = socket.data['userId'] as string | undefined;
      if (!userId) throw new WsException('Unauthorized');

      const updated = await this.roomsService.editMessage(data.roomId, userId, data.messageId, {
        content: data.content,
      });

      this.server.to(`room:${data.roomId}`).emit(ROOM_EVENTS.MESSAGE_EDITED, updated);
    } catch (e) {
      if (e instanceof WsException) throw e;
      throw new WsException('Failed to edit message');
    }
  }

  @SubscribeMessage(ROOM_EVENTS.MESSAGE_DELETE)
  async handleMessageDelete(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { roomId: string; messageId: string },
  ): Promise<void> {
    try {
      const userId = socket.data['userId'] as string | undefined;
      if (!userId) throw new WsException('Unauthorized');

      await this.roomsService.deleteMessage(data.roomId, userId, data.messageId);

      this.server
        .to(`room:${data.roomId}`)
        .emit(ROOM_EVENTS.MESSAGE_DELETED, { roomId: data.roomId, messageId: data.messageId });
    } catch (e) {
      if (e instanceof WsException) throw e;
      throw new WsException('Failed to delete message');
    }
  }

  @SubscribeMessage(ROOM_EVENTS.MESSAGE_REACT)
  async handleMessageReact(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: ReactRoomMessageDto,
  ): Promise<void> {
    try {
      const userId = socket.data['userId'] as string | undefined;
      if (!userId) throw new WsException('Unauthorized');
      const reactions = await this.roomsService.toggleRoomReaction(
        data.roomId,
        userId,
        data.messageId,
        data.emoji,
      );
      this.server.to(`room:${data.roomId}`).emit(ROOM_EVENTS.REACTION_UPDATED, {
        messageId: data.messageId,
        roomId: data.roomId,
        reactions,
      });
    } catch (e) {
      if (e instanceof WsException) throw e;
      throw new WsException('Failed to toggle reaction');
    }
  }

  @SubscribeMessage(ROOM_EVENTS.TYPING_START)
  async handleTypingStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { roomId: string },
  ): Promise<void> {
    const userId = socket.data['userId'] as string | undefined;
    const username = socket.data['username'] as string | undefined;
    if (!userId || !username) return;
    const membership = await this.roomsService.getMembership(data.roomId, userId);
    if (!membership) return; // silently ignore — not a member
    socket.to(`room:${data.roomId}`).emit(ROOM_EVENTS.TYPING, {
      roomId: data.roomId,
      userId,
      username,
      isTyping: true,
    });
  }

  @SubscribeMessage(ROOM_EVENTS.TYPING_STOP)
  async handleTypingStop(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { roomId: string },
  ): Promise<void> {
    const userId = socket.data['userId'] as string | undefined;
    const username = socket.data['username'] as string | undefined;
    if (!userId || !username) return;
    const membership = await this.roomsService.getMembership(data.roomId, userId);
    if (!membership) return; // silently ignore — not a member
    socket.to(`room:${data.roomId}`).emit(ROOM_EVENTS.TYPING, {
      roomId: data.roomId,
      userId,
      username,
      isTyping: false,
    });
  }

  // Called by RoomsController after a user joins a room, so their active sockets join the room:* room
  async joinRoomSockets(userId: string, roomId: string): Promise<void> {
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    for (const s of sockets) {
      await s.join(`room:${roomId}`);
    }
  }
}
