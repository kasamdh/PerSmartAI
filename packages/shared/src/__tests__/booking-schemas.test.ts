import {
  addDays,
  bookingRequestSchema,
  defaultCareTimes,
  defaultTimesFor,
  emptyBookingRequest,
  isCalendarDate,
  toRequestBookingArgs,
  type BookingRequestValues,
} from '../booking-schemas.ts';

const TODAY = '2026-11-01';

const valid = (overrides: Partial<BookingRequestValues> = {}): BookingRequestValues => ({
  ...emptyBookingRequest(TODAY),
  petIds: ['p1'],
  ...overrides,
});

function errorsFor(values: BookingRequestValues) {
  const result = bookingRequestSchema(TODAY).safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
}

describe('date helpers', () => {
  it('rejects dates that do not exist', () => {
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-1-5')).toBe(false);
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });
});

describe('bookingRequestSchema', () => {
  it('starts tomorrow with a 30 minute morning drop-in', () => {
    expect(emptyBookingRequest(TODAY)).toMatchObject({
      service: 'drop_in',
      repeat: 'once',
      startDate: '2026-11-02',
      arrivalStart: '09:00',
      durationMinutes: '30',
    });
  });

  it('accepts a valid one-off request', () => {
    expect(errorsFor(valid())).toEqual({});
  });

  it('needs at least one pet', () => {
    expect(errorsFor(valid({ petIds: [] }))).toEqual({ petIds: 'Choose at least one pet' });
  });

  it('rejects past, impossible, and far-future start dates', () => {
    expect(errorsFor(valid({ startDate: '2026-10-31' })).startDate).toBe(
      'Pick today or a later date',
    );
    expect(errorsFor(valid({ startDate: '2026-11-31' })).startDate).toMatch(/real date/);
    expect(errorsFor(valid({ startDate: '2027-11-02' })).startDate).toMatch(/next year/);
    expect(errorsFor(valid({ startDate: TODAY }))).toEqual({});
  });

  it('needs weekdays for a weekly booking', () => {
    expect(errorsFor(valid({ repeat: 'weekly', days: [] }))).toEqual({
      days: 'Choose at least one day',
    });
    expect(errorsFor(valid({ repeat: 'weekly', days: ['MO'] }))).toEqual({});
  });

  it('rejects a repeat that ends before it starts, but ignores the end date for one-offs', () => {
    expect(errorsFor(valid({ repeat: 'daily', endDate: '2026-11-01' })).endDate).toMatch(
      /before the start/,
    );
    expect(errorsFor(valid({ repeat: 'once', endDate: '2026-11-01' }))).toEqual({});
  });

  it('checks the arrival window order and format', () => {
    expect(errorsFor(valid({ arrivalStart: '10:00', arrivalEnd: '09:00' })).arrivalEnd).toMatch(
      /after the earliest/,
    );
    expect(errorsFor(valid({ arrivalStart: '25:00' })).arrivalStart).toMatch(/24-hour/);
    expect(errorsFor(valid({ arrivalStart: '9:00', arrivalEnd: '11:30' }))).toEqual({});
  });

  describe('overnight', () => {
    const overnight = (o: Partial<BookingRequestValues> = {}) =>
      valid({ service: 'overnight', ...defaultTimesFor('overnight'), endDate: '2026-11-04', ...o });

    it('allows leaving in the morning after arriving in the evening', () => {
      expect(errorsFor(overnight())).toEqual({});
    });

    it('needs an end date after the first night', () => {
      expect(errorsFor(overnight({ endDate: '' })).endDate).toBe('When will you be back?');
      expect(errorsFor(overnight({ endDate: '2026-11-02' })).endDate).toMatch(/after the first/);
    });

    it('needs a departure time', () => {
      expect(errorsFor(overnight({ arrivalEnd: '' })).arrivalEnd).toMatch(/leave/);
    });
  });
});

describe('toRequestBookingArgs', () => {
  it('maps a one-off visit without an end date or rule', () => {
    expect(toRequestBookingArgs(valid({ notes: '  ' }), TODAY)).toEqual({
      p_service_type: 'drop_in',
      p_pet_ids: ['p1'],
      p_start_date: '2026-11-02',
      p_end_date: undefined,
      p_window_start: '09:00',
      p_window_end: undefined,
      p_duration_minutes: 30,
      p_recurrence_rule: undefined,
      p_notes: undefined,
    });
  });

  it('builds a weekly rule with days in calendar order', () => {
    const args = toRequestBookingArgs(
      valid({
        service: 'walk',
        repeat: 'weekly',
        days: ['FR', 'MO', 'WE'],
        endDate: '2026-12-15',
        arrivalStart: '8:05',
        arrivalEnd: '10:00',
        durationMinutes: '60',
        notes: ' Leash in the hall ',
      }),
      TODAY,
    );
    expect(args).toMatchObject({
      p_service_type: 'walk',
      p_recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
      p_end_date: '2026-12-15',
      p_window_start: '08:05',
      p_window_end: '10:00',
      p_duration_minutes: 60,
      p_notes: 'Leash in the hall',
    });
  });

  it('maps every day with an open end', () => {
    expect(toRequestBookingArgs(valid({ repeat: 'daily' }), TODAY)).toMatchObject({
      p_recurrence_rule: 'FREQ=DAILY',
      p_end_date: undefined,
    });
  });

  it('drops repeat, weekdays, and duration for overnight stays', () => {
    const args = toRequestBookingArgs(
      valid({
        service: 'overnight',
        repeat: 'weekly',
        days: ['MO'],
        endDate: '2026-11-05',
        ...defaultTimesFor('overnight'),
      }),
      TODAY,
    );
    expect(args).toEqual({
      p_service_type: 'overnight',
      p_pet_ids: ['p1'],
      p_start_date: '2026-11-02',
      p_end_date: '2026-11-05',
      p_window_start: '19:00',
      p_window_end: '08:00',
      p_notes: undefined,
    });
  });

  it('throws on invalid values', () => {
    expect(() => toRequestBookingArgs(valid({ petIds: [] }), TODAY)).toThrow();
  });
});

