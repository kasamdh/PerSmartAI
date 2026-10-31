import { otpErrorMessage, signInErrorMessage, signUpErrorMessage } from '../errors';

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

describe('signUpErrorMessage', () => {
  it('maps the trigger failure to an invite- or business-specific hint', () => {
    const dbError = { message: 'Database error saving new user', status: 500 };
    expect(signUpErrorMessage(dbError, 'invite')).toMatch(/invite can't be used/);
    expect(signUpErrorMessage(dbError, 'business')).toMatch(/time zone/);
  });

  it('tells people to log in when the email is taken', () => {
    expect(signUpErrorMessage({ code: 'user_already_exists' }, 'invite')).toMatch(/Log in instead/);
  });
});

describe('otpErrorMessage', () => {
  it('asks for a new code when it is wrong or expired', () => {
    expect(otpErrorMessage({ code: 'otp_expired' })).toMatch(/Request a new one/);
    expect(otpErrorMessage({ message: 'Token has expired or is invalid' })).toMatch(
      /Request a new one/,
    );
  });
});
