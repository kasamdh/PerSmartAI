import {
  appendPhrase,
  buildVisitUpdate,
  SUMMARY_MAX_LENGTH,
  primaryActionFor,
  secondaryActionFor,
  statusLabel,
} from '../visit-actions';

describe('visit actions by status', () => {
  it.each([
    ['scheduled', 'on_the_way', 'check_in'],
    ['on_the_way', 'check_in', null],
    ['arrived', 'check_out', null],
    ['in_progress', 'check_out', null],
    ['completed', null, null],
    ['missed', null, null],
    ['cancelled', null, null],
  ] as const)('%s → primary %s, secondary %s', (status, primary, secondary) => {
    expect(primaryActionFor(status)?.kind ?? null).toBe(primary);
    expect(secondaryActionFor(status)?.kind ?? null).toBe(secondary);
  });

  it('starts the day with a big Start trip button', () => {
    expect(primaryActionFor('scheduled')?.label).toBe('Start trip');
    expect(secondaryActionFor('scheduled')?.label).toBe('Check in');
  });

  it('has a label for every status', () => {
    expect(statusLabel('in_progress')).toBe('In progress');
    expect(statusLabel('on_the_way')).toBe('On the way');
  });
});

describe('buildVisitUpdate', () => {
  const now = new Date('2026-10-31T14:05:00.000Z');
  const coords = { lat: 40.6943, lng: -73.9903 };

  it('check-in records UTC time and location and starts the visit', () => {
    expect(buildVisitUpdate('check_in', now, coords)).toEqual({
      status: 'in_progress',
      check_in_at: '2026-10-31T14:05:00.000Z',
      check_in_lat: 40.6943,
      check_in_lng: -73.9903,
    });
  });

  it('check-out records UTC time and location and completes the visit', () => {
    expect(buildVisitUpdate('check_out', now, coords)).toEqual({
      status: 'completed',
      check_out_at: '2026-10-31T14:05:00.000Z',
      check_out_lat: 40.6943,
      check_out_lng: -73.9903,
    });
  });

  it('still checks in when location is unavailable', () => {
    expect(buildVisitUpdate('check_in', now, null)).toMatchObject({
      status: 'in_progress',
      check_in_lat: null,
      check_in_lng: null,
    });
  });

  it('on my way only changes status', () => {
    expect(buildVisitUpdate('on_the_way', now, coords)).toEqual({ status: 'on_the_way' });
  });

  it('only touches columns sitters are allowed to change', () => {
    const allowed = new Set([
      'status',
      'check_in_at',
      'check_in_lat',
      'check_in_lng',
      'check_out_at',
      'check_out_lat',
      'check_out_lng',
      'summary_note',
    ]);
    for (const action of ['on_the_way', 'check_in', 'check_out'] as const) {
      for (const key of Object.keys(buildVisitUpdate(action, now, coords))) {
        expect(allowed).toContain(key);
      }
    }
  });
});

describe('check-out summary', () => {
  const now = new Date('2026-10-31T14:05:00.000Z');

  it('saves a trimmed summary with the check-out', () => {
    expect(buildVisitUpdate('check_out', now, null, '  All good! ')).toMatchObject({
      status: 'completed',
      summary_note: 'All good!',
    });
  });

  it('leaves any existing summary alone when none is given', () => {
    expect(buildVisitUpdate('check_out', now, null, '   ')).not.toHaveProperty('summary_note');
    expect(buildVisitUpdate('check_out', now, null)).not.toHaveProperty('summary_note');
  });

  it('caps the summary length', () => {
    const update = buildVisitUpdate('check_out', now, null, 'x'.repeat(SUMMARY_MAX_LENGTH + 50));
    expect(update.summary_note).toHaveLength(SUMMARY_MAX_LENGTH);
  });

  it('never adds a summary to other actions', () => {
    expect(buildVisitUpdate('check_in', now, null, 'hi')).not.toHaveProperty('summary_note');
  });
});

describe('appendPhrase', () => {
  it('adds quick phrases as sentences without repeating them', () => {
    expect(appendPhrase('', 'All good!')).toBe('All good!');
    expect(appendPhrase('All good!', 'Good walk.')).toBe('All good! Good walk.');
    expect(appendPhrase('All good! Good walk.', 'Good walk.')).toBe('All good! Good walk.');
    expect(appendPhrase('  Ate well ', 'Good walk.')).toBe('Ate well Good walk.');
  });
});
