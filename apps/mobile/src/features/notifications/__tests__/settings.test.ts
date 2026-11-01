import { toggleMuted } from '../settings';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('toggleMuted', () => {
  it('turns alerts off and back on', () => {
    expect(toggleMuted([], 'new_photos', false)).toEqual(['new_photos']);
    expect(toggleMuted(['new_photos', 'visit_complete'], 'new_photos', true)).toEqual([
      'visit_complete',
    ]);
    expect(toggleMuted(['new_photos'], 'new_photos', false)).toEqual(['new_photos']);
  });

  it('never mutes incidents', () => {
    expect(toggleMuted([], 'incident', false)).toEqual([]);
  });
});
