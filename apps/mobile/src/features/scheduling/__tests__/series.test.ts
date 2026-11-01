import {
  carryOverCancellations,
  localToUtc,
  moveVisit,
  planVisits,
  splitSeries,
  visitsToReplace,
  type SeriesBooking,
} from '@/features/scheduling';

const NY = 'America/New_York';
const at = (date: string, time: string) => localToUtc(date, time, NY).toISOString();

// Mon Nov 2, 2026.
const series = (overrides: Partial<SeriesBooking> = {}): SeriesBooking => ({
  service_type: 'walk',
  recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
  start_date: '2026-11-02',
  end_date: null,
  window_start: '12:00',
  window_end: null,
  duration_minutes: 30,
  care_times: [],
  ...overrides,
});

const TODAY = '2026-11-01';

describe('splitSeries', () => {
  it('ends the original the day before and starts a new series with the changes', () => {
    const result = splitSeries(series(), '2026-11-16', { window_start: '15:00' }, TODAY);
    expect(result).toEqual({
      kind: 'split',
      original: { end_date: '2026-11-15', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR' },
      next: series({ start_date: '2026-11-16', window_start: '15:00' }),
    });
  });

  it('updates the whole booking when nothing happened before the split date', () => {
    expect(splitSeries(series(), '2026-11-02', { duration_minutes: 45 }, TODAY)).toEqual({
      kind: 'update',
      booking: series({ duration_minutes: 45 }),
    });
    // Nov 1 has no visit, so splitting there is the same as editing everything.
    expect(splitSeries(series(), '2026-11-01', { duration_minutes: 45 }, TODAY)).toMatchObject({
      kind: 'update',
    });
  });

  it('keeps every-other-week series on the same weeks', () => {
    // Every other Monday from Nov 2: Nov 2, 16, 30, …
    const biweekly = series({ recurrence_rule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO' });
    const result = splitSeries(biweekly, '2026-11-09', { window_start: '15:00' }, TODAY);
    expect(result).toMatchObject({ kind: 'split', next: { start_date: '2026-11-16' } });
    if (result.kind !== 'split') throw new Error('expected split');
    const dates = planVisits(result.next, {
      timeZone: NY,
      now: new Date('2026-11-01T12:00:00Z'),
    }).map((v) => v.local_date);
    expect(dates.slice(0, 3)).toEqual(['2026-11-16', '2026-11-30', '2026-12-14']);
  });

  it('starts a changed rule on the split date', () => {
    const result = splitSeries(
      series(),
      '2026-11-09',
      { recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU' },
      TODAY,
    );
    expect(result).toMatchObject({
      kind: 'split',
      next: { start_date: '2026-11-09', recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU' },
    });
  });

  it('carries the remaining COUNT into the new series', () => {
    // 6 visits: Nov 2, 4, 6, 9, 11, 13. Two happen before Nov 6.
    const counted = series({ recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6' });
    const result = splitSeries(counted, '2026-11-06', { window_start: '15:00' }, TODAY);
    expect(result).toMatchObject({
      kind: 'split',
      original: { end_date: '2026-11-05' },
      next: { start_date: '2026-11-06', recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=4' },
    });
  });

  it('keeps the end date unless it changes', () => {
    const bounded = series({ end_date: '2026-12-31' });
    expect(splitSeries(bounded, '2026-11-16', {}, TODAY)).toMatchObject({
      next: { end_date: '2026-12-31' },
    });
    expect(splitSeries(bounded, '2026-11-16', { end_date: '2026-11-30' }, TODAY)).toMatchObject({
      next: { end_date: '2026-11-30' },
    });
  });

  it('rejects edits that cannot work', () => {
    expect(splitSeries(series(), '2026-10-30', {}, TODAY)).toEqual({
      kind: 'error',
      error: 'Visits in the past can’t be changed',
    });
    expect(splitSeries(series({ end_date: '2026-11-06' }), '2026-11-07', {}, TODAY)).toEqual({
      kind: 'error',
      error: 'There are no visits on or after that date',
    });
    expect(
      splitSeries(series(), '2026-11-16', { recurrence_rule: 'FREQ=MONTHLY' }, TODAY),
    ).toMatchObject({ kind: 'error', error: expect.stringContaining('daily and weekly') });
    expect(splitSeries(series(), '2026-11-16', { end_date: '2026-11-10' }, TODAY)).toMatchObject({
      kind: 'error',
      error: 'The new schedule has no visits',
    });
  });

  it('keeps the arrival window in order', () => {
    const windowed = series({ window_start: '11:00', window_end: '13:00' });
    expect(splitSeries(windowed, '2026-11-16', { window_start: '13:00' }, TODAY)).toEqual({
      kind: 'error',
      error: 'Latest arrival must be after the earliest',
    });
    expect(
      splitSeries(windowed, '2026-11-16', { window_start: '13:00', window_end: null }, TODAY),
    ).toMatchObject({ kind: 'split', next: { window_start: '13:00', window_end: null } });
  });

  it('updates overnight stays as a whole', () => {
    const stay = series({
      service_type: 'overnight',
      recurrence_rule: null,
      start_date: '2026-11-20',
      end_date: '2026-11-23',
    });
    expect(splitSeries(stay, '2026-11-21', { end_date: '2026-11-24' }, TODAY)).toEqual({
      kind: 'update',
      booking: { ...stay, end_date: '2026-11-24' },
    });
  });
});

describe('visitsToReplace', () => {
  const visits = [
    { id: 'past', scheduled_start: at('2026-11-02', '12:00'), status: 'completed' as const },
    { id: 'before', scheduled_start: at('2026-11-13', '12:00'), status: 'scheduled' as const },
    { id: 'under-way', scheduled_start: at('2026-11-16', '12:00'), status: 'in_progress' as const },
    { id: 'later', scheduled_start: at('2026-11-18', '12:00'), status: 'scheduled' as const },
    {
      id: 'early-on-day',
      scheduled_start: at('2026-11-16', '00:30'),
      status: 'scheduled' as const,
    },
    { id: 'cancelled', scheduled_start: at('2026-11-20', '12:00'), status: 'cancelled' as const },
  ];

  it('replaces scheduled visits from the split date on (local midnight), nothing else', () => {
    expect(visitsToReplace(visits, '2026-11-16', NY)).toEqual(['later', 'early-on-day']);
  });
});

describe('carryOverCancellations', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  const next = series({ start_date: '2026-11-16', window_start: '15:00' });
  const plan = planVisits(next, { timeZone: NY, now });

  it('moves cancelled dates to the new series so they are not generated again', () => {
    const cancelled = [
      { id: 'c1', scheduled_start: at('2026-11-18', '12:00'), care_time_id: null },
      { id: 'c2', scheduled_start: at('2026-11-17', '12:00'), care_time_id: null }, // not a visit day any more
    ];
    expect(carryOverCancellations(cancelled, plan, NY)).toEqual([
      { visit_id: 'c1', slot_start: at('2026-11-18', '15:00'), care_time_id: null },
    ]);
  });

  it('matches multi-day care times by id', () => {
    const multi = planVisits(
      series({
        service_type: 'multi_day',
        recurrence_rule: null,
        start_date: '2026-11-16',
        end_date: '2026-11-17',
        care_times: [
          { id: 'am', time: '08:00', duration_minutes: 20, label: 'Feed' },
          { id: 'pm', time: '18:00', duration_minutes: 20, label: 'Feed' },
        ],
      }),
      { timeZone: NY, now },
    );
    expect(
      carryOverCancellations(
        [{ id: 'c', scheduled_start: at('2026-11-17', '18:00'), care_time_id: 'pm' }],
        multi,
        NY,
      ),
    ).toEqual([{ visit_id: 'c', slot_start: at('2026-11-17', '18:00'), care_time_id: 'pm' }]);
  });
});

describe('moveVisit', () => {
  const visit = {
    scheduled_start: at('2026-11-18', '12:00'),
    scheduled_end: at('2026-11-18', '12:30'),
  };
  const now = new Date('2026-11-01T12:00:00Z');

  it('moves one visit to a new local date and time, keeping its length', () => {
    expect(moveVisit(visit, { date: '2026-11-19', time: '09:00' }, NY, now)).toEqual({
      ok: true,
      scheduled_start: at('2026-11-19', '09:00'),
      scheduled_end: at('2026-11-19', '09:30'),
    });
  });

  it('can change the length', () => {
    expect(
      moveVisit(visit, { date: '2026-11-18', time: '12:00', durationMinutes: 60 }, NY, now),
    ).toMatchObject({ scheduled_end: at('2026-11-18', '13:00') });
  });

  it('keeps its wall-clock time when moved across a DST change', () => {
    const october = {
      scheduled_start: at('2026-10-30', '12:00'),
      scheduled_end: at('2026-10-30', '12:30'),
    };
    expect(
      moveVisit(
        october,
        { date: '2026-11-02', time: '12:00' },
        NY,
        new Date('2026-10-01T00:00:00Z'),
      ),
    ).toMatchObject({ scheduled_start: '2026-11-02T17:00:00.000Z' });
  });

  it('refuses the past and bad lengths', () => {
    expect(moveVisit(visit, { date: '2026-10-31', time: '09:00' }, NY, now)).toEqual({
      ok: false,
      error: 'Pick a time in the future',
    });
    expect(
      moveVisit(visit, { date: '2026-11-19', time: '09:00', durationMinutes: 0 }, NY, now),
    ).toEqual({ ok: false, error: 'A visit needs a length' });
  });
});
