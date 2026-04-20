import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type InfiniteData,
} from '@tanstack/react-query';
import type { DmThreadPayload, DmMessagePayload } from '@chatrix/shared';
import * as dmApi from './dmApi';
import { useAuthStore } from '../../stores/authStore';

const THREADS_KEY = ['dm', 'threads'] as const;

function messagesKey(threadId: string) {
  return ['dm', 'messages', threadId] as const;
}

type MessagesPageParam = { before: string; beforeId: string } | null;

interface EditMessageVars {
  messageId: string;
  content: string;
  threadId: string;
}

interface DeleteMessageVars {
  messageId: string;
  threadId: string;
}

export function useThreads(): UseQueryResult<DmThreadPayload[]> {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: THREADS_KEY,
    queryFn: () => dmApi.getThreads(accessToken!),
    enabled: !!accessToken,
  });
}

export function useMessages(
  threadId: string | null,
): UseInfiniteQueryResult<InfiniteData<DmMessagePayload[], MessagesPageParam>, Error> {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useInfiniteQuery({
    queryKey: messagesKey(threadId ?? ''),
    queryFn: ({ pageParam }) =>
      dmApi.getMessages(accessToken!, threadId!, pageParam as MessagesPageParam),
    initialPageParam: null as MessagesPageParam,
    getNextPageParam: (lastPage: DmMessagePayload[]): MessagesPageParam | undefined => {
      if (lastPage.length < 50) return undefined;
      const oldest = lastPage[lastPage.length - 1] as DmMessagePayload | undefined;
      if (!oldest) return undefined;
      return { before: oldest.createdAt, beforeId: oldest.id };
    },
    enabled: !!accessToken && !!threadId,
  });
}

export function useStartThread(): UseMutationResult<DmThreadPayload, Error, string> {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipientId: string) => dmApi.startThread(accessToken!, recipientId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: THREADS_KEY });
    },
  });
}

export function useEditMessage(): UseMutationResult<DmMessagePayload, Error, EditMessageVars> {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, content }: EditMessageVars) =>
      dmApi.editMessage(accessToken!, messageId, content),
    onSuccess: (updatedMessage, { threadId }) => {
      queryClient.setQueryData<InfiniteData<DmMessagePayload[], unknown>>(
        messagesKey(threadId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((m) => (m.id === updatedMessage.id ? updatedMessage : m)),
            ),
          };
        },
      );
    },
  });
}

export function useDeleteMessage(): UseMutationResult<void, Error, DeleteMessageVars> {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId }: DeleteMessageVars) => dmApi.deleteMessage(accessToken!, messageId),
    onSuccess: (_, { messageId, threadId }) => {
      queryClient.setQueryData<InfiniteData<DmMessagePayload[], unknown>>(
        messagesKey(threadId),
        (old) => {
          if (!old) return old;
          const deletedAt = new Date().toISOString();
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((m) => (m.id === messageId ? { ...m, deletedAt } : m)),
            ),
          };
        },
      );
    },
  });
}
