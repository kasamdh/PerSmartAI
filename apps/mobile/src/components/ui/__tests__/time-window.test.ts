import { presetFor, timeWindowError, timeWindowLabel } from '../time-window';

describe('time windows', () => {
  it('recognises the one-tap presets', () => {
    expect(presetFor({ start: '11:00', end: '14:00' })?.label).toBe('Midday');
    expect(presetFor({ start: '11:15', end: '14:00' })).toBeNull();
  });

  it('explains problems in plain words', () => {
    expect(timeWindowError({ start: '', end: null })).toBe('Choose a start time.');
    expect(timeWindowError({ start: '14:00', end: '11:00' })).toBe(
      'The end time needs to be after the start time.',
    );
    expect(timeWindowError({ start: '11:00', end: '11:15' })).toBe(
      'Leave at least 30 minutes between start and end.',
    );
    expect(timeWindowError({ start: '11:00', end: null })).toBeNull();
    expect(timeWindowError({ start: '11:00', end: '13:00' })).toBeNull();
  });

  it('labels windows in 12-hour time', () => {
    expect(timeWindowLabel({ start: '11:00', end: '14:00' })).toBe('11 AM – 2 PM');
    expect(timeWindowLabel({ start: '08:30', end: null })).toBe('From 8:30 AM');
    expect(timeWindowLabel({ start: '00:00', end: '12:00' })).toBe('12 AM – 12 PM');
  });
});
