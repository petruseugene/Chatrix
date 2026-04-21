import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { PRESENCE_EVENTS, PresenceChangedPayload } from '@chatrix/shared';

@Injectable()
export class EventsService {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  emitPresenceChanged(friendIds: string[], payload: PresenceChangedPayload): void {
    if (!this.server) {
      return;
    }

    for (const friendId of friendIds) {
      this.server.to(`user:${friendId}`).emit(PRESENCE_EVENTS.CHANGED, payload);
    }
  }
}
