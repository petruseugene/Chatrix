import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@chatrix/shared';
import type { z } from 'zod';
import { TextField, Button, CircularProgress, Alert, Box } from '@mui/material';
import { useRegister } from './useAuthMutations';

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterForm() {
  const navigate = useNavigate();
  const { mutate, isPending, error } = useRegister();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = (data: RegisterFormValues) => {
    mutate(data, {
      onSuccess: () => navigate('/'),
    });
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {error && (
        <Alert severity="error" sx={{ borderRadius: 2, fontSize: '0.875rem' }}>
          {error instanceof Error ? error.message : 'Registration failed. Please try again.'}
        </Alert>
      )}

      <TextField
        label="Username"
        autoComplete="username"
        autoFocus
        fullWidth
        error={!!errors.username}
        helperText={errors.username?.message}
        {...register('username')}
        InputProps={{
          sx: {
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.6)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.8)' },
            '&.Mui-focused': { bgcolor: 'rgba(255,255,255,0.9)' },
          },
        }}
      />

      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        fullWidth
        error={!!errors.email}
        helperText={errors.email?.message}
        {...register('email')}
        InputProps={{
          sx: {
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.6)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.8)' },
            '&.Mui-focused': { bgcolor: 'rgba(255,255,255,0.9)' },
          },
        }}
      />

      <TextField
        label="Password"
        type="password"
        autoComplete="new-password"
        fullWidth
        error={!!errors.password}
        helperText={errors.password?.message}
        {...register('password')}
        InputProps={{
          sx: {
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.6)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.8)' },
            '&.Mui-focused': { bgcolor: 'rgba(255,255,255,0.9)' },
          },
        }}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={isPending}
        sx={{
          mt: 0.5,
          py: 1.5,
          borderRadius: 2,
          fontWeight: 700,
          fontSize: '1rem',
          letterSpacing: 0.5,
          background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
          boxShadow: '0 4px 15px rgba(99,102,241,0.4)',
          '&:hover': {
            background: 'linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)',
            boxShadow: '0 6px 20px rgba(99,102,241,0.5)',
          },
          '&:disabled': {
            background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
            opacity: 0.7,
          },
        }}
      >
        {isPending ? <CircularProgress size={20} color="inherit" /> : 'Create Account'}
      </Button>
    </Box>
  );
}
