import { useState } from 'react';
import {
  Badge,
  Box,
  IconButton,
  List,
  ListItemButton,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { useNotificationStore } from '../stores/notificationStore';

export default function NotificationBell() {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const open = Boolean(anchor);

  function handleOpen(event: React.MouseEvent<HTMLButtonElement>) {
    setAnchor(event.currentTarget);
  }

  function handleClose() {
    setAnchor(null);
  }

  return (
    <>
      <Tooltip title="Notifications" placement="top">
        <IconButton
          onClick={handleOpen}
          size="small"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          aria-haspopup="true"
          aria-expanded={open}
          sx={{
            color: open ? '#ffffff' : 'rgba(255,255,255,0.6)',
            bgcolor: open ? 'rgba(99,102,241,0.15)' : 'transparent',
            transition: 'color 0.15s ease, background-color 0.15s ease',
            '&:hover': {
              color: '#ffffff',
              bgcolor: 'rgba(255,255,255,0.08)',
            },
            // Subtle pulse animation when there are unread notifications
            ...(unreadCount > 0 && {
              '@keyframes bellPulse': {
                '0%': { transform: 'rotate(0deg)' },
                '10%': { transform: 'rotate(12deg)' },
                '20%': { transform: 'rotate(-10deg)' },
                '30%': { transform: 'rotate(8deg)' },
                '40%': { transform: 'rotate(-6deg)' },
                '50%': { transform: 'rotate(4deg)' },
                '60%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(0deg)' },
              },
              animation: 'bellPulse 3s ease-in-out infinite',
            }),
          }}
        >
          <Badge
            badgeContent={unreadCount}
            color="error"
            max={99}
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.6rem',
                fontWeight: 700,
                minWidth: 16,
                height: 16,
                padding: '0 3px',
                // Position badge tightly on icon
                top: 2,
                right: 2,
              },
            }}
          >
            {unreadCount > 0 ? (
              <NotificationsIcon fontSize="small" />
            ) : (
              <NotificationsNoneIcon fontSize="small" />
            )}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 320,
              maxHeight: 400,
              bgcolor: '#161722',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '10px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.875rem',
              letterSpacing: '-0.01em',
              lineHeight: 1,
            }}
          >
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Typography
              sx={{
                color: 'rgba(99,102,241,0.9)',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {unreadCount} unread
            </Typography>
          )}
        </Box>

        {/* Notification list */}
        {notifications.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4,
              gap: 1,
              flex: 1,
            }}
          >
            <DoneAllIcon
              sx={{
                fontSize: '2rem',
                color: 'rgba(255,255,255,0.15)',
              }}
            />
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.35)',
                fontSize: '0.8125rem',
                textAlign: 'center',
              }}
            >
              You're all caught up
            </Typography>
          </Box>
        ) : (
          <List
            dense
            disablePadding
            sx={{
              overflowY: 'auto',
              '&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '2px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: 'rgba(255,255,255,0.18)',
              },
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.1) transparent',
            }}
          >
            {notifications.map((notification, index) => (
              <ListItemButton
                key={notification.id}
                onClick={() => markRead(notification.id)}
                sx={{
                  px: 2,
                  py: 1.25,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 0.25,
                  borderBottom:
                    index < notifications.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  bgcolor: notification.read ? 'transparent' : 'rgba(99,102,241,0.07)',
                  transition: 'background-color 0.15s ease',
                  '&:hover': {
                    bgcolor: notification.read ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.12)',
                  },
                  position: 'relative',
                  // Unread indicator stripe on left edge
                  '&::before': notification.read
                    ? {}
                    : {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '3px',
                        height: '60%',
                        borderRadius: '0 2px 2px 0',
                        bgcolor: '#6366f1',
                      },
                }}
              >
                <Typography
                  sx={{
                    color: notification.read ? 'rgba(255,255,255,0.65)' : '#ffffff',
                    fontSize: '0.8125rem',
                    lineHeight: 1.45,
                    fontWeight: notification.read ? 400 : 500,
                    width: '100%',
                  }}
                >
                  {notification.message}
                </Typography>
                <Typography
                  sx={{
                    color: 'rgba(255,255,255,0.35)',
                    fontSize: '0.6875rem',
                    lineHeight: 1,
                    mt: '2px',
                  }}
                >
                  {new Date(notification.createdAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </Typography>
              </ListItemButton>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}
