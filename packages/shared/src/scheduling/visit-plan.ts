// Turning a booking into the visits it should have.
//
//   drop_in, walk  one visit per occurrence date, at window_start, lasting
//                  duration_minutes (or until window_end)
//   overnight      one visit: arrival on start_date, departure on end_date
//   multi_day      one visit per care time on every occurrence date
//
// Times are wall-clock values in the organization's time zone and converted per
// date, so they don't drift across DST. Durations are real elapsed minutes.

import { addDays, MINUTE_MS, type LocalDate, type LocalTime } from './dates.ts';
import { occurrenceDates, type DateWindow } from './recurrence.ts';
import { localToday, localToUtc } from './time-zone.ts';

export type ServiceType = 'drop_in' | 'walk' | 'overnight' | 'multi_day';

/** Visits are generated this many days past today (inclusive). */
export const SCHEDULE_HORIZON_DAYS = 60;
export const DEFAULT_VISIT_MINUTES = 30;
export const DEFAULT_VISIT_START = '09:00';
export const DEFAULT_OVERNIGHT_START = '19:00';
export const DEFAULT_OVERNIGHT_END = '08:00';

export type CareTime = {
  id: string | null;
  time: LocalTime;
  duration_minutes: number;
  label: string;
};

export type PlanBooking = {
  service_type: ServiceType;
  recurrence_rule: string | null;
  start_date: LocalDate;
  end_date: LocalDate | null;
  window_start: LocalTime | null;
  window_end: LocalTime | null;
  duration_minutes: number | null;
  care_times?: CareTime[];
};

export type PlannedVisit = {
  local_date: LocalDate;
  /**
   * Identifies the occurrence; stays fixed when the visit is moved, so generation
   * (unique per booking and slot) never recreates a moved or cancelled visit.
   */
  slot_start: string;
  scheduled_start: string;
  scheduled_end: string;
  care_time_id: string | null;
};

export type PlanOptions = {
  timeZone: string;
  now: Date;
  /** Days past today to generate; ignored when `window` is given. */
  horizonDays?: number;
  /** Dates to generate (inclusive). Defaults to today … today + horizonDays. */
  window?: DateWindow;
};

export function generationWindow(
  now: Date,
  timeZone: string,
  horizonDays = SCHEDULE_HORIZON_DAYS,
): DateWindow {
  const today = localToday(now, timeZone);
  return { from: today, to: addDays(today, horizonDays) };
}

const plusMinutes = (instant: Date, minutes: number) =>
  new Date(instant.getTime() + minutes * MINUTE_MS);

export function planVisits(booking: PlanBooking, options: PlanOptions): PlannedVisit[] {
  const { timeZone, now } = options;
  const window = options.window ?? generationWindow(now, timeZone, options.horizonDays);

  const visit = (
    date: LocalDate,
    start: Date,
    end: Date,
    careTimeId: string | null = null,
  ): PlannedVisit => ({
    local_date: date,
    slot_start: start.toISOString(),
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
    care_time_id: careTimeId,
  });

  if (booking.service_type === 'overnight') {
    if (booking.start_date > window.to) return [];
    const start = localToUtc(
      booking.start_date,
      booking.window_start ?? DEFAULT_OVERNIGHT_START,
      timeZone,
    );
    const departure = booking.window_end ?? DEFAULT_OVERNIGHT_END;
    let end = localToUtc(booking.end_date ?? addDays(booking.start_date, 1), departure, timeZone);
    if (end <= start) end = localToUtc(addDays(booking.start_date, 1), departure, timeZone);
    return end > now ? [visit(booking.start_date, start, end)] : [];
  }

  const dates = occurrenceDates(
    booking.recurrence_rule,
    { start: booking.start_date, end: booking.end_date },
    window,
  );

  const careTimes =
    booking.service_type === 'multi_day' && booking.care_times?.length
      ? [...booking.care_times].sort((a, b) => a.time.localeCompare(b.time))
      : null;

  const visits: PlannedVisit[] = [];
  for (const date of dates) {
    if (careTimes) {
      const seen = new Set<number>();
      for (const care of careTimes) {
        const start = localToUtc(date, care.time, timeZone);
        // Two care times can land on one instant when a DST gap moves the first.
        if (seen.has(start.getTime())) continue;
        seen.add(start.getTime());
        const end = plusMinutes(start, care.duration_minutes);
        if (end > now) visits.push(visit(date, start, end, care.id));
      }
      continue;
    }

    const start = localToUtc(date, booking.window_start ?? DEFAULT_VISIT_START, timeZone);
    const end = booking.duration_minutes
      ? plusMinutes(start, booking.duration_minutes)
      : booking.window_end
        ? localToUtc(date, booking.window_end, timeZone)
        : plusMinutes(start, DEFAULT_VISIT_MINUTES);
    if (end > now && end > start) visits.push(visit(date, start, end));
  }
  return visits;
}
