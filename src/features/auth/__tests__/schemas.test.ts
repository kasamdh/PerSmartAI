import { signInSchema } from '../schemas';

describe('signInSchema', () => {
  it('trims and lowercases the email', () => {
    const result = signInSchema.parse({ email: '  Olivia@Example.TEST ', password: 'x' });
    expect(result.email).toBe('olivia@example.test');
  });

  it('requires an email and password', () => {
    const result = signInSchema.safeParse({ email: '  ', password: '' });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message);
    expect(messages).toEqual(expect.arrayContaining(['Enter your email', 'Enter your password']));
  });

  it('rejects malformed emails', () => {
    const result = signInSchema.safeParse({ email: 'not-an-email', password: 'x' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Enter a valid email');
  });
});
