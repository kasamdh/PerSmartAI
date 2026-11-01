import { supabase } from '@/lib/supabase';

import type { RequestBookingArgs } from './schemas';

const OWNER_BOOKING_SELECT = `
  id, status, service_type, recurrence_rule, start_date, end_date, window_start, window_end,
  duration_minutes, notes, created_at,
  sitter:profiles ( full_name ),
  booking_pets ( pet:pets ( id, name ) ),
  schedule_change_requests ( id, scope, status, from_date, visit_id, created_at )
` as const;

/**
 * The owner's bookings that still matter: anything ending today or later, open-ended
 * repeats, and one-offs from today on. RLS limits rows to their household.
 * Cancelled bookings are hidden (the owner cancelled them).
 */
export async function fetchOwnerBookings(today: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select(OWNER_BOOKING_SELECT)
    .neq('status', 'cancelled')
    .or(
      `end_date.gte.${today},start_date.gte.${today},and(end_date.is.null,recurrence_rule.not.is.null)`,
    )
    .order('start_date')
    .order('created_at');
  if (error) throw error;
  return data;
}

export type OwnerBooking = Awaited<ReturnType<typeof fetchOwnerBookings>>[number];

/** Creates the booking and its pets in one transaction. Returns the booking id. */
export async function requestBooking(args: RequestBookingArgs): Promise<string> {
  const { data, error } = await supabase.rpc('request_booking', args);
  if (error) throw error;
  return data;
}

/** Cancels a requested or confirmed booking; the database cancels its upcoming visits. */
export async function cancelBooking(bookingId: string): Promise<void> {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .in('status', ['requested', 'confirmed'])
    .select('id');
  if (error) throw error;
  if (data.length !== 1) throw new Error('This booking can no longer be cancelled.');
}

const CALENDAR_VISIT_SELECT = `
  id, booking_id, status, scheduled_start, scheduled_end,
  sitter:profiles ( full_name ),
  booking:bookings ( id, status, service_type, booking_pets ( pet:pets ( name ) ) )
` as const;

/** The owner's visits starting in [from, to), cancelled ones included (shown struck out). */
export async function fetchOwnerCalendarVisits(range: { from: Date; to: Date }) {
  const { data, error } = await supabase
    .from('visits')
    .select(CALENDAR_VISIT_SELECT)
    .gte('scheduled_start', range.from.toISOString())
    .lt('scheduled_start', range.to.toISOString())
    .order('scheduled_start');
  if (error) throw error;
  return data;
}

export type OwnerCalendarVisit = Awaited<ReturnType<typeof fetchOwnerCalendarVisits>>[number];

/** A booking's visits that haven't ended, for the late-cancellation preview. */
export async function fetchUpcomingBookingVisits(bookingId: string, now: Date) {
  const { data, error } = await supabase
    .from('visits')
    .select('id, scheduled_start, scheduled_end, status')
    .eq('booking_id', bookingId)
    .gt('scheduled_end', now.toISOString());
  if (error) throw error;
  return data;
}

/** Asks the business to move one visit or change a booking from a date on. */
export async function requestScheduleChange(input: {
  bookingId: string;
  visitId?: string;
  fromDate?: string;
  changes: Record<string, string | number | null>;
  note?: string;
}): Promise<void> {
  const { error } = await supabase.from('schedule_change_requests').insert({
    booking_id: input.bookingId,
    visit_id: input.visitId ?? null,
    scope: input.visitId ? 'visit' : 'this_and_future',
    from_date: input.visitId ? null : (input.fromDate ?? null),
    changes: input.changes,
    note: input.note?.trim() || null,
  });
  if (error) throw error;
}

export async function withdrawScheduleChange(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('schedule_change_requests')
    .update({ status: 'withdrawn' })
    .eq('id', requestId)
    .eq('status', 'requested');
  if (error) throw error;
}
