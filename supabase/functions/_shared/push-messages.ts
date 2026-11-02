// GENERATED from packages/shared/src/push-messages.ts by scripts/sync-shared.mjs. Do not edit;
// change the source and run `npm run shared:sync`.

// Notification wording and recipients for push messages. Pure TypeScript shared by
// the notify-owner and alert-checks Edge Functions (Deno) and the app's Jest tests.

import type { AlertKind } from './alerts.ts';

export type PushEvent =
  | { type: 'visit_status'; visit_id: string; status: string }
  | { type: 'visit_photo'; visit_id: string; media_id: string; media_type?: 'photo' | 'video' }
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
      return {
        title: `New ${event.media_type === 'video' ? 'video' : 'photo'} of ${pets}`,
        body: `From ${sitter}. Tap to see it.`,
        data,
      };
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

// ---------------------------------------------------------------------------
// Alert kinds for the older events (settings screen filtering)
// ---------------------------------------------------------------------------

/** The settings kind an older visit or booking event belongs to. */
export function pushKind(event: PushEvent | BookingPushEvent): AlertKind | null {
  switch (event.type) {
    case 'visit_status':
      return event.status === 'on_the_way'
        ? 'sitter_on_the_way'
        : event.status === 'arrived'
          ? 'sitter_arrived'
          : event.status === 'completed'
            ? 'visit_complete'
            : null;
    case 'visit_photo':
      return 'new_photos';
    case 'incident':
      return 'incident';
    case 'booking_requested':
      return 'booking_request';
    case 'booking_status':
    case 'booking_cancelled':
      return 'booking_updates';
  }
}

// ---------------------------------------------------------------------------
// Visit alerts: batched photos, sitter schedule changes, reminders, late
// check-ins, medication due, pets not eating
// ---------------------------------------------------------------------------

export type VisitAlertEvent =
  | { type: 'visit_photos'; visit_id: string; count: number; has_video: boolean }
  | { type: 'visit_assigned'; visit_id: string }
  | { type: 'visit_unassigned'; visit_id: string; sitter_id?: string }
  | { type: 'visit_changed'; visit_id: string }
  | { type: 'visit_cancelled'; visit_id: string; sitter_id?: string }
  | { type: 'visit_reminder'; visit_id: string }
  | { type: 'late_check_in'; visit_id: string }
  | { type: 'medication_due'; visit_id: string; pet_name: string; title: string; due_at: string }
  | { type: 'food_refused'; visit_id: string; pet_id: string; pet_name: string };

export type VisitAlertContext = PushContext & {
  /** "Lee home". */
  place: string;
  /** "walk", "drop-in", and so on. */
  service: string;
  /** The visit's start in the business's zone, e.g. "Tue, Nov 10, 11:00 AM". */
  startLabel: string;
  /** Formats an instant as a time in the business's zone. */
  timeLabel: (iso: string) => string;
};

export type AlertMessage = {
  kind: AlertKind;
  title: string;
  body: string;
  data: { type: string; visitId?: string; bookingId?: string };
};

const firstName = (name: string | null) => name?.split(' ')[0] || null;

