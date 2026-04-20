import { Box, Typography } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';

export default function EmptyState() {
  return (
    <Box
      sx={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        bgcolor: '#fafaf8',
        userSelect: 'none',
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '18px',
          background:
            'linear-gradient(135deg, rgba(14,165,233,0.12) 0%, rgba(99,102,241,0.12) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChatBubbleOutlineIcon sx={{ fontSize: 28, color: '#6366f1', opacity: 0.7 }} />
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Typography
          sx={{
            fontSize: '1rem',
            fontWeight: 700,
            color: '#334155',
            letterSpacing: '-0.01em',
            mb: 0.5,
          }}
        >
          Welcome to Chatrix
        </Typography>
        <Typography sx={{ fontSize: '0.85rem', color: '#94a3b8' }}>
          Select a room or conversation from the sidebar, or start a new DM.
        </Typography>
      </Box>
    </Box>
  );
}
