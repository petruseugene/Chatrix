import { useState, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Typography,
  LinearProgress,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { DM_EVENTS } from '@chatrix/shared';
import type { AttachmentPayload } from '@chatrix/shared';
import { useDmStore } from '../../stores/dmStore';
import { useAttachmentUpload } from '../attachments/useAttachmentUpload';

const IMAGE_SIZE_LIMIT = 3 * 1024 * 1024; // 3 MB
const FILE_SIZE_LIMIT = 20 * 1024 * 1024; // 20 MB

interface Props {
  threadId: string;
}

export default function DmMessageInput({ threadId }: Props) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<AttachmentPayload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const socket = useDmStore((state) => state.socket);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    upload,
    progress,
    abort,
    reset: resetUpload,
  } = useAttachmentUpload({
    targetType: 'DM',
    targetId: threadId,
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

  const handleSend = async () => {
    const trimmed = content.trim();
    // Require either non-empty text or an attachment
    if (!socket || (!trimmed && !pendingAttachment) || sending || uploading) return;

    setSending(true);
    socket.emit(DM_EVENTS.MESSAGE_SEND, {
      threadId,
      content: trimmed,
      ...(pendingAttachment ? { attachmentId: pendingAttachment.id } : {}),
    });

    setContent('');
    setPendingAttachment(null);
    setSizeError(null);
    resetUpload();
    setSending(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const showAttachmentStrip = uploading || !!pendingAttachment || !!sizeError;
  const canSend = !uploading && !sending && (!!content.trim() || !!pendingAttachment);

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
        <Tooltip title="Attach file">
          <span>
            <IconButton
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || sending}
              size="medium"
              sx={{ mb: '2px' }}
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
        <IconButton
          onClick={() => void handleSend()}
          disabled={!canSend}
          aria-label="Send message"
          sx={{
            width: 40,
            height: 40,
            mb: '2px',
            borderRadius: '10px',
            background: !canSend
              ? 'rgba(0,0,0,0.06)'
              : 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
            color: !canSend ? 'rgba(0,0,0,0.3)' : '#fff',
            flexShrink: 0,
            transition: 'all 0.15s ease',
            '&:hover': {
              background: !canSend
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
    </Box>
  );
}
