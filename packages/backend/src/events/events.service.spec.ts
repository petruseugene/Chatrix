import { EventsService } from './events.service';
import { PRESENCE_EVENTS } from '@chatrix/shared';
import type { PresenceChangedPayload } from '@chatrix/shared';
import type { Server } from 'socket.io';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(() => {
    service = new EventsService();
  });

  describe('emitPresenceChanged', () => {
    it('is a no-op when server is null', () => {
      // server is null by default — must not throw
      const payload: PresenceChangedPayload = { userId: 'u1', status: 'online' };
      expect(() => service.emitPresenceChanged(['f1', 'f2'], payload)).not.toThrow();
    });

    it('calls server.to(...).emit once per friendId when server is set', () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      const mockServer = { to: mockTo } as unknown as Server;

      service.setServer(mockServer);

      const payload: PresenceChangedPayload = { userId: 'u1', status: 'online' };
      service.emitPresenceChanged(['f1', 'f2', 'f3'], payload);

      expect(mockTo).toHaveBeenCalledTimes(3);
      expect(mockTo).toHaveBeenNthCalledWith(1, 'user:f1');
      expect(mockTo).toHaveBeenNthCalledWith(2, 'user:f2');
      expect(mockTo).toHaveBeenNthCalledWith(3, 'user:f3');

      expect(mockEmit).toHaveBeenCalledTimes(3);
      expect(mockEmit).toHaveBeenCalledWith(PRESENCE_EVENTS.CHANGED, payload);
    });

    it('emits to the correct room name for each friendId', () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      const mockServer = { to: mockTo } as unknown as Server;

      service.setServer(mockServer);

      const payload: PresenceChangedPayload = { userId: 'u42', status: 'afk' };
      service.emitPresenceChanged(['abc-123'], payload);

      expect(mockTo).toHaveBeenCalledWith('user:abc-123');
      expect(mockEmit).toHaveBeenCalledWith(PRESENCE_EVENTS.CHANGED, payload);
    });

    it('does nothing when friendIds list is empty', () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      const mockServer = { to: mockTo } as unknown as Server;

      service.setServer(mockServer);

      const payload: PresenceChangedPayload = { userId: 'u1', status: 'offline' };
      service.emitPresenceChanged([], payload);

      expect(mockTo).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });
});
