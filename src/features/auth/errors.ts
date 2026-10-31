type MaybeAuthError = { message?: string; status?: number; code?: string } | null | undefined;

/** Maps Supabase auth errors to short, user-facing sign-in messages. */
export function signInErrorMessage(error: MaybeAuthError): string {
  const code = error?.code;
  const message = error?.message?.toLowerCase() ?? '';

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'Email or password is incorrect.';
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }
  if (error?.status === 429 || code === 'over_request_rate_limit') {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return 'Something went wrong signing in. Please try again.';
}

/** Sign-up failures. The DB trigger's errors reach the client as a generic message. */
export function signUpErrorMessage(error: MaybeAuthError, kind: 'business' | 'invite'): string {
  const code = error?.code;
  const message = error?.message?.toLowerCase() ?? '';

  if (code === 'user_already_exists' || message.includes('already registered')) {
    return 'An account with this email already exists. Log in instead.';
  }
  if (code === 'weak_password' || message.includes('password should')) {
    return 'Choose a stronger password (at least 8 characters).';
  }
  if (message.includes('database error') || code === 'unexpected_failure') {
    return kind === 'invite'
      ? "That invite can't be used. It may have expired, been used, or be for a different email."
      : "Couldn't create your business. Check the time zone (e.g. America/New_York) and try again.";
  }
  if (
    error?.status === 429 ||
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit'
  ) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return 'Something went wrong creating your account. Please try again.';
}

/** Failures verifying a 6-digit email code. */
export function otpErrorMessage(error: MaybeAuthError): string {
  const code = error?.code;
  const message = error?.message?.toLowerCase() ?? '';
  if (code === 'otp_expired' || message.includes('expired') || message.includes('invalid')) {
    return 'That code is wrong or has expired. Request a new one.';
  }
  if (error?.status === 429 || code === 'over_request_rate_limit') {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return 'Something went wrong. Please try again.';
}
