import { requireEnv } from '../env';

describe('requireEnv', () => {
  it('returns the trimmed value when set', () => {
    expect(requireEnv('X', '  https://example.supabase.co ')).toBe('https://example.supabase.co');
  });

  it.each([undefined, '', '   '])('throws a helpful error for %p', (value) => {
    expect(() => requireEnv('EXPO_PUBLIC_SUPABASE_URL', value)).toThrow(
      /Missing required env var EXPO_PUBLIC_SUPABASE_URL/,
    );
  });
});
