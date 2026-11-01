// Product analytics (PostHog): only these key events, with only these properties.
// Nothing personal: no names, addresses, messages, notes, ids of people or
// households, and no free text. Each property is an enum, a boolean or a number
// rounded into a bucket, so an event can't be tied back to a person.

import type { Enums } from './database.ts';

type ServiceType = Enums<'service_type'>;

export type AnalyticsEvent =
  | {
      name: 'booking_created';
      props: { service_type: ServiceType; pet_count: number; recurring: boolean };
    }
  | {
      name: 'visit_completed';
      props: {
        service_type: ServiceType;
        /** Minutes from check-in to check-out, rounded to 5. */
        duration_minutes: number;
        photo_count: number;
        care_event_count: number;
      };
    }
  | {
      name: 'photo_sent';
      props: {
        media_type: 'photo' | 'video';
        /** Seconds from capture to arrival (offline queue delay), rounded to buckets. */
        delay_bucket: 'under_1m' | 'under_10m' | 'under_1h' | 'over_1h';
      };
    };

export type AnalyticsEventName = AnalyticsEvent['name'];

const SERVICE_TYPES: readonly ServiceType[] = ['drop_in', 'walk', 'overnight', 'multi_day'];
const DELAY_BUCKETS = ['under_1m', 'under_10m', 'under_1h', 'over_1h'] as const;

type Rule = (value: unknown) => string | number | boolean | undefined;
const oneOf =
  (values: readonly string[]): Rule =>
  (v) =>
    typeof v === 'string' && values.includes(v) ? v : undefined;
const count =
  (max: number): Rule =>
  (v) =>
    typeof v === 'number' && Number.isFinite(v)
      ? Math.min(max, Math.max(0, Math.round(v)))
      : undefined;
const bool: Rule = (v) => (typeof v === 'boolean' ? v : undefined);

/** The only properties each event may carry, and how each is checked. */
const ALLOWED: Record<AnalyticsEventName, Record<string, Rule>> = {
  booking_created: { service_type: oneOf(SERVICE_TYPES), pet_count: count(20), recurring: bool },
  visit_completed: {
    service_type: oneOf(SERVICE_TYPES),
    duration_minutes: (v) => {
      const n = count(24 * 60)(v);
      return typeof n === 'number' ? Math.round(n / 5) * 5 : undefined;
    },
    photo_count: count(100),
    care_event_count: count(100),
  },
  photo_sent: { media_type: oneOf(['photo', 'video']), delay_bucket: oneOf(DELAY_BUCKETS) },
};

/**
 * The properties actually sent: unknown keys are dropped and values outside each
 * rule are dropped, so a mistake can't leak personal data.
 */
export function eventProperties(
  name: AnalyticsEventName,
  props: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const rules = ALLOWED[name];
  const out: Record<string, string | number | boolean> = {};
  for (const [key, rule] of Object.entries(rules)) {
    const value = rule(props[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function delayBucket(capturedAt: string, sentAt: Date): (typeof DELAY_BUCKETS)[number] {
  const seconds = (sentAt.getTime() - Date.parse(capturedAt)) / 1000;
  if (seconds < 60) return 'under_1m';
  if (seconds < 600) return 'under_10m';
  if (seconds < 3600) return 'under_1h';
  return 'over_1h';
}

/** Check-in to check-out in whole minutes (0 if either is missing). */
export function visitMinutes(checkInAt: string | null, checkOutAt: Date): number {
  if (!checkInAt) return 0;
  return Math.max(0, Math.round((checkOutAt.getTime() - Date.parse(checkInAt)) / 60_000));
}
