import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useDmStore } from '../../stores/dmStore';
import { useThreads } from './useDmQueries';
import { useDmSocket } from './useDmSocket';
import { useFriendSocket } from './useFriendSocket';
import { usePendingRequests } from '../friendship/useFriendshipMutations';
import DmThreadList from './DmThreadList';
import DmChatWindow from './DmChatWindow';
import { PendingInvitePanel } from './PendingInvitePanel';
import NotificationBell from '../../components/NotificationBell';

export default function DmLayout() {
  // Connect DM socket and friendship socket when the DM page is open
  useDmSocket();
  useFriendSocket();

  const activeThreadId = useDmStore((s) => s.activeThreadId);
  const activePendingRequestId = useDmStore((s) => s.activePendingRequestId);
  const setActivePendingRequestId = useDmStore((s) => s.setActivePendingRequestId);

  const { data: threads } = useThreads();
  const { data: pendingRequests } = usePendingRequests();

  const activeThread = threads?.find((t) => t.id === activeThreadId) ?? null;

  // When a DM thread becomes active, clear any pending invite panel
  useEffect(() => {
    if (activeThreadId) {
      setActivePendingRequestId(null);
    }
  }, [activeThreadId, setActivePendingRequestId]);

  const activePendingRequest =
    activePendingRequestId != null
      ? (pendingRequests?.find((r) => r.id === activePendingRequestId) ?? null)
      : null;

  function renderRightPane() {
    if (activePendingRequest) {
      return (
        <PendingInvitePanel
          requestId={activePendingRequest.id}
          fromUserId={activePendingRequest.fromUserId}
          fromUsername={activePendingRequest.fromUsername}
          fromUserCreatedAt={activePendingRequest.fromUserCreatedAt}
          createdAt={activePendingRequest.createdAt}
        />
      );
    }
    if (activeThread) {
      return <DmChatWindow thread={activeThread} />;
    }
    return <EmptyState />;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        bgcolor: '#fafaf8',
      }}
    >
      {/* Left sidebar */}
      <Box
        sx={{
          width: 280,
          flexShrink: 0,
          display: { xs: activeThread ? 'none' : 'flex', sm: 'flex' },
          flexDirection: 'column',
          borderRight: '1px solid rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        <DmThreadList />
      </Box>

      {/* Right pane */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
          position: 'relative',
        }}
      >
        {/* Notification bell — fixed in top-right corner of right pane */}
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
          }}
        >
          <NotificationBell />
        </Box>

        {renderRightPane()}
      </Box>
    </Box>
  );
}

function EmptyState() {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        bgcolor: '#fafaf8',
        userSelect: 'none',
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '18px',
          background:
            'linear-gradient(135deg, rgba(14,165,233,0.12) 0%, rgba(99,102,241,0.12) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChatBubbleOutlineIcon sx={{ fontSize: 28, color: '#6366f1', opacity: 0.7 }} />
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Typography
          sx={{
            fontSize: '1rem',
            fontWeight: 700,
            color: '#334155',
            letterSpacing: '-0.01em',
            mb: 0.5,
          }}
        >
          Select a conversation
        </Typography>
        <Typography sx={{ fontSize: '0.85rem', color: '#94a3b8' }}>
          Choose a thread from the sidebar to start chatting
        </Typography>
      </Box>
    </Box>
  );
}
