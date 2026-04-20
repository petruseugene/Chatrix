import { useSearchParams } from 'react-router-dom';
import { Box, Paper, Tabs, Tab, Typography } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

type TabValue = 'login' | 'register';

function isTabValue(v: string | null): v is TabValue {
  return v === 'login' || v === 'register';
}

export default function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: TabValue = isTabValue(rawTab) ? rawTab : 'login';

  const handleTabChange = (_: React.SyntheticEvent, newValue: TabValue) => {
    setSearchParams({ tab: newValue });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
        p: { xs: 2, sm: 3 },
      }}
    >
      {/* Decorative background orbs */}
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          top: '-15%',
          left: '-10%',
          width: '50vw',
          height: '50vw',
          maxWidth: 600,
          maxHeight: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          bottom: '-15%',
          right: '-10%',
          width: '45vw',
          height: '45vw',
          maxWidth: 550,
          maxHeight: 550,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Paper
        elevation={0}
        sx={{
          width: { xs: '100%', sm: 400 },
          maxWidth: 400,
          p: { xs: 3, sm: 4 },
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo / Title */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            mb: 3,
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
            }}
          >
            <ChatIcon sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.5px',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1.2,
            }}
          >
            Chatrix
          </Typography>
        </Box>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            mb: 3,
            minHeight: 40,
            borderRadius: 2,
            bgcolor: 'rgba(99,102,241,0.08)',
            p: 0.5,
            '& .MuiTabs-indicator': {
              height: '100%',
              borderRadius: 1.5,
              background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
              zIndex: 0,
            },
            '& .MuiTab-root': {
              minHeight: 36,
              zIndex: 1,
              fontWeight: 600,
              fontSize: '0.875rem',
              letterSpacing: 0.3,
              color: '#64748b',
              transition: 'color 0.2s',
              '&.Mui-selected': {
                color: '#fff',
              },
            },
          }}
        >
          <Tab label="Login" value="login" disableRipple />
          <Tab label="Register" value="register" disableRipple />
        </Tabs>

        {/* Active Form */}
        {activeTab === 'login' ? <LoginForm /> : <RegisterForm />}
      </Paper>
    </Box>
  );
}
