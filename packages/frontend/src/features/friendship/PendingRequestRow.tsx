import { Box, Avatar, Typography, Chip } from '@mui/material';
import type { FriendRequestDto } from './friendshipApi';
import { getAvatarColor } from '../dm/dmUtils';

interface PendingRequestRowProps {
  request: FriendRequestDto;
  onClick: () => void;
}

export function PendingRequestRow({ request, onClick }: PendingRequestRowProps) {
  const avatarColor = getAvatarColor(request.fromUsername);

  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        display: 'flex',
        gap: 1.5,
        px: 2,
        py: 1.25,
        mx: 1,
        borderRadius: '10px',
        border: 'none',
        cursor: 'pointer',
        width: 'calc(100% - 16px)',
        textAlign: 'left',
        bgcolor: 'transparent',
        transition: 'background-color 0.12s ease',
        alignItems: 'center',
        '&:hover': {
          bgcolor: 'rgba(255,255,255,0.06)',
        },
        '&:focus-visible': {
          outline: '2px solid rgba(99,102,241,0.5)',
          outlineOffset: '1px',
        },
      }}
    >
      {/* Avatar with yellow dot indicator */}
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        <Avatar
          sx={{
            width: 38,
            height: 38,
            bgcolor: avatarColor,
            fontSize: '0.85rem',
            fontWeight: 700,
          }}
        >
          {request.fromUsername.charAt(0).toUpperCase()}
        </Avatar>
        {/* Yellow dot bottom-right */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: '#f59e0b',
            border: '2px solid #1e2030',
          }}
        />
      </Box>

      {/* Request info */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: '0.875rem',
            color: 'rgba(255,255,255,0.85)',
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {request.fromUsername}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.78rem',
            color: '#f59e0b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            mt: '2px',
          }}
        >
          Pending request
        </Typography>
      </Box>

      {/* NEW chip */}
      <Chip
        label="NEW"
        size="small"
        sx={{
          flexShrink: 0,
          height: 18,
          bgcolor: 'rgba(245,158,11,0.15)',
          color: '#f59e0b',
          fontWeight: 800,
          fontSize: '0.6rem',
          letterSpacing: '0.06em',
          border: '1px solid rgba(245,158,11,0.3)',
          '& .MuiChip-label': {
            px: '6px',
          },
        }}
      />
    </Box>
  );
}
