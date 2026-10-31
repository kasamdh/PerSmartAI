import { formatTimeRange, groupByDay, sitterScheduleRange, startOfLocalDay } from '../time';

describe('sitterScheduleRange', () => {
  it('covers local today and tomorrow, starting at local midnight', () => {
    const now = new Date(2026, 9, 31, 15, 30); // Oct 31, 3:30pm local
    const { from, to } = sitterScheduleRange(now);

    expect(from).toEqual(new Date(2026, 9, 31, 0, 0));
    expect(to).toEqual(new Date(2026, 10, 2, 0, 0));
    expect(from <= now && now < to).toBe(true);
  });

  it('uses calendar days across a DST change', () => {
    // US DST ends Nov 1, 2026; the range still ends at local midnight.
    const { to } = sitterScheduleRange(new Date(2026, 9, 31, 23, 0));
    expect(to.getHours()).toBe(0);
    expect(to.getDate()).toBe(2);
  });
});

describe('formatTimeRange', () => {
  it('shows UTC instants in the given time zone', () => {
    const text = formatTimeRange('2026-10-31T14:00:00Z', '2026-10-31T14:30:00Z', {
      locale: 'en-US',
      timeZone: 'America/New_York',
    });
    expect(text.replace(/ /g, ' ')).toBe('10:00 AM – 10:30 AM');
  });
});

describe('groupByDay', () => {
  const now = new Date(2026, 9, 31, 9, 0);
  const at = (day: number, hour: number) => ({
    id: `${day}-${hour}`,
    scheduled_start: new Date(2026, 9, day, hour).toISOString(),
  });

  it('splits visits into Today and Tomorrow, dropping empty sections', () => {
    const sections = groupByDay([at(31, 8), at(31, 23), at(32, 7)], now); // day 32 = Nov 1
    expect(sections.map((s) => s.title)).toEqual(['Today', 'Tomorrow']);
    expect(sections[0].data.map((v) => v.id)).toEqual(['31-8', '31-23']);
    expect(sections[1].data.map((v) => v.id)).toEqual(['32-7']);
  });

  it('returns no sections when there are no visits', () => {
    expect(groupByDay([], now)).toEqual([]);
  });

  it('treats local midnight as the start of a new day', () => {
    const sections = groupByDay(
      [{ scheduled_start: startOfLocalDay(new Date(2026, 10, 1)).toISOString() }],
      now,
    );
    expect(sections.map((s) => s.title)).toEqual(['Tomorrow']);
  });
});
