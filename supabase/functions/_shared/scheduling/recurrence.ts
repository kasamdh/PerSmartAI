// Recurring bookings are stored as an RFC 5545 RRULE string. We support the subset a
// pet-sitting schedule needs: FREQ=DAILY or WEEKLY, INTERVAL, BYDAY (plain weekdays),
// and UNTIL or COUNT. Anything else is rejected rather than half-understood.
//
// rrule only expands *dates* here. It runs on UTC-midnight "floating" dates, so its
// time zone handling never comes into play; time-zone.ts adds the wall-clock time.

import { RRule, type Options, type Weekday as RRuleWeekday } from 'rrule';

import {
  addDays,
  dateToUtcMidnight,
  maxDate,
  minDate,
  parseLocalDate,
  utcMidnightToDate,
  type LocalDate,
} from './dates.ts';

export const WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

export type RecurrenceSpec = {
  freq: 'DAILY' | 'WEEKLY';
  interval: number;
  /** Weekly only; empty means the start date's weekday. Kept in Mon–Sun order. */
  byDay: WeekdayCode[];
  /** Last possible date (inclusive). */
  until: LocalDate | null;
  /** Total occurrences, counted from the series start. */
  count: number | null;
};

export type ParseResult = { ok: true; spec: RecurrenceSpec | null } | { ok: false; error: string };

export const MAX_INTERVAL = 52;
export const MAX_COUNT = 1000;

const RRULE_DAYS: Record<WeekdayCode, RRuleWeekday> = {
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
  SU: RRule.SU,
};

const isWeekdayCode = (v: string): v is WeekdayCode =>
  (WEEKDAY_CODES as readonly string[]).includes(v);

const fail = (error: string): ParseResult => ({ ok: false, error });

function parsePositiveInt(value: string, max: number): number | null {
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= max ? n : null;
}

/** UNTIL is a DATE (20261231) or DATE-TIME (20261231T235959Z); only the date is kept. */
function parseUntil(value: string): LocalDate | null {
  const match = /^(\d{4})(\d{2})(\d{2})(T\d{6}Z?)?$/.exec(value);
  if (!match) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  return parseLocalDate(date) ? date : null;
}

export function parseRecurrence(rule: string | null | undefined): ParseResult {
  const text = (rule ?? '')
    .trim()
    .replace(/^RRULE:/i, '')
    .toUpperCase();
  if (text === '') return { ok: true, spec: null };

  const seen = new Set<string>();
  const spec: RecurrenceSpec = { freq: 'DAILY', interval: 1, byDay: [], until: null, count: null };
  let freq: string | null = null;

  for (const part of text.split(';')) {
    const [key, value, ...rest] = part.split('=');
    if (!key || value === undefined || value === '' || rest.length > 0) {
      return fail(`Can't read "${part}" in the repeat rule`);
    }
    if (seen.has(key)) return fail(`${key} appears twice in the repeat rule`);
    seen.add(key);

    switch (key) {
      case 'FREQ':
        freq = value;
        break;
      case 'INTERVAL': {
        const n = parsePositiveInt(value, MAX_INTERVAL);
        if (n === null) return fail(`INTERVAL must be between 1 and ${MAX_INTERVAL}`);
        spec.interval = n;
        break;
      }
      case 'COUNT': {
        const n = parsePositiveInt(value, MAX_COUNT);
        if (n === null) return fail(`COUNT must be between 1 and ${MAX_COUNT}`);
        spec.count = n;
        break;
      }
      case 'UNTIL': {
        const until = parseUntil(value);
        if (!until) return fail('UNTIL must be a date like 20261231');
        spec.until = until;
        break;
      }
      case 'BYDAY': {
        const days = value.split(',');
        const bad = days.find((d) => !isWeekdayCode(d));
        if (bad !== undefined) return fail(`"${bad}" is not a weekday (use MO,TU,…)`);
        spec.byDay = WEEKDAY_CODES.filter((d) => days.includes(d));
        break;
      }
      case 'WKST':
        if (value !== 'MO') return fail('Weeks must start on Monday (WKST=MO)');
        break;
      default:
        return fail(`${key} is not supported in repeat rules`);
    }
  }

  if (freq === null) return fail('The repeat rule needs FREQ');
  if (freq !== 'DAILY' && freq !== 'WEEKLY')
    return fail('Only daily and weekly repeats are supported');
  spec.freq = freq;
  if (spec.freq === 'DAILY' && spec.byDay.length > 0) {
    return fail('BYDAY only works with weekly repeats');
  }
  if (spec.until !== null && spec.count !== null) {
    return fail('A repeat rule can’t have both UNTIL and COUNT');
  }
  return { ok: true, spec };
}

