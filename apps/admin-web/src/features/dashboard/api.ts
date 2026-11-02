import { addDays, localToUtc, localToday } from '@petsitter/shared/scheduling';

import { supabase } from '@/lib/supabase/client';

export const dashboardKeys = {
  visits: ['dashboard', 'visits'] as const,
  incidents: ['dashboard', 'incidents'] as const,
};

/** Every visit today in the business's time zone (cancelled ones excluded). */
export async function fetchTodaysVisits(now: Date, timeZone: string) {
  const today = localToday(now, timeZone);
  const { data, error } = await supabase
    .from('visits')
    .select(
      `id, status, scheduled_start, scheduled_end, check_in_at, check_out_at, status_line, sitter_id,
       sitter:profiles ( full_name, phone ),
       booking:bookings ( service_type, household:households ( id, name, address_line1 ), booking_pets ( pet:pets ( name ) ) )`,
    )
    .gte('scheduled_start', localToUtc(today, '00:00', timeZone).toISOString())
    .lt('scheduled_start', localToUtc(addDays(today, 1), '00:00', timeZone).toISOString())
    .neq('status', 'cancelled')
    .order('scheduled_start');
  if (error) throw error;
  return data;
}

export type DashboardVisit = Awaited<ReturnType<typeof fetchTodaysVisits>>[number];

/** Incidents nobody has resolved yet, newest first. */
export async function fetchOpenIncidents() {
  const { data, error } = await supabase
    .from('incidents')
    .select(
      `id, severity, description, action_taken, created_at,
       pet:pets ( name ),
       visit:visits ( id, scheduled_start, sitter:profiles ( full_name ),
         booking:bookings ( household:households ( id, name, address_line1 ) ) )`,
    )
    .is('resolved_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export type OpenIncident = Awaited<ReturnType<typeof fetchOpenIncidents>>[number];

export async function resolveIncident(input: { id: string; note: string }) {
  // resolved_by is filled in by guard_incident_resolution.
  const { data, error } = await supabase
    .from('incidents')
    .update({ resolved_at: new Date().toISOString(), resolution_note: input.note.trim() || null })
    .eq('id', input.id)
    .is('resolved_at', null)
    .select('id');
  if (error) throw error;
  if (data.length !== 1) throw new Error('This incident was already resolved.');
}

export const pageTitle = (household: { name: string | null; address_line1: string } | null) =>
  household ? (household.name ?? household.address_line1) : 'Unknown home';
