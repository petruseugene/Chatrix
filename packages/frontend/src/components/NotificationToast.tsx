import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNotificationStore, type Toast } from '../stores/notificationStore';
import { useDmStore } from '../stores/dmStore';
import { useChatStore } from '../stores/chatStore';

const TOAST_DURATION = 3000;

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useNotificationStore((s) => s.dismissToast);
  const setActivePendingRequestId = useDmStore((s) => s.setActivePendingRequestId);
  const clearActive = useChatStore((s) => s.clearActive);

  const isActionable = toast.type === 'friend_request' && !!toast.requestId;

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toast.id, dismissToast]);

  function handleClick() {
    dismissToast(toast.id);
    if (isActionable) {
      clearActive();
      setActivePendingRequestId(toast.requestId!);
    }
  }

  return (
    <Box
      onClick={handleClick}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.25,
        bgcolor: '#161722',
        border: '1px solid rgba(99,102,241,0.35)',
        borderRadius: '10px',
        px: 1.75,
        py: 1.25,
        boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
        minWidth: 260,
        maxWidth: 320,
        cursor: isActionable ? 'pointer' : 'default',
        pointerEvents: 'auto',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        ...(isActionable && {
          '&:hover': {
            bgcolor: 'rgba(99,102,241,0.08)',
            borderColor: 'rgba(99,102,241,0.6)',
          },
        }),
        '@keyframes slideIn': {
          from: { opacity: 0, transform: 'translateX(32px)' },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
        animation: 'slideIn 0.2s ease',
      }}
    >
      <NotificationsIcon sx={{ fontSize: '1rem', color: '#6366f1', mt: '1px', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            color: '#ffffff',
            fontSize: '0.8125rem',
            lineHeight: 1.45,
            fontWeight: 500,
          }}
        >
          {toast.message}
        </Typography>
        {isActionable && (
          <Typography
            sx={{
              color: 'rgba(99,102,241,0.8)',
              fontSize: '0.72rem',
              mt: '2px',
              fontWeight: 500,
            }}
          >
            Click to view request
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function NotificationToast() {
  const toasts = useNotificationStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 1400,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </Box>
  );
}
