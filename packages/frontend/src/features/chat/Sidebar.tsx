import { useState } from 'react';
import {
  Box,
  Divider,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SearchIcon from '@mui/icons-material/Search';
import SidebarRoomList from './SidebarRoomList';
import SidebarDmList from './SidebarDmList';
import SidebarUserPanel from './SidebarUserPanel';
import NewDmDialog from './NewDmDialog';
import NotificationBell from '../../components/NotificationBell';

export default function Sidebar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [newDmOpen, setNewDmOpen] = useState(false);

  return (
    <>
      <Box
        sx={{
          width: 280,
          minWidth: 280,
          height: '100vh',
          bgcolor: '#1e2030',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 1. App header */}
        <Box
          sx={{
            height: 56,
            minHeight: 56,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            bgcolor: '#161722',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Left: icon + name */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ChatBubbleOutlineIcon sx={{ fontSize: '1.1rem', color: '#6366f1' }} />
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '1rem',
                color: '#ffffff',
                letterSpacing: '-0.01em',
                lineHeight: 1,
                userSelect: 'none',
              }}
            >
              Chatrix
            </Typography>
          </Box>

          {/* Right: notification bell + new DM button */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <NotificationBell />
            <Tooltip title="New Direct Message" placement="right">
              <IconButton
                onClick={() => setNewDmOpen(true)}
                size="small"
                aria-label="New direct message"
                sx={{
                  color: 'rgba(255,255,255,0.5)',
                  '&:hover': {
                    color: '#ffffff',
                    bgcolor: 'rgba(255,255,255,0.08)',
                  },
                  transition: 'color 0.15s ease, background-color 0.15s ease',
                }}
              >
                <AddCommentOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* 2. Search bar */}
        <Box sx={{ mx: '12px', my: '8px', flexShrink: 0 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search rooms & chats"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.07)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.85rem',
                '& fieldset': {
                  borderColor: 'transparent',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255,255,255,0.15)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'rgba(99,102,241,0.5)',
                  borderWidth: '1px',
                },
              },
              '& input': {
                py: '6px',
                px: 0,
                color: '#ffffff',
              },
              '& input::placeholder': {
                color: 'rgba(255,255,255,0.3)',
                opacity: 1,
              },
            }}
          />
        </Box>

        {/* 3. Scrollable list area */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            '&::-webkit-scrollbar': {
              width: '4px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
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
          <SidebarRoomList searchQuery={searchQuery} />

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 1 }} />

          <SidebarDmList searchQuery={searchQuery} />
        </Box>

        {/* 4. User panel */}
        <Box sx={{ flexShrink: 0 }}>
          <SidebarUserPanel />
        </Box>
      </Box>

      {/* New DM Dialog */}
      <NewDmDialog open={newDmOpen} onClose={() => setNewDmOpen(false)} />
    </>
  );
}
