import { addLocalDays, startOfLocalDay } from '@/features/visits/time';
import { supabase } from '@/lib/supabase';

const OWNER_VISIT_SELECT = `
  id, status, scheduled_start, scheduled_end, check_in_at, check_out_at, summary_note,
  on_the_way_at, started_at, status_line,
  sitter:profiles ( full_name, avatar_url ),
  booking:bookings (
    service_type,
    household:households ( name, address_line1 ),
    booking_pets ( pet:pets ( id, name, species ) )
  )
` as const;

/** The owner's visits from two weeks ago to a month ahead. RLS limits rows to their households. */
export async function fetchOwnerVisits(now: Date) {
  const from = addLocalDays(startOfLocalDay(now), -14);
  const to = addLocalDays(startOfLocalDay(now), 31);
  const { data, error } = await supabase
    .from('visits')
    .select(OWNER_VISIT_SELECT)
    .gte('scheduled_start', from.toISOString())
    .lt('scheduled_start', to.toISOString())
    .neq('status', 'cancelled')
    .order('scheduled_start');
  if (error) {
    throw error;
  }
  return data;
}

export type OwnerVisit = Awaited<ReturnType<typeof fetchOwnerVisits>>[number];

export async function fetchOwnerVisit(visitId: string) {
  const { data, error } = await supabase
    .from('visits')
    .select(OWNER_VISIT_SELECT)
    .eq('id', visitId)
    .single();
  if (error) {
    throw error;
  }
  return data;
}

/**
 * One pet's finished and missed visits, newest first, with that visit's care events
 * so each row can show what happened. RLS limits rows to the owner's own pets.
 */
export async function fetchPetVisitHistory(petId: string, limit = 30) {
  const { data, error } = await supabase
    .from('visits')
    .select(
      `id, status, scheduled_start, scheduled_end, check_in_at, check_out_at, summary_note,
       sitter:profiles ( full_name ),
       booking:bookings!inner ( service_type, booking_pets!inner ( pet_id ) ),
       care_events ( type, value, pet_id, occurred_at )`,
    )
    .eq('booking.booking_pets.pet_id', petId)
    .in('status', ['completed', 'missed'])
    .order('scheduled_start', { ascending: false })
    .limit(limit);
  if (error) {
    throw error;
  }
  return data;
}

export type PetVisitHistoryRow = Awaited<ReturnType<typeof fetchPetVisitHistory>>[number];
