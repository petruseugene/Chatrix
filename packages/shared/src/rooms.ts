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

export interface RoomMessagePayload {
  id: string;
  roomId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  replyTo?: { id: string; authorUsername: string; content: string } | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface SendRoomMessagePayload {
  roomId: string;
  content: string;
  replyToId?: string;
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
