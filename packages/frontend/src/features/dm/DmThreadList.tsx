import { Box, Avatar, Typography, Badge, Skeleton, Divider } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import type { DmThreadPayload } from '@chatrix/shared';
import { useThreads } from './useDmQueries';
import { useDmStore } from '../../stores/dmStore';

const AVATAR_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
] as const;

function getAvatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? '#6366f1';
}

function formatLastMessagePreview(thread: DmThreadPayload): string {
  if (!thread.lastMessage) return 'No messages yet';
  if (thread.lastMessage.deletedAt) return '[Message deleted]';
  const content = thread.lastMessage.content;
  return content.length > 42 ? content.slice(0, 42) + '…' : content;
}

function ThreadSkeleton() {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, px: 2, py: 1.5, alignItems: 'center' }}>
      <Skeleton
        variant="circular"
        width={38}
        height={38}
        sx={{ bgcolor: 'rgba(255,255,255,0.08)', flexShrink: 0 }}
      />
      <Box sx={{ flex: 1 }}>
        <Skeleton
          variant="text"
          width="55%"
          height={16}
          sx={{ bgcolor: 'rgba(255,255,255,0.08)', mb: 0.5 }}
        />
        <Skeleton
          variant="text"
          width="80%"
          height={13}
          sx={{ bgcolor: 'rgba(255,255,255,0.06)' }}
        />
      </Box>
    </Box>
  );
}

interface ThreadRowProps {
  thread: DmThreadPayload;
  isActive: boolean;
  onClick: () => void;
}

function ThreadRow({ thread, isActive, onClick }: ThreadRowProps) {
  const avatarColor = getAvatarColor(thread.otherUsername);
  const preview = formatLastMessagePreview(thread);
  const isDeletedPreview = thread.lastMessage?.deletedAt;

  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        display: 'flex',
        gap: 1.5,
        px: 2,
        py: 1.25,
        mx: 1,
        borderRadius: '10px',
        border: 'none',
        cursor: 'pointer',
        width: 'calc(100% - 16px)',
        textAlign: 'left',
        bgcolor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
        transition: 'background-color 0.12s ease',
        alignItems: 'center',
        '&:hover': {
          bgcolor: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
        },
        '&:focus-visible': {
          outline: '2px solid rgba(99,102,241,0.5)',
          outlineOffset: '1px',
        },
      }}
    >
      {/* Avatar with unread badge */}
      <Badge
        badgeContent={thread.unreadCount > 0 ? thread.unreadCount : 0}
        max={99}
        sx={{
          flexShrink: 0,
          '& .MuiBadge-badge': {
            bgcolor: '#f59e0b',
            color: '#1c1917',
            fontWeight: 800,
            fontSize: '0.62rem',
            minWidth: 18,
            height: 18,
            border: '2px solid #1e2030',
          },
        }}
      >
        <Avatar
          sx={{
            width: 38,
            height: 38,
            bgcolor: avatarColor,
            fontSize: '0.85rem',
            fontWeight: 700,
          }}
        >
          {thread.otherUsername.charAt(0).toUpperCase()}
        </Avatar>
      </Badge>

      {/* Thread info */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography
            sx={{
              fontWeight: isActive ? 700 : 600,
              fontSize: '0.875rem',
              color: isActive ? '#fff' : 'rgba(255,255,255,0.85)',
              letterSpacing: '-0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              mr: 1,
            }}
          >
            {thread.otherUsername}
          </Typography>
          {thread.unreadCount > 0 && (
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: '#f59e0b',
                flexShrink: 0,
              }}
            />
          )}
        </Box>
        <Typography
          sx={{
            fontSize: '0.78rem',
            color: isDeletedPreview
              ? 'rgba(255,255,255,0.3)'
              : isActive
                ? 'rgba(255,255,255,0.6)'
                : 'rgba(255,255,255,0.4)',
            fontStyle: isDeletedPreview ? 'italic' : 'normal',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            mt: '2px',
          }}
        >
          {preview}
        </Typography>
      </Box>
    </Box>
  );
}

export default function DmThreadList() {
  const { data: threads, isLoading, isError } = useThreads();
  const activeThreadId = useDmStore((s) => s.activeThreadId);
  const setActiveThread = useDmStore((s) => s.setActiveThread);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: '#1e2030',
        overflow: 'hidden',
      }}
    >
      {/* Sidebar header */}
      <Box
        sx={{
          px: 2.5,
          pt: 2.5,
          pb: 1.5,
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.3)',
            userSelect: 'none',
          }}
        >
          Direct Messages
        </Typography>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mx: 2, mb: 1 }} />

      {/* Thread list area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          pb: 2,
          '&::-webkit-scrollbar': { width: '4px' },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(255,255,255,0.1)',
            borderRadius: '2px',
          },
        }}
      >
        {isLoading && (
          <>
            <ThreadSkeleton />
            <ThreadSkeleton />
            <ThreadSkeleton />
          </>
        )}

        {isError && (
          <Box sx={{ px: 2, py: 2 }}>
            <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>
              Failed to load conversations
            </Typography>
          </Box>
        )}

        {!isLoading && !isError && threads && threads.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1.5,
              pt: 4,
              px: 2,
            }}
          >
            <ChatBubbleOutlineIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.1)' }} />
            <Typography
              sx={{
                fontSize: '0.8rem',
                color: 'rgba(255,255,255,0.25)',
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              No conversations yet
            </Typography>
          </Box>
        )}

        {!isLoading &&
          threads?.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              isActive={thread.id === activeThreadId}
              onClick={() => setActiveThread(thread.id)}
            />
          ))}
      </Box>
    </Box>
  );
}
