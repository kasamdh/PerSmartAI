import { scheduleAction } from '@/features/scheduling/api';
import { supabase } from '@/lib/supabase';

// Admin scheduling reads (RLS: everything in the admin's organization) and writes.
// Schedule changes go through schedule-booking so conflicts are checked.

const SCHEDULE_VISIT_SELECT = `
  id, booking_id, sitter_id, status, scheduled_start, scheduled_end, slot_start, late_cancellation,
  sitter:profiles ( full_name ),
  booking:bookings (
    service_type,
    household:households ( id, name, address_line1 ),
    booking_pets ( pet:pets ( name ) )
  )
` as const;

/** Every visit in the business starting in [from, to), cancelled ones excluded. */
export async function fetchScheduleVisits(range: { from: Date; to: Date }) {
  const { data, error } = await supabase
    .from('visits')
    .select(SCHEDULE_VISIT_SELECT)
    .gte('scheduled_start', range.from.toISOString())
    .lt('scheduled_start', range.to.toISOString())
    .neq('status', 'cancelled')
    .order('scheduled_start');
  if (error) throw error;
  return data;
}

export type ScheduleVisit = Awaited<ReturnType<typeof fetchScheduleVisits>>[number];

export async function fetchScheduleVisit(visitId: string) {
  const { data, error } = await supabase
    .from('visits')
    .select(SCHEDULE_VISIT_SELECT)
    .eq('id', visitId)
    .single();
  if (error) throw error;
  return data;
}

/** Owners' pending reschedule requests, oldest first. */
export async function fetchChangeRequests() {
  const { data, error } = await supabase
    .from('schedule_change_requests')
    .select(
      `id, booking_id, visit_id, scope, from_date, changes, note, created_at,
       booking:bookings ( service_type, household:households ( name, address_line1, owner:profiles ( full_name ) ) ),
       visit:visits ( scheduled_start, scheduled_end )`,
    )
    .eq('status', 'requested')
    .order('created_at');
  if (error) throw error;
  return data;
}

export type ChangeRequest = Awaited<ReturnType<typeof fetchChangeRequests>>[number];

/** Sitters' pending time off requests, soonest first. */
export async function fetchTimeOffRequests(now: Date) {
  const { data, error } = await supabase
    .from('sitter_time_off')
    .select('id, sitter_id, start_at, end_at, reason, sitter:profiles ( full_name )')
    .eq('status', 'requested')
    .gt('end_at', now.toISOString())
    .order('start_at');
  if (error) throw error;
  return data;
}

export type TimeOffRequest = Awaited<ReturnType<typeof fetchTimeOffRequests>>[number];

export async function decideTimeOff(input: { id: string; approve: boolean }): Promise<void> {
  const { data, error } = await supabase
    .from('sitter_time_off')
    .update({ status: input.approve ? 'approved' : 'declined' })
    .eq('id', input.id)
    .eq('status', 'requested')
    .select('id');
  if (error) throw error;
  if (data.length !== 1) throw new Error('This request was already handled.');
}

export async function decideChangeRequest(input: {
  id: string;
  approve: boolean;
  reason?: string;
}): Promise<void> {
  await scheduleAction('decide_request', {
    request_id: input.id,
    approve: input.approve,
    decline_reason: input.reason,
  });
}

export async function updateVisitSchedule(input: {
  visitId: string;
  sitterId?: string;
  date?: string;
  time?: string;
  durationMinutes?: number;
  preview?: boolean;
}) {
  return scheduleAction('update_visit', {
    visit_id: input.visitId,
    sitter_id: input.sitterId,
    date: input.date,
    time: input.time,
    duration_minutes: input.durationMinutes,
    preview: input.preview,
  });
}

export async function checkSitters(bookingId: string, sitterIds: string[]) {
  const { results } = await scheduleAction('check_sitters', {
    booking_id: bookingId,
    sitter_ids: sitterIds,
  });
  return results;
}

export async function saveOrgSettings(input: {
  id: string;
  travelBufferMinutes: number;
  cancellationCutoffHours: number;
  mediaRetentionMonths: number | null;
}): Promise<void> {
  const { data, error } = await supabase
    .from('organizations')
    .update({
      travel_buffer_minutes: input.travelBufferMinutes,
      cancellation_cutoff_hours: input.cancellationCutoffHours,
      media_retention_months: input.mediaRetentionMonths,
    })
    .eq('id', input.id)
    .select('id');
  if (error) throw error;
  if (data.length !== 1) throw new Error('Only admins can change these settings.');
}
