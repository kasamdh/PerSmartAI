import { checkInTiming, sortForBoard } from '../live-board';

const start = '2026-11-10T16:00:00.000Z';
const at = (minutes: number) => new Date(Date.parse(start) + minutes * 60_000);
const visit = (overrides: Record<string, unknown> = {}) => ({
  status: 'scheduled',
  scheduled_start: start,
  check_in_at: null as string | null,
  ...overrides,
});

describe('checkInTiming', () => {
  it('is fine before the start and within the grace period', () => {
    expect(checkInTiming(visit(), at(-30))).toEqual({ late: false, minutesLate: 0, label: null });
    expect(checkInTiming(visit(), at(10))).toEqual({ late: false, minutesLate: 0, label: null });
  });

  it('flags a visit nobody has checked in to yet', () => {
    expect(checkInTiming(visit(), at(25))).toEqual({
      late: true,
      minutesLate: 25,
      label: 'Not checked in · 25 min late',
    });
    expect(checkInTiming(visit({ status: 'on_the_way' }), at(11))).toMatchObject({
      late: true,
      label: 'On the way · 11 min late',
    });
  });

  it('flags a late check-in after the fact', () => {
    expect(
      checkInTiming(visit({ status: 'completed', check_in_at: at(18).toISOString() }), at(60)),
    ).toEqual({ late: true, minutesLate: 18, label: 'Checked in 18 min late' });
    expect(
      checkInTiming(visit({ status: 'in_progress', check_in_at: at(5).toISOString() }), at(60)),
    ).toEqual({ late: false, minutesLate: 0, label: null });
  });

  it('ignores cancelled and missed visits', () => {
    expect(checkInTiming(visit({ status: 'cancelled' }), at(60)).late).toBe(false);
    expect(checkInTiming(visit({ status: 'missed' }), at(60)).late).toBe(false);
  });

  it('uses a custom grace period', () => {
    expect(checkInTiming(visit(), at(6), 5).late).toBe(true);
  });
});

describe('sortForBoard', () => {
  it('puts late visits first, then active ones, then the rest by start time', () => {
    const now = at(30);
    const rows = sortForBoard(
      [
        { id: 'done', ...visit({ status: 'completed', check_in_at: at(0).toISOString() }) },
        { id: 'later', ...visit({ scheduled_start: at(120).toISOString() }) },
        { id: 'active', ...visit({ status: 'in_progress', check_in_at: at(2).toISOString() }) },
        { id: 'late', ...visit() },
      ],
      now,
    );
    expect(rows.map((r) => r.id)).toEqual(['late', 'active', 'done', 'later']);
  });
});
