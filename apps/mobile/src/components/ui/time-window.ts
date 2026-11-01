// Time windows ("arrive between 11:00 and 14:00"), as wall-clock "HH:MM" values in
// the business's time zone. Pure, so the picker's rules are tested.

export type TimeWindow = { start: string; end: string | null };

export type TimeWindowPreset = { key: string; label: string; start: string; end: string };

/** Friendly presets so most people pick a window with one tap. */
export const TIME_WINDOW_PRESETS: TimeWindowPreset[] = [
  { key: 'morning', label: 'Morning', start: '08:00', end: '11:00' },
  { key: 'midday', label: 'Midday', start: '11:00', end: '14:00' },
  { key: 'afternoon', label: 'Afternoon', start: '14:00', end: '17:00' },
  { key: 'evening', label: 'Evening', start: '17:00', end: '20:00' },
];

/** The preset this window matches, or null for a custom window. */
export function presetFor(window: TimeWindow): TimeWindowPreset | null {
  return TIME_WINDOW_PRESETS.find((p) => p.start === window.start && p.end === window.end) ?? null;
}

const minutes = (time: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/** A plain-words problem with the window, or null when it's fine. */
export function timeWindowError(window: TimeWindow): string | null {
  const start = minutes(window.start);
  if (start === null) return 'Choose a start time.';
  if (window.end === null || window.end === '') return null;
  const end = minutes(window.end);
  if (end === null) return 'Choose an end time.';
  if (end <= start) return 'The end time needs to be after the start time.';
  if (end - start < 30) return 'Leave at least 30 minutes between start and end.';
  return null;
}

/** "11:00–14:00" style label in 12-hour time, e.g. "11 AM – 2 PM". */
export function timeWindowLabel(window: TimeWindow): string {
  const fmt = (time: string) => {
    const m = minutes(time);
    if (m === null) return time;
    const h = Math.floor(m / 60);
    const min = m % 60;
    const suffix = h < 12 ? 'AM' : 'PM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return min === 0 ? `${hour} ${suffix}` : `${hour}:${String(min).padStart(2, '0')} ${suffix}`;
  };
  return window.end ? `${fmt(window.start)} – ${fmt(window.end)}` : `From ${fmt(window.start)}`;
}
