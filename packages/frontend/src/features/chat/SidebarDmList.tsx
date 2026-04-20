import { Box, Avatar, Badge, ListItemButton, Typography, Skeleton } from '@mui/material';
import type { DmThreadPayload } from '@chatrix/shared';
import { useThreads } from '../dm/useDmQueries';
import { getAvatarColor } from '../dm/dmUtils';
import { useChatStore } from '../../stores/chatStore';

interface SidebarDmListProps {
  searchQuery?: string;
}

function formatLastMessagePreview(thread: DmThreadPayload): string {
  if (!thread.lastMessage) return 'No messages yet';
  if (thread.lastMessage.deletedAt) return '[Message deleted]';
  const content = thread.lastMessage.content;
  return content.length > 42 ? content.slice(0, 42) + '…' : content;
}

function DmSkeleton() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: '6px' }}>
      <Skeleton
        variant="circular"
        width={28}
        height={28}
        sx={{ bgcolor: 'rgba(255,255,255,0.08)', flexShrink: 0 }}
      />
      <Box sx={{ flex: 1 }}>
        <Skeleton
          variant="text"
          width="50%"
          height={14}
          sx={{ bgcolor: 'rgba(255,255,255,0.08)', mb: 0.5 }}
        />
        <Skeleton
          variant="text"
          width="75%"
          height={12}
          sx={{ bgcolor: 'rgba(255,255,255,0.06)' }}
        />
      </Box>
    </Box>
  );
}

interface DmRowProps {
  thread: DmThreadPayload;
  isActive: boolean;
  onClick: () => void;
}

function DmRow({ thread, isActive, onClick }: DmRowProps) {
  const avatarColor = getAvatarColor(thread.otherUsername);
  const preview = formatLastMessagePreview(thread);
  const isDeletedPreview = !!thread.lastMessage?.deletedAt;

  return (
    <ListItemButton
      onClick={onClick}
      sx={{
        px: 2,
        py: '5px',
        mx: 1,
        borderRadius: '8px',
        width: 'calc(100% - 16px)',
        bgcolor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
        color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
        transition: 'background-color 0.12s ease, color 0.12s ease',
        alignItems: 'center',
        gap: 1.5,
        '&:hover': {
          bgcolor: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
          color: '#fff',
        },
        '&.Mui-focusVisible': {
          outline: '2px solid rgba(99,102,241,0.5)',
          outlineOffset: '1px',
        },
        minHeight: 'unset',
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
            fontSize: '0.58rem',
            minWidth: 16,
            height: 16,
            border: '2px solid #1e2030',
          },
        }}
      >
        <Avatar
          sx={{
            width: 28,
            height: 28,
            bgcolor: avatarColor,
            fontSize: '0.72rem',
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
            noWrap
            sx={{
              fontWeight: isActive ? 700 : 500,
              fontSize: '0.875rem',
              letterSpacing: '-0.01em',
              lineHeight: 1.4,
              color: 'inherit',
              flex: 1,
              mr: thread.unreadCount > 0 ? 1 : 0,
            }}
          >
            {thread.otherUsername}
          </Typography>
          {thread.unreadCount > 0 && (
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: '#f59e0b',
                flexShrink: 0,
              }}
            />
          )}
        </Box>
        <Typography
          noWrap
          sx={{
            fontSize: '0.75rem',
            color: isDeletedPreview
              ? 'rgba(255,255,255,0.3)'
              : isActive
                ? 'rgba(255,255,255,0.6)'
                : 'rgba(255,255,255,0.4)',
            fontStyle: isDeletedPreview ? 'italic' : 'normal',
            lineHeight: 1.3,
          }}
        >
          {preview}
        </Typography>
      </Box>
    </ListItemButton>
  );
}

export default function SidebarDmList({ searchQuery }: SidebarDmListProps) {
  const { data: threads, isLoading, isError } = useThreads();
  const activeView = useChatStore((s) => s.activeView);
  const setActiveDm = useChatStore((s) => s.setActiveDm);

  const activeThreadId = activeView?.type === 'dm' ? activeView.threadId : null;

  const filteredThreads =
    searchQuery && threads
      ? threads.filter((t) => t.otherUsername.toLowerCase().includes(searchQuery.toLowerCase()))
      : threads;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {/* Section label */}
      <Typography
        sx={{
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
          padding: '8px 16px 4px',
          userSelect: 'none',
        }}
      >
        Direct Messages
      </Typography>

      {/* Loading state */}
      {isLoading && (
        <>
          <DmSkeleton />
          <DmSkeleton />
          <DmSkeleton />
        </>
      )}

      {/* Error state */}
      {isError && (
        <Typography
          sx={{
            fontSize: '0.78rem',
            color: 'rgba(255,255,255,0.5)',
            px: 2,
            py: 1,
          }}
        >
          Failed to load direct messages
        </Typography>
      )}

      {/* Empty state */}
      {!isLoading && !isError && filteredThreads && filteredThreads.length === 0 && (
        <Typography
          sx={{
            fontSize: '0.78rem',
            color: 'rgba(255,255,255,0.5)',
            px: 2,
            py: 1,
          }}
        >
          No direct messages yet
        </Typography>
      )}

      {/* DM thread list */}
      {!isLoading &&
        filteredThreads?.map((thread) => (
          <DmRow
            key={thread.id}
            thread={thread}
            isActive={thread.id === activeThreadId}
            onClick={() => setActiveDm(thread.id)}
          />
        ))}
    </Box>
  );
}
