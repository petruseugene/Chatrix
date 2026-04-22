import { Box, CircularProgress, Typography } from '@mui/material';
import { useEffect, useRef } from 'react';
import type { RoomRole } from '@chatrix/shared';
import { useRoomDetail, useMyRooms } from './useRoomsQuery';
import { useMarkRoomRead } from './useRoomMutations';
import { RoomHeader } from './RoomHeader';
import { RoomMessageList } from './RoomMessageList';

interface RoomChatWindowProps {
  roomId: string;
}

export default function RoomChatWindow({ roomId }: RoomChatWindowProps) {
  const { data: room, isLoading, isError } = useRoomDetail(roomId);
  const { data: rooms } = useMyRooms();
  const { mutate: markRead } = useMarkRoomRead();

  const lastRoomIdRef = useRef<string | null>(null);
  const initialUnreadCountRef = useRef<number>(0);

  // Snapshot unreadCount synchronously during render, before markRead zeroes it.
  if (lastRoomIdRef.current !== roomId) {
    lastRoomIdRef.current = roomId;
    initialUnreadCountRef.current = rooms?.find((r) => r.id === roomId)?.unreadCount ?? 0;
  }

  useEffect(() => {
    markRead(roomId);
  }, [roomId, markRead]);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !room) {
    return (
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography color="text.secondary">Room not found</Typography>
      </Box>
    );
  }

  // myRole is optional on RoomSummary; fall back to MEMBER for display purposes
  const myRole: RoomRole = room.myRole ?? 'MEMBER';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <RoomHeader room={room} myRole={myRole} />
      <RoomMessageList
        roomId={roomId}
        myRole={myRole}
        initialUnreadCount={initialUnreadCountRef.current}
      />
    </Box>
  );
}
