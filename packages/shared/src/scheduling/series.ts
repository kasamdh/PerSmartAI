// Editing recurring bookings.
//
//   one visit         moveVisit: only that visit changes; its slot stays the same,
//                     so generation never recreates it at the old time
//   this and future   splitSeries: the booking ends the day before, and a new booking
//                     with the changes takes over from the split date
//   cancel series     handled by the database (cancel_visits_on_booking_cancel):
//                     only visits that haven't started are cancelled

import { addDays, MINUTE_MS, parseLocalTime, type LocalDate, type LocalTime } from './dates.ts';
import {
  buildRecurrenceRule,
  nextOccurrenceOnOrAfter,
  occurrenceDates,
  parseRecurrence,
} from './recurrence.ts';
import { localToUtc, utcToLocal } from './time-zone.ts';
import type { PlanBooking, PlannedVisit } from './visit-plan.ts';
import type { VisitStatus } from './conflicts.ts';

export type SeriesBooking = PlanBooking;

export type SeriesChanges = Partial<
  Pick<
    PlanBooking,
    | 'recurrence_rule'
    | 'end_date'
    | 'window_start'
    | 'window_end'
    | 'duration_minutes'
    | 'care_times'
  >
>;

export type SplitResult<B extends SeriesBooking = SeriesBooking> =
  | { kind: 'update'; booking: B }
  | {
      kind: 'split';
      /** Changes to the existing booking. */
      original: { end_date: LocalDate; recurrence_rule: string | null };
      /** The new booking from the split date on. */
      next: B;
    }
  | { kind: 'error'; error: string };

/**
 * Applies `changes` to the visits on and after `fromDate` (local date).
 *
 * When the series has no visits before `fromDate`, the booking is simply updated.
 * Otherwise it is split. If the repeat rule isn't changing, the new booking starts
 * on its first visit date, so "every other week" keeps the same weeks and COUNT
 * carries over what's left.
 */
export function splitSeries<B extends SeriesBooking>(
  booking: B,
  fromDate: LocalDate,
  changes: SeriesChanges,
  today: LocalDate,
): SplitResult<B> {
  if (fromDate < today) return { kind: 'error', error: 'Visits in the past can’t be changed' };

  if (changes.recurrence_rule !== undefined) {
    const parsed = parseRecurrence(changes.recurrence_rule);
    if (!parsed.ok) return { kind: 'error', error: parsed.error };
  }

  if (booking.service_type === 'overnight') {
    return { kind: 'update', booking: { ...booking, ...changes } };
  }

  const bounds = { start: booking.start_date, end: booking.end_date };
  const first = nextOccurrenceOnOrAfter(booking.recurrence_rule, bounds, fromDate);
  if (first === null) return { kind: 'error', error: 'There are no visits on or after that date' };

  const before =
    fromDate > booking.start_date
      ? occurrenceDates(booking.recurrence_rule, bounds, {
          from: booking.start_date,
          to: addDays(fromDate, -1),
        }).length
      : 0;

  const merged = { ...booking, ...changes };
  if (merged.window_start && merged.window_end) {
    const start = parseLocalTime(merged.window_start);
    const end = parseLocalTime(merged.window_end);
    if (start === null || end === null || end <= start) {
      return { kind: 'error', error: 'Latest arrival must be after the earliest' };
    }
  }
  if (before === 0) {
    return hasVisits(merged)
      ? { kind: 'update', booking: merged }
      : { kind: 'error', error: 'The new schedule has no visits' };
  }

  let next: B;
  if (changes.recurrence_rule !== undefined) {
    next = { ...merged, start_date: fromDate };
  } else {
    const spec = parseRecurrence(booking.recurrence_rule);
    let rule = booking.recurrence_rule;
    if (spec.ok && spec.spec?.count != null) {
      rule = buildRecurrenceRule({ ...spec.spec, count: spec.spec.count - before });
    }
    next = { ...merged, start_date: first, recurrence_rule: rule };
  }

  if (!hasVisits(next)) return { kind: 'error', error: 'The new schedule has no visits' };

  return {
    kind: 'split',
    original: { end_date: addDays(fromDate, -1), recurrence_rule: booking.recurrence_rule },
    next,
  };
}

function hasVisits(booking: SeriesBooking): boolean {
  if (booking.end_date !== null && booking.end_date < booking.start_date) return false;
  return (
    nextOccurrenceOnOrAfter(
      booking.recurrence_rule,
      { start: booking.start_date, end: booking.end_date },
      booking.start_date,
    ) !== null
  );
}

/**
 * Visits a split replaces: still scheduled, starting on or after local midnight of
 * `fromDate`. Visits that are under way or finished stay with the original booking.
 */
export function visitsToReplace(
  visits: readonly { id: string; scheduled_start: string; status: VisitStatus }[],
  fromDate: LocalDate,
  timeZone: string,
): string[] {
  const from = localToUtc(fromDate, '00:00', timeZone).getTime();
  return visits
    .filter((v) => v.status === 'scheduled' && Date.parse(v.scheduled_start) >= from)
    .map((v) => v.id);
}

export type CarriedVisit = { visit_id: string; slot_start: string; care_time_id: string | null };

/**
 * Cancelled visits after a split move to the new booking, taking the new slot for
 * the same day (and care time), so the new series doesn't bring them back.
 */
export function carryOverCancellations(
  cancelled: readonly {
    id: string;
    scheduled_start: string;
    slot_start?: string;
    care_time_id: string | null;
  }[],
  plan: readonly PlannedVisit[],
  timeZone: string,
): CarriedVisit[] {
  const moves: CarriedVisit[] = [];
  for (const visit of cancelled) {
    const date = utcToLocal(Date.parse(visit.slot_start ?? visit.scheduled_start), timeZone).date;
    const slot = plan.find(
      (p) => p.local_date === date && (p.care_time_id ?? null) === (visit.care_time_id ?? null),
    );
    if (slot) {
      moves.push({
        visit_id: visit.id,
        slot_start: slot.slot_start,
        care_time_id: slot.care_time_id,
      });
    }
  }
  return moves;
}

export type MoveResult =
  { ok: true; scheduled_start: string; scheduled_end: string } | { ok: false; error: string };

/** One visit to a new local date and time; keeps its length unless one is given. */
export function moveVisit(
  visit: { scheduled_start: string; scheduled_end: string },
  to: { date: LocalDate; time: LocalTime; durationMinutes?: number },
  timeZone: string,
  now: Date,
): MoveResult {
  const minutes =
    to.durationMinutes ??
    Math.round((Date.parse(visit.scheduled_end) - Date.parse(visit.scheduled_start)) / MINUTE_MS);
  if (!(minutes > 0)) return { ok: false, error: 'A visit needs a length' };

  const start = localToUtc(to.date, to.time, timeZone);
  if (start <= now) return { ok: false, error: 'Pick a time in the future' };

  return {
    ok: true,
    scheduled_start: start.toISOString(),
    scheduled_end: new Date(start.getTime() + minutes * MINUTE_MS).toISOString(),
  };
}
