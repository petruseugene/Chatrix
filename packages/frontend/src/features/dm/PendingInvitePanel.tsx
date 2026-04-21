import { useState } from 'react';
import { Box, Avatar, Typography, Chip, Button, CircularProgress } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { getAvatarColor } from '../../utils/avatarUtils';
import { useAcceptRequest, useDeclineRequest } from '../friendship/useFriendshipMutations';
import { useStartThread } from './useDmQueries';
import { useDmStore } from '../../stores/dmStore';

export interface PendingInvitePanelProps {
  requestId: string;
  fromUserId: string;
  fromUsername: string;
  fromUserCreatedAt: string;
  createdAt: string;
}

/** Returns a human-readable join label such as "Joined 3 months ago" or "Joined 2 years ago". */
function formatJoinDate(fromUserCreatedAt: string): string {
  const joined = new Date(fromUserCreatedAt);
  const now = new Date();

  const totalMonths =
    (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth());

  if (totalMonths < 1) {
    return 'Joined this month';
  }

  if (totalMonths < 12) {
    return `Joined ${totalMonths} month${totalMonths === 1 ? '' : 's'} ago`;
  }

  const years = Math.floor(totalMonths / 12);
  return `Joined ${years} year${years === 1 ? '' : 's'} ago`;
}

export function PendingInvitePanel({
  requestId,
  fromUserId,
  fromUsername,
  fromUserCreatedAt,
}: PendingInvitePanelProps) {
  const avatarColor = getAvatarColor(fromUsername);
  const joinLabel = formatJoinDate(fromUserCreatedAt);

  const setActiveThread = useDmStore((s) => s.setActiveThread);
  const setActivePendingRequestId = useDmStore((s) => s.setActivePendingRequestId);

  const acceptMutation = useAcceptRequest();
  const declineMutation = useDeclineRequest();
  const startThreadMutation = useStartThread();

  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [declineError, setDeclineError] = useState<string | null>(null);

  const isBusy = acceptMutation.isPending || declineMutation.isPending;

  async function handleAccept() {
    setAcceptError(null);
    try {
      await acceptMutation.mutateAsync(requestId);
      const thread = await startThreadMutation.mutateAsync(fromUserId);
      setActiveThread(thread.id);
      setActivePendingRequestId(null);
    } catch {
      setAcceptError('Something went wrong. Please try again.');
    }
  }

  async function handleDecline() {
    setDeclineError(null);
    try {
      await declineMutation.mutateAsync(requestId);
      setActivePendingRequestId(null);
    } catch {
      setDeclineError('Something went wrong. Please try again.');
    }
  }

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#fafaf8',
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 3,
          py: 1.5,
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          bgcolor: '#fff',
          flexShrink: 0,
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: avatarColor,
            fontSize: '0.78rem',
            fontWeight: 700,
          }}
        >
          {fromUsername.charAt(0).toUpperCase()}
        </Avatar>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: '0.9rem',
            color: '#1e293b',
            letterSpacing: '-0.01em',
          }}
        >
          {fromUsername}
        </Typography>
        <Chip
          label="Pending"
          size="small"
          sx={{
            height: 20,
            bgcolor: 'rgba(245,158,11,0.12)',
            color: '#b45309',
            fontWeight: 700,
            fontSize: '0.65rem',
            letterSpacing: '0.04em',
            border: '1px solid rgba(245,158,11,0.3)',
            '& .MuiChip-label': { px: '7px' },
          }}
        />
      </Box>

      {/* Centered card */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            bgcolor: '#f8f9fa',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '16px',
            p: 4,
            maxWidth: 400,
            width: '100%',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}
        >
          {/* Large avatar */}
          <Avatar
            sx={{
              width: 72,
              height: 72,
              bgcolor: avatarColor,
              fontSize: '1.75rem',
              fontWeight: 700,
              boxShadow: `0 0 0 4px rgba(255,255,255,0.9), 0 0 0 6px ${avatarColor}33`,
            }}
          >
            {fromUsername.charAt(0).toUpperCase()}
          </Avatar>

          {/* Username */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: '1.1rem',
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              {fromUsername}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.8rem',
                color: '#94a3b8',
                mt: 0.5,
              }}
            >
              {joinLabel}
            </Typography>
          </Box>

          {/* Info box */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              bgcolor: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.15)',
              borderRadius: '10px',
              p: 1.75,
              width: '100%',
            }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 16, color: '#6366f1', flexShrink: 0, mt: '1px' }} />
            <Typography sx={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.55 }}>
              You have a pending friend request from this user. Accept to start chatting.
            </Typography>
          </Box>

          {/* Error messages */}
          {(acceptError || declineError) && (
            <Typography
              sx={{
                fontSize: '0.78rem',
                color: '#ef4444',
                textAlign: 'center',
              }}
            >
              {acceptError ?? declineError}
            </Typography>
          )}

          {/* Action buttons */}
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              width: '100%',
            }}
          >
            <Button
              variant="outlined"
              fullWidth
              disabled={isBusy}
              onClick={() => void handleDecline()}
              startIcon={
                declineMutation.isPending ? (
                  <CircularProgress size={14} sx={{ color: 'inherit' }} />
                ) : (
                  <CloseIcon fontSize="small" />
                )
              }
              sx={{
                borderColor: 'rgba(0,0,0,0.18)',
                color: '#64748b',
                fontWeight: 600,
                fontSize: '0.85rem',
                borderRadius: '10px',
                py: 1,
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#ef4444',
                  color: '#ef4444',
                  bgcolor: 'rgba(239,68,68,0.05)',
                },
                '&:disabled': {
                  opacity: 0.5,
                },
              }}
            >
              Decline
            </Button>

            <Button
              variant="contained"
              fullWidth
              disabled={isBusy}
              onClick={() => void handleAccept()}
              startIcon={
                acceptMutation.isPending || startThreadMutation.isPending ? (
                  <CircularProgress size={14} sx={{ color: 'inherit' }} />
                ) : (
                  <CheckIcon fontSize="small" />
                )
              }
              sx={{
                bgcolor: '#6366f1',
                fontWeight: 700,
                fontSize: '0.85rem',
                borderRadius: '10px',
                py: 1,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: '#4f46e5',
                  boxShadow: 'none',
                },
                '&:disabled': {
                  opacity: 0.5,
                  bgcolor: '#6366f1',
                  color: '#fff',
                },
              }}
            >
              Accept
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
