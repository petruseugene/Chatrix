import { Box, Badge, ListItemButton, Typography, Skeleton } from '@mui/material';
import TagIcon from '@mui/icons-material/Tag';
import { useRooms } from './useRoomsQuery';
import { useChatStore } from '../../stores/chatStore';
import type { RoomSummary } from './roomsApi';

interface SidebarRoomListProps {
  searchQuery?: string;
}

function RoomSkeleton() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: '6px' }}>
      <Skeleton
        variant="rectangular"
        width={14}
        height={14}
        sx={{ bgcolor: 'rgba(255,255,255,0.08)', borderRadius: '2px', flexShrink: 0 }}
      />
      <Skeleton variant="text" width="60%" height={16} sx={{ bgcolor: 'rgba(255,255,255,0.07)' }} />
    </Box>
  );
}

interface RoomRowProps {
  room: RoomSummary;
  isActive: boolean;
  onClick: () => void;
}

function RoomRow({ room, isActive, onClick }: RoomRowProps) {
  return (
    <ListItemButton
      onClick={onClick}
      sx={{
        px: 2,
        py: '5px',
        mx: 1,
        borderRadius: '8px',
        width: 'calc(100% - 16px)',
        bgcolor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
        color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
        transition: 'background-color 0.12s ease, color 0.12s ease',
        '&:hover': {
          bgcolor: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
          color: '#fff',
        },
        '&.Mui-focusVisible': {
          outline: '2px solid rgba(99,102,241,0.5)',
          outlineOffset: '1px',
        },
        minHeight: 'unset',
        gap: 1,
      }}
    >
      <TagIcon
        sx={{
          fontSize: '0.9rem',
          color: isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)',
          flexShrink: 0,
          mt: '1px',
        }}
      />

      <Badge
        badgeContent={room.unreadCount > 0 ? room.unreadCount : 0}
        max={99}
        sx={{
          flex: 1,
          minWidth: 0,
          '& .MuiBadge-badge': {
            bgcolor: '#f59e0b',
            color: '#1c1917',
            fontWeight: 800,
            fontSize: '0.6rem',
            minWidth: 16,
            height: 16,
            border: '2px solid #1e2030',
            right: -4,
            top: '50%',
            transform: 'translateY(-50%)',
          },
        }}
      >
        <Typography
          noWrap
          sx={{
            fontSize: '0.875rem',
            fontWeight: isActive ? 700 : 500,
            letterSpacing: '-0.01em',
            lineHeight: 1.4,
            color: 'inherit',
            display: 'block',
            pr: room.unreadCount > 0 ? 2.5 : 0,
          }}
        >
          {room.name}
        </Typography>
      </Badge>
    </ListItemButton>
  );
}

export default function SidebarRoomList({ searchQuery }: SidebarRoomListProps) {
  const { data: rooms, isLoading, isError } = useRooms();
  const activeView = useChatStore((s) => s.activeView);
  const setActiveRoom = useChatStore((s) => s.setActiveRoom);

  const activeRoomId = activeView?.type === 'room' ? activeView.roomId : null;

  const filteredRooms =
    searchQuery && rooms
      ? rooms.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : rooms;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {/* Section label */}
      <Typography
        sx={{
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
          padding: '8px 16px 4px',
          userSelect: 'none',
        }}
      >
        Rooms
      </Typography>

      {/* Loading state */}
      {isLoading && (
        <>
          <RoomSkeleton />
          <RoomSkeleton />
        </>
      )}

      {/* Error state */}
      {isError && (
        <Typography
          sx={{
            fontSize: '0.78rem',
            color: 'rgba(255,255,255,0.5)',
            px: 2,
            py: 1,
          }}
        >
          Failed to load rooms
        </Typography>
      )}

      {/* Empty state */}
      {!isLoading && !isError && filteredRooms && filteredRooms.length === 0 && (
        <Typography
          sx={{
            fontSize: '0.78rem',
            color: 'rgba(255,255,255,0.5)',
            px: 2,
            py: 1,
          }}
        >
          No rooms yet
        </Typography>
      )}

      {/* Room list */}
      {!isLoading &&
        filteredRooms?.map((room) => (
          <RoomRow
            key={room.id}
            room={room}
            isActive={room.id === activeRoomId}
            onClick={() => setActiveRoom(room.id)}
          />
        ))}
    </Box>
  );
}
