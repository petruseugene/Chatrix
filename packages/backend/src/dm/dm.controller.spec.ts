import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DmController } from './dm.controller';
import { DmService } from './dm.service';
import { DmGateway } from './dm.gateway';
import type { JwtPayload } from '@chatrix/shared';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const makeMockDmService = () => ({
  getOrCreateThread: jest.fn(),
  listThreads: jest.fn(),
  getMessages: jest.fn(),
  editMessage: jest.fn(),
  deleteMessage: jest.fn(),
  getThread: jest.fn(),
});

const makeMockDmGateway = () => ({
  joinThread: jest.fn().mockResolvedValue(undefined),
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CALLER_ID = 'aaaa-1111';
const RECIPIENT_ID = 'bbbb-2222';
const THREAD_ID = 'thread-abc';
const MSG_ID = 'msg-xyz';

const jwtUser: JwtPayload = { sub: CALLER_ID, email: 'caller@example.com', username: 'caller' };

const fakeThread = {
  id: THREAD_ID,
  userAId: CALLER_ID,
  userBId: RECIPIENT_ID,
  createdAt: new Date('2024-01-01'),
};

const fakeMessage = {
  id: MSG_ID,
  threadId: THREAD_ID,
  authorId: CALLER_ID,
  content: 'Hello',
  replyToId: null,
  editedAt: null,
  deletedAt: null,
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('DmController', () => {
  let controller: DmController;
  let mockDmService: ReturnType<typeof makeMockDmService>;
  let mockDmGateway: ReturnType<typeof makeMockDmGateway>;

  beforeEach(async () => {
    mockDmService = makeMockDmService();
    mockDmGateway = makeMockDmGateway();

    const module = await Test.createTestingModule({
      controllers: [DmController],
      providers: [
        { provide: DmService, useValue: mockDmService },
        { provide: DmGateway, useValue: mockDmGateway },
      ],
    }).compile();

    controller = module.get(DmController);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /dm/threads
  // ─────────────────────────────────────────────────────────────────────────

  describe('createThread', () => {
    it('calls DmService.getOrCreateThread with caller id and recipient id', async () => {
      mockDmService.getOrCreateThread.mockResolvedValue(fakeThread);

      await controller.createThread(jwtUser, { recipientId: RECIPIENT_ID });

      expect(mockDmService.getOrCreateThread).toHaveBeenCalledWith(CALLER_ID, RECIPIENT_ID);
    });

    it('calls gateway.joinThread for both participants after thread creation', async () => {
      mockDmService.getOrCreateThread.mockResolvedValue(fakeThread);

      await controller.createThread(jwtUser, { recipientId: RECIPIENT_ID });

      expect(mockDmGateway.joinThread).toHaveBeenCalledWith(CALLER_ID, THREAD_ID);
      expect(mockDmGateway.joinThread).toHaveBeenCalledWith(RECIPIENT_ID, THREAD_ID);
    });

    it('returns the created/existing thread', async () => {
      mockDmService.getOrCreateThread.mockResolvedValue(fakeThread);

      const result = await controller.createThread(jwtUser, { recipientId: RECIPIENT_ID });

      expect(result).toEqual(fakeThread);
    });

    it('propagates ForbiddenException when users are not mutual friends', async () => {
      mockDmService.getOrCreateThread.mockRejectedValue(
        new ForbiddenException('DMs are only allowed between mutual friends with no active block'),
      );

      await expect(controller.createThread(jwtUser, { recipientId: RECIPIENT_ID })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /dm/threads
  // ─────────────────────────────────────────────────────────────────────────

  describe('listThreads', () => {
    it('returns all threads for the authenticated user', async () => {
      mockDmService.listThreads.mockResolvedValue([fakeThread]);

      const result = await controller.listThreads(jwtUser);

      expect(mockDmService.listThreads).toHaveBeenCalledWith(CALLER_ID);
      expect(result).toEqual([fakeThread]);
    });

    it('returns an empty array when user has no threads', async () => {
      mockDmService.listThreads.mockResolvedValue([]);

      const result = await controller.listThreads(jwtUser);

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /dm/threads/:threadId/messages
  // ─────────────────────────────────────────────────────────────────────────

  describe('getMessages', () => {
    it('calls DmService.getMessages with threadId and caller id (null cursor when no query params)', async () => {
      mockDmService.getMessages.mockResolvedValue([fakeMessage]);

      await controller.getMessages(jwtUser, THREAD_ID, {});

      expect(mockDmService.getMessages).toHaveBeenCalledWith(THREAD_ID, CALLER_ID, null, undefined);
    });

    it('passes cursor params (before, beforeId) and limit to service when provided', async () => {
      mockDmService.getMessages.mockResolvedValue([fakeMessage]);

      await controller.getMessages(jwtUser, THREAD_ID, {
        before: '2024-01-01T10:00:00.000Z',
        beforeId: 'msg-prev',
        limit: 20,
      });

      expect(mockDmService.getMessages).toHaveBeenCalledWith(
        THREAD_ID,
        CALLER_ID,
        { before: '2024-01-01T10:00:00.000Z', beforeId: 'msg-prev' },
        20,
      );
    });

    it('throws ForbiddenException when caller is not a thread participant', async () => {
      mockDmService.getMessages.mockRejectedValue(
        new ForbiddenException('You are not a participant of this thread'),
      );

      await expect(controller.getMessages(jwtUser, THREAD_ID, {})).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /dm/messages/:messageId
  // ─────────────────────────────────────────────────────────────────────────

  describe('editMessage', () => {
    it('calls DmService.editMessage with messageId, caller id, and new content', async () => {
      const updatedMessage = { ...fakeMessage, content: 'Updated', editedAt: new Date() };
      mockDmService.editMessage.mockResolvedValue(updatedMessage);

      await controller.editMessage(jwtUser, MSG_ID, { content: 'Updated' });

      expect(mockDmService.editMessage).toHaveBeenCalledWith(MSG_ID, CALLER_ID, 'Updated');
    });

    it('returns the updated message', async () => {
      const updatedMessage = { ...fakeMessage, content: 'Updated', editedAt: new Date() };
      mockDmService.editMessage.mockResolvedValue(updatedMessage);

      const result = await controller.editMessage(jwtUser, MSG_ID, { content: 'Updated' });

      expect(result).toEqual(updatedMessage);
    });

    it('throws ForbiddenException when caller is not the message author', async () => {
      mockDmService.editMessage.mockRejectedValue(
        new ForbiddenException('Only the message author can edit this message'),
      );

      await expect(controller.editMessage(jwtUser, MSG_ID, { content: 'X' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when message does not exist', async () => {
      mockDmService.editMessage.mockRejectedValue(new NotFoundException('Message not found'));

      await expect(controller.editMessage(jwtUser, MSG_ID, { content: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /dm/messages/:messageId
  // ─────────────────────────────────────────────────────────────────────────

  describe('deleteMessage', () => {
    it('calls DmService.deleteMessage with messageId and caller id', async () => {
      mockDmService.deleteMessage.mockResolvedValue({ threadId: THREAD_ID });

      await controller.deleteMessage(jwtUser, MSG_ID);

      expect(mockDmService.deleteMessage).toHaveBeenCalledWith(MSG_ID, CALLER_ID);
    });

    it('returns void (no response body for 204)', async () => {
      mockDmService.deleteMessage.mockResolvedValue({ threadId: THREAD_ID });

      const result = await controller.deleteMessage(jwtUser, MSG_ID);

      // 204 endpoints return void/undefined
      expect(result).toBeUndefined();
    });

    it('throws ForbiddenException when caller is not the message author', async () => {
      mockDmService.deleteMessage.mockRejectedValue(
        new ForbiddenException('Only the message author can delete this message'),
      );

      await expect(controller.deleteMessage(jwtUser, MSG_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when message does not exist', async () => {
      mockDmService.deleteMessage.mockRejectedValue(new NotFoundException('Message not found'));

      await expect(controller.deleteMessage(jwtUser, MSG_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
