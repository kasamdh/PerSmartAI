import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useId } from 'react';

import { supabase } from './supabase';

/**
 * Refetches `queryKeys` whenever a row in any of `tables` changes. Realtime applies
 * each subscriber's RLS SELECT policies, so only rows the user can read trigger it.
 * Deletes can't be filtered by column, so lists refetch rather than patch.
 */
export function useLiveQueries(
  tables: readonly string[],
  queryKeys: readonly QueryKey[],
  enabled = true,
) {
  const queryClient = useQueryClient();
  const id = useId();
  const tableList = tables.join(',');
  // Reads the latest keys without resubscribing when callers pass fresh arrays.
  const invalidate = useEffectEvent(() => {
    for (const queryKey of queryKeys) void queryClient.invalidateQueries({ queryKey });
  });

  useEffect(() => {
    if (!enabled) return;
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
  }, [tableList, enabled, id]);
}
