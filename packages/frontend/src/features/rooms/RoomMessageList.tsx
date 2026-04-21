import { useRef, useEffect, useCallback, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import type { RoomMessagePayload, RoomRole } from '@chatrix/shared';
import { ROOM_EVENTS } from '@chatrix/shared';
import { useRoomMessages } from './useRoomsQuery';
import { useEditRoomMessage, useDeleteRoomMessage } from './useRoomMutations';
import { useAuthStore } from '../../stores/authStore';
import { useRoomStore } from '../../stores/roomStore';
import { useDmStore } from '../../stores/dmStore';
import { RoomMessageItem } from './RoomMessageItem';
import { RoomMessageInput } from './RoomMessageInput';

interface RoomMessageListProps {
  roomId: string;
  myRole: RoomRole;
}

export function RoomMessageList({ roomId, myRole }: RoomMessageListProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useRoomMessages(roomId);

  const { mutate: editMsg } = useEditRoomMessage();
  const { mutate: deleteMsg } = useDeleteRoomMessage();

  const user = useAuthStore((s) => s.user);
  const typingUsers = useRoomStore((s) => s.typing[roomId] ?? {});
  const socket = useDmStore((s) => s.socket);

  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  const [replyTo, setReplyTo] = useState<RoomMessagePayload | null>(null);

  // Flatten pages: API returns newest-first DESC, so reverse for display oldest→newest
  const allMessages: RoomMessagePayload[] = data?.pages
    ? [...data.pages].reverse().flatMap((p) => [...p.messages].reverse())
    : [];

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  // Auto-scroll to bottom when new messages arrive and user is at bottom
  useEffect(() => {
    const count = allMessages.length;
    if (count > prevMessageCountRef.current && atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = count;
  }, [allMessages.length]);

  function handleEdit(messageId: string, content: string) {
    editMsg({ roomId, messageId, content });
  }

  function handleDelete(messageId: string) {
    socket?.emit(ROOM_EVENTS.MESSAGE_DELETE, { roomId, messageId });
    deleteMsg({ roomId, messageId });
  }

  const typingList = Object.values(typingUsers);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
        <Typography color="error">Failed to load messages</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Message scroll area */}
      <Box
        ref={containerRef}
        onScroll={handleScroll}
        sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
      >
        {hasNextPage && (
          <Box display="flex" justifyContent="center" py={1}>
            <Button size="small" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? <CircularProgress size={16} /> : 'Load earlier messages'}
            </Button>
          </Box>
        )}

        {allMessages.map((msg) => (
          <RoomMessageItem
            key={msg.id}
            message={msg}
            currentUserId={user?.sub ?? ''}
            myRole={myRole}
            onReply={setReplyTo}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}

        {typingList.length > 0 && (
          <Box sx={{ px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontStyle: 'italic' }}>
              {typingList.join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing…
            </Typography>
          </Box>
        )}

        <div ref={bottomRef} />
      </Box>

      {/* Message input */}
      <RoomMessageInput roomId={roomId} replyTo={replyTo} onClearReply={() => setReplyTo(null)} />
    </Box>
  );
}
