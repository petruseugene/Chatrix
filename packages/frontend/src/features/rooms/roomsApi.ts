import type { RoomSummary, RoomDetail, RoomMember, RoomMessagePayload } from '@chatrix/shared';
import { extractError, handleJsonResponse } from '../../api/apiUtils';

async function handleResponse(res: Response): Promise<void> {
  if (!res.ok) throw new Error(await extractError(res));
}

export async function getMyRooms(token: string): Promise<RoomSummary[]> {
  const res = await fetch('/api/rooms', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return handleJsonResponse<RoomSummary[]>(res);
}

export async function getPublicRooms(
  token: string,
  search?: string,
  cursor?: string,
): Promise<RoomSummary[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (cursor) params.set('cursor', cursor);
  const res = await fetch(`/api/rooms/public?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return handleJsonResponse<RoomSummary[]>(res);
}

export async function getRoom(token: string, roomId: string): Promise<RoomDetail> {
  const res = await fetch(`/api/rooms/${roomId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return handleJsonResponse<RoomDetail>(res);
}

export async function createRoom(
  token: string,
  dto: { name: string; description?: string; isPrivate?: boolean },
): Promise<RoomSummary> {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(dto),
  });
  return handleJsonResponse<RoomSummary>(res);
}

export async function updateRoom(
  token: string,
  roomId: string,
  dto: { name?: string; description?: string; isPrivate?: boolean },
): Promise<RoomSummary> {
  const res = await fetch(`/api/rooms/${roomId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(dto),
  });
  return handleJsonResponse<RoomSummary>(res);
}

export async function deleteRoom(token: string, roomId: string): Promise<void> {
  const res = await fetch(`/api/rooms/${roomId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  await handleResponse(res);
}

export async function joinRoom(token: string, roomId: string): Promise<void> {
  const res = await fetch(`/api/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  await handleResponse(res);
}

export async function leaveRoom(token: string, roomId: string): Promise<void> {
  const res = await fetch(`/api/rooms/${roomId}/leave`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  await handleResponse(res);
}

export async function inviteUser(token: string, roomId: string, username: string): Promise<void> {
  const res = await fetch(`/api/rooms/${roomId}/invite`, {
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

export async function kickMember(token: string, roomId: string, userId: string): Promise<void> {
  const res = await fetch(`/api/rooms/${roomId}/members/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  await handleResponse(res);
}

export async function banUser(
  token: string,
  roomId: string,
  userId: string,
  reason?: string,
): Promise<void> {
  const body = reason ? JSON.stringify({ reason }) : undefined;
  const res = await fetch(`/api/rooms/${roomId}/bans/${userId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    ...(body && { body }),
  });
  await handleResponse(res);
}

export async function unbanUser(token: string, roomId: string, userId: string): Promise<void> {
  const res = await fetch(`/api/rooms/${roomId}/bans/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  await handleResponse(res);
}

export async function setRole(
  token: string,
  roomId: string,
  userId: string,
  role: 'ADMIN' | 'MEMBER',
): Promise<void> {
  const res = await fetch(`/api/rooms/${roomId}/members/${userId}/role`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ role }),
  });
  await handleResponse(res);
}

export async function getMessages(
  token: string,
  roomId: string,
  cursor?: string,
): Promise<{ messages: RoomMessagePayload[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: '50' });
  if (cursor) params.set('cursor', cursor);
  const res = await fetch(`/api/rooms/${roomId}/messages?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return handleJsonResponse<{ messages: RoomMessagePayload[]; nextCursor: string | null }>(res);
}

export async function getMembers(token: string, roomId: string): Promise<RoomMember[]> {
  const res = await fetch(`/api/rooms/${roomId}/members`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return handleJsonResponse<RoomMember[]>(res);
}
