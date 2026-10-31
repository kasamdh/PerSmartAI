import { supabase } from '@/lib/supabase';
import type { TablesUpdate } from '@/types/database';

const SITTER_VISIT_SELECT = `
  id, status, scheduled_start, scheduled_end, check_in_at, check_out_at,
  booking:bookings (
    id, service_type, notes,
    household:households ( id, name, address_line1, address_line2, city, lat, lng ),
    booking_pets ( pet:pets ( id, name, species ) )
  )
` as const;

/** A sitter's non-cancelled visits starting in [from, to), earliest first. RLS limits rows to their own. */
export async function fetchSitterVisits(sitterId: string, range: { from: Date; to: Date }) {
  const { data, error } = await supabase
    .from('visits')
    .select(SITTER_VISIT_SELECT)
    .eq('sitter_id', sitterId)
    .gte('scheduled_start', range.from.toISOString())
    .lt('scheduled_start', range.to.toISOString())
    .neq('status', 'cancelled')
    .order('scheduled_start');
  if (error) {
    throw error;
  }
  return data;
}

export type SitterVisit = Awaited<ReturnType<typeof fetchSitterVisits>>[number];

export async function updateVisit(visitId: string, patch: TablesUpdate<'visits'>): Promise<void> {
  const { data, error } = await supabase
    .from('visits')
    .update(patch)
    .eq('id', visitId)
    .select('id');
  if (error) {
    throw error;
  }
  // RLS hides rows rather than erroring, so zero rows means "not yours / not found".
  if (data.length !== 1) {
    throw new Error("This visit couldn't be updated. It may have been reassigned.");
  }
}
