// Sitter hours and visit counts per week, for payroll. Weeks run Monday–Sunday in
// the business's time zone. Worked time is check-in to check-out of completed
// visits; scheduled time is every visit that wasn't cancelled or missed.

import { weekDates } from './calendar.ts';
import { utcToLocal, type LocalDate } from './scheduling/index.ts';

type Sitter = { id: string; full_name: string };
type PayrollVisit = {
  sitter_id: string | null;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  check_in_at: string | null;
  check_out_at: string | null;
};

export type PayrollRow = {
  sitterId: string;
  name: string;
  scheduledVisits: number;
  completedVisits: number;
  missedVisits: number;
  scheduledMinutes: number;
  workedMinutes: number;
};

const minutesBetween = (a: string, b: string) =>
  Math.max(0, (Date.parse(b) - Date.parse(a)) / 60_000);

export function weeklyPayroll(
  visits: readonly PayrollVisit[],
  sitters: readonly Sitter[],
  anyDay: LocalDate,
  timeZone: string,
): { days: LocalDate[]; rows: PayrollRow[] } {
  const days = weekDates(anyDay);
  const inWeek = new Set(days);
  const week = visits.filter((v) =>
    inWeek.has(utcToLocal(new Date(v.scheduled_start), timeZone).date),
  );

  const rows = [...sitters]
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .map((sitter) => {
      const mine = week.filter((v) => v.sitter_id === sitter.id);
      const scheduled = mine.filter((v) => v.status !== 'cancelled' && v.status !== 'missed');
      const completed = mine.filter((v) => v.status === 'completed');
      const worked = completed.reduce(
        (sum, v) =>
          v.check_in_at && v.check_out_at
            ? sum + minutesBetween(v.check_in_at, v.check_out_at)
            : sum,
        0,
      );
      return {
        sitterId: sitter.id,
        name: sitter.full_name,
        scheduledVisits: scheduled.length,
        completedVisits: completed.length,
        missedVisits: mine.filter((v) => v.status === 'missed').length,
        scheduledMinutes: Math.round(
          scheduled.reduce((sum, v) => sum + minutesBetween(v.scheduled_start, v.scheduled_end), 0),
        ),
        workedMinutes: Math.round(worked),
      };
    });
  return { days, rows };
}

/** 90 → "1.50" (decimal hours, as payroll systems expect). */
export function decimalHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

/** One CSV field: quoted when needed, and never read as a spreadsheet formula. */
export function csvField(value: string | number): string {
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function payrollCsv(rows: readonly PayrollRow[], weekStart: LocalDate): string {
  const header = [
    'Week starting',
    'Sitter',
    'Visits scheduled',
    'Visits completed',
    'Visits missed',
    'Scheduled hours',
    'Worked hours',
  ];
  const lines = rows.map((r) => [
    weekStart,
    r.name,
    r.scheduledVisits,
    r.completedVisits,
    r.missedVisits,
    decimalHours(r.scheduledMinutes),
    decimalHours(r.workedMinutes),
  ]);
  return [header, ...lines].map((line) => line.map(csvField).join(',')).join('\r\n') + '\r\n';
}
