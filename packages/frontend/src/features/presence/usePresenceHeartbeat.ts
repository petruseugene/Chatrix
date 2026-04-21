import { useEffect, useRef } from 'react';
import { PRESENCE_EVENTS } from '@chatrix/shared';
import type { PresenceHeartbeatPayload } from '@chatrix/shared';
import { useDmStore } from '../../stores/dmStore';

const HEARTBEAT_INTERVAL_MS = 20_000;
const ACTIVITY_TIMEOUT_MS = 60_000;
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

export function usePresenceHeartbeat(): void {
  const socket = useDmStore((s) => s.socket);

  const tabIdRef = useRef<string>(crypto.randomUUID());
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    function handleActivity() {
      lastActivityRef.current = Date.now();
    }

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handleActivity);
    }

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, handleActivity);
      }
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    function sendHeartbeat() {
      const payload: PresenceHeartbeatPayload = {
        tabId: tabIdRef.current,
        isActive: Date.now() - lastActivityRef.current < ACTIVITY_TIMEOUT_MS,
      };
      socket!.emit(PRESENCE_EVENTS.HEARTBEAT, payload);
    }

    sendHeartbeat();
    const intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [socket]);
}
