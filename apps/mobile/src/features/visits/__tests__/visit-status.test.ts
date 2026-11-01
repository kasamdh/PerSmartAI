import { advanceArgs, canTransition, nextStatus, type VisitStatus } from '../visit-status';

const ALL: VisitStatus[] = [
  'scheduled',
  'on_the_way',
  'arrived',
  'in_progress',
  'completed',
  'missed',
  'cancelled',
];

describe('canTransition (sitters)', () => {
  it('allows only the next step of the visit', () => {
    const allowed = ALL.flatMap((from) =>
      ALL.filter((to) => canTransition(from, to, 'sitter')).map((to) => `${from}->${to}`),
    );
    expect(allowed).toEqual([
      'scheduled->on_the_way',
      'on_the_way->arrived',
      'arrived->in_progress',
      'in_progress->completed',
    ]);
  });

  it('never skips steps or goes back', () => {
    expect(canTransition('scheduled', 'arrived', 'sitter')).toBe(false);
    expect(canTransition('scheduled', 'completed', 'sitter')).toBe(false);
    expect(canTransition('on_the_way', 'in_progress', 'sitter')).toBe(false);
    expect(canTransition('in_progress', 'arrived', 'sitter')).toBe(false);
    expect(canTransition('completed', 'in_progress', 'sitter')).toBe(false);
  });

  it('does not let sitters mark visits missed or cancelled', () => {
    for (const from of ALL) {
      expect(canTransition(from, 'missed', 'sitter')).toBe(false);
      expect(canTransition(from, 'cancelled', 'sitter')).toBe(false);
    }
  });

  it('treats staying in the same status as no transition', () => {
    expect(canTransition('arrived', 'arrived', 'sitter')).toBe(false);
  });
});

describe('canTransition (admins)', () => {
  it('also lets admins mark visits missed before check-in, and cancel open visits', () => {
    expect(canTransition('scheduled', 'missed', 'admin')).toBe(true);
    expect(canTransition('on_the_way', 'missed', 'admin')).toBe(true);
    expect(canTransition('arrived', 'missed', 'admin')).toBe(false);
    expect(canTransition('in_progress', 'cancelled', 'admin')).toBe(true);
    expect(canTransition('scheduled', 'on_the_way', 'admin')).toBe(true);
  });

  it('cannot reopen or skip either', () => {
    expect(canTransition('completed', 'in_progress', 'admin')).toBe(false);
    expect(canTransition('cancelled', 'scheduled', 'admin')).toBe(false);
    expect(canTransition('missed', 'scheduled', 'admin')).toBe(false);
    expect(canTransition('scheduled', 'completed', 'admin')).toBe(false);
  });
});

describe('nextStatus', () => {
  it('names where each sitter action leads', () => {
    expect(nextStatus('scheduled')).toBe('on_the_way');
    expect(nextStatus('on_the_way')).toBe('arrived');
    expect(nextStatus('arrived')).toBe('in_progress');
    expect(nextStatus('in_progress')).toBe('completed');
    expect(nextStatus('completed')).toBeNull();
  });
});

describe('advanceArgs', () => {
  const coords = { lat: 40.69, lng: -73.99 };

  it('maps sitter actions to advance_visit arguments', () => {
    expect(advanceArgs('v1', 'on_the_way', null)).toEqual({
      p_visit_id: 'v1',
      p_status: 'on_the_way',
    });
    expect(advanceArgs('v1', 'check_in', coords)).toEqual({
      p_visit_id: 'v1',
      p_status: 'arrived',
      p_lat: 40.69,
      p_lng: -73.99,
    });
    expect(advanceArgs('v1', 'check_out', coords, '  All good!  ')).toEqual({
      p_visit_id: 'v1',
      p_status: 'completed',
      p_lat: 40.69,
      p_lng: -73.99,
      p_summary: 'All good!',
    });
  });

  it('checks in without a location and drops empty summaries', () => {
    expect(advanceArgs('v1', 'check_in', null)).toEqual({ p_visit_id: 'v1', p_status: 'arrived' });
    expect(advanceArgs('v1', 'check_out', null, '   ')).toEqual({
      p_visit_id: 'v1',
      p_status: 'completed',
    });
  });
});
