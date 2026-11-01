import { cancellationPreview, isLateCancellation } from '../scheduling/index.ts';

const now = new Date('2026-11-10T12:00:00Z');
const visit = (startHours: number, lengthHours = 1, status = 'scheduled' as const) => ({
  scheduled_start: new Date(now.getTime() + startHours * 3_600_000).toISOString(),
  scheduled_end: new Date(now.getTime() + (startHours + lengthHours) * 3_600_000).toISOString(),
  status,
});

describe('isLateCancellation', () => {
  it('is late when the visit starts within the cutoff', () => {
    expect(isLateCancellation(visit(3), now, 24)).toBe(true);
    expect(isLateCancellation(visit(23.99), now, 24)).toBe(true);
  });

  it('is on time at or beyond the cutoff', () => {
    expect(isLateCancellation(visit(24), now, 24)).toBe(false);
    expect(isLateCancellation(visit(48), now, 24)).toBe(false);
  });

  it('is never late with a zero cutoff, except for a visit that has started', () => {
    expect(isLateCancellation(visit(1), now, 0)).toBe(false);
    expect(isLateCancellation(visit(-0.5), now, 0)).toBe(true);
  });

  it('ignores visits that are over', () => {
    expect(isLateCancellation(visit(-2), now, 24)).toBe(false);
  });
});

describe('cancellationPreview', () => {
  it('counts what a booking cancellation affects, matching the database trigger', () => {
    const preview = cancellationPreview(
      [
        visit(-30, 1, 'completed' as never), // over
        visit(-0.5, 1, 'in_progress' as never), // under way: left for the sitter
        visit(3),
        visit(30),
        visit(80),
      ],
      now,
      24,
    );
    expect(preview).toEqual({ cancelled: 3, late: 1, isLate: true });
  });

  it('is on time when nothing starts within the cutoff', () => {
    expect(cancellationPreview([visit(30), visit(80)], now, 24)).toEqual({
      cancelled: 2,
      late: 0,
      isLate: false,
    });
  });
});
