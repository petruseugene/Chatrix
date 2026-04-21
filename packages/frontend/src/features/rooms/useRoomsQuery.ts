import {
  useQuery,
  useInfiniteQuery,
  type UseQueryResult,
  type UseInfiniteQueryResult,
  type InfiniteData,
} from '@tanstack/react-query';
import type { RoomSummary, RoomDetail, RoomMember, RoomMessagePayload } from '@chatrix/shared';
import * as roomsApi from './roomsApi';
import type { RoomBanEntry } from './roomsApi';
import { useAuthStore } from '../../stores/authStore';

export function myRoomsKey() {
  return ['rooms', 'list'] as const;
}
export function publicRoomsKey(search?: string) {
  return ['rooms', 'public', search ?? ''] as const;
}
export function roomDetailKey(roomId: string) {
  return ['rooms', roomId, 'detail'] as const;
}
export function roomMessagesKey(roomId: string) {
  return ['rooms', roomId, 'messages'] as const;
}
export function roomMembersKey(roomId: string) {
  return ['rooms', roomId, 'members'] as const;
}
export function roomBansKey(roomId: string) {
  return ['rooms', roomId, 'bans'] as const;
}

export function useMyRooms(): UseQueryResult<RoomSummary[]> {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: myRoomsKey(),
    queryFn: () => roomsApi.getMyRooms(accessToken!),
    enabled: !!accessToken,
  });
}

export function usePublicRooms(search?: string): UseQueryResult<RoomSummary[]> {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: publicRoomsKey(search),
    queryFn: () => roomsApi.getPublicRooms(accessToken!, search),
    enabled: !!accessToken,
  });
}

export function useRoomDetail(roomId: string | null): UseQueryResult<RoomDetail> {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: roomDetailKey(roomId ?? ''),
    queryFn: () => roomsApi.getRoom(accessToken!, roomId!),
    enabled: !!accessToken && !!roomId,
  });
}

type MessagesPage = { messages: RoomMessagePayload[]; nextCursor: string | null };

export function useRoomMessages(
  roomId: string | null,
): UseInfiniteQueryResult<InfiniteData<MessagesPage, string | null>, Error> {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useInfiniteQuery({
    queryKey: roomMessagesKey(roomId ?? ''),
    queryFn: ({ pageParam }) => roomsApi.getMessages(accessToken!, roomId!, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: MessagesPage) => lastPage.nextCursor ?? undefined,
    enabled: !!accessToken && !!roomId,
  });
}

export function useRoomMembers(roomId: string | null): UseQueryResult<RoomMember[]> {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: roomMembersKey(roomId ?? ''),
    queryFn: () => roomsApi.getMembers(accessToken!, roomId!),
    enabled: !!accessToken && !!roomId,
  });
}

export function useRoomBans(roomId: string | null): UseQueryResult<RoomBanEntry[]> {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: roomBansKey(roomId ?? ''),
    queryFn: () => roomsApi.getBans(accessToken!, roomId!),
    enabled: !!accessToken && !!roomId,
  });
}
