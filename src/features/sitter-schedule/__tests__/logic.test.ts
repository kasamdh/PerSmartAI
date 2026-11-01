import {
  availabilityByWeekday,
  timeOffRange,
  timeOffStatusLabel,
  validateAvailabilityBlock,
} from '../logic';

describe('validateAvailabilityBlock', () => {
  const existing = [
    { id: 'a', weekday: 1, start_time: '09:00:00', end_time: '12:00:00' },
    { id: 'b', weekday: 2, start_time: '09:00:00', end_time: '17:00:00' },
  ];

  it('accepts a block that ends after it starts and overlaps nothing', () => {
    expect(
      validateAvailabilityBlock({ weekday: 1, start_time: '13:00', end_time: '17:00' }, existing),
    ).toBeNull();
    expect(
      validateAvailabilityBlock({ weekday: 1, start_time: '12:00', end_time: '14:00' }, existing),
    ).toBeNull(); // touching is fine
  });

  it('rejects blocks that end before they start', () => {
    expect(
      validateAvailabilityBlock({ weekday: 3, start_time: '17:00', end_time: '09:00' }, existing),
    ).toBe('End time must be after the start time');
  });

  it('rejects blocks overlapping another on the same day', () => {
    expect(
      validateAvailabilityBlock({ weekday: 1, start_time: '11:00', end_time: '13:00' }, existing),
    ).toBe('Overlaps 9:00 AM–12:00 PM');
    expect(
      validateAvailabilityBlock({ weekday: 3, start_time: '11:00', end_time: '13:00' }, existing),
    ).toBeNull();
  });
});

describe('availabilityByWeekday', () => {
  it('lists Monday first with blocks in time order', () => {
    const days = availabilityByWeekday([
      { id: 'x', weekday: 0, start_time: '10:00:00', end_time: '12:00:00' },
      { id: 'y', weekday: 1, start_time: '13:00:00', end_time: '17:00:00' },
      { id: 'z', weekday: 1, start_time: '08:00:00', end_time: '12:00:00' },
    ]);
    expect(days.map((d) => d.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(days[0].blocks.map((b) => b.id)).toEqual(['z', 'y']);
    expect(days[6].blocks.map((b) => b.id)).toEqual(['x']);
  });
});

describe('timeOffRange', () => {
  const now = new Date(2026, 10, 1, 12, 0); // Nov 1, 2026, noon (device local)

  it('makes all-day time off run from midnight to midnight after the last day', () => {
    const result = timeOffRange(
      { startDate: '2026-11-10', endDate: '2026-11-12', allDay: true, startTime: '', endTime: '' },
      now,
    );
    expect(result).toEqual({
      ok: true,
      start_at: new Date(2026, 10, 10, 0, 0).toISOString(),
      end_at: new Date(2026, 10, 13, 0, 0).toISOString(),
    });
  });

  it('uses the times for part-day time off', () => {
    expect(
      timeOffRange(
        {
          startDate: '2026-11-10',
          endDate: '2026-11-10',
          allDay: false,
          startTime: '13:00',
          endTime: '17:30',
        },
        now,
      ),
    ).toEqual({
      ok: true,
      start_at: new Date(2026, 10, 10, 13, 0).toISOString(),
      end_at: new Date(2026, 10, 10, 17, 30).toISOString(),
    });
  });

  it('rejects ranges that end first, are in the past, or are missing times', () => {
    expect(
      timeOffRange(
        {
          startDate: '2026-11-12',
          endDate: '2026-11-10',
          allDay: true,
          startTime: '',
          endTime: '',
        },
        now,
      ),
    ).toEqual({ ok: false, error: 'The last day can’t be before the first' });
    expect(
      timeOffRange(
        {
          startDate: '2026-11-10',
          endDate: '2026-11-10',
          allDay: false,
          startTime: '17:00',
          endTime: '09:00',
        },
        now,
      ),
    ).toEqual({ ok: false, error: 'End time must be after the start time' });
    expect(
      timeOffRange(
        {
          startDate: '2026-10-30',
          endDate: '2026-10-31',
          allDay: true,
          startTime: '',
          endTime: '',
        },
        now,
      ),
    ).toEqual({ ok: false, error: 'Time off must end in the future' });
    expect(
      timeOffRange(
        {
          startDate: '2026-11-10',
          endDate: '2026-11-10',
          allDay: false,
          startTime: '',
          endTime: '',
        },
        now,
      ),
    ).toEqual({ ok: false, error: 'Choose start and end times' });
    expect(
      timeOffRange(
        { startDate: '', endDate: '2026-11-10', allDay: true, startTime: '', endTime: '' },
        now,
      ),
    ).toEqual({ ok: false, error: 'Choose the dates' });
  });
});

describe('timeOffStatusLabel', () => {
  it('reads plainly', () => {
    expect(timeOffStatusLabel('requested')).toBe('Waiting for approval');
    expect(timeOffStatusLabel('approved')).toBe('Approved');
    expect(timeOffStatusLabel('declined')).toBe('Declined');
  });
});
