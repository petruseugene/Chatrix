import { useState, useRef } from 'react';
import { Box, TextField, IconButton, CircularProgress } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { DM_EVENTS } from '@chatrix/shared';
import { useDmStore } from '../../stores/dmStore';

interface Props {
  threadId: string;
}

export default function DmMessageInput({ threadId }: Props) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const socket = useDmStore((state) => state.socket);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!socket || !content.trim() || sending) return;
    setSending(true);
    socket.emit(DM_EVENTS.MESSAGE_SEND, { threadId, content: content.trim() });
    setContent('');
    setSending(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
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
        value={content}
        onChange={(e) => setContent(e.target.value)}
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
        onClick={() => void handleSend()}
        disabled={!content.trim() || sending}
        aria-label="Send message"
        sx={{
          width: 40,
          height: 40,
          mb: '2px',
          borderRadius: '10px',
          background:
            !content.trim() || sending
              ? 'rgba(0,0,0,0.06)'
              : 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
          color: !content.trim() || sending ? 'rgba(0,0,0,0.3)' : '#fff',
          flexShrink: 0,
          transition: 'all 0.15s ease',
          '&:hover': {
            background:
              !content.trim() || sending
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
