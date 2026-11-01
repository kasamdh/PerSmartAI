import { canMoveVisit, dropChange, weekBoard, weekRange, boardTimeLabel } from '../week-board.ts';

const TZ = 'America/New_York';
const sitters = [
  { id: 's2', full_name: 'Zoe' },
  { id: 's1', full_name: 'Ana' },
];
const visit = (
  id: string,
  sitter: string | null,
  start: string,
  end: string,
  status = 'scheduled',
) => ({
  id,
  sitter_id: sitter,
  status,
  scheduled_start: start,
  scheduled_end: end,
});

describe('weekRange', () => {
  it("runs Monday to Monday in the business's zone", () => {
    const { from, to } = weekRange('2026-11-04', TZ);
    expect(from.toISOString()).toBe('2026-11-02T05:00:00.000Z');
    expect(to.toISOString()).toBe('2026-11-09T05:00:00.000Z');
  });

  it('spans the fall-back change (one 25-hour day)', () => {
    const { from, to } = weekRange('2026-10-28', TZ);
    expect(from.toISOString()).toBe('2026-10-26T04:00:00.000Z');
    expect(to.toISOString()).toBe('2026-11-02T05:00:00.000Z');
  });
});

describe('weekBoard', () => {
  it('puts each visit under its sitter and business-local day', () => {
    const visits = [
      // 23:30 Tuesday in New York is already Wednesday in UTC.
      visit('late', 's1', '2026-11-04T04:30:00Z', '2026-11-04T05:00:00Z'),
      visit('walk', 's2', '2026-11-02T14:00:00Z', '2026-11-02T14:30:00Z'),
      visit('gone', 's2', '2026-11-02T16:00:00Z', '2026-11-02T16:30:00Z', 'cancelled'),
    ];
    const board = weekBoard(visits, sitters, '2026-11-02', TZ);
    expect(board.days[0]).toBe('2026-11-02');
    expect(board.rows.map((r) => r.title)).toEqual(['Ana', 'Zoe']);
    expect(board.rows[0].cells[1].map((v) => v.id)).toEqual(['late']);
    expect(board.rows[1].cells[0].map((v) => v.id)).toEqual(['walk']);
  });

  it('adds a "Needs a sitter" row only when something is unassigned', () => {
    const board = weekBoard(
      [visit('open', null, '2026-11-05T15:00:00Z', '2026-11-05T15:30:00Z')],
      sitters,
      '2026-11-05',
      TZ,
    );
    expect(board.rows[0]).toMatchObject({ key: 'unassigned', sitterId: null });
    expect(board.rows[0].cells[3]).toHaveLength(1);
  });
});

describe('dropChange', () => {
  const walk = visit('v', 's1', '2026-11-02T14:00:00Z', '2026-11-02T14:30:00Z');

  it('reassigns when dropped on another sitter the same day', () => {
    expect(dropChange(walk, { sitterId: 's2', date: '2026-11-02' }, TZ)).toEqual({
      sitter_id: 's2',
    });
  });

  it('moves to another day at the same local time', () => {
    expect(dropChange(walk, { sitterId: 's1', date: '2026-11-04' }, TZ)).toEqual({
      date: '2026-11-04',
      time: '09:00',
    });
  });

  it('keeps the wall-clock time across a DST change', () => {
    // Fri Oct 30, 09:00 EDT → Mon Nov 2 stays 09:00 (now EST).
    const before = visit('d', 's1', '2026-10-30T13:00:00Z', '2026-10-30T13:30:00Z');
    expect(dropChange(before, { sitterId: 's2', date: '2026-11-02' }, TZ)).toEqual({
      sitter_id: 's2',
      date: '2026-11-02',
      time: '09:00',
    });
  });

  it('ignores drops that change nothing, unassign, or move started visits', () => {
    expect(dropChange(walk, { sitterId: 's1', date: '2026-11-02' }, TZ)).toBeNull();
    expect(dropChange(walk, { sitterId: null, date: '2026-11-03' }, TZ)).toBeNull();
    const started = { ...walk, status: 'arrived' };
    expect(canMoveVisit(started)).toBe(false);
    expect(dropChange(started, { sitterId: 's2', date: '2026-11-02' }, TZ)).toBeNull();
  });
});

it('labels times in the business zone', () => {
  expect(boardTimeLabel(visit('v', 's1', '2026-11-02T14:00:00Z', '2026-11-02T14:30:00Z'), TZ)).toBe(
    '09:00–09:30',
  );
});
