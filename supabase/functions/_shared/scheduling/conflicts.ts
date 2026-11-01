// GENERATED from packages/shared/src/scheduling/conflicts.ts by scripts/sync-shared.mjs. Do not edit;
// change the source and run `npm run shared:sync`.

// Can this sitter take this visit? Checked before saving any assignment.
//
// Blocking:  overlapping another visit; less than the organization's travel buffer
//            between visits at different homes; approved time off; outside the
//            sitter's weekly availability.
// Warnings:  requested (not yet approved) time off; no availability set at all.
//
// Availability blocks are wall-clock times in the organization's time zone and are
// converted per date, so they hold across DST changes. Adjacent blocks join, so
// 12:00–24:00 plus 00:00–09:00 the next day covers an overnight stay.

import { addDays, MINUTE_MS, requireTime, weekdayOf, type LocalTime } from './dates.ts';
import { localToUtc, utcToLocal } from './time-zone.ts';

export type VisitStatus =
  'scheduled' | 'on_the_way' | 'arrived' | 'in_progress' | 'completed' | 'missed' | 'cancelled';

export type ExistingVisit = {
  id: string;
  booking_id: string | null;
  household_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: VisitStatus;
  /** Shown in reasons, e.g. "Walk at Lee home". */
  label?: string;
};

export type AvailabilityBlock = {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  start_time: LocalTime;
  end_time: LocalTime;
};

export type TimeOffStatus = 'requested' | 'approved' | 'declined';

export type TimeOff = {
  id: string;
  start_at: string;
  end_at: string;
  status: TimeOffStatus;
};

export type Candidate = {
  start: string;
  end: string;
  /** Visits at the same home need no travel time between them. */
  household_id: string | null;
};

export type ConflictContext = {
  timeZone: string;
  travelBufferMinutes: number;
  /** The sitter's visits around the candidates. */
  visits: ExistingVisit[];
  availability: AvailabilityBlock[];
  timeOff: TimeOff[];
  /** Visits being moved or replaced, which shouldn't conflict with themselves. */
  ignoreVisitIds?: readonly string[];
  ignoreBookingIds?: readonly string[];
};

export type Conflict =
  | { kind: 'overlap'; blocking: true; visit: ExistingVisit }
  | {
      kind: 'travel_buffer';
      blocking: true;
      visit: ExistingVisit;
      /** Whether the candidate comes before or after the other visit. */
      position: 'before' | 'after';
      gapMinutes: number;
      requiredMinutes: number;
    }
  | { kind: 'time_off'; blocking: true; timeOff: TimeOff }
  | { kind: 'time_off_requested'; blocking: false; timeOff: TimeOff }
  | { kind: 'outside_availability'; blocking: true; weekday: number; blocks: AvailabilityBlock[] }
  | { kind: 'no_availability_set'; blocking: false };

const INACTIVE_STATUSES: readonly VisitStatus[] = ['cancelled', 'missed'];

const ms = (iso: string) => Date.parse(iso);

function visitConflicts(candidate: Candidate, ctx: ConflictContext): Conflict[] {
  const start = ms(candidate.start);
  const end = ms(candidate.end);
  const buffer = ctx.travelBufferMinutes * MINUTE_MS;
  const conflicts: Conflict[] = [];

  const others = ctx.visits
    .filter(
      (v) =>
        !INACTIVE_STATUSES.includes(v.status) &&
        !ctx.ignoreVisitIds?.includes(v.id) &&
        !(v.booking_id && ctx.ignoreBookingIds?.includes(v.booking_id)),
    )
    .sort((a, b) => ms(a.scheduled_start) - ms(b.scheduled_start));

  for (const visit of others) {
    const otherStart = ms(visit.scheduled_start);
    const otherEnd = ms(visit.scheduled_end);

    if (otherStart < end && start < otherEnd) {
      conflicts.push({ kind: 'overlap', blocking: true, visit });
      continue;
    }

    const sameHome =
      candidate.household_id !== null && candidate.household_id === visit.household_id;
    if (sameHome || buffer === 0) continue;

    const gapAfter = start - otherEnd; // candidate after the other visit
    const gapBefore = otherStart - end; // candidate before the other visit
    const gap = gapAfter >= 0 ? gapAfter : gapBefore;
    if (gap < buffer) {
      conflicts.push({
        kind: 'travel_buffer',
        blocking: true,
        visit,
        position: gapAfter >= 0 ? 'after' : 'before',
        gapMinutes: Math.floor(gap / MINUTE_MS),
        requiredMinutes: ctx.travelBufferMinutes,
      });
    }
  }
  return conflicts;
}

function timeOffConflicts(candidate: Candidate, ctx: ConflictContext): Conflict[] {
  const start = ms(candidate.start);
  const end = ms(candidate.end);
  const conflicts: Conflict[] = [];
  for (const timeOff of ctx.timeOff) {
    if (timeOff.status === 'declined') continue;
    if (!(ms(timeOff.start_at) < end && start < ms(timeOff.end_at))) continue;
    conflicts.push(
      timeOff.status === 'approved'
        ? { kind: 'time_off', blocking: true, timeOff }
        : { kind: 'time_off_requested', blocking: false, timeOff },
    );
  }
  return conflicts;
}

