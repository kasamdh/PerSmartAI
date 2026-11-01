import { supabase } from '@/lib/supabase/client';

export const requestKeys = {
  bookings: ['requests', 'bookings'] as const,
  changes: ['requests', 'changes'] as const,
};

/** Bookings waiting for an admin to assign a sitter, oldest request first. */
export async function fetchBookingRequests() {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `id, status, service_type, recurrence_rule, start_date, end_date, window_start, window_end,
       duration_minutes, notes, created_at,
       household:households ( id, name, address_line1, city, owner:profiles ( full_name, phone ) ),
       booking_pets ( pet:pets ( id, name, species ) )`,
    )
    .eq('status', 'requested')
    .order('created_at');
  if (error) throw error;
  return data;
}

export type BookingRequest = Awaited<ReturnType<typeof fetchBookingRequests>>[number];

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

/** Owners' pending reschedule requests, oldest first. */
export async function fetchChangeRequests() {
  const { data, error } = await supabase
    .from('schedule_change_requests')
    .select(
      `id, booking_id, visit_id, scope, from_date, changes, note, created_at,
       booking:bookings ( service_type, sitter_id, household:households ( id, name, address_line1, owner:profiles ( full_name ) ) ),
       visit:visits ( scheduled_start, scheduled_end )`,
    )
    .eq('status', 'requested')
    .order('created_at');
  if (error) throw error;
  return data;
}

export type ChangeRequest = Awaited<ReturnType<typeof fetchChangeRequests>>[number];
