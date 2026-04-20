import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
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
import { useFriends } from '../friendship/useFriendshipMutations';
import { useStartThread } from '../dm/useDmQueries';
import { getAvatarColor } from '../dm/dmUtils';
import { useChatStore } from '../../stores/chatStore';

interface NewDmDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function NewDmDialog({ open, onClose }: NewDmDialogProps) {
  const [search, setSearch] = useState('');
  const [pendingFriendId, setPendingFriendId] = useState<string | null>(null);

  const { data: friends, isLoading: friendsLoading } = useFriends();
  const startThread = useStartThread();
  const setActiveDm = useChatStore((s) => s.setActiveDm);

  const filteredFriends = friends?.filter((f) =>
    f.username.toLowerCase().includes(search.toLowerCase()),
  );

  function handleClose() {
    setSearch('');
    setPendingFriendId(null);
    startThread.reset();
    onClose();
  }

  async function handleSelectFriend(friendId: string) {
    setPendingFriendId(friendId);
    try {
      const newThread = await startThread.mutateAsync(friendId);
      setActiveDm(newThread.id);
      handleClose();
    } catch {
      // error is surfaced via startThread.error below
    } finally {
      setPendingFriendId(null);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
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
          placeholder="Search friends..."
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

        {/* Error alert */}
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

        {/* Loading state */}
        {friendsLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} sx={{ color: '#6366f1' }} />
          </Box>
        )}

        {/* Empty friends state */}
        {!friendsLoading && friends && friends.length === 0 && (
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

        {/* No search results */}
        {!friendsLoading &&
          friends &&
          friends.length > 0 &&
          filteredFriends &&
          filteredFriends.length === 0 && (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.3)' }}>
                No friends match &ldquo;{search}&rdquo;
              </Typography>
            </Box>
          )}

        {/* Friend list */}
        {!friendsLoading && filteredFriends && filteredFriends.length > 0 && (
          <List disablePadding>
            {filteredFriends.map((friend) => {
              const isPending = pendingFriendId === friend.friendId;
              const isDisabled = startThread.isPending;

              return (
                <ListItem
                  key={friend.friendId}
                  component="button"
                  onClick={() => {
                    if (!isDisabled) void handleSelectFriend(friend.friendId);
                  }}
                  disabled={isDisabled}
                  sx={{
                    borderRadius: '10px',
                    px: 1.5,
                    py: 1,
                    mb: 0.25,
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    bgcolor: 'transparent',
                    cursor: isDisabled ? 'default' : 'pointer',
                    transition: 'background-color 0.12s ease',
                    opacity: isDisabled && !isPending ? 0.45 : 1,
                    '&:hover': {
                      bgcolor: isDisabled ? 'transparent' : 'rgba(255,255,255,0.06)',
                    },
                    '&.Mui-disabled': {
                      opacity: isDisabled && !isPending ? 0.45 : 1,
                    },
                    '&:focus-visible': {
                      outline: '2px solid rgba(99,102,241,0.5)',
                      outlineOffset: '1px',
                    },
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 46 }}>
                    <Avatar
                      sx={{
                        width: 34,
                        height: 34,
                        bgcolor: getAvatarColor(friend.username),
                        fontSize: '0.82rem',
                        fontWeight: 700,
                      }}
                    >
                      {friend.username.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={friend.username}
                    primaryTypographyProps={{
                      sx: {
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.9)',
                        letterSpacing: '-0.01em',
                      },
                    }}
                  />
                  {isPending && <CircularProgress size={16} sx={{ color: '#6366f1', ml: 1 }} />}
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
