// Notification wording and recipients for push messages. Pure TypeScript with no
// imports, shared by the notify-owner Edge Function (Deno) and the app's Jest tests.

export type PushEvent =
  | { type: 'visit_status'; visit_id: string; status: string }
  | { type: 'visit_photo'; visit_id: string; media_id: string }
  | { type: 'incident'; visit_id: string; incident_id: string };

export type BookingPushEvent =
  | { type: 'booking_requested'; booking_id: string }
  | { type: 'booking_status'; booking_id: string; status: 'confirmed' | 'declined' }
  | { type: 'booking_cancelled'; booking_id: string; actor_id: string | null };

export type PushContext = {
  sitterName: string | null;
  petNames: string[];
};

/** What a tapped notification opens; see push-routes.ts in the app. */
export type PushData =
  | { type: PushEvent['type']; visitId: string }
  | { type: BookingPushEvent['type']; bookingId: string };

export type PushMessage = {
  title: string;
  body: string;
  data: PushData;
};

/** "Biscuit", "Biscuit & Mochi", "Biscuit, Mochi & Rex"; "your pets" when empty. */
export function joinNames(names: string[]): string {
  if (names.length === 0) return 'your pets';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export function buildPushMessage(event: PushEvent, context: PushContext): PushMessage | null {
  const sitter = context.sitterName?.split(' ')[0] || 'Your sitter';
  const pets = joinNames(context.petNames);
  const data = { visitId: event.visit_id, type: event.type };

  switch (event.type) {
    case 'visit_status':
      switch (event.status) {
        case 'on_the_way':
          return { title: `${sitter} is on the way`, body: `Heading over to see ${pets}.`, data };
        case 'arrived':
          return {
            title: `${sitter} checked in`,
            body: `${pets} ${context.petNames.length === 1 ? 'is' : 'are'} in good hands.`,
            data,
          };
        case 'completed':
          return {
            title: 'Report card ready',
            body: `${sitter} checked out. See how ${pets} did.`,
            data,
          };
        default:
          return null;
      }
    case 'visit_photo':
      return { title: `New photo of ${pets}`, body: `From ${sitter}. Tap to see it.`, data };
    case 'incident':
      return {
        title: 'Incident during a visit',
        body: `${sitter} reported an incident with ${pets}. Tap for details.`,
        data,
      };
  }
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export type BookingPushContext = {
  ownerName: string | null;
  sitterName: string | null;
  petNames: string[];
  serviceType: 'drop_in' | 'walk' | 'overnight' | 'multi_day';
  startDate: string; // YYYY-MM-DD, wall-clock in the business's time zone
  cancelledByOwner: boolean;
};

const SERVICE_NAMES: Record<BookingPushContext['serviceType'], string> = {
  drop_in: 'drop-in',
  walk: 'walk',
  overnight: 'overnight stay',
  multi_day: 'multi-day care',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-03" → "Nov 3", without time zone shifting. */
export function shortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${d}` : date;
}

export function buildBookingPushMessage(
  event: BookingPushEvent,
  context: BookingPushContext,
): PushMessage {
  const service = SERVICE_NAMES[context.serviceType];
  const pets = joinNames(context.petNames);
  const when = shortDate(context.startDate);
  const data = { bookingId: event.booking_id, type: event.type };

  switch (event.type) {
    case 'booking_requested':
      return {
        title: 'New booking request',
        body: `${context.ownerName || 'An owner'} wants a ${service} for ${pets} starting ${when}.`,
        data,
      };
    case 'booking_status':
      if (event.status === 'confirmed') {
        const sitter = context.sitterName?.split(' ')[0];
        return {
          title: 'Booking confirmed',
          body: `${sitter ? `${sitter} will look after` : 'We’ll look after'} ${pets}. Your ${service} starts ${when}.`,
          data,
        };
      }
      return {
        title: 'Booking request declined',
        body: `We couldn’t take the ${service} for ${pets} starting ${when}. Contact us for other options.`,
        data,
      };
    case 'booking_cancelled':
      return {
        title: 'Booking cancelled',
        body: `${context.cancelledByOwner ? context.ownerName || 'The owner' : 'The business'} cancelled the ${service} for ${pets} from ${when}. Upcoming visits are off the schedule.`,
        data,
      };
  }
}

export type BookingPeople = {
  ownerId: string;
  adminIds: string[];
  /** The booking's sitter and anyone whose visits were just cancelled. */
  sitterIds: string[];
};

/**
 * Who hears about a booking event. A cancellation reaches the sitters, the admins,
 * and the owner, except whoever cancelled.
 */
export function bookingRecipients(event: BookingPushEvent, people: BookingPeople): string[] {
  let ids: string[];
  switch (event.type) {
    case 'booking_requested':
      ids = people.adminIds;
      break;
    case 'booking_status':
      ids = [people.ownerId];
      break;
    case 'booking_cancelled':
      ids = [...people.sitterIds, ...people.adminIds, people.ownerId].filter(
        (id) => id !== event.actor_id,
      );
      break;
  }
  return [...new Set(ids)];
}
