import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FRIEND_EVENTS } from '@chatrix/shared';
import { useDmStore } from '../../stores/dmStore';
import { useNotificationStore } from '../../stores/notificationStore';

interface RequestReceivedPayload {
  requestId: string;
  fromUsername: string;
}

interface RequestDeclinedPayload {
  declinedByUsername: string;
}

export function useFriendSocket(): void {
  const socket = useDmStore((s) => s.socket);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    function onRequestReceived(payload: RequestReceivedPayload) {
      void queryClient.invalidateQueries({ queryKey: ['friends', 'requests'] });
      useNotificationStore.getState().addNotification({
        type: 'friend_request',
        message: `${payload.fromUsername} sent you a friend request.`,
        createdAt: new Date().toISOString(),
        requestId: payload.requestId,
      });
    }

    function onRequestAccepted() {
      void queryClient.invalidateQueries({ queryKey: ['friends', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['dm', 'threads'] });
    }

    function onRequestDeclined(payload: RequestDeclinedPayload) {
      useNotificationStore.getState().addNotification({
        type: 'friend_declined',
        message: `${payload.declinedByUsername} declined your friend request.`,
        createdAt: new Date().toISOString(),
      });
    }

    socket.on(FRIEND_EVENTS.REQUEST_RECEIVED, onRequestReceived);
    socket.on(FRIEND_EVENTS.REQUEST_ACCEPTED, onRequestAccepted);
    socket.on(FRIEND_EVENTS.REQUEST_DECLINED, onRequestDeclined);

    return () => {
      socket.off(FRIEND_EVENTS.REQUEST_RECEIVED, onRequestReceived);
      socket.off(FRIEND_EVENTS.REQUEST_ACCEPTED, onRequestAccepted);
      socket.off(FRIEND_EVENTS.REQUEST_DECLINED, onRequestDeclined);
    };
  }, [socket, queryClient]);
}
