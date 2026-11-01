// Grouping and wording for the admin scheduling screens. Visits are shown in the
// device's local time; change-request values are business wall-clock times.

import { formatCalendarDate, formatClock } from '@/features/bookings/booking-text';
import type { ProblemSummary } from '@/features/scheduling';
import { weekDates } from '@/features/scheduling/calendar';
import { toDateString } from '@/lib/wall-clock';

type Sitter = { id: string; full_name: string };
type VisitLike = { id: string; sitter_id: string | null; scheduled_start: string; status: string };

const byName = (a: Sitter, b: Sitter) => a.full_name.localeCompare(b.full_name);

export type SitterGroup<V> = { key: string; title: string; sitterId: string | null; visits: V[] };

/** Day view: unassigned visits first, then each sitter (A–Z), visits in time order. */
export function groupBySitter<V extends VisitLike>(
  visits: readonly V[],
  sitters: readonly Sitter[],
): SitterGroup<V>[] {
  const sorted = [...visits].sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
  const unassigned = sorted.filter((v) => v.sitter_id === null);
  return [
    ...(unassigned.length
      ? [{ key: 'unassigned', title: 'Needs a sitter', sitterId: null, visits: unassigned }]
      : []),
    ...[...sitters].sort(byName).map((s) => ({
      key: s.id,
      title: s.full_name,
      sitterId: s.id,
      visits: sorted.filter((v) => v.sitter_id === s.id),
    })),
  ];
}

/** Week view: each sitter's number of visits per day (cancelled and missed excluded). */
export function weekGrid(visits: readonly VisitLike[], sitters: readonly Sitter[], anyDay: string) {
  const days = weekDates(anyDay);
  const active = visits.filter((v) => v.status !== 'cancelled' && v.status !== 'missed');
  return {
    days,
    rows: [...sitters].sort(byName).map((s) => ({
      sitterId: s.id,
      name: s.full_name,
      counts: days.map(
        (day) =>
          active.filter(
            (v) => v.sitter_id === s.id && toDateString(new Date(v.scheduled_start)) === day,
          ).length,
      ),
    })),
  };
}

export type SitterCheck = {
  sitter_id: string;
  ok: boolean;
  blocking: number;
  problems: ProblemSummary[];
};

export type SitterOption = Sitter & {
  state: 'free' | 'warning' | 'blocked' | 'checking';
  note: string;
};

/** Sitters for a booking, free first, each with a one-line reason. */
export function rankSitterOptions(
  sitters: readonly Sitter[],
  checks: readonly SitterCheck[] | undefined,
): SitterOption[] {
  const order = { free: 0, warning: 1, blocked: 2, checking: 3 } as const;
  return sitters
    .map((s): SitterOption => {
      const check = checks?.find((c) => c.sitter_id === s.id);
      if (!check) return { ...s, state: 'checking', note: 'Checking schedule…' };
      if (!check.ok) {
        const reason = check.problems.find((p) => p.blocking)?.reasons[0] ?? 'Not available';
        return {
          ...s,
          state: 'blocked',
          note: `Can’t take ${check.blocking === 1 ? '1 visit' : `${check.blocking} visits`}: ${reason}`,
        };
      }
      if (check.problems.length > 0) {
        return { ...s, state: 'warning', note: check.problems[0].reasons[0] };
      }
      return { ...s, state: 'free', note: 'Free for every visit' };
    })
    .sort((a, b) => order[a.state] - order[b.state] || byName(a, b));
}

type Changes = Record<string, unknown>;

/** "Move to Nov 12 at 2:30 PM, 45 min"; "From Nov 16: arrive from 3:00 PM, until Dec 31". */
export function describeChangeRequest(request: {
  scope: string;
  from_date: string | null;
  changes: Changes;
}): string {
  const c = request.changes;
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  if (request.scope === 'visit') {
    const parts = [
      `Move to ${formatCalendarDate(String(c.date))} at ${formatClock(String(c.time))}`,
    ];
    if (typeof c.duration_minutes === 'number') parts.push(`${c.duration_minutes} min`);
    return parts.join(', ');
  }
  const parts: string[] = [];
  if ('window_start' in c) parts.push(`arrive from ${formatClock(String(c.window_start))}`);
  if ('window_end' in c) {
    parts.push(
      str(c.window_end) ? `latest ${formatClock(String(c.window_end))}` : 'no latest arrival',
    );
  }
  if ('duration_minutes' in c) parts.push(`${c.duration_minutes} min visits`);
  if ('recurrence_rule' in c) parts.push('new repeat days');
  if ('end_date' in c) {
    parts.push(str(c.end_date) ? `until ${formatCalendarDate(String(c.end_date))}` : 'no end date');
  }
  return `From ${formatCalendarDate(request.from_date ?? '')}: ${parts.join(', ')}`;
}
