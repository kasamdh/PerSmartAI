import { planVisits, utcToLocal, type PlanBooking } from '../scheduling/index.ts';

const NY = 'America/New_York';

const booking = (overrides: Partial<PlanBooking>): PlanBooking => ({
  service_type: 'walk',
  recurrence_rule: null,
  start_date: '2026-11-10',
  end_date: null,
  window_start: '12:00',
  window_end: null,
  duration_minutes: 30,
  care_times: [],
  ...overrides,
});

// 06:00 New York on Oct 30, 2026.
const now = new Date('2026-10-30T10:00:00Z');

const local = (iso: string) => {
  const p = utcToLocal(new Date(iso), NY);
  return `${p.date} ${p.time}`;
};

describe('planVisits: drop-ins and walks', () => {
  it('plans a one-off visit at the booked wall-clock time', () => {
    expect(planVisits(booking({}), { timeZone: NY, now })).toEqual([
      {
        local_date: '2026-11-10',
        slot_start: '2026-11-10T17:00:00.000Z',
        scheduled_start: '2026-11-10T17:00:00.000Z',
        scheduled_end: '2026-11-10T17:30:00.000Z',
        care_time_id: null,
      },
    ]);
  });

  it('keeps a daily 12:00 PM walk at 12:00 PM across the fall DST change', () => {
    const visits = planVisits(
      booking({ recurrence_rule: 'FREQ=DAILY', start_date: '2026-10-30', end_date: '2026-11-03' }),
      { timeZone: NY, now },
    );
    expect(visits.map((v) => local(v.scheduled_start))).toEqual([
      '2026-10-30 12:00',
      '2026-10-31 12:00',
      '2026-11-01 12:00',
      '2026-11-02 12:00',
      '2026-11-03 12:00',
    ]);
    // UTC moves by an hour; the visit length doesn't.
    expect(visits.map((v) => v.scheduled_start.slice(11, 16))).toEqual([
      '16:00',
      '16:00',
      '17:00',
      '17:00',
      '17:00',
    ]);
    for (const v of visits) {
      expect(Date.parse(v.scheduled_end) - Date.parse(v.scheduled_start)).toBe(30 * 60_000);
    }
  });

  it('keeps a weekly 12:00 PM walk at 12:00 PM across the spring DST change', () => {
    const springNow = new Date('2026-03-01T18:00:00Z'); // 1:00 PM EST
    const visits = planVisits(
      booking({
        recurrence_rule: 'FREQ=WEEKLY;BYDAY=SU',
        start_date: '2026-03-01',
        end_date: '2026-03-15',
      }),
      { timeZone: NY, now: springNow },
    );
    expect(visits.map((v) => local(v.scheduled_start))).toEqual([
      '2026-03-08 12:00',
      '2026-03-15 12:00',
    ]); // Mar 1's 12:00 visit is already over
    expect(visits.map((v) => v.scheduled_start)).toEqual([
      '2026-03-08T16:00:00.000Z',
      '2026-03-15T16:00:00.000Z',
    ]);
  });

  it('moves a visit booked inside the spring-forward gap to just after it', () => {
    const visits = planVisits(
      booking({ start_date: '2026-03-08', window_start: '02:30', service_type: 'drop_in' }),
      { timeZone: NY, now: new Date('2026-03-01T00:00:00Z') },
    );
    expect(visits.map((v) => local(v.scheduled_start))).toEqual(['2026-03-08 03:30']);
  });

  it('ends at window_end when there is no duration', () => {
    const [visit] = planVisits(
      booking({ window_start: '09:00', window_end: '11:00', duration_minutes: null }),
      { timeZone: NY, now },
    );
    expect(local(visit.scheduled_end)).toBe('2026-11-10 11:00');
  });

  it('falls back to a 9:00 AM, 30-minute visit', () => {
    const [visit] = planVisits(booking({ window_start: null, duration_minutes: null }), {
      timeZone: NY,
      now,
    });
    expect(local(visit.scheduled_start)).toBe('2026-11-10 09:00');
    expect(local(visit.scheduled_end)).toBe('2026-11-10 09:30');
  });

  it('generates open-ended series 60 days ahead (today included)', () => {
    const visits = planVisits(
      booking({ recurrence_rule: 'FREQ=DAILY', start_date: '2026-10-30' }),
      {
        timeZone: NY,
        now,
      },
    );
    expect(visits).toHaveLength(61);
    expect(visits[0].local_date).toBe('2026-10-30');
    expect(visits.at(-1)!.local_date).toBe('2026-12-29');
  });

  it('accepts a custom horizon or window', () => {
    const series = booking({ recurrence_rule: 'FREQ=DAILY', start_date: '2026-10-30' });
    expect(planVisits(series, { timeZone: NY, now, horizonDays: 6 })).toHaveLength(7);
    expect(
      planVisits(series, { timeZone: NY, now, window: { from: '2027-02-01', to: '2027-02-03' } }),
    ).toHaveLength(3);
  });

  it('skips visits that have already ended', () => {
    const lateNow = new Date('2026-10-30T16:45:00Z'); // 12:45 in New York
    const visits = planVisits(
      booking({ recurrence_rule: 'FREQ=DAILY', start_date: '2026-10-30', end_date: '2026-10-31' }),
      { timeZone: NY, now: lateNow },
    );
    expect(visits.map((v) => v.local_date)).toEqual(['2026-10-31']);
  });

  it('keeps a visit that is under way', () => {
    const during = new Date('2026-11-10T17:10:00Z');
    expect(planVisits(booking({}), { timeZone: NY, now: during })).toHaveLength(1);
  });
});

