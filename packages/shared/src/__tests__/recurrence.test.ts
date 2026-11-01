import {
  buildRecurrenceRule,
  occurrenceDates,
  parseRecurrence,
  type RecurrenceSpec,
} from '../scheduling/index.ts';

const spec = (overrides: Partial<RecurrenceSpec>): RecurrenceSpec => ({
  freq: 'WEEKLY',
  interval: 1,
  byDay: [],
  until: null,
  count: null,
  ...overrides,
});

describe('parseRecurrence', () => {
  it('treats an empty rule as no recurrence', () => {
    expect(parseRecurrence(null)).toEqual({ ok: true, spec: null });
    expect(parseRecurrence('  ')).toEqual({ ok: true, spec: null });
  });

  it('parses daily and weekly rules', () => {
    expect(parseRecurrence('FREQ=DAILY')).toEqual({ ok: true, spec: spec({ freq: 'DAILY' }) });
    expect(parseRecurrence('RRULE:freq=weekly;byday=MO,WE,FR')).toEqual({
      ok: true,
      spec: spec({ byDay: ['MO', 'WE', 'FR'] }),
    });
  });

  it('parses INTERVAL, UNTIL and COUNT', () => {
    expect(parseRecurrence('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;UNTIL=20261231')).toEqual({
      ok: true,
      spec: spec({ interval: 2, byDay: ['TU'], until: '2026-12-31' }),
    });
    expect(parseRecurrence('FREQ=DAILY;UNTIL=20261231T235959Z')).toEqual({
      ok: true,
      spec: spec({ freq: 'DAILY', until: '2026-12-31' }),
    });
    expect(parseRecurrence('FREQ=DAILY;COUNT=10')).toEqual({
      ok: true,
      spec: spec({ freq: 'DAILY', count: 10 }),
    });
  });

  it.each([
    ['FREQ=MONTHLY', 'Only daily and weekly'],
    ['FREQ=HOURLY', 'Only daily and weekly'],
    ['BYDAY=MO', 'needs FREQ'],
    ['FREQ=WEEKLY;BYDAY=1MO', 'weekday'],
    ['FREQ=WEEKLY;BYDAY=XX', 'weekday'],
    ['FREQ=DAILY;INTERVAL=0', 'INTERVAL'],
    ['FREQ=DAILY;INTERVAL=abc', 'INTERVAL'],
    ['FREQ=DAILY;COUNT=0', 'COUNT'],
    ['FREQ=DAILY;COUNT=5;UNTIL=20261231', 'both'],
    ['FREQ=DAILY;UNTIL=20260230', 'UNTIL'],
    ['FREQ=DAILY;BYHOUR=9', 'BYHOUR'],
    ['FREQ=DAILY;FREQ=WEEKLY', 'twice'],
    ['FREQ', 'FREQ'],
  ])('rejects %s', (rule, message) => {
    const result = parseRecurrence(rule);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });
});

describe('buildRecurrenceRule', () => {
  it('writes canonical rules that parse back to the same spec', () => {
    const cases: RecurrenceSpec[] = [
      spec({ freq: 'DAILY' }),
      spec({ byDay: ['MO', 'FR'] }),
      spec({ interval: 2, byDay: ['SA', 'MO'], until: '2027-01-15' }),
      spec({ freq: 'DAILY', count: 3 }),
    ];
    for (const s of cases) {
      const rule = buildRecurrenceRule(s);
      const parsed = parseRecurrence(rule);
      expect(parsed).toEqual({
        ok: true,
        spec: { ...s, byDay: [...s.byDay].sort((a, b) => order(a) - order(b)) },
      });
    }
    expect(buildRecurrenceRule(spec({ interval: 2, byDay: ['WE', 'MO'] }))).toBe(
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE',
    );
    expect(buildRecurrenceRule(spec({ freq: 'DAILY', until: '2026-12-31' }))).toBe(
      'FREQ=DAILY;UNTIL=20261231',
    );
  });
});

const order = (d: string) => ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].indexOf(d);

