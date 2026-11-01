import { invokeScheduleAction, type ScheduleActions } from '@petsitter/shared/schedule-actions';

import { supabase } from './supabase/client';

/** Calls the schedule-booking Edge Function as the signed-in admin (conflicts are checked there). */
export function scheduleAction<A extends keyof ScheduleActions>(
  action: A,
  args: ScheduleActions[A]['args'],
): Promise<ScheduleActions[A]['result']> {
  return invokeScheduleAction(supabase, action, args);
}

export async function fetchSitters() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('role', 'sitter')
    .order('full_name');
  if (error) throw error;
  return data;
}

export type Sitter = Awaited<ReturnType<typeof fetchSitters>>[number];

export const sitterKeys = { all: ['sitters'] as const };
