import {
  allergyBanner,
  formatTimeOfDay,
  kgToLb,
  lbToKg,
  normalizeTime,
  normalizeTimes,
  petAge,
  telUrl,
} from '../pets.ts';

describe('allergyBanner', () => {
  it('is hidden only when there are no allergies', () => {
    expect(allergyBanner([])).toBeNull();
    expect(allergyBanner(null)).toBeNull();
    expect(allergyBanner(undefined)).toBeNull();
    expect(allergyBanner([{ allergen: 'Fish', severity: 'mild' }])).not.toBeNull();
  });

  it('lists severe allergies first and emphasizes only those', () => {
    const banner = allergyBanner([
      { allergen: 'Fish', severity: 'mild' },
      { allergen: 'Bee stings', severity: 'severe', reaction_notes: ' Face swells ' },
      { allergen: 'Chicken', severity: 'moderate' },
      { allergen: 'Almonds', severity: 'severe' },
    ])!;

    expect(banner.items.map((i) => i.allergen)).toEqual([
      'Almonds',
      'Bee stings',
      'Chicken',
      'Fish',
    ]);
    expect(banner.items.filter((i) => i.emphasized).map((i) => i.allergen)).toEqual([
      'Almonds',
      'Bee stings',
    ]);
    expect(banner.hasSevere).toBe(true);
    expect(banner.items[1].notes).toBe('Face swells');
  });

  it('reads every allergy aloud for screen readers', () => {
    expect(
      allergyBanner([
        { allergen: 'Chicken', severity: 'moderate' },
        { allergen: 'Fish', severity: 'mild' },
      ])!.accessibilityLabel,
    ).toBe('Allergies: Chicken (moderate), Fish (mild)');
  });

  it('reports no severe allergies when there are none', () => {
    expect(allergyBanner([{ allergen: 'Fish', severity: 'mild' }])!.hasSevere).toBe(false);
  });
});

describe('petAge', () => {
  const now = new Date(2026, 9, 31); // Oct 31, 2026

  it.each([
    ['2021-04-12', '5 years'],
    ['2025-10-31', '1 year'],
    ['2025-11-01', '11 months'],
    ['2026-09-30', '1 month'],
    ['2026-10-10', '3 weeks'],
    ['2026-10-29', 'New'],
  ])('%s → %s', (birth, expected) => {
    expect(petAge(birth, now)).toBe(expected);
  });

  it('returns null without a usable birth date', () => {
    expect(petAge(null, now)).toBeNull();
    expect(petAge('2027-01-01', now)).toBeNull(); // future
  });
});

describe('weight', () => {
  it('converts pounds and kilograms', () => {
    expect(lbToKg(65)).toBeCloseTo(29.48, 2);
    expect(kgToLb(29.5)).toBe(65);
    expect(kgToLb(lbToKg(9.3))).toBe(9.3);
  });
});

describe('times of day', () => {
  it('normalizes typed times and rejects nonsense', () => {
    expect(normalizeTime('8:00')).toBe('08:00');
    expect(normalizeTime('18:30:00')).toBe('18:30');
    expect(normalizeTime('25:00')).toBeNull();
    expect(normalizeTime('noon')).toBeNull();
  });

  it('de-duplicates and sorts', () => {
    expect(normalizeTimes(['18:00', '7:00', '07:00:00', 'bad'])).toEqual(['07:00', '18:00']);
  });

  it('formats for display', () => {
    expect(formatTimeOfDay('07:00')).toBe('7:00 AM');
    expect(formatTimeOfDay('12:00')).toBe('12:00 PM');
    expect(formatTimeOfDay('00:15')).toBe('12:15 AM');
    expect(formatTimeOfDay('18:30:00')).toBe('6:30 PM');
  });
});

describe('telUrl', () => {
  it('keeps only dialable characters', () => {
    expect(telUrl('+1 (555) 555-0400')).toBe('tel:+15555550400');
    expect(telUrl('555-0100')).toBe('tel:5550100');
  });

  it('returns null when there is nothing to call', () => {
    expect(telUrl(null)).toBeNull();
    expect(telUrl('  ')).toBeNull();
    expect(telUrl('+')).toBeNull();
  });
});
