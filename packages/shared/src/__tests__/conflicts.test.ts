import {
  checkSchedule,
  describeConflict,
  findConflicts,
  localToUtc,
  type AvailabilityBlock,
  type ConflictContext,
  type ExistingVisit,
} from '../scheduling/index.ts';

const NY = 'America/New_York';
const at = (date: string, time: string) => localToUtc(date, time, NY).toISOString();
const slot = (date: string, start: string, end: string, household_id: string | null = 'h-new') => ({
  start: at(date, start),
  end: at(date, end),
  household_id,
});

// Tue Nov 10, 2026: an 11:00–11:30 walk at the Lee home.
const leeWalk: ExistingVisit = {
  id: 'v1',
  booking_id: 'b1',
  household_id: 'h-lee',
  scheduled_start: at('2026-11-10', '11:00'),
  scheduled_end: at('2026-11-10', '11:30'),
  status: 'scheduled',
  label: 'Walk at Lee home',
};

const weekdays9to5: AvailabilityBlock[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  start_time: '09:00',
  end_time: '17:00',
}));

const context = (overrides: Partial<ConflictContext> = {}): ConflictContext => ({
  timeZone: NY,
  travelBufferMinutes: 15,
  visits: [leeWalk],
  availability: weekdays9to5,
  timeOff: [],
  ...overrides,
});

const kinds = (c: ReturnType<typeof findConflicts>) => c.map((x) => x.kind);

describe('findConflicts: other visits', () => {
  it('passes a visit with enough travel time on both sides', () => {
    expect(findConflicts(slot('2026-11-10', '11:45', '12:15'), context())).toEqual([]);
    expect(findConflicts(slot('2026-11-10', '10:15', '10:45'), context())).toEqual([]);
  });

  it('blocks overlapping visits', () => {
    expect(kinds(findConflicts(slot('2026-11-10', '11:15', '11:45'), context()))).toEqual([
      'overlap',
    ]);
    expect(kinds(findConflicts(slot('2026-11-10', '10:00', '12:00'), context()))).toEqual([
      'overlap',
    ]); // contains it
    expect(kinds(findConflicts(slot('2026-11-10', '11:05', '11:10'), context()))).toEqual([
      'overlap',
    ]); // inside it
  });

  it('blocks a visit that leaves too little travel time after another', () => {
    const conflicts = findConflicts(slot('2026-11-10', '11:40', '12:10'), context());
    expect(conflicts).toEqual([
      {
        kind: 'travel_buffer',
        blocking: true,
        visit: leeWalk,
        position: 'after',
        gapMinutes: 10,
        requiredMinutes: 15,
      },
    ]);
  });

  it('blocks a visit that leaves too little travel time before another', () => {
    const conflicts = findConflicts(slot('2026-11-10', '10:20', '10:50'), context());
    expect(conflicts).toMatchObject([
      { kind: 'travel_buffer', position: 'before', gapMinutes: 10 },
    ]);
  });

  it('treats back-to-back visits as a travel conflict, not an overlap', () => {
    expect(findConflicts(slot('2026-11-10', '11:30', '12:00'), context())).toMatchObject([
      { kind: 'travel_buffer', gapMinutes: 0 },
    ]);
  });

  it('allows exactly the travel buffer', () => {
    expect(findConflicts(slot('2026-11-10', '11:45', '12:00'), context())).toEqual([]);
  });

  it('uses the organization buffer, including none', () => {
    const tight = slot('2026-11-10', '11:40', '12:10');
    expect(findConflicts(tight, context({ travelBufferMinutes: 5 }))).toEqual([]);
    expect(kinds(findConflicts(tight, context({ travelBufferMinutes: 30 })))).toEqual([
      'travel_buffer',
    ]);
    expect(
      findConflicts(slot('2026-11-10', '11:30', '12:00'), context({ travelBufferMinutes: 0 })),
    ).toEqual([]);
  });

  it('needs no travel time between visits at the same home', () => {
    expect(findConflicts(slot('2026-11-10', '11:30', '12:00', 'h-lee'), context())).toEqual([]);
    // …but they still can't overlap.
    expect(kinds(findConflicts(slot('2026-11-10', '11:15', '12:00', 'h-lee'), context()))).toEqual([
      'overlap',
    ]);
  });

  it('ignores cancelled and missed visits', () => {
    for (const status of ['cancelled', 'missed'] as const) {
      expect(
        findConflicts(
          slot('2026-11-10', '11:00', '11:30'),
          context({ visits: [{ ...leeWalk, status }] }),
        ),
      ).toEqual([]);
    }
  });

  it('ignores the visits being replaced (by id or booking)', () => {
    const moving = slot('2026-11-10', '11:10', '11:40');
    expect(findConflicts(moving, context({ ignoreVisitIds: ['v1'] }))).toEqual([]);
    expect(findConflicts(moving, context({ ignoreBookingIds: ['b1'] }))).toEqual([]);
  });

  it('finds the travel buffer across midnight', () => {
    const lateVisit: ExistingVisit = {
      ...leeWalk,
      id: 'v2',
      scheduled_start: at('2026-11-10', '23:30'),
      scheduled_end: at('2026-11-11', '00:00'),
    };
    expect(
      kinds(
        findConflicts(
          slot('2026-11-11', '00:05', '00:30'),
          context({ visits: [lateVisit], availability: [] }),
        ),
      ),
    ).toEqual(['travel_buffer', 'no_availability_set']);
  });
});

