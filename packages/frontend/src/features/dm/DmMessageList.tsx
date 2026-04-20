import { useRef, useEffect, useCallback } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import type { DmMessagePayload } from '@chatrix/shared';
import { useMessages, useEditMessage, useDeleteMessage } from './useDmQueries';
import { useAuthStore } from '../../stores/authStore';
import DmMessageItem from './DmMessageItem';

interface Props {
  threadId: string;
}

export default function DmMessageList({ threadId }: Props) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useMessages(threadId);

  const { mutate: editMsg } = useEditMessage();
  const { mutate: deleteMsg } = useDeleteMessage();

  const user = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  // Flatten all pages — newest first from API, so reverse to show oldest at top
  const allMessages: DmMessagePayload[] = data?.pages
    ? [...data.pages].reverse().flatMap((p) => [...p].reverse())
    : [];

  // Build a lookup map for reply-to content
  const messageMap = new Map<string, DmMessagePayload>(allMessages.map((m) => [m.id, m]));

  // Track scroll position to know if user is at bottom
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    atBottomRef.current = distFromBottom < 80;
  }, []);

  // Auto-scroll to bottom when new messages arrive (only if already at bottom)
  useEffect(() => {
    const currentCount = allMessages.length;
    if (currentCount > prevMessageCountRef.current && atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = currentCount;
  }, [allMessages.length]);

  // Initial scroll to bottom on first load
  useEffect(() => {
    if (!isLoading && allMessages.length > 0 && prevMessageCountRef.current === 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [isLoading, allMessages.length]);

  if (isLoading) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#fafaf8',
        }}
      >
        <CircularProgress size={28} sx={{ color: '#6366f1' }} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#fafaf8',
        }}
      >
        <Typography sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          Failed to load messages.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      sx={{
        flex: 1,
        overflowY: 'auto',
        bgcolor: '#fafaf8',
        display: 'flex',
        flexDirection: 'column',
        scrollBehavior: 'smooth',
        '&::-webkit-scrollbar': { width: '6px' },
        '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: 'rgba(0,0,0,0.12)',
          borderRadius: '3px',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.2)' },
        },
      }}
    >
      {/* Load older messages button */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2, pb: 1 }}>
        {hasNextPage ? (
          <Button
            variant="text"
            size="small"
            startIcon={
              isFetchingNextPage ? (
                <CircularProgress size={14} sx={{ color: '#6366f1' }} />
              ) : (
                <KeyboardArrowUpIcon />
              )
            }
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            sx={{
              color: '#6366f1',
              fontSize: '0.78rem',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: '20px',
              px: 2,
              py: 0.5,
              bgcolor: 'rgba(99,102,241,0.08)',
              '&:hover': { bgcolor: 'rgba(99,102,241,0.14)' },
            }}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load older messages'}
          </Button>
        ) : (
          allMessages.length > 0 && (
            <Typography sx={{ fontSize: '0.72rem', color: '#cbd5e1', userSelect: 'none' }}>
              Beginning of conversation
            </Typography>
          )
        )}
      </Box>

      {/* Empty state */}
      {allMessages.length === 0 && (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            pb: 4,
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'rgba(99,102,241,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
            }}
          >
            💬
          </Box>
          <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: 500 }}>
            No messages yet
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
            Say hello to start the conversation
          </Typography>
        </Box>
      )}

      {/* Message list */}
      {allMessages.map((msg) => {
        const isOwnMsg = msg.authorId === user?.sub && !msg.deletedAt;
        const editHandler = isOwnMsg
          ? (m: DmMessagePayload) => {
              const newContent = prompt('Edit message:', m.content);
              if (newContent && newContent.trim() && newContent.trim() !== m.content) {
                editMsg({ messageId: m.id, content: newContent.trim(), threadId });
              }
            }
          : undefined;
        const deleteHandler = isOwnMsg
          ? (m: DmMessagePayload) => {
              if (confirm('Delete this message?')) {
                deleteMsg({ messageId: m.id, threadId });
              }
            }
          : undefined;

        return (
          <DmMessageItem
            key={msg.id}
            message={msg}
            currentUserId={user?.sub ?? ''}
            replyToMessage={msg.replyToId ? (messageMap.get(msg.replyToId) ?? null) : null}
            {...(editHandler ? { onEdit: editHandler } : {})}
            {...(deleteHandler ? { onDelete: deleteHandler } : {})}
          />
        );
      })}

      {/* Scroll anchor */}
      <div ref={bottomRef} style={{ height: 8 }} />
    </Box>
  );
}
