export interface RoomSummary {
  id: string;
  name: string;
  unreadCount: number;
}

// Stub: always returns []
export async function getRooms(_token: string): Promise<RoomSummary[]> {
  return [];
}
