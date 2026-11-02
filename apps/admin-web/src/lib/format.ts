// Display helpers. The admin web shows times in the business's time zone
// (organizations.timezone), wherever the admin's computer is.

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = timeZone + JSON.stringify(options);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, ...options });
    cache.set(key, f);
  }
  return f;
}

export const formatTime = (iso: string, timeZone: string) =>
  formatter(timeZone, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

export const formatDateTime = (iso: string, timeZone: string) =>
  formatter(timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));

/** "Mon, Nov 2" for a business-local YYYY-MM-DD date. */
export const formatDay = (date: string) =>
  formatter('UTC', { weekday: 'short', month: 'short', day: 'numeric' }).format(
    new Date(`${date}T12:00:00Z`),
  );

export const formatTimeRange = (start: string, end: string, timeZone: string) =>
  `${formatTime(start, timeZone)}–${formatTime(end, timeZone)}`;

export const SERVICE_LABELS: Record<string, string> = {
  drop_in: 'Drop-in',
  walk: 'Walk',
  overnight: 'Overnight',
  multi_day: 'Multi-day stay',
};

export const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  on_the_way: 'On the way',
  arrived: 'Checked in',
  in_progress: 'In progress',
  completed: 'Completed',
  missed: 'Missed',
  cancelled: 'Cancelled',
};

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';
