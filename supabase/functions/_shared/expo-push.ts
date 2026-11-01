// Sending through the Expo Push API (Deno, service_role only). Honors each user's
// notification settings, sends in chunks of 100, and forgets devices Expo reports
// as unregistered.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { allowedRecipients, type AlertKind } from './alerts.ts';
import type { Database } from './database.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100;

type ExpoTicket = { status: 'ok' | 'error'; details?: { error?: string } };

export type Client = SupabaseClient<Database>;

export type OutgoingPush = {
  kind: AlertKind;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

export type SendResult = { sent: number; skipped: number; removed: number };

export async function sendPush(
  supabase: Client,
  message: OutgoingPush,
  recipientIds: readonly string[],
): Promise<SendResult> {
  const unique = [...new Set(recipientIds.filter(Boolean))];
  if (unique.length === 0) return { sent: 0, skipped: 0, removed: 0 };

  const { data: settings, error: settingsError } = await supabase
    .from('notification_settings')
    .select('user_id, muted')
    .in('user_id', unique);
  if (settingsError) throw settingsError;
  const recipients = allowedRecipients(unique, settings ?? [], message.kind);
  if (recipients.length === 0) return { sent: 0, skipped: unique.length, removed: 0 };

  const { data: tokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('token')
    .in('profile_id', recipients);
  if (tokenError) throw tokenError;
  if (!tokens?.length) return { sent: 0, skipped: unique.length - recipients.length, removed: 0 };

  const stale: string[] = [];
  for (let i = 0; i < tokens.length; i += CHUNK) {
    const batch = tokens.slice(i, i + CHUNK);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(
        batch.map((t) => ({
          to: t.token,
          sound: 'default',
          channelId: 'default',
          // Incidents are urgent; the rest can wait for the next delivery window.
          priority: message.kind === 'incident' ? 'high' : 'default',
          title: message.title,
          body: message.body,
          data: { ...message.data, kind: message.kind },
        })),
      ),
    });
    const result = (await response.json().catch(() => ({}))) as { data?: ExpoTicket[] };
    (result.data ?? []).forEach((ticket, j) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        stale.push(batch[j].token);
      }
    });
  }
  if (stale.length) await supabase.from('push_tokens').delete().in('token', stale);

  return { sent: tokens.length, skipped: unique.length - recipients.length, removed: stale.length };
}

export { isServiceRole } from './service-auth.ts';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
