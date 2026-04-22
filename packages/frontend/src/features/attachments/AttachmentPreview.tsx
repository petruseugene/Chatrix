import { useEffect, useState } from 'react';
import { Box, Chip, Dialog, DialogContent, IconButton, Skeleton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { AttachmentPayload } from '@chatrix/shared';
import { useAuthToken } from '../../hooks/useAuthToken';
import { getDownloadUrl, type GetDownloadUrlResponse } from './attachmentsApi';

interface AttachmentPreviewProps {
  attachment: AttachmentPayload;
}

export function AttachmentPreview({ attachment }: AttachmentPreviewProps) {
  const token = useAuthToken();
  const [urls, setUrls] = useState<GetDownloadUrlResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const isImage = attachment.mimeType.startsWith('image/');

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(false);

    getDownloadUrl(token, attachment.id)
      .then((data) => {
        if (!cancelled) {
          setUrls(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, attachment.id]);

  if (loading) {
    return isImage ? (
      <Skeleton variant="rectangular" width={200} height={150} sx={{ borderRadius: 1 }} />
    ) : (
      <Skeleton variant="rounded" width={180} height={32} />
    );
  }

  if (error || !urls) {
    return <Chip label="File unavailable" size="small" disabled />;
  }

  if (isImage) {
    const displayUrl =
      attachment.thumbnailAvailable && urls.thumbnailUrl ? urls.thumbnailUrl : urls.url;

    return (
      <>
        <Box
          component="img"
          src={displayUrl}
          alt={attachment.originalFilename}
          onClick={() => setLightboxOpen(true)}
          sx={{
            display: 'block',
            maxWidth: 320,
            maxHeight: 240,
            objectFit: 'contain',
            borderRadius: 1,
            cursor: 'pointer',
            border: '1px solid',
            borderColor: 'divider',
            '&:hover': { opacity: 0.9 },
          }}
        />

        <Dialog open={lightboxOpen} onClose={() => setLightboxOpen(false)} fullWidth maxWidth="md">
          <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
            <IconButton onClick={() => setLightboxOpen(false)} size="small" aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Box>
          <DialogContent
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              p: 2,
              pt: 5,
            }}
          >
            <Box
              component="img"
              src={urls.url}
              alt={attachment.originalFilename}
              sx={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Chip label={attachment.originalFilename} size="small" />
      <IconButton
        size="small"
        aria-label="Download file"
        onClick={() => window.open(urls.url, '_blank')}
      >
        <OpenInNewIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
