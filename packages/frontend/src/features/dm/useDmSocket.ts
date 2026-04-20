import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { DM_EVENTS } from '@chatrix/shared';
import type { DmMessagePayload } from '@chatrix/shared';
import { useAuthStore } from '../../stores/authStore';
import { useDmStore } from '../../stores/dmStore';

interface DeletedPayload {
  id: string;
  threadId: string;
  deletedAt: string;
}

interface InfiniteData {
  pages: DmMessagePayload[][];
  pageParams: unknown[];
}

export function useDmSocket(): void {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setSocketConnected = useDmStore((s) => s.setSocketConnected);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) return;

    const socket = io('/', {
      auth: { token: accessToken },
      path: '/socket.io',
    });

    function onConnect() {
      setSocketConnected(true);
    }

    function onDisconnect() {
      setSocketConnected(false);
    }

    function onMessageNew(msg: DmMessagePayload) {
      queryClient.setQueryData<InfiniteData>(['dm', 'messages', msg.threadId], (old) => {
        if (!old) return old;
        const [firstPage, ...rest] = old.pages;
        return {
          ...old,
          pages: [[msg, ...(firstPage ?? [])], ...rest],
        };
      });
    }

    function onMessageEdited(msg: DmMessagePayload) {
      queryClient.setQueryData<InfiniteData>(['dm', 'messages', msg.threadId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => page.map((m) => (m.id === msg.id ? msg : m))),
        };
      });
    }

    function onMessageDeleted(payload: DeletedPayload) {
      queryClient.setQueryData<InfiniteData>(['dm', 'messages', payload.threadId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((m) => (m.id === payload.id ? { ...m, deletedAt: payload.deletedAt } : m)),
          ),
        };
      });
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(DM_EVENTS.MESSAGE_NEW, onMessageNew);
    socket.on(DM_EVENTS.MESSAGE_EDITED, onMessageEdited);
    socket.on(DM_EVENTS.MESSAGE_DELETED, onMessageDeleted);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(DM_EVENTS.MESSAGE_NEW, onMessageNew);
      socket.off(DM_EVENTS.MESSAGE_EDITED, onMessageEdited);
      socket.off(DM_EVENTS.MESSAGE_DELETED, onMessageDeleted);
      socket.disconnect();
    };
  }, [accessToken, queryClient, setSocketConnected]);
}
