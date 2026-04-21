import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
@WebSocketGateway({ cors: { origin: process.env['CORS_ORIGIN'], credentials: true } })
export class FriendshipGateway {
  @WebSocketServer() server!: Server;

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
