import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EventsService } from '../events/events.service';

@Injectable()
@WebSocketGateway({ cors: { origin: process.env['CORS_ORIGIN'], credentials: true } })
export class FriendshipGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;

  constructor(private readonly eventsService: EventsService) {}

  afterInit(server: Server): void {
    this.eventsService.setServer(server);
  }
}
