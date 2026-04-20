import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import * as roomsApi from './roomsApi';
import type { RoomSummary } from './roomsApi';
import { useAuthStore } from '../../stores/authStore';

export function useRooms(): UseQueryResult<RoomSummary[]> {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ['rooms', 'list'],
    queryFn: () => roomsApi.getRooms(accessToken!),
    enabled: !!accessToken,
  });
}
