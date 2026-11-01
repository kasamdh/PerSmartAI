// Loading scheduling inputs for the Edge Functions (Deno). The scheduling logic
// itself is pure and lives in ./scheduling; this file only reads rows and maps them.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import type { Database } from './database.ts';
import {
  addDays,
  CHECK_HORIZON_DAYS,
  localToday,
  localToUtc,
  visitLabel,
  type OrgSchedulingSettings,
  type PlannedVisit,
  type ScheduledBooking,
  type ServiceType,
  type SitterSchedule,
  type VisitStatus,
} from './scheduling/index.ts';

export type Client = SupabaseClient<Database>;

export const BOOKING_FIELDS = `
  id, organization_id, household_id, sitter_id, status, service_type, recurrence_rule,
  start_date, end_date, window_start, window_end, duration_minutes,
  household:households ( name, address_line1 ),
  booking_care_times ( id, care_time, duration_minutes, label )
` as const;

type BookingRow = {
  id: string;
  organization_id: string;
  household_id: string;
  sitter_id: string | null;
  status: Database['public']['Enums']['booking_status'];
  service_type: ServiceType;
  recurrence_rule: string | null;
  start_date: string;
  end_date: string | null;
  window_start: string | null;
  window_end: string | null;
  duration_minutes: number | null;
  household: { name: string | null; address_line1: string } | null;
  booking_care_times: { id: string; care_time: string; duration_minutes: number; label: string }[];
};

export type LoadedBooking = ScheduledBooking & {
  organization_id: string;
  sitter_id: string | null;
  status: BookingRow['status'];
};

export function toLoadedBooking(row: BookingRow): LoadedBooking {
  return {
    id: row.id,
    organization_id: row.organization_id,
    household_id: row.household_id,
    household_name: row.household?.name ?? row.household?.address_line1 ?? null,
    sitter_id: row.sitter_id,
    status: row.status,
    service_type: row.service_type,
    recurrence_rule: row.recurrence_rule,
    start_date: row.start_date,
    end_date: row.end_date,
    window_start: row.window_start,
    window_end: row.window_end,
    duration_minutes: row.duration_minutes,
    care_times: (row.booking_care_times ?? []).map((c) => ({
      id: c.id,
      time: c.care_time,
      duration_minutes: c.duration_minutes,
      label: c.label,
    })),
  };
}

export async function loadBooking(
  client: Client,
  bookingId: string,
): Promise<LoadedBooking | null> {
  const { data, error } = await client
    .from('bookings')
    .select(BOOKING_FIELDS)
    .eq('id', bookingId)
    .maybeSingle();
  if (error) throw error;
  return data ? toLoadedBooking(data as unknown as BookingRow) : null;
}

export async function loadOrgSettings(
  client: Client,
  organizationId: string,
): Promise<OrgSchedulingSettings> {
  const { data, error } = await client
    .from('organizations')
    .select('timezone, travel_buffer_minutes')
    .eq('id', organizationId)
    .single();
  if (error) throw error;
  return { timeZone: data.timezone, travelBufferMinutes: data.travel_buffer_minutes };
}

/** A sitter's visits, availability, time off and confirmed bookings for conflict checks. */
export async function loadSitterSchedule(
  client: Client,
  sitterId: string,
  org: OrgSchedulingSettings,
  now: Date,
): Promise<SitterSchedule> {
  const today = localToday(now, org.timeZone);
  const from = localToUtc(addDays(today, -1), '00:00', org.timeZone).toISOString();
  const to = localToUtc(
    addDays(today, CHECK_HORIZON_DAYS + 1),
    '00:00',
    org.timeZone,
  ).toISOString();

  const [visits, availability, timeOff, bookings] = await Promise.all([
    client
      .from('visits')
      .select(
        `id, booking_id, scheduled_start, scheduled_end, status,
         booking:bookings ( service_type, household_id, household:households ( name, address_line1 ) )`,
      )
      .eq('sitter_id', sitterId)
      .not('status', 'in', '(cancelled,missed)')
      .gt('scheduled_end', from)
      .lt('scheduled_start', to),
    client
      .from('sitter_availability')
      .select('weekday, start_time, end_time')
      .eq('sitter_id', sitterId),
    client
      .from('sitter_time_off')
      .select('id, start_at, end_at, status')
      .eq('sitter_id', sitterId)
      .gt('end_at', from)
      .lt('start_at', to),
    client
      .from('bookings')
      .select(BOOKING_FIELDS)
      .eq('sitter_id', sitterId)
      .eq('status', 'confirmed'),
  ]);
  for (const result of [visits, availability, timeOff, bookings]) {
    if (result.error) throw result.error;
  }

  type VisitRow = {
    id: string;
    booking_id: string;
    scheduled_start: string;
    scheduled_end: string;
    status: VisitStatus;
    booking: {
      service_type: ServiceType;
      household_id: string;
      household: { name: string | null; address_line1: string } | null;
    } | null;
  };

  return {
    visits: ((visits.data ?? []) as unknown as VisitRow[]).map((v) => ({
      id: v.id,
      booking_id: v.booking_id,
      household_id: v.booking?.household_id ?? null,
      scheduled_start: v.scheduled_start,
      scheduled_end: v.scheduled_end,
      status: v.status,
      label: v.booking
        ? visitLabel(
            v.booking.service_type,
            v.booking.household?.name ?? v.booking.household?.address_line1,
          )
        : undefined,
    })),
    availability: availability.data ?? [],
    timeOff: timeOff.data ?? [],
    bookings: ((bookings.data ?? []) as unknown as BookingRow[]).map(toLoadedBooking),
  };
}

/** Planned visits as RPC rows. */
export function toVisitRows(plan: PlannedVisit[]) {
  return plan.map((v) => ({
    slot_start: v.slot_start,
    scheduled_start: v.scheduled_start,
    scheduled_end: v.scheduled_end,
    care_time_id: v.care_time_id,
  }));
}
