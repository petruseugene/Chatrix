// Query key factories for rooms and room messages
export const myRoomsKey = () => ['rooms', 'my-rooms'] as const;
export const roomDetailKey = (roomId: string) => ['rooms', 'detail', roomId] as const;
export const roomMessagesKey = (roomId: string) => ['rooms', 'messages', roomId] as const;
