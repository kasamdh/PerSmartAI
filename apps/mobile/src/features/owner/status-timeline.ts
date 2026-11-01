import type { VisitStatus } from '@/features/visits/visit-status';

type TimelineVisit = {
  status: VisitStatus;
  on_the_way_at: string | null;
  check_in_at: string | null;
  started_at: string | null;
  check_out_at: string | null;
};

export type TimelineStep = {
  key: VisitStatus;
  label: string;
  at: string | null;
  state: 'done' | 'current' | 'upcoming';
};

const FLOW: { key: VisitStatus; label: string; field: keyof Omit<TimelineVisit, 'status'> }[] = [
  { key: 'on_the_way', label: 'On the way', field: 'on_the_way_at' },
  { key: 'arrived', label: 'Arrived', field: 'check_in_at' },
  { key: 'in_progress', label: 'Caring for your pets', field: 'started_at' },
  { key: 'completed', label: 'Finished', field: 'check_out_at' },
];

/** The owner's status timeline: each step with its time (On the way 11:52, Arrived 12:03…). */
export function statusTimeline(visit: TimelineVisit): TimelineStep[] {
  if (visit.status === 'missed' || visit.status === 'cancelled') {
    return [
      ...FLOW.filter((s) => visit[s.field]).map((s) => ({
        key: s.key,
        label: s.label,
        at: visit[s.field],
        state: 'done' as const,
      })),
      {
        key: visit.status,
        label: visit.status === 'missed' ? 'Visit missed' : 'Visit cancelled',
        at: null,
        state: 'current',
      },
    ];
  }
  const reached = FLOW.findIndex((s) => s.key === visit.status);
  return FLOW.map((s, i) => ({
    key: s.key,
    label: s.label,
    at: visit[s.field],
    state:
      i < reached || visit.status === 'completed' ? 'done' : i === reached ? 'current' : 'upcoming',
  }));
}
