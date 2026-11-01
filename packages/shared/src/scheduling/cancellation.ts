// Late cancellations. Mirrors private.stamp_booking_cancellation and
// private.cancel_visits_on_booking_cancel: cancelling a booking cancels its visits
// that are still scheduled and haven't ended; each is late if it starts within the
// organization's cutoff (cancellation_cutoff_hours).

import type { VisitStatus } from './conflicts.ts';

type CancellableVisit = { scheduled_start: string; scheduled_end: string; status: VisitStatus };

const HOUR_MS = 3_600_000;

const isCancellable = (visit: CancellableVisit, now: Date) =>
  visit.status === 'scheduled' && Date.parse(visit.scheduled_end) > now.getTime();

export function isLateCancellation(visit: CancellableVisit, now: Date, cutoffHours: number) {
  return (
    isCancellable(visit, now) &&
    Date.parse(visit.scheduled_start) < now.getTime() + cutoffHours * HOUR_MS
  );
}

/** What cancelling a whole booking now would do. */
export function cancellationPreview(
  visits: readonly CancellableVisit[],
  now: Date,
  cutoffHours: number,
): { cancelled: number; late: number; isLate: boolean } {
  const cancelled = visits.filter((v) => isCancellable(v, now));
  const late = cancelled.filter((v) => isLateCancellation(v, now, cutoffHours)).length;
  return { cancelled: cancelled.length, late, isLate: late > 0 };
}
