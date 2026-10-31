// Human-readable booking schedules. Booking dates and times are wall-clock values in
// the business's time zone, so they're formatted as-is (never shifted to UTC).

const DAY_NAMES: Record<string, string> = {
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
  SU: 'Sun',
};

/** "11:00:00" → "11:00 AM", "13:30:00" → "1:30 PM". */
export function formatClock(time: string): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "2026-11-02" → "Nov 2" (no time zone shifting). */
export function formatCalendarDate(date: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "FREQ=WEEKLY;BYDAY=MO,WE,FR" → "Every Mon, Wed, Fri"; null → null. */
export function describeRecurrence(rule: string | null): string | null {
  if (!rule) return null;
  const parts = Object.fromEntries(
    rule
      .replace(/^RRULE:/i, '')
      .toUpperCase()
      .split(';')
      .map((p) => p.split('=') as [string, string]),
  );
  if (parts.FREQ === 'DAILY') return 'Every day';
  if (parts.FREQ === 'WEEKLY') {
    const days = (parts.BYDAY ?? '')
      .split(',')
      .map((d: string) => DAY_NAMES[d])
      .filter(Boolean);
    return days.length ? `Every ${days.join(', ')}` : 'Every week';
  }
  return 'Repeats';
}

type BookingSchedule = {
  service_type: 'drop_in' | 'walk' | 'overnight' | 'multi_day';
  recurrence_rule: string | null;
  start_date: string;
  end_date: string | null;
  window_start: string | null;
  window_end: string | null;
};

/** One line summarizing when a booking happens. */
export function describeSchedule(booking: BookingSchedule): string {
  const start = formatCalendarDate(booking.start_date);
  const end = booking.end_date ? formatCalendarDate(booking.end_date) : null;

  if (booking.service_type === 'overnight') {
    return `Overnight · ${start}${end && end !== start ? ` → ${end}` : ''}`;
  }

  const window = booking.window_start
    ? booking.window_end
      ? `${formatClock(booking.window_start)}–${formatClock(booking.window_end)}`
      : formatClock(booking.window_start)
    : null;
  const repeat = describeRecurrence(booking.recurrence_rule);
  const dates = end && end !== start ? `${start} – ${end}` : repeat ? `from ${start}` : start;

  return [repeat, window, dates].filter(Boolean).join(' · ');
}
