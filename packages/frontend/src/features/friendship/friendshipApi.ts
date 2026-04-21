import type { UserSearchResult, RelationshipStatus } from '@chatrix/shared';

export type UserSearchResultDto = UserSearchResult;
export type { RelationshipStatus };

export interface FriendDto {
  friendId: string;
  username: string;
  createdAt: string;
}

export interface FriendRequestDto {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromUserCreatedAt: string;
  createdAt: string;
}

const ERROR_MAP: Record<string, string> = {
  unauthorized: 'You must be logged in to manage friends.',
  'user not found': 'No user found with that username.',
  'friend request already sent': 'You already sent a friend request to this user.',
  'already friends': 'You are already friends with this user.',
  'cannot send request to yourself': 'You cannot send a friend request to yourself.',
  'too many requests': 'Too many attempts. Please wait a moment before trying again.',
};

function toFriendlyMessage(raw: string, statusCode?: number): string {
  const key = raw.toLowerCase().trim();
  if (ERROR_MAP[key]) return ERROR_MAP[key];
  for (const [pattern, friendly] of Object.entries(ERROR_MAP)) {
    if (key.includes(pattern)) return friendly;
  }
  if (statusCode === 429)
    return (
      ERROR_MAP['too many requests'] ??
      'Too many attempts. Please wait a moment before trying again.'
    );
  if (statusCode === 401 || statusCode === 403)
    return ERROR_MAP['unauthorized'] ?? 'You must be logged in to manage friends.';
  return raw || 'Something went wrong. Please try again.';
}

async function extractError(res: Response): Promise<string> {
  const body = await res.text();
  try {
    const json = JSON.parse(body) as { message?: string | string[]; statusCode?: number };
    const rawMessage = Array.isArray(json.message) ? json.message.join(', ') : (json.message ?? '');
    return toFriendlyMessage(rawMessage, json.statusCode ?? res.status);
  } catch {
    return toFriendlyMessage(body, res.status);
  }
}

async function handleResponse(res: Response): Promise<void> {
  if (!res.ok) throw new Error(await extractError(res));
}

async function handleJsonResponse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await extractError(res));
  return res.json() as Promise<T>;
}

export async function getFriends(token: string): Promise<FriendDto[]> {
  const res = await fetch('/api/friends', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return handleJsonResponse<FriendDto[]>(res);
}

export async function getPendingRequests(token: string): Promise<FriendRequestDto[]> {
  const res = await fetch('/api/friends/requests', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return handleJsonResponse<FriendRequestDto[]>(res);
}

export async function sendFriendRequest(token: string, username: string): Promise<void> {
  const res = await fetch('/api/friends/request', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ username }),
  });
  await handleResponse(res);
}

export async function acceptFriendRequest(token: string, requestId: string): Promise<void> {
  const res = await fetch(`/api/friends/accept/${requestId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  await handleResponse(res);
}

export async function declineFriendRequest(token: string, requestId: string): Promise<void> {
  const res = await fetch(`/api/friends/decline/${requestId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  await handleResponse(res);
}

export async function removeFriend(token: string, friendId: string): Promise<void> {
  const res = await fetch(`/api/friends/${friendId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  await handleResponse(res);
}

export async function searchUsers(token: string, q: string): Promise<UserSearchResultDto[]> {
  const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return handleJsonResponse<UserSearchResultDto[]>(res);
}
