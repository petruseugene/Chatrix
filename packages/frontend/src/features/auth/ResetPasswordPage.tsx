import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { resetPasswordSchema } from '@chatrix/shared';
import { Box, Paper, TextField, Button, Alert, CircularProgress, Typography } from '@mui/material';
import { useResetPassword } from './useAuthMutations';

// Client-side only: extends shared schema with confirmPassword field
const extendedSchema = resetPasswordSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof extendedSchema>;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const { mutate, isPending, error } = useResetPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(extendedSchema),
    defaultValues: { token: token ?? '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit: SubmitHandler<FormValues> = ({ newPassword }) => {
    // token is guaranteed non-null here (form is not rendered when token is absent)
    mutate(
      { token: token as string, newPassword },
      {
        onSuccess: () => {
          void navigate('/auth?tab=login');
        },
      },
    );
  };

  const cardSx = {
    bgcolor: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(12px)',
    borderRadius: 3,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    p: 4,
    width: '100%',
    maxWidth: 400,
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
      <Paper sx={cardSx}>
        <Typography
          variant="h5"
          component="h1"
          fontWeight={700}
          mb={3}
          textAlign="center"
          color="text.primary"
        >
          Reset Password
        </Typography>

        {/* ── No token: error state ── */}
        {!token ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="error">Invalid or missing reset token</Alert>
            <Button component={RouterLink} to="/auth" variant="outlined" fullWidth>
              Back to login
            </Button>
          </Box>
        ) : (
          /* ── Token present: password form ── */
          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            {error && (
              <Alert severity="error">
                {error instanceof Error ? error.message : 'Something went wrong'}
              </Alert>
            )}

            <TextField
              {...register('newPassword')}
              type="password"
              label="New password"
              fullWidth
              error={!!errors.newPassword}
              helperText={errors.newPassword?.message}
              autoComplete="new-password"
            />

            <TextField
              {...register('confirmPassword')}
              type="password"
              label="Confirm password"
              fullWidth
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword?.message}
              autoComplete="new-password"
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isPending}
              startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {isPending ? 'Resetting…' : 'Reset password'}
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