describe('occurrenceDates', () => {
  const window = (from: string, to: string) => ({ from, to });

  it('without a rule: the start date only, or every day up to the end date', () => {
    expect(
      occurrenceDates(null, { start: '2026-11-03', end: null }, window('2026-11-01', '2026-12-31')),
    ).toEqual(['2026-11-03']);
    expect(
      occurrenceDates(
        null,
        { start: '2026-11-03', end: '2026-11-05' },
        window('2026-11-01', '2026-12-31'),
      ),
    ).toEqual(['2026-11-03', '2026-11-04', '2026-11-05']);
  });

  it('daily rules stop at the window, the end date, or UNTIL', () => {
    const series = { start: '2026-11-01', end: null };
    expect(occurrenceDates('FREQ=DAILY', series, window('2026-11-01', '2026-11-04'))).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ]);
    expect(
      occurrenceDates(
        'FREQ=DAILY',
        { start: '2026-11-01', end: '2026-11-02' },
        window('2026-11-01', '2026-11-30'),
      ),
    ).toEqual(['2026-11-01', '2026-11-02']);
    expect(
      occurrenceDates('FREQ=DAILY;UNTIL=20261102', series, window('2026-11-01', '2026-11-30')),
    ).toEqual(['2026-11-01', '2026-11-02']);
  });

  it('weekly rules pick the listed weekdays', () => {
    // Nov 2, 2026 is a Monday.
    expect(
      occurrenceDates(
        'FREQ=WEEKLY;BYDAY=MO,TH',
        { start: '2026-11-01', end: null },
        window('2026-11-01', '2026-11-15'),
      ),
    ).toEqual(['2026-11-02', '2026-11-05', '2026-11-09', '2026-11-12']);
  });

  it('weekly rules without BYDAY repeat on the start weekday', () => {
    expect(
      occurrenceDates(
        'FREQ=WEEKLY',
        { start: '2026-11-04', end: null },
        window('2026-11-01', '2026-11-30'),
      ),
    ).toEqual(['2026-11-04', '2026-11-11', '2026-11-18', '2026-11-25']);
  });

  it('every other week counts weeks from the series start, not the window', () => {
    const series = { start: '2026-11-02', end: null }; // Monday
    const rule = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO';
    expect(occurrenceDates(rule, series, window('2026-11-01', '2026-12-31'))).toEqual([
      '2026-11-02',
      '2026-11-16',
      '2026-11-30',
      '2026-12-14',
      '2026-12-28',
    ]);
    // A window that starts in an "off" week still keeps the same weeks.
    expect(occurrenceDates(rule, series, window('2026-11-09', '2026-11-30'))).toEqual([
      '2026-11-16',
      '2026-11-30',
    ]);
  });

  it('every 3 days', () => {
    expect(
      occurrenceDates(
        'FREQ=DAILY;INTERVAL=3',
        { start: '2026-11-01', end: null },
        window('2026-11-05', '2026-11-12'),
      ),
    ).toEqual(['2026-11-07', '2026-11-10']);
  });

  it('COUNT counts from the series start, even when the window starts later', () => {
    const series = { start: '2026-11-01', end: null };
    expect(
      occurrenceDates('FREQ=DAILY;COUNT=5', series, window('2026-11-03', '2026-11-30')),
    ).toEqual(['2026-11-03', '2026-11-04', '2026-11-05']);
    expect(
      occurrenceDates(
        'FREQ=WEEKLY;BYDAY=MO,FR;COUNT=3',
        { start: '2026-11-02', end: null },
        window('2026-11-01', '2026-12-31'),
      ),
    ).toEqual(['2026-11-02', '2026-11-06', '2026-11-09']);
  });

  it('never returns dates before the series start', () => {
    expect(
      occurrenceDates(
        'FREQ=DAILY',
        { start: '2026-11-10', end: null },
        window('2026-11-01', '2026-11-11'),
      ),
    ).toEqual(['2026-11-10', '2026-11-11']);
  });

  it('is empty when the window is empty or the series is over', () => {
    const series = { start: '2026-11-01', end: '2026-11-05' };
    expect(occurrenceDates('FREQ=DAILY', series, window('2026-11-10', '2026-11-20'))).toEqual([]);
    expect(occurrenceDates('FREQ=DAILY', series, window('2026-11-03', '2026-11-02'))).toEqual([]);
  });

  it('crosses DST changes without skipping or repeating a day', () => {
    const dates = occurrenceDates(
      'FREQ=DAILY',
      { start: '2026-10-30', end: null },
      window('2026-10-30', '2026-11-03'),
    );
    expect(dates).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']);
  });

  it('throws on unsupported rules', () => {
    expect(() =>
      occurrenceDates('FREQ=MONTHLY', { start: '2026-11-01', end: null }, window('a', 'b')),
    ).toThrow('Only daily and weekly');
  });
});
