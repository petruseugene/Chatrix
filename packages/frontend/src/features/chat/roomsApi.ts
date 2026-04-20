export interface RoomSummary {
  id: string;
  name: string;
  unreadCount: number;
}

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

export async function getRooms(token: string): Promise<RoomSummary[]> {
  const res = await fetch('/api/rooms', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return handleJsonResponse<RoomSummary[]>(res);
}
