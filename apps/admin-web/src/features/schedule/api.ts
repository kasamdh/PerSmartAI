import { weekRange } from '@petsitter/shared/week-board';

import { supabase } from '@/lib/supabase/client';

export const scheduleKeys = { week: (monday: string) => ['schedule', 'week', monday] as const };

/** Every visit starting in the business-local week containing `anyDay`. */
export async function fetchWeekVisits(anyDay: string, timeZone: string) {
  const { from, to } = weekRange(anyDay, timeZone);
  const { data, error } = await supabase
    .from('visits')
    .select(
      `id, booking_id, sitter_id, status, scheduled_start, scheduled_end,
       booking:bookings (
         service_type,
         household:households ( id, name, address_line1 ),
         booking_pets ( pet:pets ( name ) )
       )`,
    )
    .gte('scheduled_start', from.toISOString())
    .lt('scheduled_start', to.toISOString())
    .neq('status', 'cancelled')
    .order('scheduled_start');
  if (error) throw error;
  return data;
}

export type WeekVisit = Awaited<ReturnType<typeof fetchWeekVisits>>[number];
