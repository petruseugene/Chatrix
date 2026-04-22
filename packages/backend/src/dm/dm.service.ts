import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DirectMessage, DirectMessageThread } from '@prisma/client';
import type { DmThreadPayload, DmMessagePayload } from '@chatrix/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipService } from '../friendship/friendship.service';
import { AttachmentsService } from '../attachments/attachments.service';

/** Canonical pair ordering: min(a, b) → first element */
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

const ATTACHMENT_SELECT = {
  id: true,
  originalFilename: true,
  mimeType: true,
  size: true,
  thumbnailKey: true,
} as const;

@Injectable()
export class DmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friendshipService: FriendshipService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // getOrCreateThread
  // ─────────────────────────────────────────────────────────────────────────

  async getOrCreateThread(callerUserId: string, otherUserId: string): Promise<DirectMessageThread> {
    const allowed = await this.friendshipService.areMutualFriendsAndNotBlocked(
      callerUserId,
      otherUserId,
    );
    if (!allowed) {
      throw new ForbiddenException(
        'DMs are only allowed between mutual friends with no active block',
      );
    }

    const [userAId, userBId] = canonicalPair(callerUserId, otherUserId);

    const existing = await this.prisma.directMessageThread.findFirst({
      where: { userAId, userBId },
    });

    if (existing) return existing;

    return this.prisma.directMessageThread.create({
      data: { userAId, userBId },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // sendMessage
  // ─────────────────────────────────────────────────────────────────────────

  async sendMessage(
    threadId: string,
    authorId: string,
    content: string,
    replyToId?: string,
    attachmentId?: string,
  ): Promise<
    DirectMessage & {
      attachment?: {
        id: string;
        originalFilename: string;
        mimeType: string;
        size: bigint;
        thumbnailKey: string | null;
      } | null;
    }
  > {
    await this.assertParticipant(threadId, authorId);

    if (attachmentId) {
      const attachment = await this.prisma.attachment.findUnique({
        where: { id: attachmentId },
      });
      if (!attachment) throw new NotFoundException('Attachment not found');
      if (attachment.uploaderId !== authorId) {
        throw new ForbiddenException('You do not own this attachment');
      }
      if (attachment.dmThreadId !== threadId) {
        throw new BadRequestException('Attachment does not belong to this DM thread');
      }
      if (!attachment.committedAt) {
        throw new BadRequestException('Attachment has not been committed yet');
      }

      // Check that attachment is not already linked to a message
      const alreadyLinked = await this.prisma.directMessage.findFirst({
        where: { attachmentId },
      });
      if (alreadyLinked) {
        throw new BadRequestException('Attachment is already linked to a message');
      }
    }

    return this.prisma.directMessage.create({
      data: {
        threadId,
        authorId,
        content,
        ...(replyToId ? { replyToId } : {}),
        ...(attachmentId ? { attachmentId } : {}),
      },
      include: {
        attachment: { select: ATTACHMENT_SELECT },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // editMessage
  // ─────────────────────────────────────────────────────────────────────────

  async editMessage(
    messageId: string,
    authorId: string,
    content: string,
  ): Promise<DmMessagePayload> {
    const message = await this.prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');

    if (message.authorId !== authorId) {
      throw new ForbiddenException('Only the message author can edit this message');
    }

    if (message.deletedAt !== null) {
      throw new BadRequestException('Cannot edit a deleted message');
    }

    const updated = await this.prisma.directMessage.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      include: { author: { select: { username: true } } },
    });

    return {
      id: updated.id,
      threadId: updated.threadId,
      authorId: updated.authorId,
      authorUsername: updated.author.username,
      content: updated.content,
      replyToId: updated.replyToId,
      editedAt: updated.editedAt?.toISOString() ?? null,
      deletedAt: updated.deletedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // deleteMessage
  // ─────────────────────────────────────────────────────────────────────────

  async deleteMessage(
    messageId: string,
    authorId: string,
  ): Promise<{ threadId: string; deletedAt: string }> {
    const message = await this.prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');

    if (message.authorId !== authorId) {
      throw new ForbiddenException('Only the message author can delete this message');
    }

    const deletedAt = new Date();
    await this.prisma.directMessage.update({
      where: { id: messageId },
      data: { deletedAt },
    });

    return { threadId: message.threadId, deletedAt: deletedAt.toISOString() };
  }

  async getUsernameById(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return user.username;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getThread
  // ─────────────────────────────────────────────────────────────────────────

  async getThread(threadId: string, callerUserId: string): Promise<DirectMessageThread> {
    const thread = await this.prisma.directMessageThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('Thread not found');

    if (thread.userAId !== callerUserId && thread.userBId !== callerUserId) {
      throw new ForbiddenException('You are not a participant of this thread');
    }

    return thread;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // listThreads
  // ─────────────────────────────────────────────────────────────────────────

  async listThreads(userId: string): Promise<DmThreadPayload[]> {
    const threads = await this.prisma.directMessageThread.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: { select: { id: true, username: true } },
        userB: { select: { id: true, username: true } },
        messages: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          include: { author: { select: { username: true } } },
        },
      },
    });

    return Promise.all(
      threads.map(async (thread) => {
        const other = thread.userAId === userId ? thread.userB : thread.userA;
        const lastMsg = thread.messages[0] ?? null;
        const lastReadAt =
          thread.userAId === userId ? thread.userALastReadAt : thread.userBLastReadAt;
        const unreadCount = await this.prisma.directMessage.count({
          where: {
            threadId: thread.id,
            authorId: { not: userId },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });
        return {
          id: thread.id,
          otherUserId: other.id,
          otherUsername: other.username,
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                threadId: lastMsg.threadId,
                authorId: lastMsg.authorId,
                authorUsername: lastMsg.author.username,
                content: lastMsg.content,
                replyToId: lastMsg.replyToId,
                editedAt: lastMsg.editedAt?.toISOString() ?? null,
                deletedAt: lastMsg.deletedAt?.toISOString() ?? null,
                createdAt: lastMsg.createdAt.toISOString(),
              }
            : null,
          unreadCount,
        };
      }),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getMessages
  // ─────────────────────────────────────────────────────────────────────────

  async getMessages(
    threadId: string,
    callerUserId: string,
    cursor?: { before: string; beforeId: string } | null,
    limit?: number,
  ): Promise<DmMessagePayload[]> {
    await this.assertParticipant(threadId, callerUserId);

    const take = Math.min(limit ?? 50, 50);

    // Cursor filter: (createdAt, id) < (cursor.before, cursor.beforeId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic Prisma where
    const where: any = { threadId };
    if (cursor?.before && cursor?.beforeId) {
      const cursorDate = new Date(cursor.before);
      where.OR = [
        { createdAt: { lt: cursorDate } },
        { createdAt: cursorDate, id: { lt: cursor.beforeId } },
      ];
    }

    const messages = await this.prisma.directMessage.findMany({
      where,
      include: {
        author: { select: { username: true } },
        attachment: { select: ATTACHMENT_SELECT },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    });

    return messages.map((m) => ({
      id: m.id,
      threadId: m.threadId,
      authorId: m.authorId,
      authorUsername: m.author.username,
      content: m.content,
      replyToId: m.replyToId,
      editedAt: m.editedAt?.toISOString() ?? null,
      deletedAt: m.deletedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      attachment: m.attachment
        ? {
            id: m.attachment.id,
            originalFilename: m.attachment.originalFilename,
            mimeType: m.attachment.mimeType,
            size: Number(m.attachment.size),
            thumbnailAvailable: !!m.attachment.thumbnailKey,
          }
        : null,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // markThreadRead
  // ─────────────────────────────────────────────────────────────────────────

  async markThreadRead(threadId: string, userId: string): Promise<void> {
    const thread = await this.assertParticipant(threadId, userId);
    const isUserA = userId === thread.userAId;

    await this.prisma.directMessageThread.update({
      where: { id: threadId },
      data: isUserA ? { userALastReadAt: new Date() } : { userBLastReadAt: new Date() },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async assertParticipant(threadId: string, userId: string): Promise<DirectMessageThread> {
    const thread = await this.prisma.directMessageThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('Thread not found');

    if (thread.userAId !== userId && thread.userBId !== userId) {
      throw new ForbiddenException('You are not a participant of this thread');
    }

    return thread;
  }
}
