import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Divider,
  Avatar,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuthStore } from '../../stores/authStore';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const user = useAuthStore((s) => s.user);

  const avatarLetter = user?.username?.charAt(0).toUpperCase() ?? '?';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          bgcolor: '#ffffff',
          boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        },
      }}
    >
      {/* Dialog title with close button */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          pt: 3,
          pb: 2,
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <Typography
          sx={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: '#0f172a',
            letterSpacing: '-0.02em',
          }}
        >
          Settings
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          aria-label="Close settings"
          sx={{
            color: '#94a3b8',
            '&:hover': { bgcolor: 'rgba(99,102,241,0.08)', color: '#6366f1' },
            transition: 'all 0.15s ease',
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 0 }}>
        {/* Account Section */}
        <Box sx={{ pt: 2.5, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PersonOutlineIcon sx={{ fontSize: 16, color: '#6366f1' }} />
            <Typography
              sx={{
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#6366f1',
              }}
            >
              Account
            </Typography>
          </Box>

          {/* User info card */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 2,
              borderRadius: '12px',
              bgcolor: 'rgba(99,102,241,0.04)',
              border: '1px solid rgba(99,102,241,0.10)',
            }}
          >
            <Avatar
              sx={{
                width: 44,
                height: 44,
                bgcolor: 'rgba(99,102,241,0.15)',
                color: '#6366f1',
                fontWeight: 700,
                fontSize: '1rem',
                flexShrink: 0,
              }}
            >
              {avatarLetter}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: '#0f172a',
                  letterSpacing: '-0.01em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.username ?? '—'}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.8rem',
                  color: '#64748b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  mt: '2px',
                }}
              >
                {user?.email ?? '—'}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'rgba(0,0,0,0.06)', my: 1.5 }} />

        {/* Change Password Section */}
        <Box sx={{ pb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <LockOutlinedIcon sx={{ fontSize: 16, color: '#6366f1' }} />
            <Typography
              sx={{
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#6366f1',
              }}
            >
              Change Password
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              borderRadius: '12px',
              bgcolor: 'rgba(0,0,0,0.02)',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <Typography sx={{ fontSize: '0.875rem', color: '#475569' }}>
              Password management
            </Typography>
            <Chip
              label="Coming soon"
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 600,
                bgcolor: 'rgba(99,102,241,0.1)',
                color: '#6366f1',
                border: '1px solid rgba(99,102,241,0.2)',
                '& .MuiChip-label': { px: 1 },
              }}
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 3,
          pt: 0,
          borderTop: '1px solid rgba(0,0,0,0.06)',
          mt: 0,
        }}
      >
        <Button
          onClick={onClose}
          variant="contained"
          disableElevation
          sx={{
            bgcolor: '#6366f1',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.875rem',
            borderRadius: '8px',
            px: 3,
            py: 1,
            textTransform: 'none',
            '&:hover': { bgcolor: '#4f46e5' },
            transition: 'background-color 0.15s ease',
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
