import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  PRESENCE_EVENTS,
  PresenceChangedPayload,
  ROOM_EVENTS,
  RoomMemberEventPayload,
} from '@chatrix/shared';

@Injectable()
export class EventsService {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    if (!this.server) {
      return;
    }
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitPresenceChanged(friendIds: string[], payload: PresenceChangedPayload): void {
    if (!this.server) {
      return;
    }

    for (const friendId of friendIds) {
      this.server.to(`user:${friendId}`).emit(PRESENCE_EVENTS.CHANGED, payload);
    }
  }

  emitRoomMemberJoined(roomId: string, payload: RoomMemberEventPayload): void {
    if (!this.server) return;
    this.server.to(`room:${roomId}`).emit(ROOM_EVENTS.MEMBER_JOINED, payload);
  }

  emitRoomMemberLeft(roomId: string, payload: RoomMemberEventPayload): void {
    if (!this.server) return;
    this.server.to(`room:${roomId}`).emit(ROOM_EVENTS.MEMBER_LEFT, payload);
  }

  emitRoomMemberKicked(roomId: string, payload: RoomMemberEventPayload): void {
    if (!this.server) return;
    this.server.to(`room:${roomId}`).emit(ROOM_EVENTS.MEMBER_KICKED, payload);
  }

  emitRoomMemberBanned(roomId: string, payload: RoomMemberEventPayload): void {
    if (!this.server) return;
    this.server.to(`room:${roomId}`).emit(ROOM_EVENTS.MEMBER_BANNED, payload);
  }
}
