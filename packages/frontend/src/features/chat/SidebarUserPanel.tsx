import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Box, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useAuthStore } from '../../stores/authStore';
import { useLogout } from '../auth/useAuthMutations';
import { getAvatarColor } from '../dm/dmUtils';
import SettingsDialog from './SettingsDialog';

export default function SidebarUserPanel() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const username = user?.username ?? '';
  const email = user?.email ?? '';
  const avatarLetter = username.charAt(0).toUpperCase() || '?';
  const avatarBg = getAvatarColor(username);

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        navigate('/auth');
      },
    });
  }

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}
      >
        {/* Avatar */}
        <Avatar
          sx={{
            width: 36,
            height: 36,
            bgcolor: avatarBg,
            fontSize: '0.875rem',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {avatarLetter}
        </Avatar>

        {/* User info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.875rem',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {username || '—'}
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '0.75rem',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              mt: '1px',
            }}
          >
            {email || '—'}
          </Typography>
        </Box>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Tooltip title="Settings" placement="top">
            <IconButton
              onClick={() => setSettingsOpen(true)}
              size="small"
              aria-label="Open settings"
              sx={{
                color: 'rgba(255,255,255,0.6)',
                '&:hover': {
                  color: '#ffffff',
                  bgcolor: 'rgba(255,255,255,0.08)',
                },
                transition: 'color 0.15s ease, background-color 0.15s ease',
              }}
            >
              <SettingsOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Logout" placement="top">
            <span>
              <IconButton
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                size="small"
                aria-label="Logout"
                sx={{
                  color: 'rgba(255,255,255,0.6)',
                  '&:hover': {
                    color: '#ffffff',
                    bgcolor: 'rgba(255,255,255,0.08)',
                  },
                  '&.Mui-disabled': {
                    color: 'rgba(255,255,255,0.3)',
                  },
                  transition: 'color 0.15s ease, background-color 0.15s ease',
                }}
              >
                {logoutMutation.isPending ? (
                  <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.6)' }} />
                ) : (
                  <LogoutOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
