import { useState } from 'react';
import {
  Tabs,
  Tab,
  Box,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Typography,
  Alert,
  DialogActions,
  DialogContent,
} from '@mui/material';
import type { RoomDetail, RoomMember, RoomRole } from '@chatrix/shared';
import {
  useUpdateRoom,
  useDeleteRoom,
  useKickMember,
  useBanUser,
  useUnbanUser,
  useSetRole,
} from './useRoomMutations';
import { useRoomBans } from './useRoomsQuery';
import { useAuthStore } from '../../stores/authStore';
import StyledDialog from '../../components/StyledDialog';

interface RoomSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  room: RoomDetail;
  myRole: RoomRole;
}

const ROLE_RANK = { OWNER: 2, ADMIN: 1, MEMBER: 0 } as const;

const indigoBtn = {
  bgcolor: '#6366f1',
  borderRadius: '8px',
  '&:hover': { bgcolor: '#4f46e5' },
};

const ghostBtn = {
  border: '1px solid rgba(255,255,255,0.15)',
  color: 'rgba(255,255,255,0.6)',
  borderRadius: '8px',
};

const dangerBtn = {
  bgcolor: '#ef4444',
  borderRadius: '8px',
  '&:hover': { bgcolor: '#dc2626' },
};

const darkTextField = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&.Mui-focused fieldset': { borderColor: '#6366f1' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#6366f1' },
  '& .MuiInputBase-input': { color: '#fff' },
};

export function RoomSettingsDialog({ open, onClose, room, myRole }: RoomSettingsDialogProps) {
  const [tab, setTab] = useState(0);
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description);
  const [isPrivate, setIsPrivate] = useState(room.isPrivate);
  const currentUserId = useAuthStore((s) => s.user?.sub);

  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();
  const kickMember = useKickMember();
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const setRole = useSetRole();
  const { data: bans } = useRoomBans(myRole === 'OWNER' || myRole === 'ADMIN' ? room.id : null);

  const isOwner = myRole === 'OWNER';
  const isAdminOrOwner = myRole === 'OWNER' || myRole === 'ADMIN';

  async function handleSave() {
    await updateRoom.mutateAsync({ roomId: room.id, dto: { name, description, isPrivate } });
  }

  async function handleDelete() {
    if (!confirm(`Delete room "${room.name}"? This cannot be undone.`)) return;
    await deleteRoom.mutateAsync(room.id, { onSuccess: onClose });
  }

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      title={`Room Settings — ${room.name}`}
      maxWidth={560}
    >
      <Tabs
        value={tab}
        onChange={(_, v: number) => setTab(v)}
        sx={{
          px: 2.5,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          bgcolor: 'rgba(255,255,255,0.02)',
          '& .MuiTab-root': { color: 'rgba(255,255,255,0.6)' },
          '& .MuiTab-root.Mui-selected': { color: '#fff' },
          '& .MuiTabs-indicator': { bgcolor: '#6366f1' },
        }}
      >
        <Tab label="Info" />
        <Tab label="Members" />
        {isAdminOrOwner && <Tab label="Bans" />}
      </Tabs>

      <DialogContent sx={{ minHeight: 300, p: 3 }}>
        {/* Info Tab */}
        {tab === 0 && (
          <Box>
            {isOwner ? (
              <>
                <TextField
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                  sx={{ mb: 2, ...darkTextField }}
                />
                <TextField
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  multiline
                  rows={2}
                  fullWidth
                  sx={{ mb: 2, ...darkTextField }}
                />
                <FormControlLabel
                  control={
                    <Switch checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                  }
                  label="Private room"
                  sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}
                />
                {updateRoom.isError && (
                  <Alert
                    severity="error"
                    sx={{
                      mb: 2,
                      bgcolor: 'rgba(239,68,68,0.12)',
                      color: '#fca5a5',
                      border: '1px solid rgba(239,68,68,0.3)',
                      '& .MuiAlert-icon': { color: '#fca5a5' },
                    }}
                  >
                    {updateRoom.error?.message}
                  </Alert>
                )}
                <Button
                  variant="contained"
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={updateRoom.isPending}
                  sx={indigoBtn}
                >
                  {updateRoom.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant="contained"
                  sx={{ ml: 2, ...dangerBtn }}
                  onClick={() => {
                    void handleDelete();
                  }}
                  disabled={deleteRoom.isPending}
                >
                  Delete room
                </Button>
              </>
            ) : (
              <Box>
                <Typography variant="body1" fontWeight={700} sx={{ color: '#fff' }}>
                  {room.name}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.5)' }}>
                  {room.description || 'No description'}
                </Typography>
                <Chip
                  label={room.isPrivate ? 'Private' : 'Public'}
                  size="small"
                  sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.08)', color: '#fff' }}
                />
              </Box>
            )}
          </Box>
        )}

        {/* Members Tab */}
        {tab === 1 && (
          <List disablePadding>
            {room.members.map((member: RoomMember) => {
              const canAct =
                isAdminOrOwner &&
                member.userId !== currentUserId &&
                ROLE_RANK[myRole] > ROLE_RANK[member.role];
              return (
                <ListItem
                  key={member.userId}
                  sx={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <ListItemText
                    primary={member.username}
                    secondary={member.role}
                    primaryTypographyProps={{ sx: { color: '#fff' } }}
                    secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
                  />
                  <ListItemSecondaryAction>
                    {isOwner && member.role !== 'OWNER' && (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() =>
                          setRole.mutate({
                            roomId: room.id,
                            userId: member.userId,
                            role: member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN',
                          })
                        }
                        sx={{ mr: 1, ...indigoBtn }}
                      >
                        {member.role === 'ADMIN' ? 'Demote' : 'Promote'}
                      </Button>
                    )}
                    {canAct && (
                      <>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() =>
                            kickMember.mutate({ roomId: room.id, userId: member.userId })
                          }
                          sx={{
                            mr: 1,
                            borderColor: '#ef4444',
                            color: '#ef4444',
                            borderRadius: '8px',
                          }}
                        >
                          Kick
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => banUser.mutate({ roomId: room.id, userId: member.userId })}
                          sx={{ borderColor: '#ef4444', color: '#ef4444', borderRadius: '8px' }}
                        >
                          Ban
                        </Button>
                      </>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        )}

        {/* Bans Tab */}
        {tab === 2 && isAdminOrOwner && (
          <List disablePadding>
            {!bans || bans.length === 0 ? (
              <Typography sx={{ color: 'rgba(255,255,255,0.5)' }} py={2}>
                No active bans
              </Typography>
            ) : (
              bans.map((ban) => (
                <ListItem key={ban.id} sx={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <ListItemText
                    primary={ban.username}
                    secondary={ban.reason ?? 'No reason given'}
                    primaryTypographyProps={{ sx: { color: '#fff' } }}
                    secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
                  />
                  <ListItemSecondaryAction>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => unbanUser.mutate({ roomId: room.id, userId: ban.userId })}
                      sx={indigoBtn}
                    >
                      Unban
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              ))
            )}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} sx={ghostBtn}>
          Close
        </Button>
      </DialogActions>
    </StyledDialog>
  );
}
