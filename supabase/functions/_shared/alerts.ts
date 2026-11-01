// Which alerts to send, and when. Pure TypeScript shared by the alert-checks and
// notify-owner Edge Functions (Deno) and the app (settings screen, Jest tests).

import { localToUtc, utcToLocal } from './scheduling/time-zone.ts';
import { addDays } from './scheduling/dates.ts';

export type AlertRole = 'owner' | 'sitter' | 'admin';

type KindInfo = { label: string; description: string; roles: AlertRole[]; locked?: boolean };

/** Every alert a user can receive. Order is the settings screen's order. */
export const ALERT_KINDS = {
  sitter_on_the_way: {
    label: 'Sitter on the way',
    description: 'When the sitter starts the trip to your home.',
    roles: ['owner'],
  },
  sitter_arrived: {
    label: 'Sitter arrived',
    description: 'When the sitter checks in.',
    roles: ['owner'],
  },
  new_photos: {
    label: 'New photos and videos',
    description: 'At most one alert every 5 minutes per visit.',
    roles: ['owner'],
  },
  visit_complete: {
    label: 'Visit finished',
    description: 'With the report card.',
    roles: ['owner'],
  },
  incident: {
    label: 'Incidents',
    description: 'Always on, so you never miss one.',
    roles: ['owner', 'admin'],
    locked: true,
  },
  late_check_in: {
    label: 'Late check-ins',
    description: 'When nobody has checked in 15 minutes after a visit should start.',
    roles: ['owner', 'admin'],
  },
  food_refused: {
    label: 'Not eating',
    description: 'When a pet eats nothing at two meals in a row.',
    roles: ['owner', 'admin'],
  },
  booking_request: {
    label: 'New booking requests',
    description: 'When an owner asks for a booking.',
    roles: ['admin'],
  },
  visit_assigned: {
    label: 'New visits for you',
    description: 'When a booking or visit is assigned to you.',
    roles: ['sitter'],
  },
  visit_changed: {
    label: 'Visits changed or cancelled',
    description: 'New times, reassigned, or cancelled.',
    roles: ['sitter'],
  },
  visit_reminder: {
    label: 'Visit reminders',
    description: '30 minutes before each visit.',
    roles: ['sitter'],
  },
  medication_due: {
    label: 'Medication due',
    description: 'During overnight and multi-day stays.',
    roles: ['sitter'],
  },
  booking_updates: {
    label: 'Booking updates',
    description: 'Confirmed, declined or cancelled bookings.',
    roles: ['owner', 'sitter', 'admin'],
  },
} as const satisfies Record<string, KindInfo>;

export type AlertKind = keyof typeof ALERT_KINDS;

const ROLE_ORDER: Record<AlertRole, AlertKind[]> = {
  owner: [
    'sitter_on_the_way',
    'sitter_arrived',
    'new_photos',
    'visit_complete',
    'incident',
    'late_check_in',
    'food_refused',
    'booking_updates',
  ],
  sitter: [
    'visit_assigned',
    'visit_changed',
    'visit_reminder',
    'medication_due',
    'booking_updates',
  ],
  admin: ['incident', 'late_check_in', 'food_refused', 'booking_request', 'booking_updates'],
};

export function alertKindsFor(role: AlertRole) {
  return ROLE_ORDER[role].map((kind) => ({ kind, ...(ALERT_KINDS[kind] as KindInfo) }));
}

export function isAlertKind(value: string): value is AlertKind {
  return value in ALERT_KINDS;
}

/** Recipients minus those who turned this alert off (locked alerts always go). */
export function allowedRecipients(
  recipients: readonly string[],
  settings: readonly { user_id: string; muted: readonly string[] }[],
  kind: AlertKind,
): string[] {
  if ((ALERT_KINDS[kind] as KindInfo).locked) return [...new Set(recipients)];
  const muted = new Set(settings.filter((s) => s.muted.includes(kind)).map((s) => s.user_id));
  return [...new Set(recipients)].filter((id) => !muted.has(id));
}

// ---------------------------------------------------------------------------
// New photos: batched per visit
// ---------------------------------------------------------------------------

/** At most one photo alert per visit in this time. */
export const PHOTO_ALERT_GAP_MS = 5 * 60_000;
/** Wait this long after the latest photo, so a burst becomes one alert. */
export const PHOTO_SETTLE_MS = 30_000;

export type PhotoDecision =
  { send: true; count: number; coveredUntil: Date } | { send: false; retryAt: Date | null };

/**
 * Whether to alert about a visit's photos that no alert has covered yet.
 * Sends once the burst has settled (or has gone on for the whole gap), and never
 * within 5 minutes of the visit's previous photo alert.
 */
