import type { Enums } from '@/types/database';

export type VisitStatus = Enums<'visit_status'>;
export type VisitActionKind = 'on_the_way' | 'check_in' | 'check_out';

export type VisitAction = {
  kind: VisitActionKind;
  label: string;
};

const START_TRIP: VisitAction = { kind: 'on_the_way', label: 'Start trip' };
const CHECK_IN: VisitAction = { kind: 'check_in', label: 'Check in' };
const CHECK_OUT: VisitAction = { kind: 'check_out', label: 'Check out' };

/**
 * The one big button a sitter sees for a visit in this status. Each leads to the
 * next status only (see visit-status.ts); the database refuses skipped steps.
 */
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
