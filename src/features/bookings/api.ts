import { supabase } from '@/lib/supabase';

import type { RequestBookingArgs } from './schemas';

const OWNER_BOOKING_SELECT = `
  id, status, service_type, recurrence_rule, start_date, end_date, window_start, window_end,
  duration_minutes, notes, created_at,
  sitter:profiles ( full_name ),
  booking_pets ( pet:pets ( id, name ) )
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
