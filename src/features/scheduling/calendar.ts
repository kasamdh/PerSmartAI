// Calendar and list helpers for the scheduling screens. Visits are shown in the
// device's local time zone; wall-clock care times (feeding, medication) are read in
// the organization's zone.

import { dateFromString, toDateString } from '@/lib/wall-clock';

import { addDays, localToUtc, utcToLocal, weekdayOf, type LocalDate } from './index';

/** The Monday on or before `date`. */
export function weekStart(date: LocalDate): LocalDate {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

/** Monday … Sunday of the week containing `date`. */
export function weekDates(date: LocalDate): LocalDate[] {
  const monday = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export type GridDay = { date: LocalDate; inMonth: boolean };

/** Monday-first weeks covering the month (`month` is 1–12). */
export function monthGrid(year: number, month: number): GridDay[][] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const weeks: GridDay[][] = [];
  for (let monday = weekStart(first); monday < nextMonth; monday = addDays(monday, 7)) {
    weeks.push(
      weekDates(monday).map((date) => ({ date, inMonth: date >= first && date < nextMonth })),
    );
  }
  return weeks;
}

/** Device-local midnight of `first` up to local midnight after `last`, for queries. */
export function localDayRange(first: LocalDate, last: LocalDate): { from: Date; to: Date } {
  const from = dateFromString(first);
  const end = dateFromString(addDays(last, 1));
  if (!from || !end) throw new RangeError(`Not a date range: ${first} – ${last}`);
  return { from, to: end };
}

/** Visits grouped by the device-local date they start, keeping their order. */
export function groupByLocalDate<T extends { scheduled_start: string }>(visits: readonly T[]) {
  const groups = new Map<LocalDate, T[]>();
  for (const visit of visits) {
    const date = toDateString(new Date(visit.scheduled_start));
    const list = groups.get(date);
    if (list) list.push(visit);
    else groups.set(date, [visit]);
  }
  return groups;
}

export type WorkloadRow = {
  sitterId: string;
  name: string;
  visits: number;
  minutes: number;
  /** Distinct device-local days with at least one visit. */
  days: number;
};

/** Visits, scheduled minutes and working days per sitter (cancelled and missed excluded). */
export function sitterWorkload(
  visits: readonly {
    sitter_id: string | null;
    scheduled_start: string;
    scheduled_end: string;
    status: string;
  }[],
  sitters: readonly { id: string; full_name: string }[],
): WorkloadRow[] {
  return sitters.map((sitter) => {
    const mine = visits.filter(
      (v) => v.sitter_id === sitter.id && v.status !== 'cancelled' && v.status !== 'missed',
    );
    return {
      sitterId: sitter.id,
      name: sitter.full_name,
      visits: mine.length,
      minutes: mine.reduce(
        (sum, v) => sum + (Date.parse(v.scheduled_end) - Date.parse(v.scheduled_start)) / 60_000,
        0,
      ),
      days: new Set(mine.map((v) => toDateString(new Date(v.scheduled_start)))).size,
    };
  });
}

/** Feeding or medication times count as part of a visit when due within this many minutes of it. */
export const TASK_SLACK_MINUTES = 60;

type PetCare = {
  feeding_plans: readonly { times: readonly string[] }[];
  pet_medications: readonly { schedule_times: readonly string[] }[];
};

/**
 * How many care tasks fall on this visit: each pet's feeding and medication times
 * (wall-clock in the organization's zone) due during the visit or within an hour of
 * it, plus the multi-day care time the visit was created for.
 */
export function visitTaskCount(
  visit: { scheduled_start: string; scheduled_end: string },
  pets: readonly PetCare[],
  timeZone: string,
  { hasCareTime = false }: { hasCareTime?: boolean } = {},
): number {
  const slack = TASK_SLACK_MINUTES * 60_000;
  const start = Date.parse(visit.scheduled_start) - slack;
  const end = Date.parse(visit.scheduled_end) + slack;

  // Each local date the padded visit touches.
  const firstDate = utcToLocal(start, timeZone).date;
  const lastDate = utcToLocal(end, timeZone).date;
  const dueTimes = pets.flatMap((pet) => [
    ...pet.feeding_plans.flatMap((f) => f.times),
    ...pet.pet_medications.flatMap((m) => m.schedule_times),
  ]);

  let count = hasCareTime ? 1 : 0;
  for (const time of dueTimes) {
    for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
      const due = localToUtc(date, time, timeZone).getTime();
      if (due >= start && due <= end) {
        count++;
        break;
      }
    }
  }
  return count;
}

/**
 * A link that opens directions to the household: Apple Maps on iOS, the system
 * maps app on Android (geo:), Google Maps on the web.
 */
export function mapsUrl(
  place: { address: string; lat: number | null; lng: number | null },
  os: 'ios' | 'android' | 'web' | string,
): string {
  const q = encodeURIComponent(place.address);
  const hasCoords = place.lat !== null && place.lng !== null;
  if (os === 'ios') {
    return hasCoords
      ? `http://maps.apple.com/?daddr=${place.lat},${place.lng}&q=${q}`
      : `http://maps.apple.com/?daddr=${q}`;
  }
  if (os === 'android') {
    return `geo:${hasCoords ? `${place.lat},${place.lng}` : '0,0'}?q=${q}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
