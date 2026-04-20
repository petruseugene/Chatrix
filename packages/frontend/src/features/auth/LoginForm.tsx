import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@chatrix/shared';
import type { z } from 'zod';
import {
  TextField,
  Button,
  CircularProgress,
  Alert,
  Link,
  Box,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useState } from 'react';
import { useLogin } from './useAuthMutations';

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const navigate = useNavigate();
  const { mutate, isPending, error } = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormValues) => {
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
          {error instanceof Error ? error.message : 'Login failed. Please try again.'}
        </Alert>
      )}

      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        autoFocus
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
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
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
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
                edge="end"
                size="small"
              >
                {showPassword ? (
                  <VisibilityOff fontSize="small" />
                ) : (
                  <Visibility fontSize="small" />
                )}
              </IconButton>
            </InputAdornment>
          ),
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
        {isPending ? <CircularProgress size={20} color="inherit" /> : 'Sign In'}
      </Button>

      <Box sx={{ textAlign: 'center' }}>
        <Link
          component={RouterLink}
          to="/forgot-password"
          variant="body2"
          sx={{
            color: '#6366f1',
            fontWeight: 500,
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline', color: '#4f46e5' },
          }}
        >
          Forgot password?
        </Link>
      </Box>
    </Box>
  );
}
