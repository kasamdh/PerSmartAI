import {
  businessSignUpSchema,
  createInviteSchema,
  householdSchema,
  inviteCodeSchema,
  inviteSignUpSchema,
  newPasswordSchema,
  otpCodeSchema,
} from '../schemas';

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? [];

describe('businessSignUpSchema', () => {
  const valid = {
    businessName: 'Happy Paws',
    timeZone: 'America/New_York',
    fullName: 'Kasam',
    email: 'Me@Example.com ',
    password: 'longenough',
  };

  it('accepts a complete sign-up and normalizes the email', () => {
    expect(businessSignUpSchema.parse(valid).email).toBe('me@example.com');
  });

  it('explains each problem', () => {
    const result = businessSignUpSchema.safeParse({
      businessName: '',
      timeZone: 'New York',
      fullName: '',
      email: 'nope',
      password: 'short',
    });
    expect(messages(result)).toEqual(
      expect.arrayContaining([
        'Enter your business name',
        'Use a time zone like America/New_York',
        'Enter your name',
        'Enter a valid email',
        'Use at least 8 characters',
      ]),
    );
  });

  it('accepts UTC and multi-part zones', () => {
    for (const timeZone of ['UTC', 'America/Argentina/Buenos_Aires', 'Etc/GMT+5']) {
      expect(businessSignUpSchema.safeParse({ ...valid, timeZone }).success).toBe(true);
    }
  });
});

describe('inviteCodeSchema', () => {
  it('normalizes a valid code', () => {
    expect(inviteCodeSchema.parse({ code: 'k7qm-3xpt' }).code).toBe('K7QM3XPT');
  });

  it('explains the expected format', () => {
    expect(messages(inviteCodeSchema.safeParse({ code: 'abc' }))[0]).toMatch(
      /8 letters and numbers/,
    );
  });
});

describe('inviteSignUpSchema', () => {
  it('allows a blank phone but rejects a malformed one', () => {
    const base = { fullName: 'Rudra', email: 'r@example.com', password: 'longenough' };
    expect(inviteSignUpSchema.safeParse({ ...base, phone: '' }).success).toBe(true);
    expect(inviteSignUpSchema.safeParse({ ...base, phone: '+1 555 010 0200' }).success).toBe(true);
    expect(messages(inviteSignUpSchema.safeParse({ ...base, phone: 'call me' }))).toContain(
      'Enter a valid phone number',
    );
  });
});

describe('newPasswordSchema', () => {
  it('requires matching passwords', () => {
    const result = newPasswordSchema.safeParse({ password: 'longenough', confirm: 'different1' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      message: "Passwords don't match",
      path: ['confirm'],
    });
  });
});

describe('otpCodeSchema', () => {
  it('needs exactly six digits', () => {
    expect(otpCodeSchema.safeParse({ code: ' 123456 ' }).success).toBe(true);
    expect(otpCodeSchema.safeParse({ code: '12345' }).success).toBe(false);
    expect(otpCodeSchema.safeParse({ code: '12a456' }).success).toBe(false);
  });
});

describe('householdSchema', () => {
  it('requires a phone, street, and city', () => {
    const result = householdSchema.safeParse({
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      region: '',
      postalCode: '',
      entryInstructions: '',
    });
    expect(messages(result)).toEqual(
      expect.arrayContaining([
        'Add a phone number so your sitter can reach you',
        'Enter your street address',
        'Enter your city',
      ]),
    );
  });
});

describe('createInviteSchema', () => {
  it('allows a blank email (anyone with the code) or a valid one', () => {
    expect(createInviteSchema.safeParse({ role: 'sitter', email: '' }).success).toBe(true);
    expect(createInviteSchema.parse({ role: 'owner', email: ' Rudra@Example.com ' }).email).toBe(
      'rudra@example.com',
    );
    expect(createInviteSchema.safeParse({ role: 'owner', email: 'nope' }).success).toBe(false);
    expect(createInviteSchema.safeParse({ role: 'admin', email: '' }).success).toBe(false);
  });
});
