import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import { useLiveQueries } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';

import {
  fetchConversations,
  fetchMessagesPage,
  fetchReads,
  fetchUnreadCount,
  markRead,
  sendPhoto,
  sendText,
} from './api';
import { nextCursor, type Cursor } from './chat-logic';

export const chatKeys = {
  all: ['chat'] as const,
  conversations: ['chat', 'conversations'] as const,
  unread: ['chat', 'unread'] as const,
  messages: (householdId: string) => ['chat', 'messages', householdId] as const,
  reads: (householdId: string) => ['chat', 'reads', householdId] as const,
};

/** The user's conversations, live. */
export function useConversations() {
  useLiveQueries(['messages', 'conversation_reads'], [chatKeys.conversations, chatKeys.unread]);
  return useQuery({ queryKey: chatKeys.conversations, queryFn: fetchConversations });
}

/** Unread messages across all conversations, for badges; live. */
export function useUnreadCount() {
  const signedIn = !!useAuth().session;
  useLiveQueries(['messages', 'conversation_reads'], [chatKeys.unread], signedIn);
  return useQuery({ queryKey: chatKeys.unread, queryFn: fetchUnreadCount, enabled: signedIn });
}

/** A conversation's messages, 30 at a time (newest first), live. */
export function useMessages(householdId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(householdId) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.reads(householdId) });
    };
    const channel = supabase
      .channel(`chat-${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `household_id=eq.${householdId}`,
        },
        refresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_reads',
          filter: `household_id=eq.${householdId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: chatKeys.reads(householdId) }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId, queryClient]);

  return useInfiniteQuery({
    queryKey: chatKeys.messages(householdId),
    queryFn: ({ pageParam }) => fetchMessagesPage(householdId, pageParam),
    initialPageParam: undefined as Cursor | undefined,
    getNextPageParam: (page) => nextCursor(page),
    staleTime: 10 * 60 * 1000, // signed photo URLs last an hour
  });
}

export function useReads(householdId: string) {
  return useQuery({
    queryKey: chatKeys.reads(householdId),
    queryFn: () => fetchReads(householdId),
  });
}

function useChatMutation<TArgs>(householdId: string, fn: (args: TArgs) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: chatKeys.messages(householdId) }),
        queryClient.invalidateQueries({ queryKey: chatKeys.conversations }),
      ]),
  });
}

export const useSendText = (householdId: string) =>
  useChatMutation(householdId, (body: string) => sendText(householdId, body));

export const useSendPhoto = (householdId: string) =>
  useChatMutation(householdId, (input: Omit<Parameters<typeof sendPhoto>[0], 'householdId'>) =>
    sendPhoto({ ...input, householdId }),
  );

export function useMarkRead(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markRead(householdId),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: chatKeys.unread }),
        queryClient.invalidateQueries({ queryKey: chatKeys.conversations }),
      ]),
  });
}
