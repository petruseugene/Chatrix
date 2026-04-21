import { ListItem, ListItemAvatar, ListItemText, Avatar, Button } from '@mui/material';
import type { UserSearchResultDto } from '../friendship/friendshipApi';
import { getAvatarColor } from '../dm/dmUtils';

interface StrangerRowProps {
  user: UserSearchResultDto;
  isPending: boolean;
  onAdd: () => void;
  onAccept: () => void;
}

export default function StrangerRow({ user, isPending, onAdd, onAccept }: StrangerRowProps) {
  const showPending = isPending || user.relationshipStatus === 'pending_sent';
  const showAccept = !showPending && user.relationshipStatus === 'pending_received';
  const showAdd = !showPending && !showAccept && user.relationshipStatus === 'none';

  return (
    <ListItem
      disablePadding={false}
      sx={{
        px: 1.5,
        py: 0.75,
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <ListItemAvatar sx={{ minWidth: 46 }}>
        <Avatar
          sx={{
            width: 34,
            height: 34,
            bgcolor: getAvatarColor(user.username),
            fontSize: '0.82rem',
            fontWeight: 700,
          }}
        >
          {user.username.charAt(0).toUpperCase()}
        </Avatar>
      </ListItemAvatar>

      <ListItemText
        primary={user.username}
        primaryTypographyProps={{
          sx: {
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.9)',
            letterSpacing: '-0.01em',
          },
        }}
      />

      {showPending && (
        <Button
          disabled
          size="small"
          sx={{
            ml: 1,
            flexShrink: 0,
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.3)',
            bgcolor: 'rgba(255,255,255,0.06)',
            borderRadius: '6px',
            px: 1.5,
            textTransform: 'none',
            '&.Mui-disabled': {
              color: 'rgba(255,255,255,0.3)',
              bgcolor: 'rgba(255,255,255,0.06)',
            },
          }}
        >
          Pending…
        </Button>
      )}

      {showAccept && (
        <Button
          onClick={onAccept}
          size="small"
          sx={{
            ml: 1,
            flexShrink: 0,
            fontSize: '0.78rem',
            fontWeight: 600,
            color: '#fff',
            bgcolor: '#6366f1',
            borderRadius: '6px',
            px: 1.5,
            textTransform: 'none',
            '&:hover': {
              bgcolor: '#4f52d9',
            },
          }}
        >
          Accept
        </Button>
      )}

      {showAdd && (
        <Button
          onClick={onAdd}
          size="small"
          sx={{
            ml: 1,
            flexShrink: 0,
            fontSize: '0.78rem',
            fontWeight: 600,
            color: '#fff',
            bgcolor: '#6366f1',
            borderRadius: '6px',
            px: 1.5,
            textTransform: 'none',
            '&:hover': {
              bgcolor: '#4f52d9',
            },
          }}
        >
          + Add
        </Button>
      )}
    </ListItem>
  );
}