/** Throws with the parse error; for rules that were validated on the way in. */
export function requireRecurrence(rule: string | null | undefined): RecurrenceSpec | null {
  const result = parseRecurrence(rule);
  if (!result.ok) throw new RangeError(result.error);
  return result.spec;
}

/** The canonical RRULE string for a spec (no "RRULE:" prefix). */
export function buildRecurrenceRule(spec: RecurrenceSpec): string {
  const parts = [`FREQ=${spec.freq}`];
  if (spec.interval !== 1) parts.push(`INTERVAL=${spec.interval}`);
  if (spec.freq === 'WEEKLY' && spec.byDay.length > 0) {
    parts.push(`BYDAY=${WEEKDAY_CODES.filter((d) => spec.byDay.includes(d)).join(',')}`);
  }
  if (spec.until) parts.push(`UNTIL=${spec.until.replaceAll('-', '')}`);
  if (spec.count !== null) parts.push(`COUNT=${spec.count}`);
  return parts.join(';');
}

export type SeriesBounds = {
  /** The booking's start_date; also the rule's DTSTART. */
  start: LocalDate;
  /** The booking's end_date, if any (inclusive). */
  end: LocalDate | null;
};

export type DateWindow = { from: LocalDate; to: LocalDate };

/**
 * The dates a booking happens on within `window` (both inclusive), in order.
 *
 * Without a rule a booking happens on its start date, or on every day from start
 * to end when it has an end date. With a rule, INTERVAL and COUNT are counted from
 * the series start, so the window never changes which weeks or days are included.
 */
export function occurrenceDates(
  rule: string | null | undefined,
  series: SeriesBounds,
  window: DateWindow,
): LocalDate[] {
  const spec = requireRecurrence(rule);

  let last = series.end ?? (spec ? window.to : series.start);
  if (spec?.until) last = minDate(last, spec.until);
  const from = maxDate(series.start, window.from);
  const to = minDate(last, window.to);
  if (from > to) return [];

  if (!spec) {
    const dates: LocalDate[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
    return dates;
  }

  const options: Partial<Options> = {
    freq: spec.freq === 'DAILY' ? RRule.DAILY : RRule.WEEKLY,
    interval: spec.interval,
    dtstart: new Date(dateToUtcMidnight(series.start)),
    until: new Date(dateToUtcMidnight(last)),
    wkst: RRule.MO,
  };
  if (spec.count !== null) options.count = spec.count;
  if (spec.byDay.length > 0) options.byweekday = spec.byDay.map((d) => RRULE_DAYS[d]);

  return new RRule(options)
    .between(new Date(dateToUtcMidnight(from)), new Date(dateToUtcMidnight(to)), true)
    .map((d) => utcMidnightToDate(d.getTime()));
}

/** The first occurrence on or after `date`, or null if the series has ended. */
export function nextOccurrenceOnOrAfter(
  rule: string | null | undefined,
  series: SeriesBounds,
  date: LocalDate,
  searchDays = 400,
): LocalDate | null {
  return occurrenceDates(rule, series, { from: date, to: addDays(date, searchDays) })[0] ?? null;
}
