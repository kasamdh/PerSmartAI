import { addLocalDays, startOfLocalDay } from '@/features/visits/time';
import { supabase } from '@/lib/supabase';

const BOOKING_SELECT = `
  id, status, service_type, recurrence_rule, start_date, end_date, window_start, window_end,
  duration_minutes, notes, created_at, sitter_id,
  household:households (
    name, address_line1, city,
    owner:profiles ( full_name, phone )
  ),
  booking_pets ( pet:pets ( id, name, species ) )
` as const;

/** Bookings waiting for an admin to assign a sitter, oldest request first. */
export async function fetchBookingRequests() {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('status', 'requested')
    .order('created_at');
  if (error) throw error;
  return data;
}

export type AdminBooking = Awaited<ReturnType<typeof fetchBookingRequests>>[number];

export async function fetchBooking(bookingId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('id', bookingId)
    .single();
  if (error) throw error;
  return data;
}

/** Every visit in the business today (device-local day), earliest first. */
export async function fetchTodaysVisits(now: Date) {
  const from = startOfLocalDay(now);
  const { data, error } = await supabase
    .from('visits')
    .select(
      `id, status, scheduled_start, scheduled_end, check_in_at,
       sitter:profiles ( full_name ),
       booking:bookings ( service_type, household:households ( name, address_line1 ), booking_pets ( pet:pets ( name ) ) )`,
    )
    .gte('scheduled_start', from.toISOString())
    .lt('scheduled_start', addLocalDays(from, 1).toISOString())
    .neq('status', 'cancelled')
    .order('scheduled_start');
  if (error) throw error;
  return data;
}

export type AdminVisit = Awaited<ReturnType<typeof fetchTodaysVisits>>[number];

export async function fetchSitters() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('role', 'sitter')
    .order('full_name');
  if (error) throw error;
  return data;
}

/** Assigns the sitter, confirms, and generates visits. Returns how many were created. */
export async function confirmBooking(bookingId: string, sitterId: string): Promise<number> {
  const { data, error } = await supabase.rpc('confirm_booking', {
    p_booking_id: bookingId,
    p_sitter_id: sitterId,
  });
  if (error) throw error;
  return data;
}

export async function declineBooking(bookingId: string): Promise<void> {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'declined' })
    .eq('id', bookingId)
    .eq('status', 'requested')
    .select('id');
  if (error) throw error;
  if (data.length !== 1) throw new Error('This request was already handled.');
}
