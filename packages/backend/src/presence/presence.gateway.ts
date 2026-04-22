import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PRESENCE_EVENTS } from '@chatrix/shared';
import type { JwtPayload, PresenceHeartbeatPayload } from '@chatrix/shared';
import { PresenceService } from './presence.service';
import { EventsService } from '../events/events.service';

@WebSocketGateway({ cors: { origin: process.env['CORS_ORIGIN'], credentials: true } })
export class PresenceGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly presenceService: PresenceService,
    private readonly eventsService: EventsService,
    private readonly jwt: JwtService,
  ) {}

  afterInit(server: Server): void {
    this.eventsService.setServer(server);
  }

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = socket.handshake.auth['token'] as string | undefined;
      if (!token) {
        socket.disconnect();
        return;
      }

      const payload = this.jwt.verify<JwtPayload>(token);
      const tabId = socket.handshake.auth['tabId'] as string | undefined;
      if (!tabId) {
        // Not a presence socket (e.g. a DM-only socket) — skip presence setup without disconnecting
        return;
      }

      socket.data['userId'] = payload.sub;
      socket.data['tabId'] = tabId;

      await socket.join(`user:${payload.sub}`);
      await this.presenceService.recordHeartbeat(payload.sub, tabId, true);
    } catch {
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const userId = socket.data['userId'] as string | undefined;
    const tabId = socket.data['tabId'] as string | undefined;
    if (!userId || !tabId) {
      return;
    }
    await this.presenceService.removeTab(userId, tabId);
  }

  @SubscribeMessage(PRESENCE_EVENTS.HEARTBEAT)
  async handleHeartbeat(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: PresenceHeartbeatPayload,
  ): Promise<void> {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) throw new WsException('Unauthorized');

    if (
      typeof body !== 'object' ||
      body === null ||
      typeof body.tabId !== 'string' ||
      typeof body.isActive !== 'boolean'
    ) {
      throw new WsException('Invalid payload');
    }

    await this.presenceService.recordHeartbeat(userId, body.tabId, body.isActive);
  }
}
