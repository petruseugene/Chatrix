import { Box, Typography, Avatar, Divider } from '@mui/material';
import { useEffect, useRef } from 'react';
import type { DmThreadPayload } from '@chatrix/shared';
import DmMessageList from './DmMessageList';
import DmMessageInput from './DmMessageInput';
import { getAvatarColor } from './dmUtils';
import { useMarkThreadRead } from './useDmQueries';

interface Props {
  thread: DmThreadPayload;
}

export default function DmChatWindow({ thread }: Props) {
  const { mutate: markRead } = useMarkThreadRead();
  const lastThreadIdRef = useRef<string | null>(null);
  const initialUnreadCountRef = useRef<number>(0);
  const avatarColor = getAvatarColor(thread.otherUsername);

  // Snapshot unreadCount synchronously during render, before markRead zeroes it.
  // This is a valid React pattern: writing a ref during render to track derived state.
  if (lastThreadIdRef.current !== thread.id) {
    lastThreadIdRef.current = thread.id;
    initialUnreadCountRef.current = thread.unreadCount;
  }

  // Mark thread as read when the active thread changes
  useEffect(() => {
    markRead(thread.id);
  }, [thread.id, markRead]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: '#fafaf8',
      }}
    >
      {/* Title bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 1.5,
          bgcolor: '#fff',
          borderBottom: '1px solid',
          borderColor: 'rgba(0,0,0,0.08)',
          flexShrink: 0,
          minHeight: 56,
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: avatarColor,
            fontSize: '0.8rem',
            fontWeight: 700,
          }}
        >
          {thread.otherUsername.charAt(0).toUpperCase()}
        </Avatar>
        <Box>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '0.95rem',
              color: '#1e293b',
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            {thread.otherUsername}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.72rem',
              color: '#94a3b8',
              letterSpacing: 0.2,
            }}
          >
            Direct message
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(0,0,0,0.06)' }} />

      {/* Messages */}
      <DmMessageList threadId={thread.id} initialUnreadCount={initialUnreadCountRef.current} />

      {/* Input */}
      <DmMessageInput threadId={thread.id} />
    </Box>
  );
}
