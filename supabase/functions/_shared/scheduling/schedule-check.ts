// GENERATED from packages/shared/src/scheduling/schedule-check.ts by scripts/sync-shared.mjs. Do not edit;
// change the source and run `npm run shared:sync`.

// Checking a whole booking against a sitter's schedule, as the schedule-booking
// Edge Function and the admin screens do before saving.
//
// Only the next 60 days of visits are stored, but a booking can run for a year.
// Past the generation window the sitter's other confirmed bookings are projected
// with the same planner, so a clash in March is caught when confirming in November.

import { addDays, maxDate, type LocalDate } from './dates.ts';
import { nextOccurrenceOnOrAfter, occurrenceDates, parseRecurrence } from './recurrence.ts';
import { localToday } from './time-zone.ts';
import {
  checkSchedule,
  describeConflict,
  type AvailabilityBlock,
  type ExistingVisit,
  type ScheduleCheck,
  type TimeOff,
} from './conflicts.ts';
import {
  planVisits,
  SCHEDULE_HORIZON_DAYS,
  type PlanBooking,
  type PlannedVisit,
  type ServiceType,
} from './visit-plan.ts';

/** How far ahead conflicts are checked for open-ended bookings. */
export const CHECK_HORIZON_DAYS = 365;

export type ScheduledBooking = PlanBooking & {
  id: string;
  household_id: string;
  household_name?: string | null;
};

export type SitterSchedule = {
  /** The sitter's stored visits around the booking's dates. */
  visits: ExistingVisit[];
  availability: AvailabilityBlock[];
  timeOff: TimeOff[];
  /** The sitter's other confirmed bookings, for projecting past the window. */
  bookings: ScheduledBooking[];
};

export type OrgSchedulingSettings = { timeZone: string; travelBufferMinutes: number };

export type PlannedCandidate = PlannedVisit & {
  start: string;
  end: string;
  household_id: string;
};

export type BookingCheck = {
  /** Visits to store now (the generation window). */
  plan: PlannedVisit[];
  /** Conflicts over the booking's whole run (up to CHECK_HORIZON_DAYS). */
  check: ScheduleCheck<PlannedCandidate>;
};

const SERVICE_NAMES: Record<ServiceType, string> = {
  drop_in: 'Drop-in',
  walk: 'Walk',
  overnight: 'Overnight stay',
  multi_day: 'Multi-day stay',
};

/** "Walk at Lee home"; used in conflict reasons. */
export function visitLabel(service: ServiceType, householdName: string | null | undefined) {
  return householdName ? `${SERVICE_NAMES[service]} at ${householdName}` : SERVICE_NAMES[service];
}

/** The booking's last date: end_date, or the last COUNT/UNTIL occurrence. Null if open-ended. */
export function seriesLastDate(booking: PlanBooking): LocalDate | null {
  if (booking.end_date) return booking.end_date;
  const parsed = parseRecurrence(booking.recurrence_rule);
  if (!parsed.ok) return null;
  const spec = parsed.spec;
  if (!spec) return booking.service_type === 'overnight' ? null : booking.start_date;
  if (spec.until) return spec.until;
  if (spec.count === null) return null;
  // COUNT ≤ 1000 and INTERVAL ≤ 52 weeks bounds the search.
  const dates = occurrenceDates(
    booking.recurrence_rule,
    { start: booking.start_date, end: null },
    { from: booking.start_date, to: addDays(booking.start_date, spec.count * spec.interval * 7) },
  );
  return dates.at(-1) ?? null;
}

const toCandidates = (plan: PlannedVisit[], householdId: string): PlannedCandidate[] =>
  plan.map((v) => ({
    ...v,
    start: v.scheduled_start,
    end: v.scheduled_end,
    household_id: householdId,
  }));

export function checkBookingForSitter(
  booking: ScheduledBooking,
  sitter: SitterSchedule,
  org: OrgSchedulingSettings,
  now: Date,
  options: {
    fromDate?: LocalDate;
    /** Bookings being replaced, e.g. the original of a split series. */
    ignoreBookingIds?: readonly string[];
  } = {},
): BookingCheck {
  const ignore = [booking.id, ...(options.ignoreBookingIds ?? [])];
  const today = localToday(now, org.timeZone);
  const from = maxDate(today, options.fromDate ?? today);
  const windowEnd = addDays(today, SCHEDULE_HORIZON_DAYS);
  const checkEnd = addDays(today, CHECK_HORIZON_DAYS);

  const plan = planVisits(booking, {
    timeZone: org.timeZone,
    now,
    window: { from, to: windowEnd },
  });
  const all = planVisits(booking, { timeZone: org.timeZone, now, window: { from, to: checkEnd } });

  // Stored visits cover the window; projections cover the rest.
  const projected: ExistingVisit[] = sitter.bookings
    .filter((b) => !ignore.includes(b.id))
    .flatMap((other) =>
      planVisits(other, {
        timeZone: org.timeZone,
        now,
        window: { from: addDays(windowEnd, 1), to: checkEnd },
      }).map((v) => ({
        id: `projected:${other.id}:${v.slot_start}`,
        booking_id: other.id,
        household_id: other.household_id,
        scheduled_start: v.scheduled_start,
        scheduled_end: v.scheduled_end,
        status: 'scheduled' as const,
        label: visitLabel(other.service_type, other.household_name),
      })),
    );

  const check = checkSchedule(toCandidates(all, booking.household_id), {
    timeZone: org.timeZone,
    travelBufferMinutes: org.travelBufferMinutes,
    visits: [...sitter.visits, ...projected],
    availability: sitter.availability,
    timeOff: sitter.timeOff,
    ignoreBookingIds: ignore,
  });

  return { plan, check };
}

export type ProblemSummary = {
  local_date: LocalDate;
  start: string;
  end: string;
  blocking: boolean;
  reasons: string[];
};

/** Problems as plain data for the app: one entry per affected visit. */
export function summarizeProblems(
  check: ScheduleCheck<PlannedCandidate>,
  timeZone: string,
): ProblemSummary[] {
  return check.problems.map((p) => ({
    local_date: p.candidate.local_date,
    start: p.candidate.start,
    end: p.candidate.end,
    blocking: p.conflicts.some((c) => c.blocking),
    reasons: p.conflicts.map((c) => describeConflict(c, timeZone)),
  }));
}

/** True if the booking may still need visits generated on or after `today`. */
export function needsGeneration(booking: PlanBooking, today: LocalDate): boolean {
  const last = seriesLastDate(booking);
  if (last !== null && last < today) return false;
  if (booking.service_type === 'overnight') return true;
  return (
    nextOccurrenceOnOrAfter(
      booking.recurrence_rule,
      { start: booking.start_date, end: booking.end_date },
      maxDate(today, booking.start_date),
    ) !== null
  );
}
