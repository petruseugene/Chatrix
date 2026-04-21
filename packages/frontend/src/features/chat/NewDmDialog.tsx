import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  List,
  CircularProgress,
  Alert,
  Typography,
  Box,
  IconButton,
  InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import { useQueryClient } from '@tanstack/react-query';
import {
  useFriends,
  useUserSearch,
  useSendFriendRequest,
  useAcceptRequest,
  SEARCH_KEY,
} from '../friendship/useFriendshipMutations';
import { useStartThread } from '../dm/useDmQueries';
import { useChatStore } from '../../stores/chatStore';
import FriendRow from './FriendRow';
import StrangerRow from './StrangerRow';

interface NewDmDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function NewDmDialog({ open, onClose }: NewDmDialogProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const { data: friends } = useFriends();
  const {
    data: searchResults,
    isLoading: searchLoading,
    isError: searchError,
    error: searchErrorObj,
  } = useUserSearch(debouncedSearch);
  const startThread = useStartThread();
  const sendFriendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptRequest();
  const setActiveDm = useChatStore((s) => s.setActiveDm);

  // Debounce the search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  const handleClose = useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
    setPendingIds(new Set());
    startThread.reset();
    onClose();
  }, [onClose, startThread]);

  async function onDm(friendId: string) {
    try {
      const newThread = await startThread.mutateAsync(friendId);
      setActiveDm(newThread.id);
      handleClose();
    } catch {
      // error surfaced via startThread.error below
    }
  }

  async function onAdd(userId: string, username: string) {
    setPendingIds((prev) => new Set(prev).add(userId));
    try {
      await sendFriendRequest.mutateAsync(username);
    } catch {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  }

  async function onAccept(requestId: string) {
    await acceptRequest.mutateAsync(requestId);
    void queryClient.invalidateQueries({ queryKey: ['friends', 'list'] });
    void queryClient.invalidateQueries({ queryKey: [...SEARCH_KEY, debouncedSearch] });
  }

  const isSearchActive = debouncedSearch.length >= 2;
  const isSearchPending = isSearchActive && searchLoading;

  // Split search results into friends and strangers
  const searchFriends = isSearchActive
    ? (searchResults ?? []).filter((u) => u.relationshipStatus === 'friend')
    : [];
  const searchStrangers = isSearchActive
    ? (searchResults ?? []).filter((u) => u.relationshipStatus !== 'friend')
    : [];

  const hasFriends = (friends ?? []).length > 0;
  const hasSearchResults = searchFriends.length > 0 || searchStrangers.length > 0;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: 360,
          bgcolor: '#1e2030',
          backgroundImage: 'none',
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          pt: 2.5,
          pb: 0,
        }}
      >
        <Typography
          sx={{
            fontSize: '1rem',
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-0.01em',
          }}
        >
          New Direct Message
        </Typography>
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{
            color: 'rgba(255,255,255,0.4)',
            '&:hover': { color: 'rgba(255,255,255,0.8)', bgcolor: 'rgba(255,255,255,0.06)' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2, pt: 2, pb: 2 }}>
        {/* Search field */}
        <TextField
          fullWidth
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 1.5,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.875rem',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&.Mui-focused fieldset': { borderColor: '#6366f1' },
            },
            '& input::placeholder': { color: 'rgba(255,255,255,0.3)', opacity: 1 },
          }}
        />

        {/* startThread error */}
        {startThread.isError && (
          <Alert
            severity="error"
            sx={{
              mb: 1.5,
              bgcolor: 'rgba(239,68,68,0.12)',
              color: '#fca5a5',
              borderRadius: '8px',
              border: '1px solid rgba(239,68,68,0.25)',
              '& .MuiAlert-icon': { color: '#ef4444' },
            }}
          >
            {startThread.error?.message ?? 'Failed to start conversation. Please try again.'}
          </Alert>
        )}

        {/* ----- EMPTY STATE: no active search (< 2 chars) ----- */}
        {!isSearchActive && (
          <>
            {hasFriends && (
              <>
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.35)',
                    px: 1.5,
                    mb: 0.5,
                  }}
                >
                  Friends
                </Typography>
                <List disablePadding>
                  {(friends ?? []).map((friend) => (
                    <FriendRow
                      key={friend.friendId}
                      friend={friend}
                      disabled={startThread.isPending}
                      onDm={() => void onDm(friend.friendId)}
                    />
                  ))}
                </List>
              </>
            )}

            {!hasFriends && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1.5,
                  py: 4,
                  px: 1,
                }}
              >
                <PersonAddAlt1Icon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.12)' }} />
                <Typography
                  sx={{
                    fontSize: '0.82rem',
                    color: 'rgba(255,255,255,0.3)',
                    textAlign: 'center',
                    lineHeight: 1.6,
                  }}
                >
                  You have no friends yet. Send a friend request first.
                </Typography>
              </Box>
            )}
          </>
        )}

        {/* ----- SEARCH ACTIVE (>= 2 chars) ----- */}
        {isSearchActive && (
          <>
            {/* Search error alert — friends list still visible above */}
            {searchError && (
              <Alert
                severity="error"
                sx={{
                  mb: 1.5,
                  bgcolor: 'rgba(239,68,68,0.12)',
                  color: '#fca5a5',
                  borderRadius: '8px',
                  border: '1px solid rgba(239,68,68,0.25)',
                  '& .MuiAlert-icon': { color: '#ef4444' },
                }}
              >
                {(searchErrorObj as Error | null)?.message ?? 'Search failed. Please try again.'}
              </Alert>
            )}

            {/* Friends from search (still visible even if search errored) */}
            {searchError && hasFriends && (
              <>
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.35)',
                    px: 1.5,
                    mb: 0.5,
                  }}
                >
                  Friends
                </Typography>
                <List disablePadding>
                  {(friends ?? []).map((friend) => (
                    <FriendRow
                      key={friend.friendId}
                      friend={friend}
                      disabled={startThread.isPending}
                      onDm={() => void onDm(friend.friendId)}
                    />
                  ))}
                </List>
              </>
            )}

            {/* Loading spinner */}
            {isSearchPending && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} sx={{ color: '#6366f1' }} />
              </Box>
            )}

            {/* Search results */}
            {!isSearchPending && !searchError && (
              <>
                {/* Friends section */}
                {searchFriends.length > 0 && (
                  <>
                    <Typography
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.35)',
                        px: 1.5,
                        mb: 0.5,
                      }}
                    >
                      Friends
                    </Typography>
                    <List disablePadding sx={{ mb: searchStrangers.length > 0 ? 1 : 0 }}>
                      {searchFriends.map((user) => {
                        const friend = (friends ?? []).find((f) => f.friendId === user.id);
                        if (!friend) return null;
                        return (
                          <FriendRow
                            key={friend.friendId}
                            friend={friend}
                            disabled={startThread.isPending}
                            onDm={() => void onDm(friend.friendId)}
                          />
                        );
                      })}
                    </List>
                  </>
                )}

                {/* Other People section */}
                {searchStrangers.length > 0 && (
                  <>
                    <Typography
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.35)',
                        px: 1.5,
                        mb: 0.5,
                      }}
                    >
                      Other People
                    </Typography>
                    <List disablePadding>
                      {searchStrangers.map((user) => (
                        <StrangerRow
                          key={user.id}
                          user={user}
                          isPending={pendingIds.has(user.id)}
                          onAdd={() => void onAdd(user.id, user.username)}
                          onAccept={() =>
                            user.friendRequestId ? void onAccept(user.friendRequestId) : undefined
                          }
                        />
                      ))}
                    </List>
                  </>
                )}

                {/* No results */}
                {!hasSearchResults && (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.3)' }}>
                      No users found for &ldquo;{debouncedSearch}&rdquo;
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
