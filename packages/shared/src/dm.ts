import { z } from 'zod';
import type { AttachmentPayload } from './rooms';

export const sendDmSchema = z.object({
  recipientId: z.string().cuid(),
  content: z.string().min(1).max(3072),
  replyToId: z.string().cuid().optional(),
});

export const editDmSchema = z.object({
  content: z.string().min(1).max(3072),
});

export const dmCursorSchema = z.object({
  before: z.string().optional(),
  beforeId: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});

export const sendFriendRequestSchema = z.object({
  username: z.string().min(3).max(32),
});

export interface DmMessagePayload {
  id: string;
  threadId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  replyToId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  attachment?: AttachmentPayload | null;
}

export interface DmThreadPayload {
  id: string;
  otherUserId: string;
  otherUsername: string;
  lastMessage: DmMessagePayload | null;
  unreadCount: number;
}
