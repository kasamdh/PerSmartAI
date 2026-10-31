import {
  describeRecurrence,
  describeSchedule,
  formatCalendarDate,
  formatClock,
} from '../booking-text';

describe('formatClock', () => {
  it.each([
    ['00:00:00', '12:00 AM'],
    ['09:05:00', '9:05 AM'],
    ['12:00:00', '12:00 PM'],
    ['13:30:00', '1:30 PM'],
    ['23:59', '11:59 PM'],
  ])('%s → %s', (input, expected) => {
    expect(formatClock(input)).toBe(expected);
  });
});

describe('formatCalendarDate', () => {
  it('formats the calendar date without shifting it across time zones', () => {
    expect(formatCalendarDate('2026-11-01')).toBe('Nov 1');
    expect(formatCalendarDate('2026-12-31')).toBe('Dec 31');
  });
});

describe('describeRecurrence', () => {
  it('reads common rules aloud', () => {
    expect(describeRecurrence('FREQ=WEEKLY;BYDAY=MO,WE,FR')).toBe('Every Mon, Wed, Fri');
    expect(describeRecurrence('RRULE:FREQ=DAILY')).toBe('Every day');
    expect(describeRecurrence('FREQ=WEEKLY')).toBe('Every week');
    expect(describeRecurrence('FREQ=MONTHLY')).toBe('Repeats');
    expect(describeRecurrence(null)).toBeNull();
  });
});

describe('describeSchedule', () => {
  const base = {
    service_type: 'drop_in' as const,
    recurrence_rule: null,
    start_date: '2026-11-02',
    end_date: null,
    window_start: null,
    window_end: null,
  };

  it('describes a recurring drop-in with its window and date range', () => {
    expect(
      describeSchedule({
        ...base,
        recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
        end_date: '2026-12-31',
        window_start: '11:00:00',
        window_end: '13:00:00',
      }),
    ).toBe('Every Mon, Wed, Fri · 11:00 AM–1:00 PM · Nov 2 – Dec 31');
  });

  it('describes an open-ended recurring booking', () => {
    expect(
      describeSchedule({ ...base, recurrence_rule: 'FREQ=DAILY', window_start: '08:00:00' }),
    ).toBe('Every day · 8:00 AM · from Nov 2');
  });

  it('describes a one-off walk', () => {
    expect(describeSchedule({ ...base, service_type: 'walk', window_start: '14:00:00' })).toBe(
      '2:00 PM · Nov 2',
    );
  });

  it('describes an overnight stay', () => {
    expect(
      describeSchedule({
        ...base,
        service_type: 'overnight',
        start_date: '2026-11-20',
        end_date: '2026-11-22',
      }),
    ).toBe('Overnight · Nov 20 → Nov 22');
  });
});
