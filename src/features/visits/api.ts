import { supabase } from '@/lib/supabase';
import type { TablesUpdate } from '@/types/database';

const SITTER_VISIT_SELECT = `
  id, status, scheduled_start, scheduled_end, check_in_at, check_out_at,
  care_time:booking_care_times ( label ),
  booking:bookings (
    id, service_type, notes, window_start, window_end,
    household:households ( id, name, address_line1, address_line2, city, lat, lng ),
    booking_pets (
      pet:pets (
        id, name, species, photo_url,
        pet_allergies ( allergen, severity ),
        feeding_plans ( times ),
        pet_medications ( schedule_times )
      )
    )
  )
` as const;

/**
 * A sitter's non-cancelled visits that overlap [from, to) (so an overnight stay
 * that began yesterday still shows today), earliest first. RLS limits rows to their own.
 */
export async function fetchSitterVisits(sitterId: string, range: { from: Date; to: Date }) {
  const { data, error } = await supabase
    .from('visits')
    .select(SITTER_VISIT_SELECT)
    .eq('sitter_id', sitterId)
    .gt('scheduled_end', range.from.toISOString())
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
