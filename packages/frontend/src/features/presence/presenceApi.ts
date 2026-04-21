import type { FriendPresence } from '@chatrix/shared';
import { handleJsonResponse } from '../../api/apiUtils';

export async function getFriendPresences(token: string): Promise<FriendPresence[]> {
  const res = await fetch('/api/presence/friends', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return handleJsonResponse<FriendPresence[]>(res);
}
