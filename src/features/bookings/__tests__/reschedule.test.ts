import { cancelMessage, seriesChanges, visitChanges } from '../reschedule';

describe('visitChanges', () => {
  it('sends the new local date and time, and the length only when it changed', () => {
    expect(visitChanges({ date: '2026-11-12', time: '14:30', durationMinutes: 30 }, 30)).toEqual({
      ok: true,
      changes: { date: '2026-11-12', time: '14:30' },
    });
    expect(visitChanges({ date: '2026-11-12', time: '14:30', durationMinutes: 45 }, 30)).toEqual({
      ok: true,
      changes: { date: '2026-11-12', time: '14:30', duration_minutes: 45 },
    });
  });

  it('needs a date and a time', () => {
    expect(visitChanges({ date: '', time: '14:30', durationMinutes: 30 }, 30)).toEqual({
      ok: false,
      error: 'Choose a new date and time',
    });
  });
});

describe('seriesChanges', () => {
  const booking = {
    window_start: '11:00:00',
    window_end: '13:00:00',
    duration_minutes: 30,
    end_date: null,
  };

  it('sends only what changed', () => {
    expect(
      seriesChanges(
        { windowStart: '14:00', windowEnd: '16:00', durationMinutes: 30, endDate: '' },
        booking,
      ),
    ).toEqual({ ok: true, changes: { window_start: '14:00', window_end: '16:00' } });
    expect(
      seriesChanges(
        { windowStart: '11:00', windowEnd: '13:00', durationMinutes: 60, endDate: '2026-12-31' },
        booking,
      ),
    ).toEqual({ ok: true, changes: { duration_minutes: 60, end_date: '2026-12-31' } });
  });

  it('clears the latest arrival and end date', () => {
    expect(
      seriesChanges(
        { windowStart: '11:00', windowEnd: '', durationMinutes: 30, endDate: '' },
        { ...booking, end_date: '2026-12-31' },
      ),
    ).toEqual({ ok: true, changes: { window_end: null, end_date: null } });
  });

  it('refuses an empty change and a window out of order', () => {
    expect(
      seriesChanges(
        { windowStart: '11:00', windowEnd: '13:00', durationMinutes: 30, endDate: '' },
        booking,
      ),
    ).toEqual({ ok: false, error: 'Nothing changed yet' });
    expect(
      seriesChanges(
        { windowStart: '14:00', windowEnd: '13:00', durationMinutes: 30, endDate: '' },
        booking,
      ),
    ).toEqual({ ok: false, error: 'Latest arrival must be after the earliest' });
  });
});

describe('cancelMessage', () => {
  it('warns about late cancellations with the business cutoff', () => {
    expect(cancelMessage({ cancelled: 3, late: 1, isLate: true }, 24, 'confirmed')).toBe(
      'This is a late cancellation: a visit starts within 24 hours. The business may still charge for it. 3 upcoming visits will be cancelled; a visit already under way will still finish.',
    );
  });

  it('is plain when on time or still a request', () => {
    expect(cancelMessage({ cancelled: 1, late: 0, isLate: false }, 24, 'confirmed')).toBe(
      '1 upcoming visit will be cancelled; a visit already under way will still finish.',
    );
    expect(cancelMessage({ cancelled: 0, late: 0, isLate: false }, 24, 'requested')).toBe(
      'Your request will be withdrawn.',
    );
  });
});
