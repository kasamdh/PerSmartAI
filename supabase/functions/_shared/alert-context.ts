// Loads who and what an alert about a visit is for (Deno, service_role).

import { formatDayInZone, formatTimeInZone } from './scheduling/conflicts.ts';
import type { Client } from './expo-push.ts';
import type { VisitAlertContext } from './push-messages.ts';

const SERVICE = {
  drop_in: 'drop-in',
  walk: 'walk',
  overnight: 'overnight stay',
  multi_day: 'multi-day care',
} as const;

export type VisitPeople = {
  organizationId: string;
  timeZone: string;
  ownerId: string;
  sitterId: string | null;
  adminIds: string[];
  context: VisitAlertContext;
};

export async function adminIds(supabase: Client, organizationId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('role', 'admin');
  if (error) throw error;
  return data.map((a) => a.id);
}

export async function loadVisitPeople(
  supabase: Client,
  visitId: string,
): Promise<VisitPeople | null> {
  const { data: visit, error } = await supabase
    .from('visits')
    .select(
      `organization_id, sitter_id, scheduled_start,
       organization:organizations ( timezone ),
       sitter:profiles ( full_name ),
       booking:bookings (
         service_type,
         household:households ( owner_id, name, address_line1 ),
         booking_pets ( pet:pets ( name ) )
       )`,
    )
    .eq('id', visitId)
    .maybeSingle();
  if (error) throw error;
  if (!visit) return null;

  const timeZone = visit.organization?.timezone ?? 'UTC';
  const household = visit.booking.household;
  return {
    organizationId: visit.organization_id,
    timeZone,
    ownerId: household.owner_id,
    sitterId: visit.sitter_id,
    adminIds: await adminIds(supabase, visit.organization_id),
    context: {
      sitterName: visit.sitter?.full_name ?? null,
      petNames: visit.booking.booking_pets.flatMap((bp) => (bp.pet ? [bp.pet.name] : [])),
      place: household.name ?? household.address_line1,
      service: SERVICE[visit.booking.service_type],
      startLabel: `${formatDayInZone(visit.scheduled_start, timeZone)}, ${formatTimeInZone(visit.scheduled_start, timeZone)}`,
      timeLabel: (iso) => formatTimeInZone(iso, timeZone),
    },
  };
}
