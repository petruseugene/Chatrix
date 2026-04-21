import type React from 'react';
import { Avatar, Box, Button, ListItemButton, Typography } from '@mui/material';
import type { FriendDto } from '../friendship/friendshipApi';
import { getAvatarColor } from '../dm/dmUtils';

type PresenceStatus = 'online' | 'afk' | 'offline';

interface FriendRowProps {
  friend: FriendDto;
  presence?: PresenceStatus;
  onDm: () => void;
  disabled?: boolean;
}

const PRESENCE_COLOR: Record<PresenceStatus, string> = {
  online: '#22c55e',
  afk: '#eab308',
  offline: '#4b5563',
};

const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  online: 'Online',
  afk: 'AFK',
  offline: 'Offline',
};

export default function FriendRow({ friend, presence, onDm, disabled }: FriendRowProps) {
  const resolvedPresence: PresenceStatus = presence ?? 'offline';
  const dotColor = PRESENCE_COLOR[resolvedPresence];
  const statusLabel = PRESENCE_LABEL[resolvedPresence];
  const avatarBg = getAvatarColor(friend.username);

  return (
    <ListItemButton
      onClick={onDm}
      disabled={disabled === true}
      sx={{
        px: 1.5,
        py: 0.75,
        mx: 1,
        borderRadius: '10px',
        width: 'calc(100% - 16px)',
        bgcolor: 'transparent',
        transition: 'background-color 0.12s ease',
        alignItems: 'center',
        gap: 1.5,
        '&:hover': {
          bgcolor: 'rgba(255,255,255,0.06)',
        },
        '&.Mui-disabled': {
          opacity: 0.45,
        },
        '&.Mui-focusVisible': {
          outline: '2px solid rgba(99,102,241,0.5)',
          outlineOffset: '1px',
        },
        minHeight: 'unset',
      }}
    >
      {/* Avatar with presence dot overlay */}
      <Box sx={{ position: 'relative', flexShrink: 0, width: 34, height: 34 }}>
        <Avatar
          sx={{
            width: 34,
            height: 34,
            bgcolor: avatarBg,
            fontSize: '0.82rem',
            fontWeight: 700,
          }}
        >
          {friend.username.charAt(0).toUpperCase()}
        </Avatar>
        {/* Presence dot */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 9,
            height: 9,
            borderRadius: '50%',
            bgcolor: dotColor,
            border: '2px solid #1e2030',
          }}
        />
      </Box>

      {/* Username + status label */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          noWrap
          sx={{
            fontSize: '0.875rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'rgba(255,255,255,0.9)',
            lineHeight: 1.3,
          }}
        >
          {friend.username}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.72rem',
            fontWeight: 500,
            color: dotColor,
            lineHeight: 1.3,
          }}
        >
          {statusLabel}
        </Typography>
      </Box>

      {/* DM button */}
      <Button
        size="small"
        disabled={disabled === true}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          onDm();
        }}
        sx={{
          flexShrink: 0,
          minWidth: 'unset',
          px: 1.5,
          py: 0.25,
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.02em',
          bgcolor: '#16a34a',
          color: '#fff',
          borderRadius: '6px',
          textTransform: 'none',
          '&:hover': {
            bgcolor: '#15803d',
          },
          '&.Mui-disabled': {
            bgcolor: 'rgba(22,163,74,0.35)',
            color: 'rgba(255,255,255,0.4)',
          },
        }}
      >
        DM
      </Button>
    </ListItemButton>
  );
}
