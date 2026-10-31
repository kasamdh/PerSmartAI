// notify-owner: sends Expo push notifications for visit events.
//
// Called only by database triggers (private.send_push_event) with the service_role
// JWT. The gateway verifies the JWT signature (verify_jwt = true); this function
// additionally requires role = service_role so signed-in users can't trigger pushes.

import { createClient } from 'npm:@supabase/supabase-js@2';

import type { Database } from '../_shared/database.ts';
import { buildPushMessage, type PushEvent } from '../_shared/push-messages.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type ExpoTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isServiceRole(req: Request): boolean {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const payload = token.split('.')[1];
  if (!payload) return false;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return claims.role === 'service_role';
  } catch {
    return false;
  }
}

function isPushEvent(value: unknown): value is PushEvent {
  const v = value as Record<string, unknown> | null;
  return (
    !!v &&
    typeof v.visit_id === 'string' &&
    (v.type === 'visit_status' || v.type === 'visit_photo' || v.type === 'incident')
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isServiceRole(req)) return json({ error: 'Forbidden' }, 403);

  const event: unknown = await req.json().catch(() => null);
  if (!isPushEvent(event)) return json({ error: 'Invalid event' }, 400);

  const supabase = createClient<Database>(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: visit, error } = await supabase
    .from('visits')
    .select(
      `organization_id,
       sitter:profiles ( full_name ),
       booking:bookings ( household:households ( owner_id ), booking_pets ( pet:pets ( name ) ) )`,
    )
    .eq('id', event.visit_id)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!visit) return json({ sent: 0, reason: 'visit not found' });

  const message = buildPushMessage(event, {
    sitterName: visit.sitter?.full_name ?? null,
    petNames: visit.booking.booking_pets.flatMap((bp) => (bp.pet ? [bp.pet.name] : [])),
  });
  if (!message) return json({ sent: 0, reason: 'no message for this event' });

  // Owners hear about everything; admins also hear about incidents.
  const recipients = new Set([visit.booking.household.owner_id]);
  if (event.type === 'incident') {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', visit.organization_id)
      .eq('role', 'admin');
    admins?.forEach((a) => recipients.add(a.id));
  }

  const { data: tokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('token')
    .in('profile_id', [...recipients]);
  if (tokenError) return json({ error: tokenError.message }, 500);
  if (!tokens?.length) return json({ sent: 0, reason: 'no devices registered' });

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(
      tokens.map((t) => ({ to: t.token, sound: 'default', channelId: 'default', ...message })),
    ),
  });
  const result = (await response.json().catch(() => ({}))) as {
    data?: ExpoTicket[];
    errors?: unknown[];
  };

  // Forget devices Expo says are gone (app uninstalled, token rotated).
  const stale = (result.data ?? []).flatMap((ticket, i) =>
    ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
      ? [tokens[i].token]
      : [],
  );
  if (stale.length) {
    await supabase.from('push_tokens').delete().in('token', stale);
  }

  return json({
    sent: tokens.length,
    removed: stale.length,
    tickets: result.data,
    errors: result.errors,
  });
});
