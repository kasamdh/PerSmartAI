// Owner reschedule requests (schedule_change_requests) and cancellation wording.
// Dates and times are wall-clock values in the business's time zone; an admin
// applies an approved request through schedule-booking, with conflict checks.

import { parseLocalTime } from './scheduling/index.ts';

type Result =
  { ok: true; changes: Record<string, string | number | null> } | { ok: false; error: string };

/** One visit to a new date and time. */
export function visitChanges(
  values: { date: string; time: string; durationMinutes: number },
  currentMinutes: number,
): Result {
  if (!values.date || !values.time) return { ok: false, error: 'Choose a new date and time' };
  return {
    ok: true,
    changes: {
      date: values.date,
      time: values.time,
      ...(values.durationMinutes !== currentMinutes
        ? { duration_minutes: values.durationMinutes }
        : {}),
    },
  };
}

const sameTime = (a: string | null, b: string) =>
  (a ? parseLocalTime(a) : null) === (b ? parseLocalTime(b) : null);

/** The booking's times from a date on; only fields that differ are sent. */
export function seriesChanges(
  values: { windowStart: string; windowEnd: string; durationMinutes: number; endDate: string },
  booking: {
    window_start: string | null;
    window_end: string | null;
    duration_minutes: number | null;
    end_date: string | null;
  },
): Result {
  const start = parseLocalTime(values.windowStart);
  const end = values.windowEnd ? parseLocalTime(values.windowEnd) : null;
  if (start !== null && end !== null && end <= start) {
    return { ok: false, error: 'Latest arrival must be after the earliest' };
  }

  const changes: Record<string, string | number | null> = {};
  if (!sameTime(booking.window_start, values.windowStart))
    changes.window_start = values.windowStart;
  if (!sameTime(booking.window_end, values.windowEnd))
    changes.window_end = values.windowEnd || null;
  if (booking.duration_minutes !== values.durationMinutes) {
    changes.duration_minutes = values.durationMinutes;
  }
  if ((booking.end_date ?? '') !== values.endDate) changes.end_date = values.endDate || null;

  return Object.keys(changes).length === 0
    ? { ok: false, error: 'Nothing changed yet' }
    : { ok: true, changes };
}

/** The confirmation text for cancelling a booking. */
export function cancelMessage(
  preview: { cancelled: number; late: number; isLate: boolean },
  cutoffHours: number,
  status: 'requested' | 'confirmed',
): string {
  if (status === 'requested') return 'Your request will be withdrawn.';
  const visits = `${preview.cancelled} upcoming visit${preview.cancelled === 1 ? '' : 's'} will be cancelled; a visit already under way will still finish.`;
  return preview.isLate
    ? `This is a late cancellation: a visit starts within ${cutoffHours} hours. The business may still charge for it. ${visits}`
    : visits;
}
