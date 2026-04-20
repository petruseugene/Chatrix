import { Box, Typography } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useDmStore } from '../../stores/dmStore';
import { useThreads } from './useDmQueries';
import { useDmSocket } from './useDmSocket';
import DmThreadList from './DmThreadList';
import DmChatWindow from './DmChatWindow';

export default function DmLayout() {
  // Connect socket when the DM page is open
  useDmSocket();

  const activeThreadId = useDmStore((s) => s.activeThreadId);
  const { data: threads } = useThreads();

  const activeThread = threads?.find((t) => t.id === activeThreadId) ?? null;

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
        }}
      >
        {activeThread ? <DmChatWindow thread={activeThread} /> : <EmptyState />}
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
