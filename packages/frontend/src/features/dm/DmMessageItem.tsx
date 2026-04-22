import { useState } from 'react';
import { Box, Avatar, Typography, IconButton, Tooltip, Chip } from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import ReplyIcon from '@mui/icons-material/ReplyOutlined';
import type { DmMessagePayload } from '@chatrix/shared';
import { REACTION_EMOJIS } from '@chatrix/shared';
import { getAvatarColor } from './dmUtils';
import { AttachmentPreview } from '../attachments/AttachmentPreview';

interface Props {
  message: DmMessagePayload;
  currentUserId: string;
  replyToMessage?: DmMessagePayload | null;
  onEdit?: (message: DmMessagePayload) => void;
  onDelete?: (message: DmMessagePayload) => void;
  onReact: (messageId: string, emoji: string) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function DmMessageItem({
  message,
  currentUserId,
  replyToMessage,
  onEdit,
  onDelete,
  onReact,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const [quickReactOpen, setQuickReactOpen] = useState(false);
  const isOwn = message.authorId === currentUserId;
  const isDeleted = !!message.deletedAt;
  const avatarColor = getAvatarColor(message.authorUsername);

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setQuickReactOpen(false);
      }}
      sx={{
        display: 'flex',
        gap: 1.5,
        px: 2,
        py: 0.75,
        borderRadius: '8px',
        position: 'relative',
        bgcolor: hovered ? 'rgba(0,0,0,0.025)' : 'transparent',
        transition: 'background-color 0.1s ease',
        '&:hover .msg-actions': {
          opacity: 1,
          pointerEvents: 'auto',
        },
      }}
    >
      {/* Avatar */}
      <Avatar
        sx={{
          width: 34,
          height: 34,
          bgcolor: avatarColor,
          fontSize: '0.8rem',
          fontWeight: 700,
          flexShrink: 0,
          mt: '2px',
          letterSpacing: 0,
        }}
      >
        {message.authorUsername.charAt(0).toUpperCase()}
      </Avatar>

      {/* Content column */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Header: name + timestamp */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.25 }}>
          <Typography
            component="span"
            sx={{
              fontWeight: 700,
              fontSize: '0.875rem',
              color: isOwn ? '#6366f1' : '#1e293b',
              letterSpacing: '-0.01em',
            }}
          >
            {message.authorUsername}
          </Typography>
          <Typography
            component="span"
            sx={{
              fontSize: '0.72rem',
              color: '#94a3b8',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatTime(message.createdAt)}
          </Typography>
        </Box>

        {/* Reply preview */}
        {message.replyToId && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              mb: 0.5,
              pl: 1,
              borderLeft: '3px solid',
              borderColor: '#e2e8f0',
              borderRadius: '0 4px 4px 0',
            }}
          >
            <ReplyIcon sx={{ fontSize: 12, color: '#94a3b8', transform: 'scaleX(-1)' }} />
            <Typography
              component="span"
              sx={{
                fontSize: '0.78rem',
                color: '#94a3b8',
                fontStyle: 'italic',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {replyToMessage
                ? `${replyToMessage.authorUsername}: ${replyToMessage.deletedAt ? '[Message deleted]' : replyToMessage.content}`
                : 'Original message'}
            </Typography>
          </Box>
        )}

        {/* Message body */}
        {isDeleted ? (
          <Typography
            sx={{
              fontSize: '0.875rem',
              color: '#94a3b8',
              fontStyle: 'italic',
              userSelect: 'none',
            }}
          >
            [Message deleted]
          </Typography>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75, flexWrap: 'wrap' }}>
              <Typography
                sx={{
                  fontSize: '0.875rem',
                  color: '#334155',
                  lineHeight: 1.55,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {message.content}
              </Typography>
              {message.editedAt && (
                <Chip
                  label="edited"
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: '0.65rem',
                    bgcolor: 'rgba(0,0,0,0.05)',
                    color: '#94a3b8',
                    fontStyle: 'italic',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              )}
            </Box>
            {message.attachment && <AttachmentPreview attachment={message.attachment} />}
            {/* Reactions row */}
            <Box
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, alignItems: 'center' }}
            >
              {message.reactions.map((r) => (
                <Chip
                  key={r.emoji}
                  label={`${r.emoji} ${r.count}`}
                  size="small"
                  variant={r.userIds.includes(currentUserId) ? 'filled' : 'outlined'}
                  color={r.userIds.includes(currentUserId) ? 'primary' : 'default'}
                  onClick={() => onReact(message.id, r.emoji)}
                  sx={{ cursor: 'pointer', fontSize: '0.75rem' }}
                />
              ))}
              <Box
                sx={{
                  opacity: hovered ? 1 : 0,
                  transition: 'opacity 0.15s',
                  pointerEvents: hovered ? 'auto' : 'none',
                }}
              >
                <Chip
                  label="😊 +"
                  size="small"
                  variant="outlined"
                  onClick={() => setQuickReactOpen((v) => !v)}
                  sx={{ cursor: 'pointer', borderStyle: 'dashed', fontSize: '0.75rem' }}
                />
                {quickReactOpen && (
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 0.5,
                      mt: 0.5,
                      flexWrap: 'wrap',
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 0.5,
                    }}
                  >
                    {REACTION_EMOJIS.map((emoji) => (
                      <Box
                        key={emoji}
                        component="span"
                        sx={{
                          fontSize: '1.25rem',
                          cursor: 'pointer',
                          p: 0.25,
                          borderRadius: 1,
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                        onClick={() => {
                          onReact(message.id, emoji);
                          setQuickReactOpen(false);
                        }}
                      >
                        {emoji}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          </>
        )}
      </Box>

      {/* Hover action buttons — only for own non-deleted messages */}
      {isOwn && !isDeleted && (
        <Box
          className="msg-actions"
          sx={{
            position: 'absolute',
            top: 4,
            right: 8,
            display: 'flex',
            gap: 0.25,
            opacity: 0,
            pointerEvents: 'none',
            transition: 'opacity 0.15s ease',
            bgcolor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
            p: 0.25,
          }}
        >
          {onEdit && (
            <Tooltip title="Edit" placement="top">
              <IconButton
                size="small"
                onClick={() => onEdit(message)}
                sx={{
                  color: '#64748b',
                  width: 28,
                  height: 28,
                  borderRadius: '6px',
                  '&:hover': { bgcolor: 'rgba(99,102,241,0.1)', color: '#6366f1' },
                }}
              >
                <EditIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="Delete" placement="top">
              <IconButton
                size="small"
                onClick={() => onDelete(message)}
                sx={{
                  color: '#64748b',
                  width: 28,
                  height: 28,
                  borderRadius: '6px',
                  '&:hover': { bgcolor: 'rgba(239,68,68,0.1)', color: '#ef4444' },
                }}
              >
                <DeleteIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  );
}
