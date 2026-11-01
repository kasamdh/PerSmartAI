import {
  dateFromString,
  formatDateLabel,
  formatTimeLabel,
  timeFromString,
  toDateString,
  toTimeString,
} from '../wall-clock';

describe('wall-clock dates', () => {
  it('round-trips local calendar dates', () => {
    expect(toDateString(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(toDateString(dateFromString('2026-11-03')!)).toBe('2026-11-03');
  });

  it('rejects dates that do not exist', () => {
    expect(dateFromString('2026-02-29')).toBeNull();
    expect(dateFromString('2026-1-5')).toBeNull();
    expect(dateFromString('')).toBeNull();
  });

  it('labels dates with the weekday', () => {
    expect(formatDateLabel('2026-11-03')).toBe('Tue, Nov 3, 2026');
    expect(formatDateLabel('nope')).toBe('nope');
  });
});

describe('wall-clock times', () => {
  it('round-trips 24-hour times on a given day', () => {
    const base = new Date(2026, 10, 3, 15, 0);
    const t = timeFromString('08:05', base)!;
    expect(t.getDate()).toBe(3);
    expect(toTimeString(t)).toBe('08:05');
    expect(timeFromString('24:00')).toBeNull();
    expect(timeFromString('9:00')).toBeNull();
  });

  it('labels times in 12-hour form', () => {
    expect(formatTimeLabel('00:15')).toBe('12:15 AM');
    expect(formatTimeLabel('09:00')).toBe('9:00 AM');
    expect(formatTimeLabel('12:00')).toBe('12:00 PM');
    expect(formatTimeLabel('19:30')).toBe('7:30 PM');
    expect(formatTimeLabel('')).toBe('');
  });
});
