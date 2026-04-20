import { useState, useRef, useCallback } from 'react';
import { Box, TextField, IconButton, CircularProgress } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { io, type Socket } from 'socket.io-client';
import { DM_EVENTS } from '@chatrix/shared';
import { useAuthStore } from '../../stores/authStore';

interface Props {
  threadId: string;
}

// Lazily-initialised socket reference shared per component instance
let _socket: Socket | null = null;

function getSocket(token: string): Socket {
  if (!_socket || !_socket.connected) {
    _socket = io('/', {
      auth: { token },
      path: '/socket.io',
    });
  }
  return _socket;
}

export default function DmMessageInput({ threadId }: Props) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || !accessToken) return;

    setSending(true);
    const socket = getSocket(accessToken);

    socket.emit(DM_EVENTS.MESSAGE_SEND, { threadId, content: trimmed }, () => {
      setSending(false);
    });

    setValue('');
    textareaRef.current?.focus();
    // Optimistically clear sending state after a short timeout in case no ack
    setTimeout(() => setSending(false), 1500);
  }, [value, accessToken, threadId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 1,
        px: 2,
        py: 1.5,
        borderTop: '1px solid',
        borderColor: 'rgba(0,0,0,0.08)',
        bgcolor: '#fafaf8',
      }}
    >
      <TextField
        inputRef={textareaRef}
        multiline
        maxRows={6}
        fullWidth
        placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={sending}
        variant="outlined"
        size="small"
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
            bgcolor: '#fff',
            fontSize: '0.9rem',
            lineHeight: 1.5,
            '& fieldset': {
              borderColor: 'rgba(0,0,0,0.15)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(99,102,241,0.4)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#6366f1',
              borderWidth: '1.5px',
            },
          },
        }}
      />
      <IconButton
        onClick={handleSend}
        disabled={!value.trim() || sending}
        aria-label="Send message"
        sx={{
          width: 40,
          height: 40,
          mb: '2px',
          borderRadius: '10px',
          background:
            !value.trim() || sending
              ? 'rgba(0,0,0,0.06)'
              : 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
          color: !value.trim() || sending ? 'rgba(0,0,0,0.3)' : '#fff',
          flexShrink: 0,
          transition: 'all 0.15s ease',
          '&:hover': {
            background:
              !value.trim() || sending
                ? 'rgba(0,0,0,0.06)'
                : 'linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)',
          },
        }}
      >
        {sending ? (
          <CircularProgress size={16} sx={{ color: 'rgba(0,0,0,0.3)' }} />
        ) : (
          <SendIcon sx={{ fontSize: 18 }} />
        )}
      </IconButton>
    </Box>
  );
}
