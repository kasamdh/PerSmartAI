import { formatInviteCode, isValidInviteCode, normalizeInviteCode } from '../invite-code';

describe('invite codes', () => {
  it('normalizes what people type or paste', () => {
    expect(normalizeInviteCode(' k7qm-3xpt ')).toBe('K7QM3XPT');
    expect(normalizeInviteCode('K7QM 3XPT')).toBe('K7QM3XPT');
  });

  it('formats codes in two groups for reading aloud', () => {
    expect(formatInviteCode('K7QM3XPT')).toBe('K7QM-3XPT');
    expect(formatInviteCode('k7qm3xpt')).toBe('K7QM-3XPT');
    expect(formatInviteCode('SHORT')).toBe('SHORT');
  });

  it('accepts only 8 characters from the unambiguous alphabet', () => {
    expect(isValidInviteCode('k7qm-3xpt')).toBe(true);
    expect(isValidInviteCode('K7QM3XP')).toBe(false); // too short
    expect(isValidInviteCode('K7QM3XP0')).toBe(false); // 0 is excluded
    expect(isValidInviteCode('O1ILK7QM')).toBe(false); // O, 1, I, L are excluded
  });
});
