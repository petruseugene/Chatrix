import type { DmMessagePayload, DmThreadPayload } from '@chatrix/shared';
import { extractError, handleJsonResponse } from '../../api/apiUtils';

async function handleResponse(res: Response): Promise<void> {
  if (!res.ok) throw new Error(await extractError(res));
}

export async function getThreads(token: string): Promise<DmThreadPayload[]> {
  const res = await fetch('/api/dm/threads', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return handleJsonResponse<DmThreadPayload[]>(res);
}

export async function getMessages(
  token: string,
  threadId: string,
  cursor?: { before: string; beforeId: string } | null,
): Promise<DmMessagePayload[]> {
  const params = new URLSearchParams({ limit: '50' });
  if (cursor) {
    params.set('before', cursor.before);
    params.set('beforeId', cursor.beforeId);
  }
  const res = await fetch(`/api/dm/threads/${threadId}/messages?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return handleJsonResponse<DmMessagePayload[]>(res);
}

export async function startThread(token: string, recipientId: string): Promise<DmThreadPayload> {
  const res = await fetch('/api/dm/threads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ recipientId }),
  });
  return handleJsonResponse<DmThreadPayload>(res);
}

export async function editMessage(
  token: string,
  messageId: string,
  content: string,
): Promise<DmMessagePayload> {
  const res = await fetch(`/api/dm/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ content }),
  });
  return handleJsonResponse<DmMessagePayload>(res);
}

export async function deleteMessage(token: string, messageId: string): Promise<void> {
  const res = await fetch(`/api/dm/messages/${messageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  await handleResponse(res);
}
