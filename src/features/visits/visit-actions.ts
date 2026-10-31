import type { Coords } from '@/lib/location';
import type { Enums, TablesUpdate } from '@/types/database';

export type VisitStatus = Enums<'visit_status'>;
export type VisitActionKind = 'on_the_way' | 'check_in' | 'check_out';

export type VisitAction = {
  kind: VisitActionKind;
  label: string;
};

const ON_THE_WAY: VisitAction = { kind: 'on_the_way', label: 'On my way' };
const CHECK_IN: VisitAction = { kind: 'check_in', label: 'Check in' };
const CHECK_OUT: VisitAction = { kind: 'check_out', label: 'Check out' };

/** The one big button a sitter sees for a visit in this status. */
export function primaryActionFor(status: VisitStatus): VisitAction | null {
  switch (status) {
    case 'scheduled':
    case 'on_the_way':
      return CHECK_IN;
    case 'arrived':
    case 'in_progress':
      return CHECK_OUT;
    default:
      return null;
  }
}

/** Optional smaller action shown next to the primary one. */
export function secondaryActionFor(status: VisitStatus): VisitAction | null {
  return status === 'scheduled' ? ON_THE_WAY : null;
}

/**
 * The visits row update for an action. Only touches columns sitters are allowed
 * to change (see guard_visit_update). Times are UTC ISO strings.
 */
export function buildVisitUpdate(
  action: VisitActionKind,
  now: Date,
  coords: Coords | null,
): TablesUpdate<'visits'> {
  const at = now.toISOString();
  switch (action) {
    case 'on_the_way':
      return { status: 'on_the_way' };
    case 'check_in':
      return {
        status: 'in_progress',
        check_in_at: at,
        check_in_lat: coords?.lat ?? null,
        check_in_lng: coords?.lng ?? null,
      };
    case 'check_out':
      return {
        status: 'completed',
        check_out_at: at,
        check_out_lat: coords?.lat ?? null,
        check_out_lng: coords?.lng ?? null,
      };
  }
}

const STATUS_LABELS: Record<VisitStatus, string> = {
  scheduled: 'Scheduled',
  on_the_way: 'On the way',
  arrived: 'Arrived',
  in_progress: 'In progress',
  completed: 'Completed',
  missed: 'Missed',
  cancelled: 'Cancelled',
};

export function statusLabel(status: VisitStatus): string {
  return STATUS_LABELS[status];
}
