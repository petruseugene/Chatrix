import { useState, useRef } from 'react';
import { Box, TextField, IconButton, Paper, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import { ROOM_EVENTS } from '@chatrix/shared';
import type { RoomMessagePayload } from '@chatrix/shared';
import { useDmStore } from '../../stores/dmStore';

interface RoomMessageInputProps {
  roomId: string;
  replyTo: RoomMessagePayload | null;
  onClearReply: () => void;
}

export function RoomMessageInput({ roomId, replyTo, onClearReply }: RoomMessageInputProps) {
  const [content, setContent] = useState('');
  const socket = useDmStore((s) => s.socket);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    if (!socket || !content.trim()) return;
    socket.emit(ROOM_EVENTS.MESSAGE_SEND, {
      roomId,
      content: content.trim(),
      ...(replyTo ? { replyToId: replyTo.id } : {}),
    });
    setContent('');
    onClearReply();
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTypingStart() {
    socket?.emit(ROOM_EVENTS.TYPING_START, { roomId });
  }

  function handleTypingStop() {
    socket?.emit(ROOM_EVENTS.TYPING_STOP, { roomId });
  }

  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderTop: '1px solid',
        borderColor: 'rgba(0,0,0,0.08)',
        bgcolor: '#fafaf8',
      }}
    >
      {replyTo && (
        <Paper
          variant="outlined"
          sx={{
            p: 1,
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: '8px',
          }}
        >
          <Box>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
              Replying to {replyTo.authorUsername}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }} noWrap>
              {replyTo.content.slice(0, 80)}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClearReply}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Paper>
      )}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <TextField
          inputRef={textareaRef}
          multiline
          maxRows={6}
          fullWidth
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={handleTypingStart}
          onBlur={handleTypingStop}
          variant="outlined"
          size="small"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
        />
        <IconButton color="primary" onClick={handleSend} disabled={!content.trim()}>
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
