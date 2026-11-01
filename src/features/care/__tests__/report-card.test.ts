import { buildReportCard, reportCardLines } from '../report-card';

const pets = [
  { id: 'rex', name: 'Rex' },
  { id: 'mochi', name: 'Mochi' },
];

const event = (type: string, pet_id: string | null, value: Record<string, unknown> = {}) => ({
  id: `${type}-${Math.random()}`,
  type,
  pet_id,
  value,
  occurred_at: '2026-11-10T16:10:00.000Z',
});

describe('buildReportCard', () => {
  it('summarizes food, potty, walks, meds and notes per pet', () => {
    const card = buildReportCard(
      [
        event('fed', 'rex', { amount_eaten: 'all' }),
        event('fed', 'rex', { amount_eaten: 'half' }),
        event('pee', 'rex'),
        event('pee', 'rex'),
        event('poop', 'rex'),
        event('walk', 'rex', { started_at: '2026-11-10T16:00:00Z', minutes: 25 }),
        event('walk', 'rex', { started_at: '2026-11-10T17:00:00Z' }), // still going
        event('meds_given', 'rex', { medication_name: 'Apoquel' }),
        event('meds_given', 'rex', {
          medication_name: 'Fish oil',
          skipped: true,
          reason: 'Refused',
        }),
        event('water', 'mochi'),
        event('fed', 'mochi', { amount_eaten: 'none' }),
        event('note', 'mochi', { text: 'Hid under the bed' }),
        event('note', null, { text: 'Took the mail in' }),
        event('play', 'mochi'),
      ],
      pets,
    );

    expect(card.pets[0]).toEqual({
      petId: 'rex',
      name: 'Rex',
      meals: ['all', 'half'],
      water: 0,
      pee: 2,
      poop: 1,
      walks: 1,
      walkMinutes: 25,
      play: 0,
      vomit: 0,
      meds: [
        { name: 'Apoquel', status: 'given', reason: null },
        { name: 'Fish oil', status: 'skipped', reason: 'Refused' },
      ],
      notes: [],
    });
    expect(card.pets[1]).toMatchObject({
      meals: ['none'],
      water: 1,
      play: 1,
      notes: ['Hid under the bed'],
    });
    expect(card.notes).toEqual(['Took the mail in']);
  });
});

describe('reportCardLines', () => {
  it('reads like a report card', () => {
    const card = buildReportCard(
      [
        event('fed', 'rex', { amount_eaten: 'all' }),
        event('pee', 'rex'),
        event('pee', 'rex'),
        event('poop', 'rex'),
        event('walk', 'rex', { minutes: 25 }),
        event('walk', 'rex', { minutes: 10 }),
        event('meds_given', 'rex', { medication_name: 'Apoquel' }),
      ],
      pets,
    );
    expect(reportCardLines(card.pets[0])).toEqual([
      'Ate: all',
      'Potty: peed 2×, pooped 1×',
      'Walks: 2 (35 min)',
      'Meds: Apoquel given',
    ]);
    expect(reportCardLines(card.pets[1])).toEqual(['Nothing logged']);
  });

  it('lists skipped meds with the reason', () => {
    const card = buildReportCard(
      [event('meds_given', 'rex', { skipped: true, reason: 'Vomited' }), event('vomit', 'rex')],
      pets,
    );
    expect(reportCardLines(card.pets[0])).toEqual([
      'Meds: medication skipped (Vomited)',
      'Vomited 1×',
    ]);
  });
});
