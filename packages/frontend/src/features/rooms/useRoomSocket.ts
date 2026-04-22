import { useEffect } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { ROOM_EVENTS } from '@chatrix/shared';
import type {
  RoomMessagePayload,
  RoomSummary,
  RoomTypingPayload,
  RoomMemberEventPayload,
} from '@chatrix/shared';
import { useDmStore } from '../../stores/dmStore';
import { useRoomStore } from '../../stores/roomStore';
import { useChatStore } from '../../stores/chatStore';
import { myRoomsKey, roomDetailKey, roomMessagesKey } from './useRoomsQuery';

type MessagesPage = { messages: RoomMessagePayload[]; nextCursor: string | null };

export function useRoomSocket(): void {
  const socket = useDmStore((s) => s.socket);
  const queryClient = useQueryClient();
  const setTyping = useRoomStore((s) => s.setTyping);
  const clearTyping = useRoomStore((s) => s.clearTyping);

  useEffect(() => {
    if (!socket) return;

    function onMessageNew(msg: RoomMessagePayload) {
      queryClient.setQueryData<InfiniteData<MessagesPage, unknown>>(
        roomMessagesKey(msg.roomId),
        (old): InfiniteData<MessagesPage, unknown> => {
          if (!old) {
            return {
              pages: [{ messages: [msg], nextCursor: null }],
              pageParams: [null],
            };
          }
          const [firstPage, ...rest] = old.pages;
          const updatedFirst: MessagesPage = {
            messages: [msg, ...(firstPage?.messages ?? [])],
            nextCursor: firstPage?.nextCursor ?? null,
          };
          return {
            ...old,
            pages: [updatedFirst, ...rest],
          };
        },
      );

      const activeView = useChatStore.getState().activeView;
      const activeRoomId = activeView?.type === 'room' ? activeView.roomId : null;
      if (activeRoomId !== msg.roomId) {
        queryClient.setQueryData<RoomSummary[]>(myRoomsKey(), (old) => {
          if (!old) return old;
          return old.map((r) =>
            r.id === msg.roomId ? { ...r, unreadCount: r.unreadCount + 1 } : r,
          );
        });
      }
    }

    function onMessageEdited(msg: RoomMessagePayload) {
      queryClient.setQueryData<InfiniteData<MessagesPage, unknown>>(
        roomMessagesKey(msg.roomId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((m) => (m.id === msg.id ? msg : m)),
            })),
          };
        },
      );
    }

    function onMessageDeleted(payload: { roomId: string; messageId: string }) {
      queryClient.setQueryData<InfiniteData<MessagesPage, unknown>>(
        roomMessagesKey(payload.roomId),
        (old) => {
          if (!old) return old;
          const deletedAt = new Date().toISOString();
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((m) =>
                m.id === payload.messageId ? { ...m, deletedAt } : m,
              ),
            })),
          };
        },
      );
    }

    function onMemberEvent(payload: RoomMemberEventPayload) {
      void queryClient.invalidateQueries({ queryKey: roomDetailKey(payload.roomId) });
      void queryClient.invalidateQueries({ queryKey: myRoomsKey() });
    }

    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

    function onTyping(payload: RoomTypingPayload) {
      const key = `${payload.roomId}:${payload.userId}`;
      if (payload.isTyping) {
        setTyping(payload.roomId, payload.userId, payload.username);
        const existing = typingTimers.get(key);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          clearTyping(payload.roomId, payload.userId);
          typingTimers.delete(key);
        }, 3000);
        typingTimers.set(key, timer);
      } else {
        const existing = typingTimers.get(key);
        if (existing) {
          clearTimeout(existing);
          typingTimers.delete(key);
        }
        clearTyping(payload.roomId, payload.userId);
      }
    }

    socket.on(ROOM_EVENTS.MESSAGE_NEW, onMessageNew);
    socket.on(ROOM_EVENTS.MESSAGE_EDITED, onMessageEdited);
    socket.on(ROOM_EVENTS.MESSAGE_DELETED, onMessageDeleted);
    socket.on(ROOM_EVENTS.MEMBER_JOINED, onMemberEvent);
    socket.on(ROOM_EVENTS.MEMBER_LEFT, onMemberEvent);
    socket.on(ROOM_EVENTS.MEMBER_KICKED, onMemberEvent);
    socket.on(ROOM_EVENTS.MEMBER_BANNED, onMemberEvent);
    socket.on(ROOM_EVENTS.TYPING, onTyping);

    return () => {
      socket.off(ROOM_EVENTS.MESSAGE_NEW, onMessageNew);
      socket.off(ROOM_EVENTS.MESSAGE_EDITED, onMessageEdited);
      socket.off(ROOM_EVENTS.MESSAGE_DELETED, onMessageDeleted);
      socket.off(ROOM_EVENTS.MEMBER_JOINED, onMemberEvent);
      socket.off(ROOM_EVENTS.MEMBER_LEFT, onMemberEvent);
      socket.off(ROOM_EVENTS.MEMBER_KICKED, onMemberEvent);
      socket.off(ROOM_EVENTS.MEMBER_BANNED, onMemberEvent);
      socket.off(ROOM_EVENTS.TYPING, onTyping);
      for (const timer of typingTimers.values()) clearTimeout(timer);
      typingTimers.clear();
    };
  }, [socket, queryClient, setTyping, clearTyping]);
}
