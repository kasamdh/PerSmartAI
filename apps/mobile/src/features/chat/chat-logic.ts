// Pure helpers for household chat: paging, read receipts, day separators.

import { toDateString } from '@/lib/wall-clock';

/** Messages load in pages of 30, newest first. */
export const PAGE_SIZE = 30;

export type Cursor = { created_at: string; id: string };

/** Where the next (older) page starts, or undefined after a short page. */
export function nextCursor(
  page: readonly { id: string; created_at: string }[],
): Cursor | undefined {
  if (page.length < PAGE_SIZE) return undefined;
  const oldest = page[page.length - 1];
  return { created_at: oldest.created_at, id: oldest.id };
}

const first = (name: string) => name.split(' ')[0];

/**
 * Under my own messages: "Read by Rudra", "Read by Rudra & Monika",
 * "Read by 3 people", or "Sent". Null for other people's messages.
 */
export function readReceipt(
  message: { sender_id: string | null; created_at: string },
  reads: readonly { user_id: string; read_at: string; name: string }[],
  me: string,
): string | null {
  if (message.sender_id !== me) return null;
  const sent = Date.parse(message.created_at);
  const readers = reads.filter((r) => r.user_id !== me && Date.parse(r.read_at) >= sent);
  if (readers.length === 0) return 'Sent';
  if (readers.length === 1) return `Read by ${first(readers[0].name)}`;
  if (readers.length === 2) {
    return `Read by ${first(readers[0].name)} & ${first(readers[1].name)}`;
  }
  return `Read by ${readers.length} people`;
}

/**
 * For a newest-first list: message id → local date, for the oldest message of
 * each day (shown above it, since the list is drawn bottom-up).
 */
export function daySeparators(
  messages: readonly { id: string; created_at: string }[],
): Map<string, string> {
  const separators = new Map<string, string>();
  messages.forEach((m, i) => {
    const day = toDateString(new Date(m.created_at));
    const older = messages[i + 1];
    if (!older || toDateString(new Date(older.created_at)) !== day) separators.set(m.id, day);
  });
  return separators;
}
