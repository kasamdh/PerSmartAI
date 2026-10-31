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
