// Sends chat message alerts for one household (Deno, service_role). Used by
// notify-owner (right after a message) and alert-checks (every minute, for
// messages that came in within a minute of the previous alert).

import { adminIds } from './alert-context.ts';
import { buildMessageAlert, decideMessageAlert, messageAlertsByRecipient } from './chat-alerts.ts';
import { sendPush, type Client } from './expo-push.ts';

const LOOKBACK_MS = 3_600_000;
const SITTER_WINDOW_MS = 30 * 24 * 3_600_000;

/** Owner, admins, and sitters with a visit in the last or next 30 days (as private.can_chat). */
async function participants(
  supabase: Client,
  household: { id: string; owner_id: string; organization_id: string },
  now: Date,
): Promise<string[]> {
  const { data: visits, error } = await supabase
    .from('visits')
    .select('sitter_id, booking:bookings!inner ( household_id )')
    .eq('booking.household_id', household.id)
    .neq('status', 'cancelled')
    .not('sitter_id', 'is', null)
    .gte('scheduled_end', new Date(now.getTime() - SITTER_WINDOW_MS).toISOString())
    .lte('scheduled_start', new Date(now.getTime() + SITTER_WINDOW_MS).toISOString());
  if (error) throw error;
  return [
    ...new Set([
      household.owner_id,
      ...(await adminIds(supabase, household.organization_id)),
      ...visits.map((v) => v.sitter_id!),
    ]),
  ];
}

export async function sendChatAlerts(
  supabase: Client,
  householdId: string,
  now: Date,
): Promise<{ sent: number; reason?: string }> {
  const { data: household, error } = await supabase
    .from('households')
    .select('id, owner_id, organization_id, name, address_line1')
    .eq('id', householdId)
    .maybeSingle();
  if (error) throw error;
  if (!household) return { sent: 0, reason: 'household not found' };

  const { data: log, error: logError } = await supabase
    .from('notification_log')
    .select('sent_at, covered_until')
    .eq('kind', 'messages')
    .eq('key', householdId)
    .maybeSingle();
  if (logError) throw logError;

  const since = log?.covered_until ?? new Date(now.getTime() - LOOKBACK_MS).toISOString();
  const { data: messages, error: messageError } = await supabase
    .from('messages')
    .select('sender_id, body, photo_path, created_at, sender:profiles ( full_name )')
    .eq('household_id', householdId)
    .gt('created_at', since)
    .order('created_at')
    .limit(200);
  if (messageError) throw messageError;

  const decision = decideMessageAlert({
    unsent: messages.map((m) => new Date(m.created_at)),
    lastAlertAt: log ? new Date(log.sent_at) : null,
    now,
  });
  if (!decision.send) return { sent: 0, reason: messages.length ? 'batching' : 'nothing new' };

  // Claim the batch first so a concurrent run doesn't send it again.
  const { error: claimError } = await supabase.from('notification_log').upsert(
    {
      organization_id: household.organization_id,
      kind: 'messages',
      key: householdId,
      covered_until: decision.coveredUntil.toISOString(),
      sent_at: now.toISOString(),
    },
    { onConflict: 'kind,key' },
  );
  if (claimError) throw claimError;

  const people = await participants(supabase, household, now);
  const { data: reads, error: readError } = await supabase
    .from('conversation_reads')
    .select('user_id, read_at')
    .eq('household_id', householdId);
  if (readError) throw readError;

  const alerts = messageAlertsByRecipient(
    messages.map((m) => ({
      sender_id: m.sender_id,
      sender_name: m.sender?.full_name ?? null,
      body: m.body,
      has_photo: !!m.photo_path,
      created_at: m.created_at,
    })),
    people,
    new Map(reads.map((r) => [r.user_id, new Date(r.read_at)])),
  );
  let sent = 0;
  for (const alert of alerts) {
    const message = buildMessageAlert(alert, {
      householdId,
      householdName: household.name ?? household.address_line1,
    });
    sent += (await sendPush(supabase, message, [alert.recipientId])).sent;
  }
  return { sent };
}
