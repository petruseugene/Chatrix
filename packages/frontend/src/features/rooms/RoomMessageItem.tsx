import { useState } from 'react';
import {
  Box,
  Avatar,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  TextField,
  Button,
} from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import ReplyIcon from '@mui/icons-material/ReplyOutlined';
import type { RoomMessagePayload, RoomRole } from '@chatrix/shared';
import { REACTION_EMOJIS } from '@chatrix/shared';
import { AttachmentPreview } from '../attachments/AttachmentPreview';

const ROLE_RANK = { OWNER: 2, ADMIN: 1, MEMBER: 0 } as const;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function getAvatarColor(username: string): string {
  const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length] ?? '#6366f1';
}

interface RoomMessageItemProps {
  message: RoomMessagePayload;
  currentUserId: string;
  myRole: RoomRole;
  onReply: (message: RoomMessagePayload) => void;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
}

export function RoomMessageItem({
  message,
  currentUserId,
  myRole,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: RoomMessageItemProps) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [quickReactOpen, setQuickReactOpen] = useState(false);

  const isOwn = message.authorId === currentUserId;
  const isDeleted = !!message.deletedAt;
  const canEdit = isOwn && !isDeleted;
  const canDelete = !isDeleted && (isOwn || ROLE_RANK[myRole] >= 1);
  const avatarColor = getAvatarColor(message.authorUsername);

  function handleEditSave() {
    if (editContent.trim() && editContent.trim() !== message.content) {
      onEdit(message.id, editContent.trim());
    }
    setEditing(false);
  }

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
        '&:hover .msg-actions': { opacity: 1, pointerEvents: 'auto' },
      }}
    >
      <Avatar
        sx={{
          width: 34,
          height: 34,
          bgcolor: avatarColor,
          fontSize: '0.8rem',
          fontWeight: 700,
          flexShrink: 0,
          mt: '2px',
        }}
      >
        {message.authorUsername.charAt(0).toUpperCase()}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.25 }}>
          <Typography
            component="span"
            sx={{
              fontWeight: 700,
              fontSize: '0.875rem',
              color: isOwn ? '#6366f1' : 'text.primary',
            }}
          >
            {message.authorUsername}
          </Typography>
          <Typography component="span" sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>
            {formatTime(message.createdAt)}
          </Typography>
          {message.editedAt && (
            <Chip label="edited" size="small" sx={{ height: 16, fontSize: '0.65rem' }} />
          )}
        </Box>

        {/* Reply quote */}
        {message.replyTo && (
          <Box
            sx={{
              borderLeft: '3px solid',
              borderColor: 'primary.main',
              pl: 1,
              mb: 0.5,
              opacity: 0.7,
              borderRadius: '0 4px 4px 0',
              bgcolor: 'rgba(0,0,0,0.03)',
            }}
          >
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }}>
              {message.replyTo.authorUsername}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem' }} noWrap>
              {message.replyTo.content}
            </Typography>
          </Box>
        )}

        {/* Message content */}
        {isDeleted ? (
          <Typography sx={{ fontSize: '0.875rem', color: 'text.disabled', fontStyle: 'italic' }}>
            [message deleted]
          </Typography>
        ) : editing ? (
          <Box>
            <TextField
              autoFocus
              multiline
              fullWidth
              size="small"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEditSave();
                }
                if (e.key === 'Escape') {
                  setEditing(false);
                  setEditContent(message.content);
                }
              }}
              sx={{ mb: 0.5 }}
            />
            <Button size="small" variant="contained" onClick={handleEditSave} sx={{ mr: 1 }}>
              Save
            </Button>
            <Button
              size="small"
              onClick={() => {
                setEditing(false);
                setEditContent(message.content);
              }}
            >
              Cancel
            </Button>
          </Box>
        ) : (
          <>
            <Typography
              sx={{
                fontSize: '0.875rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message.content}
            </Typography>
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

      {/* Action buttons (hover) */}
      {!isDeleted && !editing && (
        <Box
          className="msg-actions"
          sx={{
            position: 'absolute',
            right: 8,
            top: 4,
            display: 'flex',
            gap: 0.25,
            opacity: 0,
            pointerEvents: 'none',
            bgcolor: 'background.paper',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 1,
            p: 0.25,
          }}
        >
          <Tooltip title="Reply">
            <IconButton size="small" onClick={() => onReply(message)}>
              <ReplyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {canEdit && (
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => setEditing(true)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => onDelete(message.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  );
}
