import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Alert,
} from '@mui/material';
import { useCreateRoom } from './useRoomMutations';

interface CreateRoomDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateRoomDialog({ open, onClose }: CreateRoomDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const createRoom = useCreateRoom();

  function handleClose() {
    setName('');
    setDescription('');
    setIsPrivate(false);
    createRoom.reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const trimmedDescription = description.trim();
    await createRoom.mutateAsync(
      {
        name: name.trim(),
        ...(trimmedDescription && { description: trimmedDescription }),
        ...(isPrivate && { isPrivate }),
      },
      { onSuccess: handleClose },
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <DialogTitle>Create Room</DialogTitle>
        <DialogContent>
          {createRoom.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {createRoom.error?.message ?? 'Failed to create room'}
            </Alert>
          )}
          <TextField
            autoFocus
            label="Room name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            inputProps={{ maxLength: 60 }}
            fullWidth
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            inputProps={{ maxLength: 300 }}
            fullWidth
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Switch checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
            }
            label="Private room (invite only)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!name.trim() || createRoom.isPending}>
            {createRoom.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
