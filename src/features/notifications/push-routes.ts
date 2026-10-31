import type { Href } from 'expo-router';

import type { AppRole } from '@/types/models';

/** Where tapping a notification about `visitId` should take this user. */
export function visitRouteFor(role: AppRole, visitId: string): Href {
  switch (role) {
    case 'sitter':
      return { pathname: '/visit/[id]', params: { id: visitId } };
    case 'owner':
      return { pathname: '/visits/[id]', params: { id: visitId } };
    case 'admin':
      return { pathname: '/visit-overview/[id]', params: { id: visitId } };
  }
}

/** Where tapping a booking notification should take this user. */
export function bookingRouteFor(role: AppRole, bookingId: string, type: string): Href {
  switch (role) {
    case 'owner':
      return '/my-bookings';
    case 'sitter':
      return '/sitter';
    case 'admin':
      return type === 'booking_requested'
        ? { pathname: '/bookings/[id]', params: { id: bookingId } }
        : '/admin';
  }
}

/** The route for a notification's data payload (see _shared/push-messages.ts), if any. */
export function pushRouteFor(
  role: AppRole,
  data: Record<string, unknown> | undefined,
): Href | null {
  if (typeof data?.visitId === 'string') return visitRouteFor(role, data.visitId);
  if (typeof data?.bookingId === 'string' && typeof data.type === 'string') {
    return bookingRouteFor(role, data.bookingId, data.type);
  }
  return null;
}
