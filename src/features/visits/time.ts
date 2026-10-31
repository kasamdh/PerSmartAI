// Visit times are stored as UTC instants and shown in the device's local time zone.

export function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addLocalDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days); // calendar days, so DST-length days stay correct
  return d;
}

/** Local midnight today up to (not including) local midnight the day after tomorrow. */
export function sitterScheduleRange(now: Date): { from: Date; to: Date } {
  const from = startOfLocalDay(now);
  return { from, to: addLocalDays(from, 2) };
}

type FormatOptions = { locale?: string; timeZone?: string };

export function formatTime(iso: string, { locale, timeZone }: FormatOptions = {}): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone });
}

export function formatTimeRange(startIso: string, endIso: string, options?: FormatOptions): string {
  return `${formatTime(startIso, options)} – ${formatTime(endIso, options)}`;
}

export type DaySection<T> = { title: 'Today' | 'Tomorrow'; data: T[] };

/** Splits visits (already sorted by start) into Today / Tomorrow sections, dropping empty ones. */
export function groupByDay<T extends { scheduled_start: string }>(
  visits: T[],
  now: Date,
): DaySection<T>[] {
  const tomorrow = addLocalDays(startOfLocalDay(now), 1);
  const dayAfter = addLocalDays(tomorrow, 1);
  const sections: DaySection<T>[] = [
    { title: 'Today', data: [] },
    { title: 'Tomorrow', data: [] },
  ];
  for (const visit of visits) {
    const start = new Date(visit.scheduled_start);
    if (start < tomorrow) {
      sections[0].data.push(visit);
    } else if (start < dayAfter) {
      sections[1].data.push(visit);
    }
  }
  return sections.filter((s) => s.data.length > 0);
}
