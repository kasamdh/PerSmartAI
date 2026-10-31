import { z } from 'zod';

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Enter your email')
    .pipe(z.email('Enter a valid email')),
  password: z.string().min(1, 'Enter your password'),
});

export type SignInValues = z.infer<typeof signInSchema>;
