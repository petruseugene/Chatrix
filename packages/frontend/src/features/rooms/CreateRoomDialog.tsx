import { useState } from 'react';
import {
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Alert,
} from '@mui/material';
import StyledDialog from '../../components/StyledDialog';
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

  const textFieldSx = {
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
    '& textarea::placeholder': { color: 'rgba(255,255,255,0.3)', opacity: 1 },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#6366f1' },
  };

  return (
    <StyledDialog open={open} onClose={handleClose} title="Create Room">
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <DialogContent sx={{ px: 2.5, pt: 2, pb: 1 }}>
          {createRoom.isError && (
            <Alert
              severity="error"
              sx={{
                mb: 2,
                bgcolor: 'rgba(239,68,68,0.12)',
                color: '#fca5a5',
                borderRadius: '8px',
                border: '1px solid rgba(239,68,68,0.25)',
                '& .MuiAlert-icon': { color: '#ef4444' },
              }}
            >
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
            sx={{ mt: 1, mb: 2, ...textFieldSx }}
          />
          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            inputProps={{ maxLength: 300 }}
            fullWidth
            sx={{ mb: 2, ...textFieldSx }}
          />
          <FormControlLabel
            control={
              <Switch checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
            }
            label="Private room (invite only)"
            sx={{ color: 'rgba(255,255,255,0.7)' }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1, gap: 1 }}>
          <Button
            onClick={handleClose}
            variant="outlined"
            sx={{
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.6)',
              borderRadius: '8px',
              '&:hover': {
                border: '1px solid rgba(255,255,255,0.3)',
                bgcolor: 'rgba(255,255,255,0.05)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!name.trim() || createRoom.isPending}
            sx={{
              bgcolor: '#6366f1',
              borderRadius: '8px',
              '&:hover': { bgcolor: '#4f46e5' },
            }}
          >
            {createRoom.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </StyledDialog>
  );
}
