import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
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
  IconButton,
  Chip,
  Typography,
  Alert,
  DialogActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
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

interface RoomSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  room: RoomDetail;
  myRole: RoomRole;
}

const ROLE_RANK = { OWNER: 2, ADMIN: 1, MEMBER: 0 } as const;

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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Room Settings — {room.name}</DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, v: number) => setTab(v)}
        sx={{ px: 3, borderBottom: '1px solid', borderColor: 'divider' }}
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
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  multiline
                  rows={2}
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <FormControlLabel
                  control={
                    <Switch checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                  }
                  label="Private room"
                  sx={{ mb: 2 }}
                />
                {updateRoom.isError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {updateRoom.error?.message}
                  </Alert>
                )}
                <Button
                  variant="contained"
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={updateRoom.isPending}
                >
                  {updateRoom.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  color="error"
                  sx={{ ml: 2 }}
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
                <Typography variant="body1" fontWeight={700}>
                  {room.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {room.description || 'No description'}
                </Typography>
                <Chip label={room.isPrivate ? 'Private' : 'Public'} size="small" sx={{ mt: 2 }} />
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
                <ListItem key={member.userId} divider>
                  <ListItemText primary={member.username} secondary={member.role} />
                  <ListItemSecondaryAction>
                    {isOwner && member.role !== 'OWNER' && (
                      <Button
                        size="small"
                        onClick={() =>
                          setRole.mutate({
                            roomId: room.id,
                            userId: member.userId,
                            role: member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN',
                          })
                        }
                        sx={{ mr: 1 }}
                      >
                        {member.role === 'ADMIN' ? 'Demote' : 'Promote'}
                      </Button>
                    )}
                    {canAct && (
                      <>
                        <Button
                          size="small"
                          color="warning"
                          onClick={() =>
                            kickMember.mutate({ roomId: room.id, userId: member.userId })
                          }
                          sx={{ mr: 1 }}
                        >
                          Kick
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => banUser.mutate({ roomId: room.id, userId: member.userId })}
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
              <Typography color="text.secondary" py={2}>
                No active bans
              </Typography>
            ) : (
              bans.map((ban) => (
                <ListItem key={ban.id} divider>
                  <ListItemText
                    primary={ban.username}
                    secondary={ban.reason ?? 'No reason given'}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      size="small"
                      onClick={() => unbanUser.mutate({ roomId: room.id, userId: ban.userId })}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))
            )}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
