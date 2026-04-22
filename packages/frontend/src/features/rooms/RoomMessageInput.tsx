import { useState, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Typography,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { ROOM_EVENTS } from '@chatrix/shared';
import type { RoomMessagePayload, AttachmentPayload } from '@chatrix/shared';
import { useDmStore } from '../../stores/dmStore';
import { useAttachmentUpload } from '../attachments/useAttachmentUpload';

const IMAGE_SIZE_LIMIT = 3 * 1024 * 1024; // 3 MB
const FILE_SIZE_LIMIT = 20 * 1024 * 1024; // 20 MB

interface RoomMessageInputProps {
  roomId: string;
  replyTo: RoomMessagePayload | null;
  onClearReply: () => void;
}

export function RoomMessageInput({ roomId, replyTo, onClearReply }: RoomMessageInputProps) {
  const [content, setContent] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<AttachmentPayload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const socket = useDmStore((s) => s.socket);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    upload,
    progress,
    abort,
    reset: resetUpload,
  } = useAttachmentUpload({
    targetType: 'ROOM',
    targetId: roomId,
  });

  const validateAndUpload = useCallback(
    async (file: File) => {
      setSizeError(null);

      const isImage = file.type.startsWith('image/');
      const limit = isImage ? IMAGE_SIZE_LIMIT : FILE_SIZE_LIMIT;
      const limitLabel = isImage ? '3 MB' : '20 MB';

      if (file.size > limit) {
        setSizeError(
          `"${file.name}" exceeds the ${limitLabel} limit for ${isImage ? 'images' : 'files'}.`,
        );
        return;
      }

      setUploading(true);
      setPendingAttachment(null);
      resetUpload();

      try {
        const payload = await upload(file);
        setPendingAttachment(payload);
      } catch {
        // error already stored in hook; uploading flag cleared below
      } finally {
        setUploading(false);
      }
    },
    [upload, resetUpload],
  );

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void validateAndUpload(file);
    // Reset input so the same file can be re-selected after clearing
    e.target.value = '';
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = Array.from(e.clipboardData.items);
    const fileItem = items.find((item) => item.kind === 'file');
    if (!fileItem) return;
    const file = fileItem.getAsFile();
    if (file) {
      e.preventDefault();
      void validateAndUpload(file);
    }
  }

  function handleClearAttachment() {
    if (uploading) {
      abort();
      setUploading(false);
    }
    setPendingAttachment(null);
    setSizeError(null);
    resetUpload();
  }

  function handleSend() {
    const trimmed = content.trim();
    // Require either non-empty text or an attachment
    if (!socket || (!trimmed && !pendingAttachment)) return;

    socket.emit(ROOM_EVENTS.MESSAGE_SEND, {
      roomId,
      content: trimmed,
      ...(replyTo ? { replyToId: replyTo.id } : {}),
      ...(pendingAttachment ? { attachmentId: pendingAttachment.id } : {}),
    });

    setContent('');
    setPendingAttachment(null);
    setSizeError(null);
    resetUpload();
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

  const showAttachmentStrip = uploading || !!pendingAttachment || !!sizeError;
  const canSend = !uploading && (!!content.trim() || !!pendingAttachment);

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
      {/* Reply preview */}
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

      {/* Attachment preview strip */}
      {showAttachmentStrip && (
        <Paper
          variant="outlined"
          sx={{
            p: 1,
            mb: 1,
            borderRadius: '8px',
            bgcolor: sizeError ? 'error.50' : 'background.paper',
            borderColor: sizeError ? 'error.light' : undefined,
          }}
        >
          {sizeError ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'error.main' }}>{sizeError}</Typography>
              <IconButton size="small" onClick={handleClearAttachment}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: uploading ? 0.5 : 0,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                  {pendingAttachment && !uploading ? (
                    <CheckCircleOutlineIcon
                      fontSize="small"
                      sx={{ color: 'success.main', flexShrink: 0 }}
                    />
                  ) : (
                    <InsertDriveFileIcon
                      fontSize="small"
                      sx={{ color: 'text.secondary', flexShrink: 0 }}
                    />
                  )}
                  <Typography
                    sx={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {pendingAttachment?.originalFilename ?? 'Uploading…'}
                  </Typography>
                  {pendingAttachment && !uploading && (
                    <Typography sx={{ fontSize: '0.7rem', color: 'success.main', flexShrink: 0 }}>
                      Ready
                    </Typography>
                  )}
                </Box>
                <IconButton
                  size="small"
                  onClick={handleClearAttachment}
                  sx={{ ml: 1, flexShrink: 0 }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
              {uploading && (
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ borderRadius: 1, height: 4 }}
                />
              )}
            </Box>
          )}
        </Paper>
      )}

      {/* Input row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }} onPaste={handlePaste}>
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
        <Tooltip title="Attach file">
          <span>
            <IconButton
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              size="medium"
            >
              <AttachFileIcon />
            </IconButton>
          </span>
        </Tooltip>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <IconButton color="primary" onClick={handleSend} disabled={!canSend}>
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
