import type { FriendPresence } from '@chatrix/shared';

async function extractError(res: Response): Promise<string> {
  const body = await res.text();
  try {
    const json = JSON.parse(body) as { message?: string | string[]; statusCode?: number };
    const rawMessage = Array.isArray(json.message) ? json.message.join(', ') : (json.message ?? '');
    return rawMessage || 'Something went wrong. Please try again.';
  } catch {
    return body || 'Something went wrong. Please try again.';
  }
}

async function handleJsonResponse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await extractError(res));
  return res.json() as Promise<T>;
}

export async function getFriendPresences(token: string): Promise<FriendPresence[]> {
  const res = await fetch('/api/presence/friends', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return handleJsonResponse<FriendPresence[]>(res);
}
