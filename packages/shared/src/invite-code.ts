/** Invite codes: 8 characters, no look-alikes (no 0/O, 1/I/L). Must match the DB generator. */
export const INVITE_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{8}$/;

/** "k7qm-3xpt " → "K7QM3XPT". Strips anything that isn't a letter or digit. */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** "K7QM3XPT" → "K7QM-3XPT" for display and sharing. */
export function formatInviteCode(code: string): string {
  const c = normalizeInviteCode(code);
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export function isValidInviteCode(input: string): boolean {
  return INVITE_CODE_PATTERN.test(normalizeInviteCode(input));
}
