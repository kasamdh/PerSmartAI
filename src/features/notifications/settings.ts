import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-provider';
import { supabase } from '@/lib/supabase';

import { ALERT_KINDS, type AlertKind } from '../../../supabase/functions/_shared/alerts';

export {
  alertKindsFor,
  ALERT_KINDS,
  type AlertKind,
} from '../../../supabase/functions/_shared/alerts';

const settingsKey = (userId: string | undefined) => ['notification-settings', userId] as const;

/** The alerts this user turned off (none until they change something). RLS: own row only. */
async function fetchMuted(userId: string): Promise<AlertKind[]> {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('muted')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.muted ?? []).filter((k): k is AlertKind => k in ALERT_KINDS);
}

/** Turns one kind on or off; locked kinds (incidents) can't be muted. */
export function toggleMuted(
  muted: readonly AlertKind[],
  kind: AlertKind,
  on: boolean,
): AlertKind[] {
  if ((ALERT_KINDS[kind] as { locked?: boolean }).locked) return [...muted];
  const rest = muted.filter((k) => k !== kind);
  return on ? rest : [...rest, kind];
}

export function useNotificationSettings() {
  const userId = useAuth().session?.user.id;
  const queryClient = useQueryClient();
  const key = settingsKey(userId);
  const query = useQuery({ queryKey: key, queryFn: () => fetchMuted(userId!), enabled: !!userId });

  const save = useMutation({
    mutationFn: async (muted: AlertKind[]) => {
      const { error } = await supabase
        .from('notification_settings')
        .upsert({ user_id: userId!, muted }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    // Flip the switch right away; roll back if saving fails.
    onMutate: async (muted) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AlertKind[]>(key);
      queryClient.setQueryData(key, muted);
      return { previous };
    },
    onError: (_error, _muted, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { query, save };
}
