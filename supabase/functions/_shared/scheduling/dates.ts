// GENERATED from packages/shared/src/scheduling/dates.ts by scripts/sync-shared.mjs. Do not edit;
// change the source and run `npm run shared:sync`.

// Wall-clock calendar values used by scheduling. Dates are "YYYY-MM-DD" and times
// "HH:MM" (Postgres `time` values like "09:15:00" are accepted too). They carry no
// time zone; time-zone.ts turns them into instants in a given zone.

export type LocalDate = string;
export type LocalTime = string;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
// Postgres `time` values may carry fractional seconds (ignored).
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000;

/** [year, month (1-12), day] for a real calendar date, or null. */
export function parseLocalDate(value: string): [number, number, number] | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? [y, m, d]
    : null;
}

export function isLocalDate(value: string): boolean {
  return parseLocalDate(value) !== null;
}

function requireDate(value: string): [number, number, number] {
  const parts = parseLocalDate(value);
  if (!parts) throw new RangeError(`Not a date: ${value}`);
  return parts;
}

/** Minutes after midnight for "HH:MM", "HH:MM:SS" or "HH:MM:SS.ffffff" (00:00–24:00), or null. */
export function parseLocalTime(value: string): number | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  const [h, m, s = 0] = match.slice(1).map((p) => (p === undefined ? 0 : Number(p)));
  if (m > 59 || s > 59) return null;
  if (h > 24 || (h === 24 && (m > 0 || s > 0))) return null;
  return h * 60 + m;
}

export function requireTime(value: string): number {
  const minutes = parseLocalTime(value);
  if (minutes === null) throw new RangeError(`Not a time: ${value}`);
  return minutes;
}

/** 545 → "09:05". */
export function formatLocalTime(minutes: number): LocalTime {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Midnight UTC of a local date, used as a time-zone-free day number. */
export function dateToUtcMidnight(value: LocalDate): number {
  const [y, m, d] = requireDate(value);
  return Date.UTC(y, m - 1, d);
}

export function utcMidnightToDate(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(value: LocalDate, days: number): LocalDate {
  return utcMidnightToDate(dateToUtcMidnight(value) + days * DAY_MS);
}

/** Whole days from `a` to `b` (negative if `b` is earlier). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((dateToUtcMidnight(b) - dateToUtcMidnight(a)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday, matching Postgres `extract(dow)` and sitter_availability. */
export function weekdayOf(value: LocalDate): number {
  return new Date(dateToUtcMidnight(value)).getUTCDay();
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a <= b ? a : b;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a >= b ? a : b;
}
