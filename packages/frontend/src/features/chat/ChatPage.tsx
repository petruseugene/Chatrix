import { Box } from '@mui/material';
import { useChatStore } from '../../stores/chatStore';
import { useDmSocket } from '../dm/useDmSocket';
import { useThreads } from '../dm/useDmQueries';
import { useRoomSocket } from '../rooms/useRoomSocket';
import Sidebar from './Sidebar';
import EmptyState from './EmptyState';
import DmChatWindow from '../dm/DmChatWindow';
import RoomChatWindow from '../rooms/RoomChatWindow';

export default function ChatPage() {
  useDmSocket();
  useRoomSocket();

  const activeView = useChatStore((s) => s.activeView);
  const { data: threadsData } = useThreads();

  let rightPane: React.ReactNode;

  if (activeView === null) {
    rightPane = <EmptyState />;
  } else if (activeView.type === 'dm') {
    const thread = threadsData?.find((t) => t.id === activeView.threadId);
    rightPane = thread ? <DmChatWindow thread={thread} /> : <EmptyState />;
  } else {
    rightPane = <RoomChatWindow roomId={activeView.roomId} />;
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
