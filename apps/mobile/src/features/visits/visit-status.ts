// The visit status flow, mirroring private.visit_transition_allowed (the database
// enforces it; this copy drives the buttons):
//
//   scheduled -> on_the_way -> arrived -> in_progress -> completed
//
// Sitters only take the next step. Admins may also mark a visit missed before
// check-in, or cancel one that isn't finished. Nobody skips a step or goes back.

import type { Coords } from '@/lib/location';
import type { Database, Enums } from '@/types/database';

import { SUMMARY_MAX_LENGTH, type VisitActionKind } from './visit-actions';

export type VisitStatus = Enums<'visit_status'>;

const NEXT: Partial<Record<VisitStatus, VisitStatus>> = {
  scheduled: 'on_the_way',
  on_the_way: 'arrived',
  arrived: 'in_progress',
  in_progress: 'completed',
};

const ADMIN_EXTRA: Partial<Record<VisitStatus, VisitStatus[]>> = {
  scheduled: ['missed', 'cancelled'],
  on_the_way: ['missed', 'cancelled'],
  arrived: ['cancelled'],
  in_progress: ['cancelled'],
};

/** The status a sitter's next step leads to, or null once the visit is closed. */
export function nextStatus(status: VisitStatus): VisitStatus | null {
  return NEXT[status] ?? null;
}

export function canTransition(
  from: VisitStatus,
  to: VisitStatus,
  role: 'sitter' | 'admin',
): boolean {
  if (NEXT[from] === to) return true;
  return role === 'admin' && (ADMIN_EXTRA[from] ?? []).includes(to);
}

export type AdvanceVisitArgs = Database['public']['Functions']['advance_visit']['Args'];

const STATUS_FOR_ACTION: Record<VisitActionKind, VisitStatus> = {
  on_the_way: 'on_the_way',
  check_in: 'arrived',
  check_out: 'completed',
};

/** A sitter action → advance_visit arguments. The server records the times. */
export function advanceArgs(
  visitId: string,
  action: VisitActionKind,
  coords: Coords | null,
  summary?: string,
): AdvanceVisitArgs {
  const note = summary?.trim();
  return {
    p_visit_id: visitId,
    p_status: STATUS_FOR_ACTION[action],
    ...(action !== 'on_the_way' && coords ? { p_lat: coords.lat, p_lng: coords.lng } : {}),
    ...(action === 'check_out' && note ? { p_summary: note.slice(0, SUMMARY_MAX_LENGTH) } : {}),
  };
}
