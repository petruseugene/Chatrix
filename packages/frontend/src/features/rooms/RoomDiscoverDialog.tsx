import { useState, useEffect } from 'react';
import {
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import StyledDialog from '../../components/StyledDialog';
import { usePublicRooms } from './useRoomsQuery';
import { useJoinRoom } from './useRoomMutations';
import type { RoomSummary } from '@chatrix/shared';

interface RoomDiscoverDialogProps {
  open: boolean;
  onClose: () => void;
}

export function RoomDiscoverDialog({ open, onClose }: RoomDiscoverDialogProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const joinRoom = useJoinRoom();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: rooms, isLoading } = usePublicRooms(debouncedSearch || undefined);

  function handleClose() {
    setSearch('');
    setDebouncedSearch('');
    onClose();
  }

  return (
    <StyledDialog open={open} onClose={handleClose} title="Discover Rooms" maxWidth={560}>
      <DialogContent>
        <TextField
          autoFocus
          placeholder="Search rooms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              '& fieldset': {
                borderColor: 'rgba(255,255,255,0.1)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(255,255,255,0.2)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#6366f1',
              },
            },
            '& .MuiInputBase-input': {
              color: '#fff',
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'rgba(255,255,255,0.4)' }} />
              </InputAdornment>
            ),
          }}
        />
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress sx={{ color: '#6366f1' }} />
          </Box>
        ) : rooms?.length === 0 ? (
          <Typography textAlign="center" py={3} sx={{ color: 'rgba(255,255,255,0.35)' }}>
            No rooms found
          </Typography>
        ) : (
          <List disablePadding>
            {rooms?.map((room: RoomSummary) => (
              <ListItem key={room.id} sx={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <ListItemText
                  primary={room.name}
                  secondary={
                    room.description
                      ? `${room.memberCount} members · ${room.description.slice(0, 80)}`
                      : `${room.memberCount} members`
                  }
                  primaryTypographyProps={{ sx: { color: '#fff' } }}
                  secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
                />
                <ListItemSecondaryAction>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={room.myRole !== undefined || joinRoom.isPending}
                    onClick={() => joinRoom.mutate(room.id)}
                    sx={
                      room.myRole !== undefined || joinRoom.isPending
                        ? {
                            color: 'rgba(255,255,255,0.3)',
                            borderColor: 'rgba(255,255,255,0.1)',
                            '&.Mui-disabled': {
                              color: 'rgba(255,255,255,0.3)',
                              borderColor: 'rgba(255,255,255,0.1)',
                            },
                          }
                        : {
                            color: '#6366f1',
                            borderColor: '#6366f1',
                            '&:hover': {
                              borderColor: '#818cf8',
                              bgcolor: 'rgba(99,102,241,0.08)',
                            },
                          }
                    }
                  >
                    {room.myRole !== undefined ? 'Joined' : 'Join'}
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </StyledDialog>
  );
}
