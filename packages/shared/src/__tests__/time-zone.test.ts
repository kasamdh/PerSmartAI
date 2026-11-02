import { localToUtc, utcToLocal } from '../scheduling/index.ts';

// 2026 DST changes:
//   America/New_York  Mar 8 (02:00 → 03:00), Nov 1 (02:00 → 01:00)
//   Europe/London     Mar 29 (01:00 → 02:00), Oct 25 (02:00 → 01:00)
//   Australia/Sydney  Apr 5 (03:00 → 02:00), Oct 4 (02:00 → 03:00)

const iso = (d: Date) => d.toISOString();

describe('localToUtc', () => {
  it('converts wall-clock times with the offset in effect that day', () => {
    expect(iso(localToUtc('2026-07-01', '12:00', 'America/New_York'))).toBe(
      '2026-07-01T16:00:00.000Z',
    );
    expect(iso(localToUtc('2026-12-01', '12:00', 'America/New_York'))).toBe(
      '2026-12-01T17:00:00.000Z',
    );
    expect(iso(localToUtc('2026-12-01', '12:00', 'UTC'))).toBe('2026-12-01T12:00:00.000Z');
  });

  it('keeps 12:00 PM at 12:00 PM across the New York spring change', () => {
    expect(iso(localToUtc('2026-03-07', '12:00', 'America/New_York'))).toBe(
      '2026-03-07T17:00:00.000Z',
    );
    expect(iso(localToUtc('2026-03-08', '12:00', 'America/New_York'))).toBe(
      '2026-03-08T16:00:00.000Z',
    );
    expect(iso(localToUtc('2026-03-09', '12:00', 'America/New_York'))).toBe(
      '2026-03-09T16:00:00.000Z',
    );
  });

  it('keeps 12:00 PM at 12:00 PM across the New York fall change', () => {
    expect(iso(localToUtc('2026-10-31', '12:00', 'America/New_York'))).toBe(
      '2026-10-31T16:00:00.000Z',
    );
    expect(iso(localToUtc('2026-11-01', '12:00', 'America/New_York'))).toBe(
      '2026-11-01T17:00:00.000Z',
    );
  });

  it('moves a time that does not exist (spring forward) past the gap', () => {
    // 02:30 never happens on Mar 8 in New York; it becomes 03:30 EDT.
    const instant = localToUtc('2026-03-08', '02:30', 'America/New_York');
    expect(iso(instant)).toBe('2026-03-08T07:30:00.000Z');
    expect(utcToLocal(instant, 'America/New_York').time).toBe('03:30');
  });

  it('picks the first of two identical times (fall back)', () => {
    // 01:30 happens twice on Nov 1 in New York; use the first (EDT).
    expect(iso(localToUtc('2026-11-01', '01:30', 'America/New_York'))).toBe(
      '2026-11-01T05:30:00.000Z',
    );
  });

  it('handles Europe/London changes', () => {
    expect(iso(localToUtc('2026-03-28', '12:00', 'Europe/London'))).toBe(
      '2026-03-28T12:00:00.000Z',
    );
    expect(iso(localToUtc('2026-03-29', '12:00', 'Europe/London'))).toBe(
      '2026-03-29T11:00:00.000Z',
    );
    expect(iso(localToUtc('2026-03-29', '01:30', 'Europe/London'))).toBe(
      '2026-03-29T01:30:00.000Z',
    );
    expect(iso(localToUtc('2026-10-25', '01:30', 'Europe/London'))).toBe(
      '2026-10-25T00:30:00.000Z',
    );
  });

  it('handles southern-hemisphere changes (Australia/Sydney)', () => {
    expect(iso(localToUtc('2026-04-04', '12:00', 'Australia/Sydney'))).toBe(
      '2026-04-04T01:00:00.000Z',
    );
    expect(iso(localToUtc('2026-04-05', '12:00', 'Australia/Sydney'))).toBe(
      '2026-04-05T02:00:00.000Z',
    );
    // 02:30 doesn't exist on Oct 4; it becomes 03:30 AEDT.
    const gap = localToUtc('2026-10-04', '02:30', 'Australia/Sydney');
    expect(utcToLocal(gap, 'Australia/Sydney')).toMatchObject({
      date: '2026-10-04',
      time: '03:30',
    });
  });

  it('treats 24:00 as midnight at the end of the day', () => {
    expect(iso(localToUtc('2026-12-31', '24:00', 'America/New_York'))).toBe(
      '2027-01-01T05:00:00.000Z',
    );
  });

  it('accepts Postgres times with fractional seconds', () => {
    expect(iso(localToUtc('2026-12-01', '09:15:30.431335', 'America/New_York'))).toBe(
      '2026-12-01T14:15:00.000Z',
    );
  });

  it('accepts HH:MM:SS from Postgres time columns', () => {
    expect(iso(localToUtc('2026-12-01', '09:15:00', 'America/New_York'))).toBe(
      '2026-12-01T14:15:00.000Z',
    );
  });

  it('rejects malformed input', () => {
    expect(() => localToUtc('2026-02-30', '12:00', 'UTC')).toThrow();
    expect(() => localToUtc('2026-02-01', '25:00', 'UTC')).toThrow();
    expect(() => localToUtc('2026-02-01', '12:00', 'Not/AZone')).toThrow();
  });
});

describe('utcToLocal', () => {
  it('returns the local date, time, weekday and minutes', () => {
    expect(utcToLocal(new Date('2026-11-01T04:30:00Z'), 'America/New_York')).toEqual({
      date: '2026-11-01',
      time: '00:30',
      weekday: 0,
      minutes: 30,
    });
    expect(utcToLocal(new Date('2026-11-01T03:59:00Z'), 'America/New_York')).toEqual({
      date: '2026-10-31',
      time: '23:59',
      weekday: 6,
      minutes: 23 * 60 + 59,
    });
  });

  it('round-trips every hour across a DST day', () => {
    for (let h = 0; h < 24; h++) {
      if (h === 2) continue; // doesn't exist on Mar 8
      const time = `${String(h).padStart(2, '0')}:15`;
      const instant = localToUtc('2026-03-08', time, 'America/New_York');
      expect(utcToLocal(instant, 'America/New_York')).toMatchObject({ date: '2026-03-08', time });
    }
  });
});
