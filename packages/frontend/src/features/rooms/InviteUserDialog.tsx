import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
} from '@mui/material';
import { useInviteUser } from './useRoomMutations';

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
}

export function InviteUserDialog({ open, onClose, roomId }: InviteUserDialogProps) {
  const [username, setUsername] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const inviteUser = useInviteUser();

  function handleClose() {
    setUsername('');
    setSuccessMsg(null);
    inviteUser.reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    await inviteUser.mutateAsync(
      { roomId, username: username.trim() },
      {
        onSuccess: () => {
          setSuccessMsg(`${username.trim()} has been invited`);
          setUsername('');
        },
      },
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <DialogTitle>Invite User</DialogTitle>
        <DialogContent>
          {successMsg && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {successMsg}
            </Alert>
          )}
          {inviteUser.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {inviteUser.error?.message ?? 'Failed to invite user'}
            </Alert>
          )}
          <TextField
            autoFocus
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!username.trim() || inviteUser.isPending}
          >
            {inviteUser.isPending ? 'Inviting...' : 'Invite'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
