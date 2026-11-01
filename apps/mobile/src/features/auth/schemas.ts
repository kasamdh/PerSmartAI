import { z } from 'zod';

import { isValidInviteCode, normalizeInviteCode } from './invite-code';

export const PASSWORD_MIN_LENGTH = 8;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email')
  .pipe(z.email('Enter a valid email'));

const fullName = z.string().trim().min(1, 'Enter your name').max(100, 'Name is too long');

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === '' || /^[+\d][\d\s().-]{6,}$/.test(v), 'Enter a valid phone number');

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(72, 'Password is too long');

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const emailOnlySchema = z.object({ email });
export type EmailOnlyValues = z.infer<typeof emailOnlySchema>;

export const otpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from the email'),
});
export type OtpCodeValues = z.infer<typeof otpCodeSchema>;

export const businessSignUpSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter your business name').max(100, 'Name is too long'),
  timeZone: z
    .string()
    .trim()
    .regex(/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$|^UTC$/, 'Use a time zone like America/New_York'),
  fullName,
  email,
  password: newPassword,
});
export type BusinessSignUpValues = z.infer<typeof businessSignUpSchema>;

export const inviteCodeSchema = z.object({
  code: z
    .string()
    .refine(isValidInviteCode, 'Invite codes are 8 letters and numbers, like K7QM-3XPT')
    .transform(normalizeInviteCode),
});
export type InviteCodeValues = z.input<typeof inviteCodeSchema>;

export const inviteSignUpSchema = z.object({
  fullName,
  phone: optionalPhone,
  email,
  password: newPassword,
});
export type InviteSignUpValues = z.infer<typeof inviteSignUpSchema>;

export const newPasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ['confirm'] });
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

export const profileSchema = z.object({ fullName, phone: optionalPhone });
export type ProfileValues = z.infer<typeof profileSchema>;

export const householdSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, 'Add a phone number so your sitter can reach you')
    .pipe(optionalPhone),
  addressLine1: z.string().trim().min(1, 'Enter your street address'),
  addressLine2: z.string().trim(),
  city: z.string().trim().min(1, 'Enter your city'),
  region: z.string().trim(),
  postalCode: z.string().trim(),
  entryInstructions: z.string().trim().max(1000, 'Keep this under 1000 characters'),
});
export type HouseholdValues = z.infer<typeof householdSchema>;

export const createInviteSchema = z.object({
  role: z.enum(['sitter', 'owner']),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (v) => v === '' || z.email().safeParse(v).success,
      'Enter a valid email or leave it blank',
    ),
});
export type CreateInviteValues = z.infer<typeof createInviteSchema>;
