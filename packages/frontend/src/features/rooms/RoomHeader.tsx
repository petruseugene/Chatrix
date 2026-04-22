import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import LockIcon from '@mui/icons-material/Lock';
import PeopleIcon from '@mui/icons-material/People';
import { useState } from 'react';
import type { RoomDetail, RoomRole } from '@chatrix/shared';
import { RoomSettingsDialog } from './RoomSettingsDialog';
import { InviteUserDialog } from './InviteUserDialog';

interface RoomHeaderProps {
  room: RoomDetail;
  myRole: RoomRole;
}

export function RoomHeader({ room, myRole }: RoomHeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 3,
        py: 1.5,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'background.paper',
        gap: 1,
        minHeight: 56,
      }}
    >
      {room.isPrivate && <LockIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />}
      <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', flex: 1 }}>
        {room.name}
      </Typography>
      <Tooltip title="Add member">
        <IconButton size="small" onClick={() => setInviteOpen(true)}>
          <PeopleIcon sx={{ fontSize: '1.1rem' }} />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            {room.memberCount}
          </Typography>
        </IconButton>
      </Tooltip>
      <IconButton size="small" onClick={() => setSettingsOpen(true)} title="Room settings">
        <SettingsIcon fontSize="small" />
      </IconButton>
      <RoomSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        room={room}
        myRole={myRole}
      />
      <InviteUserDialog open={inviteOpen} onClose={() => setInviteOpen(false)} roomId={room.id} />
    </Box>
  );
}
