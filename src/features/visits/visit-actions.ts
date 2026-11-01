import type { Coords } from '@/lib/location';
import type { Enums, TablesUpdate } from '@/types/database';

export type VisitStatus = Enums<'visit_status'>;
export type VisitActionKind = 'on_the_way' | 'check_in' | 'check_out';

export type VisitAction = {
  kind: VisitActionKind;
  label: string;
};

const START_TRIP: VisitAction = { kind: 'on_the_way', label: 'Start trip' };
const CHECK_IN: VisitAction = { kind: 'check_in', label: 'Check in' };
const CHECK_OUT: VisitAction = { kind: 'check_out', label: 'Check out' };

/** The one big button a sitter sees for a visit in this status. */
export function primaryActionFor(status: VisitStatus): VisitAction | null {
  switch (status) {
    case 'scheduled':
      return START_TRIP;
    case 'on_the_way':
      return CHECK_IN;
    case 'arrived':
    case 'in_progress':
      return CHECK_OUT;
    default:
      return null;
  }
}

/** Optional smaller action shown next to the primary one (already there: check in). */
export function secondaryActionFor(status: VisitStatus): VisitAction | null {
  return status === 'scheduled' ? CHECK_IN : null;
}

/**
 * The visits row update for an action. Only touches columns sitters are allowed
 * to change (see guard_visit_update). Times are UTC ISO strings. A check-out
 * summary is saved only when it has text.
 */
export function buildVisitUpdate(
  action: VisitActionKind,
  now: Date,
  coords: Coords | null,
  summary?: string,
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
    case 'check_out': {
      const note = summary?.trim();
      return {
        status: 'completed',
        check_out_at: at,
        check_out_lat: coords?.lat ?? null,
        check_out_lng: coords?.lng ?? null,
        ...(note ? { summary_note: note.slice(0, SUMMARY_MAX_LENGTH) } : {}),
      };
    }
  }
}

export const SUMMARY_MAX_LENGTH = 500;

/** Quick phrases a sitter can tap instead of typing (one hand on the leash). */
export const SUMMARY_PHRASES = [
  'All good!',
  'Ate everything.',
  'Ate a little.',
  'Good walk.',
  'Lots of cuddles.',
  'A bit anxious at first.',
  'Litter box cleaned.',
  'Water refilled.',
];

/** Adds a phrase to the summary as its own sentence, without duplicating it. */
export function appendPhrase(text: string, phrase: string): string {
  const current = text.trim();
  if (current.includes(phrase)) return current;
  return current ? `${current} ${phrase}` : phrase;
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
