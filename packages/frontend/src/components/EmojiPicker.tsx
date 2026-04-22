import { Box, Popover } from '@mui/material';
import { INPUT_EMOJIS } from '@chatrix/shared';

interface EmojiPickerProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ open, anchorEl, onSelect, onClose }: EmojiPickerProps) {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(10, 1fr)',
          p: 1,
          gap: 0.25,
        }}
      >
        {INPUT_EMOJIS.map((emoji) => (
          <Box
            key={emoji}
            component="span"
            onClick={() => onSelect(emoji)}
            sx={{
              fontSize: '1.25rem',
              cursor: 'pointer',
              p: 0.5,
              borderRadius: 1,
              textAlign: 'center',
              lineHeight: 1.5,
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            {emoji}
          </Box>
        ))}
      </Box>
    </Popover>
  );
}
