import {
  checkBookingForSitter,
  needsGeneration,
  localToUtc,
  seriesLastDate,
  summarizeProblems,
  visitLabel,
  type ScheduledBooking,
  type SitterSchedule,
} from '@/features/scheduling';

const NY = 'America/New_York';
const org = { timeZone: NY, travelBufferMinutes: 15 };
const now = new Date('2026-11-01T12:00:00Z'); // 7 AM Sunday in New York
const at = (date: string, time: string) => localToUtc(date, time, NY).toISOString();

const booking = (overrides: Partial<ScheduledBooking> = {}): ScheduledBooking => ({
  id: 'new',
  household_id: 'h-new',
  household_name: 'Patel home',
  service_type: 'walk',
  recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU',
  start_date: '2026-11-03',
  end_date: null,
  window_start: '12:00',
  window_end: null,
  duration_minutes: 30,
  care_times: [],
  ...overrides,
});

const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  start_time: '07:00',
  end_time: '20:00',
}));

const free: SitterSchedule = { visits: [], availability: allWeek, timeOff: [], bookings: [] };

describe('checkBookingForSitter', () => {
  it('plans 60 days of visits and finds no problems for a free sitter', () => {
    const result = checkBookingForSitter(booking(), free, org, now);
    expect(result.plan.length).toBe(9); // Tuesdays Nov 3 … Dec 29
    expect(result.plan[0].scheduled_start).toBe(at('2026-11-03', '12:00'));
    expect(result.check).toMatchObject({ ok: true, blockingCount: 0, problems: [] });
  });

  it('blocks on a real visit inside the generation window', () => {
    const sitter: SitterSchedule = {
      ...free,
      visits: [
        {
          id: 'v',
          booking_id: 'other',
          household_id: 'h-lee',
          scheduled_start: at('2026-11-10', '11:50'),
          scheduled_end: at('2026-11-10', '12:20'),
          status: 'scheduled',
          label: 'Drop-in at Lee home',
        },
      ],
    };
    const result = checkBookingForSitter(booking(), sitter, org, now);
    expect(result.check.ok).toBe(false);
    expect(summarizeProblems(result.check, NY)).toEqual([
      {
        local_date: '2026-11-10',
        start: at('2026-11-10', '12:00'),
        end: at('2026-11-10', '12:30'),
        blocking: true,
        reasons: ['Overlaps Drop-in at Lee home (Tue, Nov 10, 11:50 AM–12:20 PM)'],
      },
    ]);
  });

  it('finds conflicts beyond the generation window from the sitter’s other bookings', () => {
    // The sitter has another weekly Tuesday walk at 12:15 starting in March. Its
    // visits don't exist yet, but the new open-ended booking would collide.
    const sitter: SitterSchedule = {
      ...free,
      bookings: [
        booking({
          id: 'other',
          household_id: 'h-lee',
          household_name: 'Lee home',
          start_date: '2027-03-02',
          window_start: '12:15',
        }),
      ],
    };
    const result = checkBookingForSitter(booking(), sitter, org, now);
    expect(result.check.ok).toBe(false);
    const problems = summarizeProblems(result.check, NY);
    expect(problems[0]).toMatchObject({ local_date: '2027-03-02', blocking: true });
    expect(problems[0].reasons[0]).toBe(
      'Overlaps Walk at Lee home (Tue, Mar 2, 12:15 PM–12:45 PM)',
    );
    // Only the first 60 days are stored.
    expect(result.plan.every((v) => v.local_date <= '2026-12-31')).toBe(true);
  });

  it('does not project the sitter’s other bookings inside the window (real visits are used)', () => {
    const sitter: SitterSchedule = {
      ...free,
      bookings: [booking({ id: 'other', household_id: 'h-lee', start_date: '2026-11-03' })],
    };
    // Same Tuesday 12:00 slot, but only from day 61 on does the projection count.
    const result = checkBookingForSitter(booking(), sitter, org, now);
    expect(result.check.problems[0].candidate.local_date > '2026-12-31').toBe(true);
  });

  it('ignores the booking’s own visits and projections (re-confirming, reassigning)', () => {
    const sitter: SitterSchedule = {
      ...free,
      visits: [
        {
          id: 'mine',
          booking_id: 'new',
          household_id: 'h-new',
          scheduled_start: at('2026-11-03', '12:00'),
          scheduled_end: at('2026-11-03', '12:30'),
          status: 'scheduled',
        },
      ],
      bookings: [booking()],
    };
    expect(checkBookingForSitter(booking(), sitter, org, now).check.ok).toBe(true);
  });

  it('ignores the booking a split replaces', () => {
    const sitter: SitterSchedule = {
      ...free,
      visits: [
        {
          id: 'old-visit',
          booking_id: 'original',
          household_id: 'h-new',
          scheduled_start: at('2026-11-17', '12:00'),
          scheduled_end: at('2026-11-17', '12:30'),
          status: 'scheduled',
        },
      ],
      bookings: [booking({ id: 'original' })],
    };
    const next = booking({ id: 'next', start_date: '2026-11-17', window_start: '12:15' });
    expect(checkBookingForSitter(next, sitter, org, now).check.ok).toBe(false);
    expect(
      checkBookingForSitter(next, sitter, org, now, { ignoreBookingIds: ['original'] }).check.ok,
    ).toBe(true);
  });

  it('checks only from a date on, for this-and-future changes', () => {
    const result = checkBookingForSitter(booking(), free, org, now, { fromDate: '2026-11-17' });
    expect(result.plan[0].local_date).toBe('2026-11-17');
  });

  it('flags visits outside availability and approved time off', () => {
    const sitter: SitterSchedule = {
      ...free,
      availability: allWeek.filter((b) => b.weekday !== 2), // no Tuesdays
      timeOff: [],
    };
    const result = checkBookingForSitter(booking({ end_date: '2026-11-10' }), sitter, org, now);
    expect(summarizeProblems(result.check, NY).map((p) => p.reasons)).toEqual([
      ['Outside availability: not available on Tuesdays'],
      ['Outside availability: not available on Tuesdays'],
    ]);
  });
});

