import {
  describeChangeRequest,
  groupBySitter,
  rankSitterOptions,
  weekGrid,
} from '../schedule-logic';

const sitters = [
  { id: 's1', full_name: 'Sam Smith' },
  { id: 's2', full_name: 'Ana Lopez' },
];

const visit = (id: string, sitter: string | null, start: Date) => ({
  id,
  sitter_id: sitter,
  scheduled_start: start.toISOString(),
  scheduled_end: new Date(start.getTime() + 30 * 60_000).toISOString(),
  status: 'scheduled',
});

describe('groupBySitter', () => {
  it('puts visits needing a sitter first, then every sitter alphabetically (empty ones too)', () => {
    const groups = groupBySitter(
      [
        visit('a', 's1', new Date(2026, 10, 3, 9)),
        visit('b', null, new Date(2026, 10, 3, 10)),
        visit('c', 's1', new Date(2026, 10, 3, 8)),
      ],
      sitters,
    );
    expect(groups.map((g) => [g.title, g.visits.map((v) => v.id)])).toEqual([
      ['Needs a sitter', ['b']],
      ['Ana Lopez', []],
      ['Sam Smith', ['c', 'a']],
    ]);
  });

  it('omits the unassigned group when every visit is staffed', () => {
    expect(groupBySitter([], sitters).map((g) => g.title)).toEqual(['Ana Lopez', 'Sam Smith']);
  });
});

describe('weekGrid', () => {
  it('counts each sitter’s visits per day of the week', () => {
    const grid = weekGrid(
      [
        visit('a', 's1', new Date(2026, 10, 2, 9)),
        visit('b', 's1', new Date(2026, 10, 2, 13)),
        visit('c', 's2', new Date(2026, 10, 8, 9)),
        { ...visit('d', 's2', new Date(2026, 10, 3, 9)), status: 'cancelled' },
      ],
      sitters,
      '2026-11-02',
    );
    expect(grid.days).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
    expect(grid.rows).toEqual([
      { sitterId: 's2', name: 'Ana Lopez', counts: [0, 0, 0, 0, 0, 0, 1] },
      { sitterId: 's1', name: 'Sam Smith', counts: [2, 0, 0, 0, 0, 0, 0] },
    ]);
  });
});

describe('rankSitterOptions', () => {
  it('lists free sitters first, then ones with warnings, then blocked ones with the first reason', () => {
    const options = rankSitterOptions(sitters.concat({ id: 's3', full_name: 'Zoe' }), [
      {
        sitter_id: 's1',
        ok: false,
        blocking: 2,
        problems: [
          { local_date: '', start: '', end: '', blocking: true, reasons: ['Overlaps a walk'] },
        ],
      },
      { sitter_id: 's2', ok: true, blocking: 0, problems: [] },
      {
        sitter_id: 's3',
        ok: true,
        blocking: 0,
        problems: [
          {
            local_date: '',
            start: '',
            end: '',
            blocking: false,
            reasons: ['No availability set yet'],
          },
        ],
      },
    ]);
    expect(options.map((o) => [o.id, o.state, o.note])).toEqual([
      ['s2', 'free', 'Free for every visit'],
      ['s3', 'warning', 'No availability set yet'],
      ['s1', 'blocked', 'Can’t take 2 visits: Overlaps a walk'],
    ]);
  });

  it('marks sitters still being checked', () => {
    expect(rankSitterOptions(sitters, undefined).map((o) => o.state)).toEqual([
      'checking',
      'checking',
    ]);
  });
});

describe('describeChangeRequest', () => {
  it('spells out what the owner asked for', () => {
    expect(
      describeChangeRequest({
        scope: 'visit',
        from_date: null,
        changes: { date: '2026-11-12', time: '14:30', duration_minutes: 45 },
      }),
    ).toBe('Move to Nov 12 at 2:30 PM, 45 min');
    expect(
      describeChangeRequest({
        scope: 'this_and_future',
        from_date: '2026-11-16',
        changes: { window_start: '15:00', window_end: null, end_date: '2026-12-31' },
      }),
    ).toBe('From Nov 16: arrive from 3:00 PM, no latest arrival, until Dec 31');
  });
});
