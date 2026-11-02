// Words for the owner's home screen: plain, friendly, about their pets.
import { formatDayAndTime, formatTime, formatTimeRange } from '@/features/visits/time';

type HomeVisit = {
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  sitter: { full_name: string } | null;
  booking: { booking_pets: { pet: { name: string } | null }[] };
};

/** "Biscuit", "Biscuit and Mochi", "Biscuit, Mochi and Rex". */
export function joinPetNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'your pets';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export const visitPetNames = (visit: HomeVisit) =>
  joinPetNames(
    visit.booking.booking_pets.map((bp) => bp.pet?.name).filter((n): n is string => !!n),
  );

const firstName = (visit: HomeVisit) => visit.sitter?.full_name.split(' ')[0] ?? 'Your sitter';

/**
 * The one line under "Hi, Rudra": what's happening right now, otherwise the next
 * visit, otherwise a nudge to book.
 */
export function homeHeadline(
  groups: { active: HomeVisit[]; upcoming: HomeVisit[] },
  now: Date,
): string {
  const live = groups.active[0];
  if (live) {
    const pets = visitPetNames(live);
    return live.status === 'on_the_way'
      ? `${firstName(live)} is on the way to ${pets}`
      : `${firstName(live)} is with ${pets} now`;
  }
  const next = groups.upcoming[0];
  if (next) return `Next visit: ${formatDayAndTime(next.scheduled_start, now)}`;
  return 'No visits booked yet';
}

/** "Tomorrow, 12:00 – 12:30 PM · Monika" for a visit row. */
export function visitWhen(visit: HomeVisit, now: Date): string {
  const time = formatTime(visit.scheduled_start);
  const day = formatDayAndTime(visit.scheduled_start, now)
    .replace(` · ${time}`, '')
    .replace(` ${time}`, '');
  const range = formatTimeRange(visit.scheduled_start, visit.scheduled_end);
  return visit.sitter ? `${day}, ${range} · ${firstName(visit)}` : `${day}, ${range}`;
}
