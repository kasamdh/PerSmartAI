// Sitter availability and time off. Availability is wall-clock weekly hours in the
// business's time zone (like the scheduler reads them); time off is a pair of
// instants entered in the device's local time.

import { formatClock } from '@/features/bookings/booking-text';
import { parseLocalTime, type TimeOffStatus } from '@/features/scheduling';
import { dateFromString } from '@/lib/wall-clock';

export type AvailabilityBlock = {
  id: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  start_time: string;
  end_time: string;
};

const minutes = (time: string) => parseLocalTime(time) ?? NaN;

/** An error message for a new block, or null if it can be saved. */
export function validateAvailabilityBlock(
  block: Omit<AvailabilityBlock, 'id'>,
  existing: readonly AvailabilityBlock[],
): string | null {
  const start = minutes(block.start_time);
  const end = minutes(block.end_time);
  if (!(end > start)) return 'End time must be after the start time';
  const clash = existing.find(
    (b) =>
      b.weekday === block.weekday && minutes(b.start_time) < end && start < minutes(b.end_time),
  );
  return clash ? `Overlaps ${formatClock(clash.start_time)}–${formatClock(clash.end_time)}` : null;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Monday-first days with their blocks in time order. */
export function availabilityByWeekday(blocks: readonly AvailabilityBlock[]) {
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
    weekday,
    label: DAY_LABELS[weekday],
    name: DAY_NAMES[weekday],
    blocks: blocks
      .filter((b) => b.weekday === weekday)
      .sort((a, b) => minutes(a.start_time) - minutes(b.start_time)),
  }));
}

export type TimeOffInput = {
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
};

export type TimeOffRange =
  { ok: true; start_at: string; end_at: string } | { ok: false; error: string };

function localInstant(date: string, time: string): Date | null {
  const day = dateFromString(date);
  const mins = parseLocalTime(time);
  if (!day || mins === null) return null;
  day.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return day;
}

/** Form values (device-local) → the instants stored in sitter_time_off. */
export function timeOffRange(input: TimeOffInput, now: Date): TimeOffRange {
  if (!input.startDate || !input.endDate) return { ok: false, error: 'Choose the dates' };
  if (input.endDate < input.startDate) {
    return { ok: false, error: 'The last day can’t be before the first' };
  }

  let start: Date | null;
  let end: Date | null;
  if (input.allDay) {
    start = localInstant(input.startDate, '00:00');
    end = localInstant(input.endDate, '00:00');
    end?.setDate(end.getDate() + 1); // calendar day, so DST days stay whole
  } else {
    if (!input.startTime || !input.endTime)
      return { ok: false, error: 'Choose start and end times' };
    start = localInstant(input.startDate, input.startTime);
    end = localInstant(input.endDate, input.endTime);
  }
  if (!start || !end) return { ok: false, error: 'Choose the dates' };
  if (end <= start) return { ok: false, error: 'End time must be after the start time' };
  if (end <= now) return { ok: false, error: 'Time off must end in the future' };
  return { ok: true, start_at: start.toISOString(), end_at: end.toISOString() };
}

const STATUS_LABELS: Record<TimeOffStatus, string> = {
  requested: 'Waiting for approval',
  approved: 'Approved',
  declined: 'Declined',
};

export function timeOffStatusLabel(status: TimeOffStatus): string {
  return STATUS_LABELS[status];
}
