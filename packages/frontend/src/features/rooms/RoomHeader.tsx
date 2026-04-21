import { Box, Typography, IconButton } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import LockIcon from '@mui/icons-material/Lock';
import PeopleIcon from '@mui/icons-material/People';
import { useState } from 'react';
import type { RoomDetail, RoomRole } from '@chatrix/shared';
import { RoomSettingsDialog } from './RoomSettingsDialog';

interface RoomHeaderProps {
  room: RoomDetail;
  myRole: RoomRole;
}

export function RoomHeader({ room, myRole }: RoomHeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1 }}>
        <PeopleIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary">
          {room.memberCount}
        </Typography>
      </Box>
      <IconButton size="small" onClick={() => setSettingsOpen(true)} title="Room settings">
        <SettingsIcon fontSize="small" />
      </IconButton>
      <RoomSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        room={room}
        myRole={myRole}
      />
    </Box>
  );
}