describe('seriesLastDate', () => {
  it('is the end date, or the last occurrence of COUNT / UNTIL rules', () => {
    expect(seriesLastDate(booking({ end_date: '2026-12-01' }))).toBe('2026-12-01');
    expect(seriesLastDate(booking())).toBeNull();
    expect(seriesLastDate(booking({ recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU;COUNT=3' }))).toBe(
      '2026-11-17',
    );
    expect(seriesLastDate(booking({ recurrence_rule: 'FREQ=DAILY;UNTIL=20261120' }))).toBe(
      '2026-11-20',
    );
    expect(seriesLastDate(booking({ recurrence_rule: null }))).toBe('2026-11-03');
  });
});

describe('needsGeneration', () => {
  it('is true while a booking can still have visits on or after today', () => {
    expect(needsGeneration(booking(), '2027-06-01')).toBe(true);
    expect(needsGeneration(booking({ end_date: '2026-11-20' }), '2026-11-21')).toBe(false);
    expect(
      needsGeneration(booking({ recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU;COUNT=2' }), '2026-11-11'),
    ).toBe(false);
    expect(needsGeneration(booking({ end_date: '2026-11-20' }), '2026-11-18')).toBe(false); // no Tuesday left
    expect(
      needsGeneration(
        booking({ service_type: 'overnight', recurrence_rule: null, end_date: '2026-11-05' }),
        '2026-11-05',
      ),
    ).toBe(true);
  });
});

describe('visitLabel', () => {
  it('names the service and the home', () => {
    expect(visitLabel('drop_in', 'Lee home')).toBe('Drop-in at Lee home');
    expect(visitLabel('multi_day', null)).toBe('Multi-day stay');
  });
});
