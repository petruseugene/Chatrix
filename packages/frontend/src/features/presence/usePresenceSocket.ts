import { useEffect } from 'react';
import { PRESENCE_EVENTS } from '@chatrix/shared';
import type { PresenceChangedPayload } from '@chatrix/shared';
import { useDmStore } from '../../stores/dmStore';
import { usePresenceStore } from '../../stores/presenceStore';

export function usePresenceSocket(): void {
  const socket = useDmStore((s) => s.socket);

  useEffect(() => {
    if (!socket) return;

    function onPresenceChanged(payload: PresenceChangedPayload) {
      usePresenceStore.getState().setStatus(payload.userId, payload.status);
    }

    socket.on(PRESENCE_EVENTS.CHANGED, onPresenceChanged);

    return () => {
      socket.off(PRESENCE_EVENTS.CHANGED, onPresenceChanged);
    };
  }, [socket]);
}
