import { useEffect } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { FriendPresence } from '@chatrix/shared';
import { useAuthStore } from '../../stores/authStore';
import { usePresenceStore } from '../../stores/presenceStore';
import { getFriendPresences } from './presenceApi';

const PRESENCE_FRIENDS_KEY = ['presence', 'friends'] as const;

export function usePresenceQuery(): UseQueryResult<FriendPresence[]> {
  const accessToken = useAuthStore((s) => s.accessToken);

  const query = useQuery({
    queryKey: PRESENCE_FRIENDS_KEY,
    queryFn: () => getFriendPresences(accessToken!),
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (query.data) {
      usePresenceStore.getState().setMany(query.data);
    }
  }, [query.data]);

  return query;
}