describe('findConflicts: availability', () => {
  it('blocks visits outside the weekly availability', () => {
    expect(kinds(findConflicts(slot('2026-11-10', '08:30', '09:00'), context()))).toEqual([
      'outside_availability',
    ]);
    expect(kinds(findConflicts(slot('2026-11-10', '16:45', '17:15'), context()))).toEqual([
      'outside_availability',
    ]); // runs past 5 PM
    expect(kinds(findConflicts(slot('2026-11-14', '12:00', '12:30'), context()))).toEqual([
      'outside_availability',
    ]); // Saturday
  });

  it('allows visits that exactly fill an availability block', () => {
    expect(findConflicts(slot('2026-11-10', '09:00', '17:00'), context({ visits: [] }))).toEqual(
      [],
    );
  });

  it('joins adjacent blocks, including across midnight for overnight stays', () => {
    const availability: AvailabilityBlock[] = [
      { weekday: 2, start_time: '09:00', end_time: '12:00' },
      { weekday: 2, start_time: '12:00', end_time: '24:00' },
      { weekday: 3, start_time: '00:00', end_time: '09:00' },
    ];
    const overnight = {
      start: at('2026-11-10', '19:00'),
      end: at('2026-11-11', '08:00'),
      household_id: 'h',
    };
    expect(findConflicts(overnight, context({ visits: [], availability }))).toEqual([]);
    expect(
      findConflicts(slot('2026-11-10', '11:00', '13:00'), context({ visits: [], availability })),
    ).toEqual([]);
    const tooLong = { ...overnight, end: at('2026-11-11', '10:00') };
    expect(kinds(findConflicts(tooLong, context({ visits: [], availability })))).toEqual([
      'outside_availability',
    ]);
  });

  it('reads availability as wall-clock time on DST change days', () => {
    // Sunday Nov 1, 2026 (fall back): the block is still 09:00–17:00 local, even though
    // its UTC offset differs from the day before.
    const availability: AvailabilityBlock[] = [
      { weekday: 0, start_time: '09:00', end_time: '17:00' },
    ];
    expect(
      findConflicts(slot('2026-11-01', '09:00', '09:30'), context({ visits: [], availability })),
    ).toEqual([]);
    expect(
      kinds(
        findConflicts(slot('2026-11-01', '08:00', '08:30'), context({ visits: [], availability })),
      ),
    ).toEqual(['outside_availability']);
    // Spring forward (Mar 8): still 09:00 local.
    expect(
      findConflicts(slot('2026-03-08', '09:00', '09:30'), context({ visits: [], availability })),
    ).toEqual([]);
  });

  it('warns but does not block when the sitter has no availability set', () => {
    expect(
      findConflicts(slot('2026-11-14', '12:00', '12:30'), context({ availability: [] })),
    ).toEqual([{ kind: 'no_availability_set', blocking: false }]);
  });
});

