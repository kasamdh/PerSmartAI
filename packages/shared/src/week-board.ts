// The admin web schedule: a week of every sitter's visits, shown in the business's
// time zone, where a visit can be dragged to another sitter or day. Drops become
// schedule-booking `update_visit` arguments, so the server's conflict check runs.

import { weekDates } from './calendar.ts';
import { addDays, localToUtc, utcToLocal, type LocalDate } from './scheduling/index.ts';

type Sitter = { id: string; full_name: string };
export type BoardVisit = {
  id: string;
  sitter_id: string | null;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
};

export type BoardRow<V> = {
  key: string;
  sitterId: string | null;
  title: string;
  /** One list per day, Monday first, in start order. */
  cells: V[][];
};

/** Monday 00:00 to the next Monday 00:00 in `timeZone`, for the query. */
export function weekRange(anyDay: LocalDate, timeZone: string): { from: Date; to: Date } {
  const [monday] = weekDates(anyDay);
  return {
    from: localToUtc(monday, '00:00', timeZone),
    to: localToUtc(addDays(monday, 7), '00:00', timeZone),
  };
}

/** Rows: visits needing a sitter (only if any), then each sitter A–Z. Cancelled visits are left out. */
export function weekBoard<V extends BoardVisit>(
  visits: readonly V[],
  sitters: readonly Sitter[],
  anyDay: LocalDate,
  timeZone: string,
): { days: LocalDate[]; rows: BoardRow<V>[] } {
  const days = weekDates(anyDay);
  const shown = visits
    .filter((v) => v.status !== 'cancelled')
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
  const dayOf = (v: V) => utcToLocal(new Date(v.scheduled_start), timeZone).date;
  const cellsFor = (sitterId: string | null) =>
    days.map((day) => shown.filter((v) => v.sitter_id === sitterId && dayOf(v) === day));

  const unassigned = cellsFor(null);
  const rows: BoardRow<V>[] = unassigned.some((c) => c.length > 0)
    ? [{ key: 'unassigned', sitterId: null, title: 'Needs a sitter', cells: unassigned }]
    : [];
  for (const s of [...sitters].sort((a, b) => a.full_name.localeCompare(b.full_name))) {
    rows.push({ key: s.id, sitterId: s.id, title: s.full_name, cells: cellsFor(s.id) });
  }
  return { days, rows };
}

/** Only visits nobody has started can be moved or reassigned (the server agrees). */
export function canMoveVisit(visit: Pick<BoardVisit, 'status'>): boolean {
  return visit.status === 'scheduled';
}

export type DropTarget = { sitterId: string | null; date: LocalDate };

export type VisitChange = { sitter_id?: string; date?: LocalDate; time?: string };

/**
 * The update_visit arguments for dropping `visit` on a cell, or null when nothing
 * changes or the drop isn't allowed (visits can't be unassigned by dragging). A new
 * day keeps the visit's local start time.
 */
export function dropChange(
  visit: BoardVisit,
  target: DropTarget,
  timeZone: string,
): VisitChange | null {
  if (!canMoveVisit(visit) || target.sitterId === null) return null;
  const local = utcToLocal(new Date(visit.scheduled_start), timeZone);
  const change: VisitChange = {};
  if (target.sitterId !== visit.sitter_id) change.sitter_id = target.sitterId;
  if (target.date !== local.date) {
    change.date = target.date;
    change.time = local.time;
  }
  return Object.keys(change).length > 0 ? change : null;
}

/** Local start–end label, e.g. "09:00–09:30". */
export function boardTimeLabel(visit: BoardVisit, timeZone: string): string {
  const start = utcToLocal(new Date(visit.scheduled_start), timeZone).time;
  const end = utcToLocal(new Date(visit.scheduled_end), timeZone).time;
  return `${start}–${end}`;
}

/**
 * The update_visit arguments for an edited visit (sitter, local date and time), or
 * null when nothing changed. Moving sends both date and time, as the server expects.
 */
export function editChange(
  visit: BoardVisit,
  draft: { sitterId: string | null; date: LocalDate; time: string },
  timeZone: string,
): VisitChange | null {
  if (!canMoveVisit(visit)) return null;
  const local = utcToLocal(new Date(visit.scheduled_start), timeZone);
  const change: VisitChange = {};
  if (draft.sitterId && draft.sitterId !== visit.sitter_id) change.sitter_id = draft.sitterId;
  if (draft.date !== local.date || draft.time !== local.time) {
    change.date = draft.date;
    change.time = draft.time;
  }
  return Object.keys(change).length > 0 ? change : null;
}
