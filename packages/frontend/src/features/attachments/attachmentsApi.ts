import type { AttachmentPayload } from '@chatrix/shared';
import { handleJsonResponse } from '../../api/apiUtils';

export interface RequestUploadUrlParams {
  targetType: 'ROOM' | 'DM';
  targetId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface RequestUploadUrlResponse {
  attachmentId: string;
  presignedUrl: string;
}

export interface GetDownloadUrlResponse {
  url: string;
  thumbnailUrl?: string;
}

export async function requestUploadUrl(
  token: string,
  params: RequestUploadUrlParams,
): Promise<RequestUploadUrlResponse> {
  const res = await fetch('/api/attachments/upload-url', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(params),
  });
  return handleJsonResponse<RequestUploadUrlResponse>(res);
}

export async function commitUpload(
  token: string,
  attachmentId: string,
): Promise<AttachmentPayload> {
  const res = await fetch(`/api/attachments/${attachmentId}/commit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
  });
  return handleJsonResponse<AttachmentPayload>(res);
}

export async function getDownloadUrl(
  token: string,
  attachmentId: string,
): Promise<GetDownloadUrlResponse> {
  const res = await fetch(`/api/attachments/${attachmentId}/download`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
  });
  return handleJsonResponse<GetDownloadUrlResponse>(res);
}

export function putToMinio(
  presignedUrl: string,
  file: File,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`MinIO PUT failed with status ${xhr.status}: ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('MinIO PUT request failed (network error)'));
    };

    xhr.onabort = () => {
      reject(new DOMException('Upload aborted', 'AbortError'));
    };

    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
      });
    }

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}
