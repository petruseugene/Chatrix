import { useCallback, useRef, useState } from 'react';
import type { AttachmentPayload } from '@chatrix/shared';
import { useAuthToken } from '../../hooks/useAuthToken';
import { commitUpload, putToMinio, requestUploadUrl } from './attachmentsApi';

export interface UseAttachmentUploadOptions {
  targetType: 'ROOM' | 'DM';
  targetId: string;
}

export interface UseAttachmentUploadResult {
  upload: (file: File) => Promise<AttachmentPayload>;
  progress: number;
  error: string | null;
  reset: () => void;
  abort: () => void;
}

export function useAttachmentUpload(
  options: UseAttachmentUploadOptions,
): UseAttachmentUploadResult {
  const { targetType, targetId } = options;
  const token = useAuthToken();

  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController>(new AbortController());

  const upload = useCallback(
    async (file: File): Promise<AttachmentPayload> => {
      setProgress(0);
      setError(null);

      try {
        const { attachmentId, presignedUrl } = await requestUploadUrl(token, {
          targetType,
          targetId,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        });

        await putToMinio(
          presignedUrl,
          file,
          (pct) => setProgress(pct),
          abortControllerRef.current.signal,
        );

        const payload = await commitUpload(token, attachmentId);
        return payload;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        throw err;
      }
    },
    [token, targetType, targetId],
  );

  const reset = useCallback(() => {
    setProgress(0);
    setError(null);
    abortControllerRef.current = new AbortController();
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current.abort();
  }, []);

  return { upload, progress, error, reset, abort };
}
