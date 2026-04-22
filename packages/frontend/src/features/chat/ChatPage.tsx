import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Box } from '@mui/material';
import { useChatStore } from '../../stores/chatStore';
import { useDmStore } from '../../stores/dmStore';
import { useDmSocket } from '../dm/useDmSocket';
import { useFriendSocket } from '../dm/useFriendSocket';
import { usePresenceHeartbeat } from '../presence/usePresenceHeartbeat';
import { usePresenceSocket } from '../presence/usePresenceSocket';
import { usePresenceQuery } from '../presence/usePresenceQuery';
import { useThreads } from '../dm/useDmQueries';
import { useRoomSocket } from '../rooms/useRoomSocket';
import { usePendingRequests } from '../friendship/useFriendshipMutations';
import Sidebar from './Sidebar';
import EmptyState from './EmptyState';
import DmChatWindow from '../dm/DmChatWindow';
import RoomChatWindow from '../rooms/RoomChatWindow';
import { PendingInvitePanel } from '../dm/PendingInvitePanel';
import NotificationToast from '../../components/NotificationToast';

export default function ChatPage() {
  useDmSocket();
  useRoomSocket();
  useFriendSocket();
  usePresenceHeartbeat();
  usePresenceSocket();
  usePresenceQuery();

  const activeView = useChatStore((s) => s.activeView);
  const setActiveDm = useChatStore((s) => s.setActiveDm);
  const activePendingRequestId = useDmStore((s) => s.activePendingRequestId);
  const setActivePendingRequestId = useDmStore((s) => s.setActivePendingRequestId);
  const { data: threadsData } = useThreads();
  const { data: pendingRequests } = usePendingRequests();

  // Clear pending invite when a room or DM thread is selected
  useEffect(() => {
    if (activeView !== null) {
      setActivePendingRequestId(null);
    }
  }, [activeView, setActivePendingRequestId]);

  const activePendingRequest =
    activePendingRequestId != null
      ? (pendingRequests?.find((r) => r.id === activePendingRequestId) ?? null)
      : null;

  let rightPane: ReactNode;

  if (activePendingRequest) {
    rightPane = (
      <PendingInvitePanel
        requestId={activePendingRequest.id}
        fromUserId={activePendingRequest.fromUserId}
        fromUsername={activePendingRequest.fromUsername}
        fromUserCreatedAt={activePendingRequest.fromUserCreatedAt}
        createdAt={activePendingRequest.createdAt}
        onAccepted={(threadId) => setActiveDm(threadId)}
      />
    );
  } else if (activeView === null) {
    rightPane = <EmptyState />;
  } else if (activeView.type === 'dm') {
    const thread = threadsData?.find((t) => t.id === activeView.threadId);
    rightPane = thread ? <DmChatWindow thread={thread} /> : <EmptyState />;
  } else {
    rightPane = <RoomChatWindow roomId={activeView.roomId} />;
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <NotificationToast />
      {/* Left sidebar — fixed 280px */}
      <Box sx={{ width: 280, flexShrink: 0, height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
      </Box>

      {/* Right pane — fills remaining space */}
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          bgcolor: '#fafaf8',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {rightPane}
      </Box>
    </Box>
  );
}
