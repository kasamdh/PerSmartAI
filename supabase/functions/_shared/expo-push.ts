// Sending through the Expo Push API (Deno, service_role only). Honors each user's
// notification settings, sends in chunks of 100, and forgets devices Expo reports
// as unregistered.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { allowedRecipients, type AlertKind } from './alerts.ts';
import type { Database } from './database.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * With "Enhanced Security for Push Notifications" on in the Expo dashboard, Expo
 * only accepts pushes carrying this access token (function secret
 * EXPO_ACCESS_TOKEN), so a leaked device token can't be used to message people.
 */
export function expoPushHeaders(accessToken = Deno.env.get('EXPO_ACCESS_TOKEN')): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}
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
      headers: expoPushHeaders(),
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
    if (response.status === 401 || response.status === 403) {
      // Enhanced push security is on but EXPO_ACCESS_TOKEN is missing or wrong.
      console.error(`Expo push refused (${response.status}): check the EXPO_ACCESS_TOKEN secret`);
    }
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
