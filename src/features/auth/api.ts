import * as Linking from 'expo-linking';

import { unregisterPushToken } from '@/features/notifications/push';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/models';

import { otpErrorMessage, signInErrorMessage, signUpErrorMessage } from './errors';
import { normalizeInviteCode } from './invite-code';
import type {
  BusinessSignUpValues,
  HouseholdValues,
  ProfileValues,
  SignInValues,
  InviteSignUpValues,
} from './schemas';

/** Where email links (magic link, password reset) return into the app. */
export function authCallbackUrl(params?: Record<string, string>): string {
  return Linking.createURL('auth/callback', { queryParams: params });
}

// ---------------------------------------------------------------------------
// Sign in / out
// ---------------------------------------------------------------------------

export async function signIn({ email, password }: SignInValues): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(signInErrorMessage(error));
  }
}

/** Emails a magic link plus a 6-digit code. Only for existing accounts. */
export async function sendSignInCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: authCallbackUrl() },
  });
  // Don't reveal whether the email has an account.
  if (error && error.code !== 'otp_disabled' && error.status !== 400 && error.status !== 422) {
    throw new Error(otpErrorMessage(error));
  }
}

export async function verifySignInCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw new Error(otpErrorMessage(error));
}

/** Exchanges the `?code=` from an email link for a session (PKCE). */
export async function exchangeAuthCode(code: string): Promise<void> {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw new Error(otpErrorMessage(error));
}

export async function signOut(): Promise<void> {
  // Remove this device's push token while still signed in (RLS needs the session).
  await unregisterPushToken().catch(() => {});
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Sign up
// ---------------------------------------------------------------------------

/** Result of a sign-up: signed in right away, or email confirmation required. */
export type SignUpResult = { needsEmailConfirmation: boolean };

export async function signUpBusiness(values: BusinessSignUpValues): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      emailRedirectTo: authCallbackUrl(),
      // Read by the on_auth_user_created trigger to create the business + admin profile.
      data: {
        signup_type: 'business',
        business_name: values.businessName,
        timezone: values.timeZone,
        full_name: values.fullName,
      },
    },
  });
  if (error) throw new Error(signUpErrorMessage(error, 'business'));
  return { needsEmailConfirmation: !data.session };
}

export type InvitePreview = {
  organizationName: string;
  role: 'owner' | 'sitter' | 'admin';
  emailLocked: boolean;
};

/** Looks up an invite code without signing in. Null if invalid, expired, or used. */
export async function checkInvite(code: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc('check_invite', { p_code: normalizeInviteCode(code) });
  if (error) throw error;
  const row = data[0];
  return row
    ? { organizationName: row.organization_name, role: row.role, emailLocked: row.email_locked }
    : null;
}

export async function signUpWithInvite(
  code: string,
  values: InviteSignUpValues,
): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      emailRedirectTo: authCallbackUrl(),
      data: {
        invite_code: normalizeInviteCode(code),
        full_name: values.fullName,
        phone: values.phone,
      },
    },
  });
  if (error) throw new Error(signUpErrorMessage(error, 'invite'));
  return { needsEmailConfirmation: !data.session };
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authCallbackUrl({ type: 'recovery' }),
  });
  if (error && error.status !== 400 && error.status !== 422) {
    throw new Error(otpErrorMessage(error));
  }
}

/** Signs in with the reset code; the auth listener then holds the user on the reset screen. */
export async function verifyRecoveryCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
  if (error) throw new Error(otpErrorMessage(error));
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw new Error(
      error.code === 'same_password'
        ? 'Choose a password different from your old one.'
        : 'Could not save the new password. Please try again.',
    );
  }
}

// ---------------------------------------------------------------------------
// Profile, household, account
// ---------------------------------------------------------------------------

/** The signed-in user's profile, or null if they have no profile yet. */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}

export async function updateProfile(userId: string, values: ProfileValues): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: values.fullName, phone: values.phone || null })
    .eq('id', userId);
  if (error) throw error;
}

export async function ownerHasHousehold(ownerId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('households')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Owner onboarding: saves their phone and creates their household. */
export async function createHousehold(
  ownerId: string,
  ownerName: string,
  values: HouseholdValues,
): Promise<void> {
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ phone: values.phone })
    .eq('id', ownerId);
  if (profileError) throw profileError;

  const { data: household, error } = await supabase
    .from('households')
    .insert({
      owner_id: ownerId,
      name: `${ownerName.split(' ')[0]}'s home`,
      address_line1: values.addressLine1,
      address_line2: values.addressLine2 || null,
      city: values.city,
      region: values.region || null,
      postal_code: values.postalCode || null,
    })
    .select('id')
    .single();
  if (error) throw error;

  if (values.entryInstructions) {
    const { error: accessError } = await supabase
      .from('household_access')
      .insert({ household_id: household.id, entry_instructions: values.entryInstructions });
    if (accessError) throw accessError;
  }
}

/** Permanently deletes the account (server-side rules in the delete-account function). */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) {
    let message = 'Could not delete your account. Please try again.';
    const response = (error as { context?: Response }).context;
    if (response && typeof response.json === 'function') {
      const body = await response.json().catch(() => null);
      if (body?.error) message = body.error;
    }
    throw new Error(message);
  }
  await unregisterPushToken().catch(() => {});
  // The server already deleted the user; clear the local session.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
