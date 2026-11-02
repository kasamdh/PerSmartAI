import { legalUrl } from '../legal-links';

describe('legalUrl', () => {
  it('builds the public page address from the site URL', () => {
    expect(legalUrl('privacy', 'https://admin.example.com')).toBe(
      'https://admin.example.com/privacy',
    );
    expect(legalUrl('terms', 'https://admin.example.com')).toBe('https://admin.example.com/terms');
  });

  it('shows no link when the site URL isn’t configured', () => {
    expect(legalUrl('privacy', undefined)).toBeNull();
  });
});
