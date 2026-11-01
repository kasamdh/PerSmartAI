import { z } from 'zod';

import { zodResolver } from '../zod-resolver';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters').regex(/\d/, 'Add a number'),
  name: z.string().trim().min(1, 'Enter your name'),
});

const resolve = (values: Record<string, unknown>) =>
  zodResolver(schema)(values as never, undefined, { fields: {}, shouldUseNativeValidation: false });

describe('zodResolver', () => {
  it('returns parsed values (with transforms) when valid', async () => {
    const result = await resolve({ email: 'a@b.co', password: 'abcdefg1', name: '  Ana ' });
    expect(result.errors).toEqual({});
    expect(result.values).toEqual({ email: 'a@b.co', password: 'abcdefg1', name: 'Ana' });
  });

  it('reports the first problem per field, and no values', async () => {
    const result = await resolve({ email: 'nope', password: 'short', name: '' });
    expect(result.values).toEqual({});
    expect(result.errors).toEqual({
      email: { type: expect.any(String), message: 'Enter a valid email' },
      password: { type: expect.any(String), message: 'At least 8 characters' },
      name: { type: expect.any(String), message: 'Enter your name' },
    });
  });
});
