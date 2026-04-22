import { useEffect } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { DM_EVENTS } from '@chatrix/shared';
import type { DmMessagePayload, DmThreadPayload, ReactionSummary } from '@chatrix/shared';
import { useAuthStore } from '../../stores/authStore';
import { useDmStore } from '../../stores/dmStore';
import { useChatStore } from '../../stores/chatStore';

interface DeletedPayload {
  id: string;
  threadId: string;
  deletedAt: string;
}

export function useDmSocket(): void {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setSocketConnected = useDmStore((s) => s.setSocketConnected);
  const setSocket = useDmStore((s) => s.setSocket);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) return;

    const socket = io('/', {
      auth: { token: accessToken },
      path: '/socket.io',
    });

    setSocket(socket);

    function onConnect() {
      setSocketConnected(true);
    }

    function onDisconnect() {
      setSocketConnected(false);
    }

    function onMessageNew(msg: DmMessagePayload) {
      queryClient.setQueryData<InfiniteData<DmMessagePayload[], unknown>>(
        ['dm', 'messages', msg.threadId],
        (old) => {
          if (!old) {
            return { pages: [[msg]], pageParams: [undefined] };
          }
          const [firstPage, ...rest] = old.pages;
          return {
            ...old,
            pages: [[msg, ...(firstPage ?? [])], ...rest],
          };
        },
      );

      const activeView = useChatStore.getState().activeView;
      const activeThreadId = activeView?.type === 'dm' ? activeView.threadId : null;
      const isBackground = activeThreadId !== msg.threadId;

      queryClient.setQueryData<DmThreadPayload[]>(['dm', 'threads'], (old) => {
        if (!old) return old;
        return old.map((t) =>
          t.id === msg.threadId
            ? {
                ...t,
                lastMessage: msg,
                unreadCount: isBackground ? Math.max(0, t.unreadCount) + 1 : t.unreadCount,
              }
            : t,
        );
      });
    }

    function onMessageEdited(msg: DmMessagePayload) {
      queryClient.setQueryData<InfiniteData<DmMessagePayload[], unknown>>(
        ['dm', 'messages', msg.threadId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => page.map((m) => (m.id === msg.id ? msg : m))),
          };
        },
      );
    }

    function onMessageDeleted(payload: DeletedPayload) {
      queryClient.setQueryData<InfiniteData<DmMessagePayload[], unknown>>(
        ['dm', 'messages', payload.threadId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((m) => (m.id === payload.id ? { ...m, deletedAt: payload.deletedAt } : m)),
            ),
          };
        },
      );
    }

    function onReactionUpdated(payload: {
      messageId: string;
      threadId: string;
      reactions: ReactionSummary[];
    }) {
      queryClient.setQueryData<InfiniteData<DmMessagePayload[], unknown>>(
        ['dm', 'messages', payload.threadId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((m) =>
                m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m,
              ),
            ),
          };
        },
      );
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(DM_EVENTS.MESSAGE_NEW, onMessageNew);
    socket.on(DM_EVENTS.MESSAGE_EDITED, onMessageEdited);
    socket.on(DM_EVENTS.MESSAGE_DELETED, onMessageDeleted);
    socket.on(DM_EVENTS.REACTION_UPDATED, onReactionUpdated);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(DM_EVENTS.MESSAGE_NEW, onMessageNew);
      socket.off(DM_EVENTS.MESSAGE_EDITED, onMessageEdited);
      socket.off(DM_EVENTS.MESSAGE_DELETED, onMessageDeleted);
      socket.off(DM_EVENTS.REACTION_UPDATED, onReactionUpdated);
      socket.disconnect();
      setSocket(null);
    };
  }, [accessToken, queryClient, setSocketConnected, setSocket]);
}