describe('repeat options', () => {
  it('maps weekdays, every other week, and a visit count', () => {
    expect(toRequestBookingArgs(valid({ repeat: 'weekdays' }), TODAY)).toMatchObject({
      p_recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    });
    expect(
      toRequestBookingArgs(valid({ repeat: 'weekly', days: ['TU'], everyWeeks: '2' }), TODAY),
    ).toMatchObject({ p_recurrence_rule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU' });
    expect(toRequestBookingArgs(valid({ repeat: 'daily', count: '10' }), TODAY)).toMatchObject({
      p_recurrence_rule: 'FREQ=DAILY;COUNT=10',
      p_end_date: undefined,
    });
  });

  it('takes an end date or a number of visits, not both', () => {
    expect(errorsFor(valid({ repeat: 'daily', count: '5', endDate: '2026-11-20' })).count).toBe(
      'Choose an end date or a number of visits, not both',
    );
    expect(errorsFor(valid({ repeat: 'daily', count: '0' })).count).toMatch(/between 1 and/);
    expect(errorsFor(valid({ repeat: 'once', count: '5' }))).toEqual({});
  });
});

describe('multi-day stays', () => {
  const stay = (o: Partial<BookingRequestValues> = {}) =>
    valid({
      service: 'multi_day',
      endDate: '2026-11-05',
      careTimes: [
        { time: '18:00', label: 'Feed and walk', durationMinutes: '45' },
        { time: '08:00', label: 'Feed', durationMinutes: '15' },
      ],
      ...o,
    });

  it('sends care times in time order and no repeat rule or window', () => {
    expect(toRequestBookingArgs(stay({ repeat: 'daily' }), TODAY)).toEqual({
      p_service_type: 'multi_day',
      p_pet_ids: ['p1'],
      p_start_date: '2026-11-02',
      p_end_date: '2026-11-05',
      p_care_times: [
        { care_time: '08:00', duration_minutes: 15, label: 'Feed' },
        { care_time: '18:00', duration_minutes: 45, label: 'Feed and walk' },
      ],
      p_notes: undefined,
    });
  });

  it('needs an end date, care times, labels, and different times', () => {
    expect(errorsFor(stay({ endDate: '' })).endDate).toBe('When does the stay end?');
    expect(errorsFor(stay({ endDate: '2027-02-15' })).endDate).toMatch(/90 days/);
    expect(errorsFor(stay({ careTimes: [] })).careTimes).toBe('Add at least one care time');
    expect(
      errorsFor(stay({ careTimes: [{ time: '08:00', label: ' ', durationMinutes: '30' }] }))
        .careTimes,
    ).toBe('Give each care time a name');
    expect(
      errorsFor(
        stay({
          careTimes: [
            { time: '08:00', label: 'Feed', durationMinutes: '30' },
            { time: '08:00', label: 'Meds', durationMinutes: '30' },
          ],
        }),
      ).careTimes,
    ).toBe('Two care times can’t be at the same time');
  });
});

describe('defaultCareTimes', () => {
  it('suggests one care time per feeding or medication time', () => {
    expect(
      defaultCareTimes([
        {
          feeding_plans: [{ times: ['08:00:00', '18:00:00'] }],
          pet_medications: [{ schedule_times: ['08:00:00'] }],
        },
        { feeding_plans: [{ times: ['12:30:00'] }], pet_medications: [] },
      ]),
    ).toEqual([
      { time: '08:00', label: 'Feed + meds', durationMinutes: '30' },
      { time: '12:30', label: 'Feed', durationMinutes: '30' },
      { time: '18:00', label: 'Feed', durationMinutes: '30' },
    ]);
  });

  it('falls back to morning and evening care', () => {
    expect(defaultCareTimes([{ feeding_plans: [], pet_medications: [] }])).toEqual([
      { time: '08:00', label: 'Morning care', durationMinutes: '30' },
      { time: '18:00', label: 'Evening care', durationMinutes: '30' },
    ]);
  });
});
