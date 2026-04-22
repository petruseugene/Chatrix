import { useState } from 'react';
import { DialogContent, DialogActions, TextField, Button, Alert } from '@mui/material';
import StyledDialog from '../../components/StyledDialog';
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
    <StyledDialog open={open} onClose={handleClose} title="Invite User">
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <DialogContent>
          {successMsg && (
            <Alert
              severity="success"
              sx={{
                mb: 2,
                bgcolor: 'rgba(34,197,94,0.12)',
                color: '#86efac',
                '& .MuiAlert-icon': { color: '#86efac' },
              }}
            >
              {successMsg}
            </Alert>
          )}
          {inviteUser.isError && (
            <Alert
              severity="error"
              sx={{
                mb: 2,
                bgcolor: 'rgba(239,68,68,0.12)',
                color: '#fca5a5',
                '& .MuiAlert-icon': { color: '#fca5a5' },
              }}
            >
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
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&.Mui-focused fieldset': { borderColor: '#6366f1' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#6366f1' },
              '& .MuiOutlinedInput-input': { color: '#fff' },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleClose}
            variant="outlined"
            sx={{
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.6)',
              borderRadius: '8px',
              '&:hover': {
                border: '1px solid rgba(255,255,255,0.3)',
                bgcolor: 'rgba(255,255,255,0.06)',
              },
            }}
          >
            Close
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!username.trim() || inviteUser.isPending}
            sx={{
              bgcolor: '#6366f1',
              borderRadius: '8px',
              '&:hover': { bgcolor: '#4f46e5' },
              '&:disabled': { bgcolor: 'rgba(99,102,241,0.4)' },
            }}
          >
            {inviteUser.isPending ? 'Inviting...' : 'Invite'}
          </Button>
        </DialogActions>
      </form>
    </StyledDialog>
  );
}
