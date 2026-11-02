// The admin's live board of today's visits: late check-ins are flagged.

export const LATE_GRACE_MINUTES = 10;

type BoardVisit = { status: string; scheduled_start: string; check_in_at: string | null };

export type CheckInTiming = { late: boolean; minutesLate: number; label: string | null };

const ON_TIME: CheckInTiming = { late: false, minutesLate: 0, label: null };

/**
 * Late means checked in more than the grace period after the start, or not checked
 * in yet when the grace period has passed. Cancelled and missed visits are never late.
 */
export function checkInTiming(
  visit: BoardVisit,
  now: Date,
  graceMinutes = LATE_GRACE_MINUTES,
): CheckInTiming {
  if (visit.status === 'cancelled' || visit.status === 'missed') return ON_TIME;
  const start = Date.parse(visit.scheduled_start);
  const reference = visit.check_in_at ? Date.parse(visit.check_in_at) : now.getTime();
  const minutesLate = Math.floor((reference - start) / 60_000);
  if (minutesLate <= graceMinutes) return ON_TIME;
  if (visit.check_in_at) {
    return { late: true, minutesLate, label: `Checked in ${minutesLate} min late` };
  }
  if (visit.status !== 'scheduled' && visit.status !== 'on_the_way') return ON_TIME;
  return {
    late: true,
    minutesLate,
    label: `${visit.status === 'on_the_way' ? 'On the way' : 'Not checked in'} · ${minutesLate} min late`,
  };
}

const ACTIVE = ['on_the_way', 'arrived', 'in_progress'];

/** Late visits first (still waiting before already checked in), then active, then by start. */
export function sortForBoard<T extends BoardVisit>(visits: readonly T[], now: Date): T[] {
  const rank = (v: T) => {
    const timing = checkInTiming(v, now);
    if (timing.late && !v.check_in_at) return 0;
    if (ACTIVE.includes(v.status)) return 1;
    if (timing.late) return 2;
    return 3;
  };
  return [...visits].sort(
    (a, b) => rank(a) - rank(b) || a.scheduled_start.localeCompare(b.scheduled_start),
  );
}
