// GENERATED from packages/shared/src/chat-alerts.ts by scripts/sync-shared.mjs. Do not edit;
// change the source and run `npm run shared:sync`.

// Push alerts for household chat messages. Pure TypeScript shared by notify-owner
// and alert-checks (Deno) and Jest.
//
// The first message in a quiet conversation is pushed at once; messages arriving
// within a minute of the last alert are batched into one alert by the minute job.
// Each participant hears only about others' messages they haven't read yet.

import type { AlertMessage } from './push-messages.ts';

export const MESSAGE_ALERT_GAP_MS = 60_000;

export type MessageDecision =
  { send: true; coveredUntil: Date } | { send: false; retryAt: Date | null };

export function decideMessageAlert({
  unsent,
  lastAlertAt,
  now,
}: {
  unsent: readonly Date[];
  lastAlertAt: Date | null;
  now: Date;
}): MessageDecision {
  if (unsent.length === 0) return { send: false, retryAt: null };
  if (lastAlertAt && now.getTime() - lastAlertAt.getTime() < MESSAGE_ALERT_GAP_MS) {
    return { send: false, retryAt: new Date(lastAlertAt.getTime() + MESSAGE_ALERT_GAP_MS) };
  }
  const newest = Math.max(...unsent.map((d) => d.getTime()));
  return { send: true, coveredUntil: new Date(newest) };
}

type ChatMessage = {
  sender_id: string | null;
  sender_name: string | null;
  body: string | null;
  has_photo: boolean;
  created_at: string;
};

export type RecipientAlert = {
  recipientId: string;
  count: number;
  /** First names, in the order they wrote. */
  senderNames: string[];
  last: { body: string | null; hasPhoto: boolean };
};

/** One alert per participant with unread messages from others in this batch. */
export function messageAlertsByRecipient(
  messages: readonly ChatMessage[],
  participants: readonly string[],
  readAt: ReadonlyMap<string, Date>,
): RecipientAlert[] {
  const sorted = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const alerts: RecipientAlert[] = [];
  for (const recipientId of new Set(participants)) {
    const read = readAt.get(recipientId)?.getTime() ?? -Infinity;
    const theirs = sorted.filter(
      (m) => m.sender_id !== recipientId && Date.parse(m.created_at) > read,
    );
    if (theirs.length === 0) continue;
    const names = [...new Set(theirs.map((m) => m.sender_name?.split(' ')[0] || 'Someone'))];
    const last = theirs[theirs.length - 1];
    alerts.push({
      recipientId,
      count: theirs.length,
      senderNames: names,
      last: { body: last.body, hasPhoto: last.has_photo },
    });
  }
  return alerts;
}

const PREVIEW_LENGTH = 140;

function preview(last: RecipientAlert['last']): string {
  const text = last.body?.trim();
  if (!text) return last.hasPhoto ? '📷 Photo' : 'New message';
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH - 1)}…` : text;
}

const joinNames = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? 'Someone')
    : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;

export function buildMessageAlert(
  alert: RecipientAlert,
  conversation: { householdId: string; householdName: string },
): AlertMessage {
  const data = { type: 'message', householdId: conversation.householdId };
  if (alert.count === 1) {
    return {
      kind: 'messages',
      title: `${alert.senderNames[0]} · ${conversation.householdName}`,
      body: preview(alert.last),
      data,
    };
  }
  return {
    kind: 'messages',
    title: `${conversation.householdName}: ${alert.count} new messages`,
    body: `${joinNames(alert.senderNames)}: ${preview(alert.last)}`,
    data,
  };
}
