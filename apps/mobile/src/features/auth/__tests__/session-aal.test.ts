import { sessionAal } from '../session-aal';

const token = (claims: object) =>
  `x.${btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.sig`;

describe('sessionAal', () => {
  it('reads the assurance level from the access token', () => {
    expect(sessionAal(token({ sub: 'u', aal: 'aal2' }))).toBe('aal2');
    expect(sessionAal(token({ sub: 'u', aal: 'aal1', email: 'a.b+c@example.com' }))).toBe('aal1');
  });

  it('returns null for missing or malformed tokens', () => {
    expect(sessionAal(undefined)).toBeNull();
    expect(sessionAal('not-a-jwt')).toBeNull();
    expect(sessionAal('x.%%%.y')).toBeNull();
    expect(sessionAal(token({ sub: 'u' }))).toBeNull();
  });
});
