import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sendFriendRequestSchema } from '@chatrix/shared';
import type { z } from 'zod';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Divider,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import {
  usePendingRequests,
  useSendFriendRequest,
  useAcceptRequest,
  useDeclineRequest,
} from './useFriendshipMutations';

type SendRequestFormValues = z.infer<typeof sendFriendRequestSchema>;

export default function FriendRequests() {
  const {
    data: requests,
    isLoading: requestsLoading,
    isError: requestsError,
  } = usePendingRequests();
  const {
    mutate: sendRequest,
    isPending: sendPending,
    isError: sendError,
    error: sendErrorObj,
  } = useSendFriendRequest();
  const { mutate: acceptRequest, isPending: acceptPending } = useAcceptRequest();
  const { mutate: declineRequest, isPending: declinePending } = useDeclineRequest();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SendRequestFormValues>({
    resolver: zodResolver(sendFriendRequestSchema),
  });

  const onSubmit = (data: SendRequestFormValues) => {
    sendRequest(data.username, {
      onSuccess: () => reset(),
    });
  };

  return (
    <Box sx={{ maxWidth: 480 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Add a Friend
      </Typography>

      {/* Send friend request form */}
      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}
      >
        <TextField
          label="Username"
          size="small"
          fullWidth
          error={!!errors.username}
          helperText={errors.username?.message}
          {...register('username')}
          sx={{ flex: 1 }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={sendPending}
          startIcon={
            sendPending ? <CircularProgress size={16} color="inherit" /> : <PersonAddIcon />
          }
          sx={{
            minWidth: 80,
            height: 40,
            flexShrink: 0,
          }}
        >
          Send
        </Button>
      </Box>

      {sendError && sendErrorObj && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {sendErrorObj instanceof Error ? sendErrorObj.message : 'Failed to send friend request.'}
        </Alert>
      )}

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Pending Requests
      </Typography>

      {requestsLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress />
        </Box>
      )}

      {requestsError && (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Failed to load friend requests. Please try again.
        </Alert>
      )}

      {!requestsLoading && !requestsError && requests !== undefined && (
        <>
          {requests.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No pending friend requests.
            </Typography>
          ) : (
            <List disablePadding>
              {requests.map((req) => (
                <ListItem
                  key={req.id}
                  disableGutters
                  sx={{
                    py: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 'none' },
                    pr: 18,
                  }}
                >
                  <ListItemText
                    primary={req.fromUsername}
                    primaryTypographyProps={{ fontWeight: 600 }}
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        disabled={acceptPending || declinePending}
                        onClick={() => acceptRequest(req.id)}
                        sx={{ minWidth: 72 }}
                      >
                        Accept
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        disabled={acceptPending || declinePending}
                        onClick={() => declineRequest(req.id)}
                        sx={{ minWidth: 76 }}
                      >
                        Decline
                      </Button>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </>
      )}
    </Box>
  );
}
