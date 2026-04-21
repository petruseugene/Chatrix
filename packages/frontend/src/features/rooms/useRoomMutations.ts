import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import * as roomsApi from './roomsApi';
import { useAuthStore } from '../../stores/authStore';
import {
  myRoomsKey,
  roomBansKey,
  roomDetailKey,
  roomMembersKey,
  roomMessagesKey,
} from './useRoomsQuery';
import type { RoomMessagePayload } from '@chatrix/shared';

type MessagesPage = { messages: RoomMessagePayload[]; nextCursor: string | null };

export function useCreateRoom() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; description?: string; isPrivate?: boolean }) =>
      roomsApi.createRoom(accessToken!, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myRoomsKey() });
    },
  });
}

export function useJoinRoom() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => roomsApi.joinRoom(accessToken!, roomId),
    onSuccess: (_, roomId) => {
      void queryClient.invalidateQueries({ queryKey: myRoomsKey() });
      void queryClient.invalidateQueries({ queryKey: roomDetailKey(roomId) });
    },
  });
}

export function useLeaveRoom() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => roomsApi.leaveRoom(accessToken!, roomId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myRoomsKey() });
    },
  });
}

export function useDeleteRoom() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => roomsApi.deleteRoom(accessToken!, roomId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myRoomsKey() });
    },
  });
}

export function useUpdateRoom() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      dto,
    }: {
      roomId: string;
      dto: { name?: string; description?: string; isPrivate?: boolean };
    }) => roomsApi.updateRoom(accessToken!, roomId, dto),
    onSuccess: (_, { roomId }) => {
      void queryClient.invalidateQueries({ queryKey: roomDetailKey(roomId) });
      void queryClient.invalidateQueries({ queryKey: myRoomsKey() });
    },
  });
}

export function useInviteUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, username }: { roomId: string; username: string }) =>
      roomsApi.inviteUser(accessToken!, roomId, username),
    onSuccess: (_, { roomId }) => {
      void queryClient.invalidateQueries({ queryKey: roomMembersKey(roomId) });
      void queryClient.invalidateQueries({ queryKey: roomDetailKey(roomId) });
    },
  });
}

export function useKickMember() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, userId }: { roomId: string; userId: string }) =>
      roomsApi.kickMember(accessToken!, roomId, userId),
    onSuccess: (_, { roomId }) => {
      void queryClient.invalidateQueries({ queryKey: roomMembersKey(roomId) });
      void queryClient.invalidateQueries({ queryKey: roomDetailKey(roomId) });
    },
  });
}

export function useBanUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, userId, reason }: { roomId: string; userId: string; reason?: string }) =>
      roomsApi.banUser(accessToken!, roomId, userId, reason),
    onSuccess: (_, { roomId }) => {
      void queryClient.invalidateQueries({ queryKey: roomMembersKey(roomId) });
      void queryClient.invalidateQueries({ queryKey: roomDetailKey(roomId) });
    },
  });
}

export function useUnbanUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, userId }: { roomId: string; userId: string }) =>
      roomsApi.unbanUser(accessToken!, roomId, userId),
    onSuccess: (_, { roomId }) => {
      void queryClient.invalidateQueries({ queryKey: roomMembersKey(roomId) });
      void queryClient.invalidateQueries({ queryKey: roomDetailKey(roomId) });
      void queryClient.invalidateQueries({ queryKey: roomBansKey(roomId) });
    },
  });
}

export function useSetRole() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      userId,
      role,
    }: {
      roomId: string;
      userId: string;
      role: 'ADMIN' | 'MEMBER';
    }) => roomsApi.setRole(accessToken!, roomId, userId, role),
    onSuccess: (_, { roomId }) => {
      void queryClient.invalidateQueries({ queryKey: roomMembersKey(roomId) });
      void queryClient.invalidateQueries({ queryKey: roomDetailKey(roomId) });
    },
  });
}

export function useSendRoomMessage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  // Fire-and-forget: socket handles real-time prepend
  return useMutation({
    mutationFn: ({
      roomId,
      content,
      replyToId,
    }: {
      roomId: string;
      content: string;
      replyToId?: string;
    }) => roomsApi.sendMessage(accessToken!, roomId, content, replyToId),
  });
}

export function useEditRoomMessage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      messageId,
      content,
    }: {
      roomId: string;
      messageId: string;
      content: string;
    }) => roomsApi.editMessage(accessToken!, roomId, messageId, content),
    onSuccess: (updated, { roomId }) => {
      queryClient.setQueryData<InfiniteData<MessagesPage, unknown>>(
        roomMessagesKey(roomId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((m) => (m.id === updated.id ? updated : m)),
            })),
          };
        },
      );
    },
  });
}

export function useDeleteRoomMessage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, messageId }: { roomId: string; messageId: string }) =>
      roomsApi.deleteRoomMessage(accessToken!, roomId, messageId),
    onSuccess: (_, { roomId, messageId }) => {
      queryClient.setQueryData<InfiniteData<MessagesPage, unknown>>(
        roomMessagesKey(roomId),
        (old) => {
          if (!old) return old;
          const deletedAt = new Date().toISOString();
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((m) => (m.id === messageId ? { ...m, deletedAt } : m)),
            })),
          };
        },
      );
    },
  });
}
