export type RoomRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export interface RoomSummary {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  memberCount: number;
  myRole?: RoomRole;
  unreadCount: number;
}
export interface RoomMember {
  userId: string;
  username: string;
  role: RoomRole;
  joinedAt: string;
}
export interface RoomDetail extends RoomSummary {
  ownerId: string;
  members: RoomMember[];
}
export interface ReactionSummary {
  emoji: string;
  count: number;
  userIds: string[];
}
export interface AttachmentPayload {
  id: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  thumbnailAvailable: boolean;
}
export interface RoomMessagePayload {
  id: string;
  roomId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  replyTo?: {
    id: string;
    authorUsername: string;
    content: string;
  } | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  attachment?: AttachmentPayload | null;
  reactions: ReactionSummary[];
}
export interface SendRoomMessagePayload {
  roomId: string;
  content: string;
  replyToId?: string;
  attachmentId?: string;
}
export interface RoomTypingPayload {
  roomId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}
export interface RoomMemberEventPayload {
  roomId: string;
  userId: string;
  username: string;
}
//# sourceMappingURL=rooms.d.ts.map
