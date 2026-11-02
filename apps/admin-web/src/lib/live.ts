'use client';

import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useId, useState } from 'react';

import { supabase } from './supabase/client';

/**
 * Refetches `queryKeys` whenever a row in any of `tables` changes (same as the
 * mobile app's useLiveQueries). Realtime applies RLS, so only rows the admin can
 * read trigger it.
 */
export function useLiveQueries(tables: readonly string[], queryKeys: readonly QueryKey[]) {
  const queryClient = useQueryClient();
  const id = useId();
  const tableList = tables.join(',');
  const invalidate = useEffectEvent(() => {
    for (const queryKey of queryKeys) void queryClient.invalidateQueries({ queryKey });
  });

  useEffect(() => {
    let channel = supabase.channel(`live-${tableList}-${id}`);
    for (const table of tableList.split(',')) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () =>
        invalidate(),
      );
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tableList, id]);
}

/** The current time, updated every `ms` (so "late" badges appear without a reload). */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}
