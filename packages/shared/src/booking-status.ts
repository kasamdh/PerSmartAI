import type { Database } from './database.ts';

type BookingStatus = Database['public']['Enums']['booking_status'];

const STATUS: Record<BookingStatus, { label: string; tone: 'waiting' | 'good' | 'bad' | 'muted' }> =
  {
    requested: { label: 'Waiting for confirmation', tone: 'waiting' },
    confirmed: { label: 'Confirmed', tone: 'good' },
    declined: { label: 'Declined', tone: 'bad' },
    cancelled: { label: 'Cancelled', tone: 'muted' },
    completed: { label: 'Completed', tone: 'muted' },
  };

export function bookingStatus(status: BookingStatus) {
  return STATUS[status];
}

/** Owners can cancel until a booking is finished (enforced by guard_booking_write). */
export function canOwnerCancel(status: BookingStatus): boolean {
  return status === 'requested' || status === 'confirmed';
}

// request_booking raises these with messages written for owners.
const FRIENDLY_CODES = new Set(['22023', 'P0002']);

/** A message to show for a failed booking request. */
export function bookingRequestErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code && FRIENDLY_CODES.has(e.code) && e.message) return e.message;
  if (e?.code === '23514') return 'One of those pets isn’t in your household.';
  return 'Couldn’t send your request. Check your connection and try again.';
}
