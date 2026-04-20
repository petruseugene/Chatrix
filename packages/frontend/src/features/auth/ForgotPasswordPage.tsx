import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { requestResetSchema } from '@chatrix/shared';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Link,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useRequestReset } from './useAuthMutations';

type FormValues = { email: string };

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const { mutate, isPending, error } = useRequestReset();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(requestResetSchema),
  });

  const onSubmit = (data: FormValues) => {
    mutate(data, {
      onSuccess: () => setSubmitted(true),
    });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
        px: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          p: 4,
          width: '100%',
          maxWidth: 400,
        }}
      >
        {submitted ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="success">Check your email for a reset link.</Alert>
            <Button component={RouterLink} to="/auth" variant="outlined" fullWidth>
              Back to login
            </Button>
          </Box>
        ) : (
          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
            noValidate
          >
            <Typography variant="h5" fontWeight={700} textAlign="center">
              Forgot Password
            </Typography>

            <Typography variant="body2" color="text.secondary" textAlign="center">
              Enter your email and we'll send a reset link
            </Typography>

            {error && (
              <Alert severity="error">
                {error instanceof Error ? error.message : 'Something went wrong'}
              </Alert>
            )}

            <TextField
              type="email"
              label="Email"
              fullWidth
              {...register('email')}
              error={Boolean(errors.email)}
              helperText={errors.email?.message}
              autoComplete="email"
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isPending}
              startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {isPending ? 'Sending…' : 'Send reset link'}
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Link component={RouterLink} to="/auth" variant="body2">
                Back to login
              </Link>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
