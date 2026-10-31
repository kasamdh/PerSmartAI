import { signInErrorMessage } from '../errors';

describe('signInErrorMessage', () => {
  it('explains wrong credentials without revealing which field was wrong', () => {
    expect(
      signInErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
    ).toBe('Email or password is incorrect.');
    expect(signInErrorMessage({ message: 'Invalid login credentials' })).toBe(
      'Email or password is incorrect.',
    );
  });

  it('handles unconfirmed email, rate limits, and network failures', () => {
    expect(signInErrorMessage({ code: 'email_not_confirmed' })).toMatch(/confirm your email/);
    expect(signInErrorMessage({ status: 429 })).toMatch(/Too many attempts/);
    expect(signInErrorMessage({ message: 'Network request failed' })).toMatch(/reach the server/);
  });

  it('falls back to a generic message', () => {
    expect(signInErrorMessage({ message: 'weird' })).toMatch(/Something went wrong/);
    expect(signInErrorMessage(undefined)).toMatch(/Something went wrong/);
  });
});