describe('findConflicts: time off', () => {
  const off = {
    id: 't1',
    start_at: at('2026-11-10', '00:00'),
    end_at: at('2026-11-11', '00:00'),
    status: 'approved' as const,
  };

  it('blocks visits during approved time off', () => {
    expect(
      findConflicts(slot('2026-11-10', '12:00', '12:30'), context({ timeOff: [off] })),
    ).toEqual([{ kind: 'time_off', blocking: true, timeOff: off }]);
  });

  it('allows visits that touch the edge of time off', () => {
    const edge = { ...off, end_at: at('2026-11-10', '12:00') };
    expect(
      findConflicts(slot('2026-11-10', '12:00', '12:30'), context({ timeOff: [edge] })),
    ).toEqual([]);
  });

  it('warns about requested time off, ignores declined', () => {
    expect(
      findConflicts(
        slot('2026-11-10', '12:00', '12:30'),
        context({ timeOff: [{ ...off, status: 'requested' }] }),
      ),
    ).toEqual([
      { kind: 'time_off_requested', blocking: false, timeOff: { ...off, status: 'requested' } },
    ]);
    expect(
      findConflicts(
        slot('2026-11-10', '12:00', '12:30'),
        context({ timeOff: [{ ...off, status: 'declined' }] }),
      ),
    ).toEqual([]);
  });
});

describe('checkSchedule', () => {
  it('reports only the slots with problems and whether anything blocks', () => {
    const result = checkSchedule(
      [
        slot('2026-11-10', '11:15', '11:45'),
        slot('2026-11-10', '13:00', '13:30'),
        slot('2026-11-14', '13:00', '13:30'),
      ],
      context(),
    );
    expect(result.ok).toBe(false);
    expect(result.blockingCount).toBe(2);
    expect(result.problems.map((p) => [p.index, kinds(p.conflicts)])).toEqual([
      [0, ['overlap']],
      [2, ['outside_availability']],
    ]);
  });

  it('is ok when only warnings remain', () => {
    const result = checkSchedule(
      [slot('2026-11-14', '13:00', '13:30')],
      context({ availability: [] }),
    );
    expect(result).toMatchObject({ ok: true, blockingCount: 0 });
    expect(result.problems).toHaveLength(1);
  });
});

describe('describeConflict', () => {
  const describe1 = (s: ReturnType<typeof slot>, ctx: ConflictContext = context()) =>
    findConflicts(s, ctx).map((c) => describeConflict(c, NY));

  it('explains each reason in the organization time zone', () => {
    expect(describe1(slot('2026-11-10', '11:15', '11:45'))).toEqual([
      'Overlaps Walk at Lee home (Tue, Nov 10, 11:00 AM–11:30 AM)',
    ]);
    expect(describe1(slot('2026-11-10', '11:40', '12:10'))).toEqual([
      'Only 10 min after Walk at Lee home ends at 11:30 AM; needs 15 min travel time',
    ]);
    expect(describe1(slot('2026-11-10', '10:20', '10:50'))).toEqual([
      'Only 10 min before Walk at Lee home starts at 11:00 AM; needs 15 min travel time',
    ]);
    expect(describe1(slot('2026-11-14', '13:00', '13:30'))).toEqual([
      'Outside availability: not available on Saturdays',
    ]);
    expect(describe1(slot('2026-11-10', '16:45', '17:15'))).toEqual([
      'Outside availability: Tuesdays 9:00 AM–5:00 PM',
    ]);
    expect(describe1(slot('2026-11-14', '13:00', '13:30'), context({ availability: [] }))).toEqual([
      'No availability set yet',
    ]);
  });

  it('explains time off', () => {
    const timeOff = {
      id: 't',
      start_at: at('2026-11-09', '00:00'),
      end_at: at('2026-11-12', '00:00'),
      status: 'approved' as const,
    };
    expect(
      describe1(slot('2026-11-10', '12:00', '12:30'), context({ timeOff: [timeOff] })),
    ).toEqual(['Time off Mon, Nov 9, 12:00 AM – Thu, Nov 12, 12:00 AM']);
    expect(
      describe1(
        slot('2026-11-10', '12:00', '12:30'),
        context({ timeOff: [{ ...timeOff, status: 'requested' }] }),
      ),
    ).toEqual([
      'Time off requested (not approved yet) Mon, Nov 9, 12:00 AM – Thu, Nov 12, 12:00 AM',
    ]);
  });

  it('falls back to "another visit" without a label', () => {
    expect(
      describe1(
        slot('2026-11-10', '11:15', '11:45'),
        context({ visits: [{ ...leeWalk, label: undefined }] }),
      ),
    ).toEqual(['Overlaps another visit (Tue, Nov 10, 11:00 AM–11:30 AM)']);
  });
});
