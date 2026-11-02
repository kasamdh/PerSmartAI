import {
  careButtonsFor,
  careEventSummary,
  canLogCare,
  finishWalkValue,
  ongoingWalk,
  walkElapsed,
} from '../care-events';

describe('careButtonsFor', () => {
  const types = (species: 'dog' | 'cat', meds: boolean) =>
    careButtonsFor(species, meds).map((b) => b.type);

  it('offers walks for dogs but not cats', () => {
    expect(types('dog', false)).toContain('walk');
    expect(types('cat', false)).not.toContain('walk');
  });

  it('offers "meds given" only when the pet has medications', () => {
    expect(types('dog', true)).toContain('meds_given');
    expect(types('dog', false)).not.toContain('meds_given');
  });

  it('always offers the basics, and never "note" as a button', () => {
    for (const species of ['dog', 'cat'] as const) {
      expect(types(species, false)).toEqual(
        expect.arrayContaining(['fed', 'water', 'pee', 'poop', 'play', 'vomit']),
      );
      expect(types(species, true)).not.toContain('note');
    }
  });
});

describe('canLogCare', () => {
  it.each([
    ['arrived', true],
    ['in_progress', true],
    ['scheduled', false],
    ['on_the_way', false],
    ['completed', false],
    ['missed', false],
    ['cancelled', false],
  ] as const)('%s → %s', (status, expected) => {
    expect(canLogCare(status)).toBe(expected);
  });
});

describe('careEventSummary', () => {
  it('describes feeding amounts', () => {
    expect(careEventSummary('fed', { amount_eaten: 'half' }, 'Biscuit')).toBe('Biscuit ate half');
    expect(careEventSummary('fed', { amount_eaten: 'all' }, 'Biscuit')).toBe('Biscuit ate all');
    expect(careEventSummary('fed', { amount_eaten: 'none' }, 'Mochi')).toBe("Mochi didn't eat");
    expect(careEventSummary('fed', {}, 'Mochi')).toBe('Fed Mochi');
  });

  it('describes walks with optional minutes', () => {
    expect(careEventSummary('walk', { minutes: 20 }, 'Rex')).toBe('Walked Rex · 20 min');
    expect(careEventSummary('walk', {}, 'Rex')).toBe('Walked Rex');
  });

  it('uses note text, and copes with unexpected values', () => {
    expect(careEventSummary('note', { text: 'All good' })).toBe('All good');
    expect(careEventSummary('note', null)).toBe('Note');
    expect(careEventSummary('fed', ['weird'], 'Rex')).toBe('Fed Rex');
  });

  it('falls back to "Pet" when the pet is unknown', () => {
    expect(careEventSummary('pee', {}, null)).toBe('Pet peed');
  });
});

describe('walks and medications', () => {
  it('describes a walk in progress and a finished one', () => {
    expect(careEventSummary('walk', { started_at: '2026-11-10T16:00:00Z' }, 'Rex')).toBe(
      'Started a walk with Rex',
    );
    expect(
      careEventSummary('walk', { started_at: '2026-11-10T16:00:00Z', minutes: 25 }, 'Rex'),
    ).toBe('Walked Rex · 25 min');
  });

  it('names the medication, and says when it was skipped and why', () => {
    expect(careEventSummary('meds_given', { medication_name: 'Apoquel' }, 'Rex')).toBe(
      'Rex got Apoquel',
    );
    expect(
      careEventSummary(
        'meds_given',
        { medication_name: 'Apoquel', skipped: true, reason: 'Vomited' },
        'Rex',
      ),
    ).toBe('Rex’s Apoquel skipped: Vomited');
  });

  it('finds the walk still going for a pet', () => {
    const events = [
      {
        id: 'a',
        type: 'walk' as const,
        pet_id: 'rex',
        value: { started_at: '2026-11-10T16:00:00Z', minutes: 20 },
      },
      {
        id: 'b',
        type: 'walk' as const,
        pet_id: 'rex',
        value: { started_at: '2026-11-10T17:00:00Z' },
      },
      {
        id: 'c',
        type: 'walk' as const,
        pet_id: 'mochi',
        value: { started_at: '2026-11-10T17:05:00Z' },
      },
    ];
    expect(ongoingWalk(events, 'rex')?.id).toBe('b');
    expect(ongoingWalk(events.slice(0, 1), 'rex')).toBeNull();
  });

  it('finishes a walk with its length in whole minutes (at least 1)', () => {
    expect(
      finishWalkValue({ started_at: '2026-11-10T17:00:00.000Z' }, new Date('2026-11-10T17:25:40Z')),
    ).toEqual({
      started_at: '2026-11-10T17:00:00.000Z',
      ended_at: '2026-11-10T17:25:40.000Z',
      minutes: 26,
    });
    expect(
      finishWalkValue({ started_at: '2026-11-10T17:00:00.000Z' }, new Date('2026-11-10T17:00:10Z'))
        .minutes,
    ).toBe(1);
  });

  it('shows a running timer', () => {
    expect(walkElapsed('2026-11-10T17:00:00Z', new Date('2026-11-10T17:07:05Z'))).toBe('7:05');
    expect(walkElapsed('2026-11-10T17:00:00Z', new Date('2026-11-10T18:02:09Z'))).toBe('62:09');
  });
});
