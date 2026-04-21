import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Discover Rooms</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          placeholder="Search rooms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress />
          </Box>
        ) : rooms?.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={3}>
            No rooms found
          </Typography>
        ) : (
          <List disablePadding>
            {rooms?.map((room: RoomSummary) => (
              <ListItem key={room.id} divider>
                <ListItemText
                  primary={room.name}
                  secondary={
                    room.description
                      ? `${room.memberCount} members · ${room.description.slice(0, 80)}`
                      : `${room.memberCount} members`
                  }
                />
                <ListItemSecondaryAction>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={room.myRole !== undefined || joinRoom.isPending}
                    onClick={() => joinRoom.mutate(room.id)}
                  >
                    {room.myRole !== undefined ? 'Joined' : 'Join'}
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
