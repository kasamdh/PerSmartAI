import { inviteShareMessage } from '../invites';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('inviteShareMessage', () => {
  it('includes the business, the formatted code, and the link', () => {
    const text = inviteShareMessage({
      businessName: 'Happy Paws Pet Care',
      role: 'sitter',
      code: 'K7QM3XPT',
      link: 'petsitter://accept-invite?code=K7QM3XPT',
    });
    expect(text).toContain('join Happy Paws Pet Care');
    expect(text).toContain('as a sitter');
    expect(text).toContain('K7QM-3XPT');
    expect(text).toContain('petsitter://accept-invite?code=K7QM3XPT');
  });

  it('words owner invites around their pets', () => {
    expect(
      inviteShareMessage({ businessName: 'X', role: 'owner', code: 'K7QM3XPT', link: 'l' }),
    ).toContain('manage your pets');
  });
});
