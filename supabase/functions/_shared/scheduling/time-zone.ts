// GENERATED from packages/shared/src/scheduling/time-zone.ts by scripts/sync-shared.mjs. Do not edit;
// change the source and run `npm run shared:sync`.

// Converting wall-clock times in an IANA time zone to UTC instants and back.
//
// Visits are generated from wall-clock times in the organization's time zone, so a
// 12:00 walk is 12:00 local on both sides of a DST change. Two cases have no single
// answer:
//   - a time skipped by spring forward (02:30 on Mar 8 in New York) moves forward by
//     the size of the gap (03:30 EDT), like Postgres `timestamp at time zone`;
//   - a time repeated by fall back (01:30 on Nov 1 in New York) uses the first one.

import {
  DAY_MS,
  formatLocalTime,
  MINUTE_MS,
  parseLocalDate,
  requireTime,
  type LocalDate,
  type LocalTime,
} from './dates.ts';

export type LocalParts = {
  date: LocalDate;
  time: LocalTime;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Minutes after local midnight. */
  minutes: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    // Throws RangeError for unknown zones.
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The local wall clock at an instant, as if it were a UTC timestamp (ms). */
function wallClockMs(instantMs: number, timeZone: string): number {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(new Date(instantMs))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour % 24, // some engines print midnight as 24
    parts.minute,
    parts.second,
  );
}

/** The zone's UTC offset at an instant, in minutes (New York in summer: -240). */
export function utcOffsetMinutes(instant: Date | number, timeZone: string): number {
  const ms = typeof instant === 'number' ? instant : instant.getTime();
  const whole = Math.floor(ms / 1000) * 1000;
  return Math.round((wallClockMs(whole, timeZone) - whole) / MINUTE_MS);
}

/** The instant a wall-clock date and time happen in `timeZone`. "24:00" is the next midnight. */
export function localToUtc(date: LocalDate, time: LocalTime, timeZone: string): Date {
  const parts = parseLocalDate(date);
  if (!parts) throw new RangeError(`Not a date: ${date}`);
  const [y, m, d] = parts;
  const wall = Date.UTC(y, m - 1, d) + requireTime(time) * MINUTE_MS;

  // The offsets a day either side cover any single transition near this time.
  const before = utcOffsetMinutes(wall - DAY_MS, timeZone);
  const after = utcOffsetMinutes(wall + DAY_MS, timeZone);
  const valid = [before, after].filter(
    (offset) => utcOffsetMinutes(wall - offset * MINUTE_MS, timeZone) === offset,
  );

  if (valid.length === 0) {
    // Skipped by spring forward: read it with the offset from before the gap.
    return new Date(wall - before * MINUTE_MS);
  }
  // Repeated by fall back: the larger offset is the earlier instant.
  return new Date(wall - Math.max(...valid) * MINUTE_MS);
}

/** The wall-clock date, time and weekday of an instant in `timeZone`. */
export function utcToLocal(instant: Date | number, timeZone: string): LocalParts {
  const ms = typeof instant === 'number' ? instant : instant.getTime();
  const wall = wallClockMs(ms, timeZone);
  const minutes = Math.floor((wall % DAY_MS) / MINUTE_MS);
  return {
    date: new Date(wall).toISOString().slice(0, 10),
    time: formatLocalTime(minutes),
    weekday: new Date(wall).getUTCDay(),
    minutes,
  };
}

/** Today's date in `timeZone`. */
export function localToday(now: Date, timeZone: string): LocalDate {
  return utcToLocal(now, timeZone).date;
}