export function decidePhotoAlert({
  unsent,
  lastAlertAt,
  now,
}: {
  unsent: readonly Date[];
  lastAlertAt: Date | null;
  now: Date;
}): PhotoDecision {
  if (unsent.length === 0) return { send: false, retryAt: null };
  const times = unsent.map((d) => d.getTime()).sort((a, b) => a - b);
  const oldest = times[0];
  const newest = times[times.length - 1];

  const gapOpensAt = lastAlertAt ? lastAlertAt.getTime() + PHOTO_ALERT_GAP_MS : -Infinity;
  if (now.getTime() < gapOpensAt) return { send: false, retryAt: new Date(gapOpensAt) };

  const settled = now.getTime() - newest >= PHOTO_SETTLE_MS;
  const waitedLongEnough = now.getTime() - oldest >= PHOTO_ALERT_GAP_MS;
  if (!settled && !waitedLongEnough) {
    return { send: false, retryAt: new Date(newest + PHOTO_SETTLE_MS) };
  }
  return { send: true, count: unsent.length, coveredUntil: new Date(newest) };
}

// ---------------------------------------------------------------------------
// Late check-ins and reminders (pg_cron, every 5 minutes)
// ---------------------------------------------------------------------------

export const LATE_AFTER_MS = 15 * 60_000;
/** Visits that should have started longer ago than this are no longer news. */
const LATE_ALERT_HORIZON_MS = 3 * 3_600_000;
export const REMINDER_BEFORE_MS = 30 * 60_000;

type TimedVisit = { id: string; status: string; scheduled_start: string };

/** Visits nobody has checked in to 15 minutes after their window start, once each. */
export function lateCheckIns<
  V extends TimedVisit & { scheduled_end: string; check_in_at: string | null },
>(visits: readonly V[], now: Date, alreadyAlerted: ReadonlySet<string>): V[] {
  const t = now.getTime();
  return visits.filter((v) => {
    const start = Date.parse(v.scheduled_start);
    return (
      (v.status === 'scheduled' || v.status === 'on_the_way') &&
      !v.check_in_at &&
      t - start >= LATE_AFTER_MS &&
      t - start <= LATE_ALERT_HORIZON_MS &&
      !alreadyAlerted.has(v.id)
    );
  });
}

/** Scheduled visits starting within 30 minutes, not yet reminded, with a sitter. */
export function visitReminders<V extends TimedVisit & { sitter_id: string | null }>(
  visits: readonly V[],
  now: Date,
  alreadyReminded: ReadonlySet<string>,
): V[] {
  const t = now.getTime();
  return visits.filter((v) => {
    const start = Date.parse(v.scheduled_start);
    return (
      v.status === 'scheduled' &&
      v.sitter_id !== null &&
      start > t &&
      start - t <= REMINDER_BEFORE_MS &&
      !alreadyReminded.has(v.id)
    );
  });
}

// ---------------------------------------------------------------------------
// Medication due during a stay
// ---------------------------------------------------------------------------

/** How far back a dose may have come due and still be "just due" (the job's interval). */
export const MEDICATION_WINDOW_MS = 5 * 60_000;
const STAY_SERVICES = ['overnight', 'multi_day'];

type StayPet = {
  id: string;
  name: string;
  pet_medications: readonly {
    id: string;
    name: string;
    dose: string | null;
    schedule_times: readonly string[];
  }[];
};

export type DueMedication = {
  /** Same key as the sitter's checklist task, so a logged dose matches. */
  key: string;
  petId: string;
  petName: string;
  title: string;
  dueAt: string;
};

/**
 * Doses that came due in the last 5 minutes during a stay that's under way and
 * haven't been given, skipped, or alerted. Times are wall-clock in the org zone.
 */
export function medicationsDue(
  visit: {
    status: string;
    service_type: string;
    scheduled_start: string;
    scheduled_end: string;
  },
  pets: readonly StayPet[],
  events: readonly { pet_id: string | null; type: string; value: unknown }[],
  timeZone: string,
  now: Date,
  alreadyAlerted: ReadonlySet<string>,
): DueMedication[] {
  if (!STAY_SERVICES.includes(visit.service_type)) return [];
  if (visit.status !== 'arrived' && visit.status !== 'in_progress') return [];

  const logged = new Set(
    events
      .filter((e) => e.type === 'meds_given')
      .map((e) => (e.value as { task_key?: unknown } | null)?.task_key)
      .filter((k): k is string => typeof k === 'string'),
  );
  const start = Date.parse(visit.scheduled_start);
  const end = Date.parse(visit.scheduled_end);
  const t = now.getTime();
  const first = utcToLocal(start, timeZone).date;
  const last = utcToLocal(end, timeZone).date;

  const due: DueMedication[] = [];
  for (const pet of pets) {
    for (const med of pet.pet_medications) {
      for (const time of med.schedule_times) {
        for (let date = first; date <= last; date = addDays(date, 1)) {
          const at = localToUtc(date, time, timeZone).getTime();
          if (at < start || at > end || at > t || t - at > MEDICATION_WINDOW_MS) continue;
          const key = `medication:${med.id}:${new Date(at).toISOString()}`;
          if (logged.has(key) || alreadyAlerted.has(key)) continue;
          due.push({
            key,
            petId: pet.id,
            petName: pet.name,
            title: [med.name, med.dose].filter(Boolean).join(' '),
            dueAt: new Date(at).toISOString(),
          });
        }
      }
    }
  }
  return due.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
