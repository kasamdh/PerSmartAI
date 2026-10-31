import { formatDayAndTime, formatTime } from '@/features/visits/time';
import type { VisitStatus } from '@/features/visits/visit-actions';

type VisitLike = {
  status: VisitStatus;
  scheduled_start: string;
  scheduled_end: string;
  check_in_at: string | null;
  check_out_at: string | null;
};

const ACTIVE: VisitStatus[] = ['on_the_way', 'arrived', 'in_progress'];
export const RECENT_LIMIT = 5;

export function isActiveVisit(status: VisitStatus): boolean {
  return ACTIVE.includes(status);
}

/**
 * Splits an owner's visits into what's happening now, what's coming up (soonest
 * first), and recent history (newest first, capped). Cancelled visits are dropped.
 */
export function partitionOwnerVisits<T extends VisitLike>(
  visits: T[],
  now: Date,
): { active: T[]; upcoming: T[]; recent: T[] } {
  const active: T[] = [];
  const upcoming: T[] = [];
  const recent: T[] = [];

  for (const visit of visits) {
    if (visit.status === 'cancelled') continue;
    if (isActiveVisit(visit.status)) {
      active.push(visit);
    } else if (visit.status === 'scheduled' && new Date(visit.scheduled_end) >= now) {
      upcoming.push(visit);
    } else {
      recent.push(visit);
    }
  }

  const byStart = (a: T, b: T) => a.scheduled_start.localeCompare(b.scheduled_start);
  active.sort(byStart);
  upcoming.sort(byStart);
  recent.sort((a, b) => byStart(b, a));
  return { active, upcoming, recent: recent.slice(0, RECENT_LIMIT) };
}

/** Plain-language status for an owner, e.g. "Monika checked in at 2:05 PM". */
export function ownerStatusText(visit: VisitLike, sitterName: string | null, now: Date): string {
  const sitter = sitterName ?? 'Your sitter';
  switch (visit.status) {
    case 'scheduled':
      return `${sitterName ? `${sitter} · ` : ''}${formatDayAndTime(visit.scheduled_start, now)}`;
    case 'on_the_way':
      return `${sitter} is on the way`;
    case 'arrived':
    case 'in_progress':
      return visit.check_in_at
        ? `${sitter} checked in at ${formatTime(visit.check_in_at)}`
        : `${sitter} is with your pets`;
    case 'completed':
      return visit.check_out_at
        ? `Visit finished at ${formatTime(visit.check_out_at)}`
        : 'Visit finished';
    case 'missed':
      return 'Visit was missed';
    case 'cancelled':
      return 'Visit was cancelled';
  }
}
