import { canLogCare, careButtonsFor, careEventSummary } from '../care-events';

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