/** The alert for one audience, or null if this event isn't for them. */
export function buildVisitAlert(
  event: VisitAlertEvent,
  context: VisitAlertContext,
  audience: 'owner' | 'sitter' | 'admin',
): AlertMessage | null {
  const sitter = firstName(context.sitterName);
  const pets = joinNames(context.petNames);
  const data = { type: event.type, visitId: event.visit_id };
  const at = `${context.service} at ${context.place}`;

  switch (event.type) {
    case 'visit_photos': {
      if (audience !== 'owner') return null;
      const what = event.has_video ? 'photos and videos' : event.count === 1 ? 'photo' : 'photos';
      return {
        kind: 'new_photos',
        title: `${pets}: ${event.count} new ${what}`,
        body: `From ${sitter ?? 'your sitter'}. Tap to see ${event.count === 1 ? 'it' : 'them'}.`,
        data,
      };
    }
    case 'late_check_in':
      if (audience === 'owner') {
        return {
          kind: 'late_check_in',
          title: 'Your sitter hasn’t checked in yet',
          body: `The ${context.service} for ${pets} (${context.startLabel}) hasn’t started. The business is on it.`,
          data,
        };
      }
      if (audience === 'admin') {
        return {
          kind: 'late_check_in',
          title: `Late check-in: ${context.place}`,
          body: sitter
            ? `${sitter} hasn’t checked in for the ${context.service} at ${context.startLabel} (15+ min late).`
            : `Nobody is assigned to the ${context.service} at ${context.startLabel}.`,
          data,
        };
      }
      return null;
    case 'food_refused':
      if (audience === 'sitter') return null;
      return {
        kind: 'food_refused',
        title: `${event.pet_name} isn’t eating`,
        body:
          audience === 'owner'
            ? `${event.pet_name} ate nothing at the last 2 meals. ${sitter ?? 'Your sitter'} is keeping an eye on it.`
            : `${event.pet_name} (${context.place}) ate nothing at the last 2 meals, logged by ${sitter ?? 'the sitter'}.`,
        data,
      };
  }

  if (audience !== 'sitter') return null;
  switch (event.type) {
    case 'visit_assigned':
      return {
        kind: 'visit_assigned',
        title: `New visit: ${at}`,
        body: `${context.startLabel} with ${pets}.`,
        data,
      };
    case 'visit_unassigned':
      return {
        kind: 'visit_changed',
        title: 'Visit reassigned',
        body: `The ${at} (${context.startLabel}) is no longer yours.`,
        data,
      };
    case 'visit_changed':
      return {
        kind: 'visit_changed',
        title: 'Visit time changed',
        body: `The ${at} is now ${context.startLabel}.`,
        data,
      };
    case 'visit_cancelled':
      return {
        kind: 'visit_changed',
        title: 'Visit cancelled',
        body: `The ${at} (${context.startLabel}) is cancelled.`,
        data,
      };
    case 'visit_reminder':
      return {
        kind: 'visit_reminder',
        title: `In 30 minutes: ${at}`,
        body: `${context.startLabel} with ${pets}. Tap for the address and care notes.`,
        data,
      };
    case 'medication_due':
      return {
        kind: 'medication_due',
        title: `Medication due: ${event.pet_name}`,
        body: `${event.title} at ${context.timeLabel(event.due_at)}. Mark it given or skipped in the visit.`,
        data,
      };
  }
}

export type SitterBookingEvent = {
  type: 'booking_assigned' | 'booking_unassigned' | 'booking_changed';
  booking_id: string;
  sitter_id: string;
};

/** Bookings assigned to, taken from, or changed for a sitter. */
export function buildSitterBookingAlert(
  event: SitterBookingEvent,
  booking: {
    petNames: string[];
    serviceType: BookingPushContext['serviceType'];
    startDate: string;
  },
): AlertMessage {
  const service = SERVICE_NAMES[booking.serviceType];
  const what = `${service.charAt(0).toUpperCase()}${service.slice(1)} for ${joinNames(booking.petNames)}`;
  const data = { type: event.type, bookingId: event.booking_id };
  switch (event.type) {
    case 'booking_assigned':
      return {
        kind: 'visit_assigned',
        title: 'New booking for you',
        body: `${what}, starting ${shortDate(booking.startDate)}. It’s on your schedule.`,
        data,
      };
    case 'booking_unassigned':
      return {
        kind: 'visit_changed',
        title: 'Booking reassigned',
        body: `${what} is no longer on your schedule.`,
        data,
      };
    case 'booking_changed':
      return {
        kind: 'visit_changed',
        title: 'Booking changed',
        body: `${what} has new dates or times. Check your schedule.`,
        data,
      };
  }
}
