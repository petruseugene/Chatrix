import { Box, Typography } from '@mui/material';
import { useChatStore } from '../../stores/chatStore';
import { useDmSocket } from '../dm/useDmSocket';
import { useThreads } from '../dm/useDmQueries';
import { useRooms } from './useRoomsQuery';
import Sidebar from './Sidebar';
import EmptyState from './EmptyState';
import DmChatWindow from '../dm/DmChatWindow';

function RoomChatWindowPlaceholder({ roomId }: { roomId: string }) {
  const { data: rooms } = useRooms();
  const room = rooms?.find((r) => r.id === roomId);

  return (
    <Box
      sx={{
        bgcolor: '#fafaf8',
        flex: 1,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
        {room ? `# ${room.name}` : 'Room'}
      </Typography>
      <Typography sx={{ color: '#94a3b8', fontSize: '0.9rem' }}>Room chat coming soon</Typography>
    </Box>
  );
}

export default function ChatPage() {
  useDmSocket();

  const activeView = useChatStore((s) => s.activeView);
  const { data: threadsData } = useThreads();

  let rightPane: React.ReactNode;

  if (activeView === null) {
    rightPane = <EmptyState />;
  } else if (activeView.type === 'dm') {
    const thread = threadsData?.find((t) => t.id === activeView.threadId);
    rightPane = thread ? <DmChatWindow thread={thread} /> : <EmptyState />;
  } else {
    rightPane = <RoomChatWindowPlaceholder roomId={activeView.roomId} />;
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
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
        }}
      >
        {rightPane}
      </Box>
    </Box>
  );
}
