import { statusTimeline } from '../status-timeline';

const base = {
  status: 'scheduled' as const,
  on_the_way_at: null,
  check_in_at: null,
  started_at: null,
  check_out_at: null,
};

describe('statusTimeline', () => {
  it('shows every step, with times for the ones that happened', () => {
    expect(
      statusTimeline({
        ...base,
        status: 'in_progress',
        on_the_way_at: '2026-11-10T16:52:00Z',
        check_in_at: '2026-11-10T17:03:00Z',
        started_at: '2026-11-10T17:05:00Z',
      }),
    ).toEqual([
      { key: 'on_the_way', label: 'On the way', at: '2026-11-10T16:52:00Z', state: 'done' },
      { key: 'arrived', label: 'Arrived', at: '2026-11-10T17:03:00Z', state: 'done' },
      {
        key: 'in_progress',
        label: 'Caring for your pets',
        at: '2026-11-10T17:05:00Z',
        state: 'current',
      },
      { key: 'completed', label: 'Finished', at: null, state: 'upcoming' },
    ]);
  });

  it('has nothing done before the trip starts', () => {
    expect(statusTimeline(base).map((s) => s.state)).toEqual([
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });

  it('marks everything done once finished', () => {
    const steps = statusTimeline({
      status: 'completed',
      on_the_way_at: '2026-11-10T16:52:00Z',
      check_in_at: '2026-11-10T17:03:00Z',
      started_at: '2026-11-10T17:05:00Z',
      check_out_at: '2026-11-10T17:35:00Z',
    });
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done']);
  });

  it('ends with the reason when a visit was missed or cancelled', () => {
    expect(statusTimeline({ ...base, status: 'missed' }).at(-1)).toEqual({
      key: 'missed',
      label: 'Visit missed',
      at: null,
      state: 'current',
    });
    expect(
      statusTimeline({ ...base, status: 'cancelled', on_the_way_at: '2026-11-10T16:52:00Z' }).map(
        (s) => [s.key, s.state],
      ),
    ).toEqual([
      ['on_the_way', 'done'],
      ['cancelled', 'current'],
    ]);
  });
});
