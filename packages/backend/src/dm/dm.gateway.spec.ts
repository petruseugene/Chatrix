import { Test } from '@nestjs/testing';
import { WsException } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import { DmGateway } from './dm.gateway';
import { DmService } from './dm.service';
import { PrismaService } from '../prisma/prisma.service';
import { DM_EVENTS } from '@chatrix/shared';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const makeMockDmService = () => ({
  listThreads: jest.fn(),
  sendMessage: jest.fn(),
  editMessage: jest.fn(),
  deleteMessage: jest.fn(),
});

const makeMockJwtService = () => ({
  verify: jest.fn(),
});

const makeMockPrismaService = () => ({
  directMessage: {
    findUnique: jest.fn(),
  },
});

const makeMockServer = () => ({
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  in: jest.fn().mockReturnThis(),
  fetchSockets: jest.fn().mockResolvedValue([]),
});

interface MakeSocketOpts {
  token?: string;
  toMock?: jest.Mock;
  emitMock?: jest.Mock;
}

function makeSocket(opts: MakeSocketOpts = {}): jest.Mocked<Socket> {
  const socketData: Record<string, unknown> = {};
  const auth: Record<string, unknown> = opts.token !== undefined ? { token: opts.token } : {};
  return {
    handshake: { auth },
    data: socketData,
    join: jest.fn().mockResolvedValue(undefined),
    to: opts.toMock ?? jest.fn().mockReturnThis(),
    emit: opts.emitMock ?? jest.fn(),
    disconnect: jest.fn(),
  } as unknown as jest.Mocked<Socket>;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-abc-123';
const THREAD_ID = 'thread-001';
const MSG_ID = 'msg-001';
const JWT_PAYLOAD = { sub: USER_ID, email: 'user@example.com', username: 'user' };

const fakeMessage = {
  id: MSG_ID,
  threadId: THREAD_ID,
  authorId: USER_ID,
  content: 'Hello',
  replyToId: null,
  editedAt: null,
  deletedAt: null,
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
};

const fakeThread = {
  id: THREAD_ID,
  userAId: USER_ID,
  userBId: 'user-other-456',
  createdAt: new Date('2024-01-01'),
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('DmGateway', () => {
  let gateway: DmGateway;
  let mockDmService: ReturnType<typeof makeMockDmService>;
  let mockJwtService: ReturnType<typeof makeMockJwtService>;
  let mockPrismaService: ReturnType<typeof makeMockPrismaService>;
  let mockServer: ReturnType<typeof makeMockServer>;

  beforeEach(async () => {
    mockDmService = makeMockDmService();
    mockJwtService = makeMockJwtService();
    mockPrismaService = makeMockPrismaService();
    mockServer = makeMockServer();

    const module = await Test.createTestingModule({
      providers: [
        DmGateway,
        { provide: DmService, useValue: mockDmService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    gateway = module.get(DmGateway);
    // Inject mock server (normally set by NestJS on WebSocketGateway init)
    gateway.server = mockServer as unknown as typeof gateway.server;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // handleConnection
  // ─────────────────────────────────────────────────────────────────────────

  describe('handleConnection', () => {
    it('disconnects socket when no token is provided in handshake auth', async () => {
      const socket = makeSocket(); // no token

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects socket when JWT verification fails', async () => {
      const socket = makeSocket({ token: 'bad.token' });
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('joins user personal room on successful connection', async () => {
      const socket = makeSocket({ token: 'valid.jwt' });
      mockJwtService.verify.mockReturnValue(JWT_PAYLOAD);
      mockDmService.listThreads.mockResolvedValue([]);

      await gateway.handleConnection(socket);

      expect(socket.join).toHaveBeenCalledWith(`user:${USER_ID}`);
    });

    it('joins all existing DM thread rooms on successful connection', async () => {
      const socket = makeSocket({ token: 'valid.jwt' });
      mockJwtService.verify.mockReturnValue(JWT_PAYLOAD);
      mockDmService.listThreads.mockResolvedValue([fakeThread]);

      await gateway.handleConnection(socket);

      expect(socket.join).toHaveBeenCalledWith(`dm:thread:${THREAD_ID}`);
    });

    it('stores userId in socket.data after successful auth', async () => {
      const socket = makeSocket({ token: 'valid.jwt' });
      mockJwtService.verify.mockReturnValue(JWT_PAYLOAD);
      mockDmService.listThreads.mockResolvedValue([]);

      await gateway.handleConnection(socket);

      expect(socket.data['userId']).toBe(USER_ID);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // handleMessageSend
  // ─────────────────────────────────────────────────────────────────────────

  describe('handleMessageSend', () => {
    it('throws WsException when socket has no userId (unauthenticated)', async () => {
      const socket = makeSocket();
      // socket.data.userId is undefined

      await expect(
        gateway.handleMessageSend(socket, { threadId: THREAD_ID, content: 'Hi' }),
      ).rejects.toThrow(WsException);
    });

    it(`calls DmService.sendMessage and emits ${DM_EVENTS.MESSAGE_NEW} to thread room`, async () => {
      const socket = makeSocket();
      socket.data['userId'] = USER_ID;
      mockDmService.sendMessage.mockResolvedValue(fakeMessage);

      await gateway.handleMessageSend(socket, { threadId: THREAD_ID, content: 'Hello' });

      expect(mockDmService.sendMessage).toHaveBeenCalledWith(
        THREAD_ID,
        USER_ID,
        'Hello',
        undefined,
      );
      expect(mockServer.to).toHaveBeenCalledWith(`dm:thread:${THREAD_ID}`);
      expect(mockServer.emit).toHaveBeenCalledWith(DM_EVENTS.MESSAGE_NEW, fakeMessage);
    });

    it('passes replyToId to DmService.sendMessage when provided', async () => {
      const socket = makeSocket();
      socket.data['userId'] = USER_ID;
      mockDmService.sendMessage.mockResolvedValue(fakeMessage);

      await gateway.handleMessageSend(socket, {
        threadId: THREAD_ID,
        content: 'A reply',
        replyToId: 'parent-msg-id',
      });

      expect(mockDmService.sendMessage).toHaveBeenCalledWith(
        THREAD_ID,
        USER_ID,
        'A reply',
        'parent-msg-id',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // handleMessageEdit
  // ─────────────────────────────────────────────────────────────────────────

  describe('handleMessageEdit', () => {
    it('throws WsException when socket has no userId (unauthenticated)', async () => {
      const socket = makeSocket();

      await expect(
        gateway.handleMessageEdit(socket, { messageId: MSG_ID, content: 'New' }),
      ).rejects.toThrow(WsException);
    });

    it(`emits ${DM_EVENTS.MESSAGE_EDITED} to the correct thread room after edit`, async () => {
      const socket = makeSocket();
      socket.data['userId'] = USER_ID;
      const editedMessage = { ...fakeMessage, content: 'Edited', editedAt: new Date() };
      mockDmService.editMessage.mockResolvedValue(editedMessage);
      mockPrismaService.directMessage.findUnique.mockResolvedValue({ threadId: THREAD_ID });

      await gateway.handleMessageEdit(socket, { messageId: MSG_ID, content: 'Edited' });

      expect(mockDmService.editMessage).toHaveBeenCalledWith(MSG_ID, USER_ID, 'Edited');
      expect(mockServer.to).toHaveBeenCalledWith(`dm:thread:${THREAD_ID}`);
      expect(mockServer.emit).toHaveBeenCalledWith(DM_EVENTS.MESSAGE_EDITED, editedMessage);
    });

    it('does not emit when message is not found after edit', async () => {
      const socket = makeSocket();
      socket.data['userId'] = USER_ID;
      mockDmService.editMessage.mockResolvedValue(fakeMessage);
      mockPrismaService.directMessage.findUnique.mockResolvedValue(null);

      await gateway.handleMessageEdit(socket, { messageId: MSG_ID, content: 'Edited' });

      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // handleMessageDelete
  // ─────────────────────────────────────────────────────────────────────────

  describe('handleMessageDelete', () => {
    it('throws WsException when socket has no userId (unauthenticated)', async () => {
      const socket = makeSocket();

      await expect(gateway.handleMessageDelete(socket, { messageId: MSG_ID })).rejects.toThrow(
        WsException,
      );
    });

    it(`fetches threadId, deletes message, and emits ${DM_EVENTS.MESSAGE_DELETED} to thread room`, async () => {
      const socket = makeSocket();
      socket.data['userId'] = USER_ID;
      mockPrismaService.directMessage.findUnique.mockResolvedValue({ threadId: THREAD_ID });
      mockDmService.deleteMessage.mockResolvedValue(undefined);

      await gateway.handleMessageDelete(socket, { messageId: MSG_ID });

      expect(mockDmService.deleteMessage).toHaveBeenCalledWith(MSG_ID, USER_ID);
      expect(mockServer.to).toHaveBeenCalledWith(`dm:thread:${THREAD_ID}`);
      expect(mockServer.emit).toHaveBeenCalledWith(DM_EVENTS.MESSAGE_DELETED, {
        messageId: MSG_ID,
      });
    });

    it('does not emit when message is not found before delete', async () => {
      const socket = makeSocket();
      socket.data['userId'] = USER_ID;
      mockPrismaService.directMessage.findUnique.mockResolvedValue(null);
      mockDmService.deleteMessage.mockResolvedValue(undefined);

      await gateway.handleMessageDelete(socket, { messageId: MSG_ID });

      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // handleTypingStart / handleTypingStop
  // ─────────────────────────────────────────────────────────────────────────

  describe('handleTypingStart', () => {
    it(`broadcasts ${DM_EVENTS.TYPING_START} to thread room (excluding sender)`, async () => {
      const toMock = jest.fn().mockReturnThis();
      const emitMock = jest.fn();
      const socket = makeSocket({ toMock, emitMock });
      socket.data['userId'] = USER_ID;

      await gateway.handleTypingStart(socket, { threadId: THREAD_ID });

      expect(toMock).toHaveBeenCalledWith(`dm:thread:${THREAD_ID}`);
      expect(emitMock).toHaveBeenCalledWith(DM_EVENTS.TYPING_START, {
        threadId: THREAD_ID,
        userId: USER_ID,
      });
    });

    it('does nothing when socket has no userId', async () => {
      const toMock = jest.fn().mockReturnThis();
      const emitMock = jest.fn();
      const socket = makeSocket({ toMock, emitMock });
      // no userId in socket.data

      await gateway.handleTypingStart(socket, { threadId: THREAD_ID });

      expect(toMock).not.toHaveBeenCalled();
      expect(emitMock).not.toHaveBeenCalled();
    });
  });

  describe('handleTypingStop', () => {
    it(`broadcasts ${DM_EVENTS.TYPING_STOP} to thread room (excluding sender)`, async () => {
      const toMock = jest.fn().mockReturnThis();
      const emitMock = jest.fn();
      const socket = makeSocket({ toMock, emitMock });
      socket.data['userId'] = USER_ID;

      await gateway.handleTypingStop(socket, { threadId: THREAD_ID });

      expect(toMock).toHaveBeenCalledWith(`dm:thread:${THREAD_ID}`);
      expect(emitMock).toHaveBeenCalledWith(DM_EVENTS.TYPING_STOP, {
        threadId: THREAD_ID,
        userId: USER_ID,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // joinThread
  // ─────────────────────────────────────────────────────────────────────────

  describe('joinThread', () => {
    it('makes all user sockets join the new DM thread room', async () => {
      const fakeSocket = { join: jest.fn().mockResolvedValue(undefined) };
      mockServer.fetchSockets.mockResolvedValue([fakeSocket]);

      await gateway.joinThread(USER_ID, THREAD_ID);

      expect(mockServer.in).toHaveBeenCalledWith(`user:${USER_ID}`);
      expect(mockServer.fetchSockets).toHaveBeenCalled();
      expect(fakeSocket.join).toHaveBeenCalledWith(`dm:thread:${THREAD_ID}`);
    });
  });
});
