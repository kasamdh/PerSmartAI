// Wall-clock dates ("YYYY-MM-DD") and times ("HH:MM"), converted to and from the
// Date objects native pickers use. Dates are built in the device's local calendar,
// so nothing shifts across time zones.

const pad = (n: number) => String(n).padStart(2, '0');

/** A Date → "YYYY-MM-DD" in the device's local calendar. */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DD" → local midnight that day, or null if it isn't a real date. */
export function dateFromString(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
    ? date
    : null;
}

/** A Date → "HH:MM" (24-hour, local). */
export function toTimeString(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "HH:MM" → that time today (local), or null if it isn't a time. */
export function timeFromString(value: string, today = new Date()): Date | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const date = new Date(today);
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
}

/** "2026-11-03" → "Tue, Nov 3, 2026"; returns the input if it isn't a date. */
export function formatDateLabel(value: string, locale = 'en-US'): string {
  const date = dateFromString(value);
  return date
    ? date.toLocaleDateString(locale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : value;
}

/** "09:00" → "9:00 AM", "13:30" → "1:30 PM"; returns the input if it isn't a time. */
export function formatTimeLabel(value: string): string {
  const date = timeFromString(value);
  if (!date) return value;
  const h = date.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(date.getMinutes())} ${h >= 12 ? 'PM' : 'AM'}`;
}
