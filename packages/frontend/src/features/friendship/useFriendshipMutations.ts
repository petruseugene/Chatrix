import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as friendshipApi from './friendshipApi';
import { useAuthStore } from '../../stores/authStore';

const FRIENDS_KEY = ['friends', 'list'] as const;
const REQUESTS_KEY = ['friends', 'requests'] as const;

export function useFriends() {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: FRIENDS_KEY,
    queryFn: () => friendshipApi.getFriends(accessToken!),
    enabled: !!accessToken,
  });
}

export function usePendingRequests() {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: REQUESTS_KEY,
    queryFn: () => friendshipApi.getPendingRequests(accessToken!),
    enabled: !!accessToken,
  });
}

export function useSendFriendRequest() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (username: string) => friendshipApi.sendFriendRequest(accessToken!, username),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FRIENDS_KEY });
      void queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
    },
  });
}

export function useAcceptRequest() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => friendshipApi.acceptFriendRequest(accessToken!, requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FRIENDS_KEY });
      void queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
    },
  });
}

export function useDeclineRequest() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => friendshipApi.declineFriendRequest(accessToken!, requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
    },
  });
}