describe('planVisits: overnight stays', () => {
  const overnight = (overrides: Partial<PlanBooking>) =>
    booking({
      service_type: 'overnight',
      window_start: '19:00',
      window_end: '08:00',
      duration_minutes: null,
      ...overrides,
    });

  it('plans one visit from arrival on the start date to departure on the end date', () => {
    const visits = planVisits(overnight({ start_date: '2026-11-20', end_date: '2026-11-23' }), {
      timeZone: NY,
      now,
    });
    expect(visits).toHaveLength(1);
    expect(local(visits[0].scheduled_start)).toBe('2026-11-20 19:00');
    expect(local(visits[0].scheduled_end)).toBe('2026-11-23 08:00');
  });

  it('lasts 14 hours over the night the clocks go back', () => {
    const [visit] = planVisits(overnight({ start_date: '2026-10-31', end_date: '2026-11-01' }), {
      timeZone: NY,
      now,
    });
    expect(local(visit.scheduled_start)).toBe('2026-10-31 19:00');
    expect(local(visit.scheduled_end)).toBe('2026-11-01 08:00');
    expect((Date.parse(visit.scheduled_end) - Date.parse(visit.scheduled_start)) / 3_600_000).toBe(
      14,
    );
  });

  it('lasts 12 hours over the night the clocks go forward', () => {
    const [visit] = planVisits(overnight({ start_date: '2026-03-07', end_date: '2026-03-08' }), {
      timeZone: NY,
      now: new Date('2026-03-01T00:00:00Z'),
    });
    expect((Date.parse(visit.scheduled_end) - Date.parse(visit.scheduled_start)) / 3_600_000).toBe(
      12,
    );
  });

  it('defaults to 7 PM – 8 AM the next morning', () => {
    const [visit] = planVisits(
      overnight({ start_date: '2026-11-20', end_date: null, window_start: null, window_end: null }),
      { timeZone: NY, now },
    );
    expect(local(visit.scheduled_start)).toBe('2026-11-20 19:00');
    expect(local(visit.scheduled_end)).toBe('2026-11-21 08:00');
  });

  it('waits until the stay is inside the generation window', () => {
    const later = overnight({ start_date: '2027-03-01', end_date: '2027-03-03' });
    expect(planVisits(later, { timeZone: NY, now })).toEqual([]);
    expect(planVisits(later, { timeZone: NY, now: new Date('2027-01-15T12:00:00Z') })).toHaveLength(
      1,
    );
  });

  it('keeps a stay that is under way, and drops one that is over', () => {
    const stay = overnight({ start_date: '2026-11-20', end_date: '2026-11-23' });
    expect(planVisits(stay, { timeZone: NY, now: new Date('2026-11-22T12:00:00Z') })).toHaveLength(
      1,
    );
    expect(planVisits(stay, { timeZone: NY, now: new Date('2026-11-23T14:00:00Z') })).toEqual([]);
  });
});

describe('planVisits: multi-day stays', () => {
  const careTimes = [
    { id: 'evening', time: '18:00', duration_minutes: 45, label: 'Feed and walk' },
    { id: 'morning', time: '08:00', duration_minutes: 20, label: 'Feed' },
  ];

  it('creates one visit per care time each day, in time order', () => {
    const visits = planVisits(
      booking({
        service_type: 'multi_day',
        start_date: '2026-11-10',
        end_date: '2026-11-12',
        care_times: careTimes,
      }),
      { timeZone: NY, now },
    );
    expect(
      visits.map((v) => [local(v.scheduled_start), local(v.scheduled_end), v.care_time_id]),
    ).toEqual([
      ['2026-11-10 08:00', '2026-11-10 08:20', 'morning'],
      ['2026-11-10 18:00', '2026-11-10 18:45', 'evening'],
      ['2026-11-11 08:00', '2026-11-11 08:20', 'morning'],
      ['2026-11-11 18:00', '2026-11-11 18:45', 'evening'],
      ['2026-11-12 08:00', '2026-11-12 08:20', 'morning'],
      ['2026-11-12 18:00', '2026-11-12 18:45', 'evening'],
    ]);
  });

  it('keeps care times at their wall-clock time across DST', () => {
    const visits = planVisits(
      booking({
        service_type: 'multi_day',
        start_date: '2026-10-31',
        end_date: '2026-11-01',
        care_times: careTimes,
      }),
      { timeZone: NY, now },
    );
    expect(visits.map((v) => local(v.scheduled_start))).toEqual([
      '2026-10-31 08:00',
      '2026-10-31 18:00',
      '2026-11-01 08:00',
      '2026-11-01 18:00',
    ]);
  });

  it('merges care times that land on the same instant because of a DST gap', () => {
    const visits = planVisits(
      booking({
        service_type: 'multi_day',
        start_date: '2026-03-08',
        end_date: '2026-03-08',
        care_times: [
          { id: 'a', time: '02:30', duration_minutes: 15, label: 'Meds' },
          { id: 'b', time: '03:30', duration_minutes: 15, label: 'Feed' },
        ],
      }),
      { timeZone: NY, now: new Date('2026-03-01T00:00:00Z') },
    );
    expect(visits.map((v) => [local(v.scheduled_start), v.care_time_id])).toEqual([
      ['2026-03-08 03:30', 'a'],
    ]);
  });

  it('uses the booking window when no care times are set', () => {
    const visits = planVisits(
      booking({ service_type: 'multi_day', start_date: '2026-11-10', end_date: '2026-11-11' }),
      { timeZone: NY, now },
    );
    expect(visits.map((v) => local(v.scheduled_start))).toEqual([
      '2026-11-10 12:00',
      '2026-11-11 12:00',
    ]);
  });
});
