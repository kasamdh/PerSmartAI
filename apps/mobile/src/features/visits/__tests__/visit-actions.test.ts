import { appendPhrase, primaryActionFor, statusLabel } from '../visit-actions';

describe('primaryActionFor', () => {
  it.each([
    ['scheduled', 'on_the_way', 'Start trip'],
    ['on_the_way', 'check_in', 'Check in'],
    ['arrived', 'check_out', 'Check out'],
    ['in_progress', 'check_out', 'Check out'],
    ['completed', null, null],
    ['missed', null, null],
    ['cancelled', null, null],
  ] as const)('%s → %s', (status, kind, label) => {
    expect(primaryActionFor(status)?.kind ?? null).toBe(kind);
    expect(primaryActionFor(status)?.label ?? null).toBe(label);
  });

  it('has a label for every status', () => {
    expect(statusLabel('in_progress')).toBe('In progress');
    expect(statusLabel('on_the_way')).toBe('On the way');
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
