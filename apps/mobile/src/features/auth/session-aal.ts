/**
 * The assurance level in a Supabase access token: 'aal2' after two-step sign-in.
 * Read for routing only; the database checks the same claim on every request.
 */
export function sessionAal(accessToken: string | null | undefined): 'aal1' | 'aal2' | null {
  const payload = accessToken?.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(
      payload
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(payload.length / 4) * 4, '='),
    );
    const aal = (JSON.parse(json) as { aal?: unknown }).aal;
    return aal === 'aal1' || aal === 'aal2' ? aal : null;
  } catch {
    return null;
  }
}
