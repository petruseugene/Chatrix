import { Box, Typography, Avatar, Divider } from '@mui/material';
import type { DmThreadPayload } from '@chatrix/shared';
import DmMessageList from './DmMessageList';
import DmMessageInput from './DmMessageInput';
import { getAvatarColor } from './dmUtils';

interface Props {
  thread: DmThreadPayload;
}

export default function DmChatWindow({ thread }: Props) {
  const avatarColor = getAvatarColor(thread.otherUsername);

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
      <DmMessageList threadId={thread.id} />

      {/* Input */}
      <DmMessageInput threadId={thread.id} />
    </Box>
  );
}
