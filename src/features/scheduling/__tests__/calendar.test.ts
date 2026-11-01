import {
  groupByLocalDate,
  localDayRange,
  mapsUrl,
  monthGrid,
  sitterWorkload,
  visitTaskCount,
  weekDates,
  weekStart,
} from '../calendar';

describe('weekStart / weekDates', () => {
  it('weeks start on Monday', () => {
    expect(weekStart('2026-11-04')).toBe('2026-11-02'); // Wed → Mon
    expect(weekStart('2026-11-02')).toBe('2026-11-02');
    expect(weekStart('2026-11-08')).toBe('2026-11-02'); // Sun → previous Mon
    expect(weekDates('2026-12-30')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
  });
});

describe('monthGrid', () => {
  it('covers the month in whole Monday-first weeks', () => {
    const grid = monthGrid(2026, 11); // Nov 2026 starts on a Sunday
    expect(grid[0][0]).toEqual({ date: '2026-10-26', inMonth: false });
    expect(grid[0][6]).toEqual({ date: '2026-11-01', inMonth: true });
    expect(grid.at(-1)!.at(-1)).toEqual({ date: '2026-12-06', inMonth: false });
    expect(grid).toHaveLength(6);
    expect(grid.flat().filter((d) => d.inMonth)).toHaveLength(30);
  });

  it('handles February', () => {
    const grid = monthGrid(2027, 2); // Feb 1, 2027 is a Monday
    expect(grid[0][0]).toEqual({ date: '2027-02-01', inMonth: true });
    expect(grid).toHaveLength(4);
  });
});

describe('localDayRange', () => {
  it('runs from local midnight of the first day to local midnight after the last', () => {
    const { from, to } = localDayRange('2026-11-01', '2026-11-01');
    expect(from.getHours()).toBe(0);
    expect(from.getDate()).toBe(1);
    expect(to.getDate()).toBe(2);
    expect(to.getHours()).toBe(0);
  });
});

describe('groupByLocalDate', () => {
  it('groups visits by the device-local day they start', () => {
    const at = (y: number, m: number, d: number, h: number) =>
      new Date(y, m - 1, d, h).toISOString();
    const groups = groupByLocalDate([
      { id: 'a', scheduled_start: at(2026, 11, 3, 9) },
      { id: 'b', scheduled_start: at(2026, 11, 3, 23) },
      { id: 'c', scheduled_start: at(2026, 11, 4, 0) },
    ]);
    expect([...groups.keys()]).toEqual(['2026-11-03', '2026-11-04']);
    expect(groups.get('2026-11-03')!.map((v) => v.id)).toEqual(['a', 'b']);
  });
});

describe('sitterWorkload', () => {
  const visit = (sitter: string | null, start: string, minutes: number, status = 'scheduled') => ({
    sitter_id: sitter,
    scheduled_start: start,
    scheduled_end: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
    status,
  });

  it('counts visits, hours and working days per sitter, ignoring cancelled ones', () => {
    const rows = sitterWorkload(
      [
        visit('s1', new Date(2026, 10, 2, 9).toISOString(), 30),
        visit('s1', new Date(2026, 10, 2, 13).toISOString(), 60),
        visit('s1', new Date(2026, 10, 4, 9).toISOString(), 30),
        visit('s1', new Date(2026, 10, 5, 9).toISOString(), 30, 'cancelled'),
        visit('s2', new Date(2026, 10, 3, 9).toISOString(), 45),
        visit(null, new Date(2026, 10, 3, 10).toISOString(), 30),
      ],
      [
        { id: 's1', full_name: 'Sam' },
        { id: 's2', full_name: 'Ana' },
        { id: 's3', full_name: 'Zoe' },
      ],
    );
    expect(rows).toEqual([
      { sitterId: 's1', name: 'Sam', visits: 3, minutes: 120, days: 2 },
      { sitterId: 's2', name: 'Ana', visits: 1, minutes: 45, days: 1 },
      { sitterId: 's3', name: 'Zoe', visits: 0, minutes: 0, days: 0 },
    ]);
  });
});

describe('visitTaskCount', () => {
  const NY = 'America/New_York';
  // 11:00–11:30 New York on Nov 10, 2026.
  const visit = {
    scheduled_start: '2026-11-10T16:00:00.000Z',
    scheduled_end: '2026-11-10T16:30:00.000Z',
  };

  it('counts feedings and medications due around the visit, plus its care time', () => {
    expect(
      visitTaskCount(
        visit,
        [
          {
            feeding_plans: [{ times: ['07:00', '11:30', '18:00'] }],
            pet_medications: [{ schedule_times: ['10:30:00', '22:00'] }],
          },
          { feeding_plans: [{ times: ['12:15'] }], pet_medications: [] },
        ],
        NY,
        { hasCareTime: true },
      ),
    ).toBe(4); // 11:30 feed, 10:30 meds, 12:15 feed (within an hour), care time
  });

  it('is zero when nothing is due', () => {
    expect(visitTaskCount(visit, [{ feeding_plans: [], pet_medications: [] }], NY)).toBe(0);
  });

  it('counts every due time across an overnight stay', () => {
    const night = {
      scheduled_start: '2026-11-11T00:00:00.000Z',
      scheduled_end: '2026-11-11T13:00:00.000Z',
    }; // 7 PM – 8 AM
    expect(
      visitTaskCount(
        night,
        [{ feeding_plans: [{ times: ['07:00', '19:30', '12:00'] }], pet_medications: [] }],
        NY,
      ),
    ).toBe(2);
  });
});

describe('mapsUrl', () => {
  const place = { address: '1 Main St, Springfield', lat: 40.1, lng: -75.2 };

  it('opens Apple Maps on iOS and the geo: handler on Android', () => {
    expect(mapsUrl(place, 'ios')).toBe(
      'http://maps.apple.com/?daddr=40.1,-75.2&q=1%20Main%20St%2C%20Springfield',
    );
    expect(mapsUrl(place, 'android')).toBe('geo:40.1,-75.2?q=1%20Main%20St%2C%20Springfield');
  });

  it('falls back to the address without coordinates, and to Google Maps on the web', () => {
    expect(mapsUrl({ address: '1 Main St', lat: null, lng: null }, 'ios')).toBe(
      'http://maps.apple.com/?daddr=1%20Main%20St',
    );
    expect(mapsUrl({ address: '1 Main St', lat: null, lng: null }, 'android')).toBe(
      'geo:0,0?q=1%20Main%20St',
    );
    expect(mapsUrl(place, 'web')).toBe(
      'https://www.google.com/maps/search/?api=1&query=1%20Main%20St%2C%20Springfield',
    );
  });
});