/** True if the merged availability around the candidate covers all of it. */
function isAvailable(candidate: Candidate, ctx: ConflictContext): boolean {
  const start = ms(candidate.start);
  const end = ms(candidate.end);
  const firstDate = addDays(utcToLocal(start, ctx.timeZone).date, -1);
  const lastDate = utcToLocal(end, ctx.timeZone).date;

  const intervals: [number, number][] = [];
  for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
    const weekday = weekdayOf(date);
    for (const block of ctx.availability) {
      if (block.weekday !== weekday) continue;
      intervals.push([
        localToUtc(date, block.start_time, ctx.timeZone).getTime(),
        localToUtc(date, block.end_time, ctx.timeZone).getTime(),
      ]);
    }
  }
  intervals.sort((a, b) => a[0] - b[0]);

  // Walk the merged intervals: the candidate must sit inside one of them.
  let current: [number, number] | null = null;
  for (const [s, e] of intervals) {
    if (current && s <= current[1]) {
      current[1] = Math.max(current[1], e);
    } else {
      if (current && current[0] <= start && end <= current[1]) return true;
      current = [s, e];
    }
  }
  return current !== null && current[0] <= start && end <= current[1];
}

function availabilityConflicts(candidate: Candidate, ctx: ConflictContext): Conflict[] {
  if (ctx.availability.length === 0) return [{ kind: 'no_availability_set', blocking: false }];
  if (isAvailable(candidate, ctx)) return [];
  const weekday = utcToLocal(ms(candidate.start), ctx.timeZone).weekday;
  return [
    {
      kind: 'outside_availability',
      blocking: true,
      weekday,
      blocks: ctx.availability
        .filter((b) => b.weekday === weekday)
        .sort((a, b) => requireTime(a.start_time) - requireTime(b.start_time)),
    },
  ];
}

/** Every reason this sitter can't (or shouldn't) take the candidate visit. */
export function findConflicts(candidate: Candidate, ctx: ConflictContext): Conflict[] {
  return [
    ...visitConflicts(candidate, ctx),
    ...timeOffConflicts(candidate, ctx),
    ...availabilityConflicts(candidate, ctx),
  ];
}

export type ScheduleProblem<C extends Candidate = Candidate> = {
  index: number;
  candidate: C;
  conflicts: Conflict[];
};

export type ScheduleCheck<C extends Candidate = Candidate> = {
  /** True when nothing blocks; warnings may remain in `problems`. */
  ok: boolean;
  blockingCount: number;
  problems: ScheduleProblem<C>[];
};

/** Checks every candidate; only the ones with conflicts or warnings are listed. */
export function checkSchedule<C extends Candidate>(
  candidates: readonly C[],
  ctx: ConflictContext,
): ScheduleCheck<C> {
  const problems: ScheduleProblem<C>[] = [];
  let blockingCount = 0;
  candidates.forEach((candidate, index) => {
    const conflicts = findConflicts(candidate, ctx);
    if (conflicts.length === 0) return;
    if (conflicts.some((c) => c.blocking)) blockingCount++;
    problems.push({ index, candidate, conflicts });
  });
  return { ok: blockingCount === 0, blockingCount, problems };
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PLURAL_DAYS = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 545 → "9:05 AM"; 1440 → "12:00 AM". */
export function formatClockMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** An instant as "Tue, Nov 10" in the zone. */
export function formatDayInZone(iso: string, timeZone: string): string {
  const local = utcToLocal(ms(iso), timeZone);
  const [, month, day] = local.date.split('-').map(Number);
  return `${DAY_NAMES[local.weekday]}, ${MONTHS[month - 1]} ${day}`;
}

/** An instant as "11:00 AM" in the zone. */
export function formatTimeInZone(iso: string, timeZone: string): string {
  return formatClockMinutes(utcToLocal(ms(iso), timeZone).minutes);
}

const range = (start: string, end: string, timeZone: string) =>
  `${formatDayInZone(start, timeZone)}, ${formatTimeInZone(start, timeZone)}–${formatTimeInZone(end, timeZone)}`;

const longRange = (start: string, end: string, timeZone: string) =>
  `${formatDayInZone(start, timeZone)}, ${formatTimeInZone(start, timeZone)} – ` +
  `${formatDayInZone(end, timeZone)}, ${formatTimeInZone(end, timeZone)}`;

/** One sentence explaining a conflict, with times in the organization's zone. */
export function describeConflict(conflict: Conflict, timeZone: string): string {
  switch (conflict.kind) {
    case 'overlap': {
      const v = conflict.visit;
      return `Overlaps ${v.label ?? 'another visit'} (${range(v.scheduled_start, v.scheduled_end, timeZone)})`;
    }
    case 'travel_buffer': {
      const v = conflict.visit;
      const name = v.label ?? 'another visit';
      const edge =
        conflict.position === 'after'
          ? `after ${name} ends at ${formatTimeInZone(v.scheduled_end, timeZone)}`
          : `before ${name} starts at ${formatTimeInZone(v.scheduled_start, timeZone)}`;
      return `Only ${conflict.gapMinutes} min ${edge}; needs ${conflict.requiredMinutes} min travel time`;
    }
    case 'time_off':
      return `Time off ${longRange(conflict.timeOff.start_at, conflict.timeOff.end_at, timeZone)}`;
    case 'time_off_requested':
      return `Time off requested (not approved yet) ${longRange(
        conflict.timeOff.start_at,
        conflict.timeOff.end_at,
        timeZone,
      )}`;
    case 'outside_availability': {
      const day = PLURAL_DAYS[conflict.weekday];
      if (conflict.blocks.length === 0) return `Outside availability: not available on ${day}`;
      const hours = conflict.blocks
        .map(
          (b) =>
            `${formatClockMinutes(requireTime(b.start_time))}–${formatClockMinutes(requireTime(b.end_time))}`,
        )
        .join(', ');
      return `Outside availability: ${day} ${hours}`;
    }
    case 'no_availability_set':
      return 'No availability set yet';
  }
}
