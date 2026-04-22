import { type z } from 'zod';
import type { AttachmentPayload, ReactionSummary } from './rooms';
export declare const sendDmSchema: z.ZodObject<
  {
    recipientId: z.ZodString;
    content: z.ZodString;
    replyToId: z.ZodOptional<z.ZodString>;
  },
  'strip',
  z.ZodTypeAny,
  {
    recipientId: string;
    content: string;
    replyToId?: string | undefined;
  },
  {
    recipientId: string;
    content: string;
    replyToId?: string | undefined;
  }
>;
export declare const editDmSchema: z.ZodObject<
  {
    content: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    content: string;
  },
  {
    content: string;
  }
>;
export declare const dmCursorSchema: z.ZodObject<
  {
    before: z.ZodOptional<z.ZodString>;
    beforeId: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
  },
  'strip',
  z.ZodTypeAny,
  {
    limit: number;
    before?: string | undefined;
    beforeId?: string | undefined;
  },
  {
    before?: string | undefined;
    beforeId?: string | undefined;
    limit?: number | undefined;
  }
>;
export declare const sendFriendRequestSchema: z.ZodObject<
  {
    username: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    username: string;
  },
  {
    username: string;
  }
>;
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
  reactions: ReactionSummary[];
}
export interface DmThreadPayload {
  id: string;
  otherUserId: string;
  otherUsername: string;
  lastMessage: DmMessagePayload | null;
  unreadCount: number;
}
//# sourceMappingURL=dm.d.ts.map
