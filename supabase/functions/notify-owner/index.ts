// notify-owner: sends Expo push notifications for visit and booking events.
//
// Called only by database triggers (private.send_push_event) with the service_role
// JWT. The gateway verifies the JWT signature (verify_jwt = true); this function
// additionally requires role = service_role so signed-in users can't trigger pushes.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import type { Database } from '../_shared/database.ts';
import {
  bookingRecipients,
  buildBookingPushMessage,
  buildPushMessage,
  type BookingPushEvent,
  type PushEvent,
  type PushMessage,
} from '../_shared/push-messages.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type ExpoTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

type Client = SupabaseClient<Database>;

/** A message and who gets it, or why nothing is sent. */
type Delivery = { message: PushMessage; recipients: string[] } | { reason: string };

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

function isBookingPushEvent(value: unknown): value is BookingPushEvent {
  const v = value as Record<string, unknown> | null;
  return (
    !!v &&
    typeof v.booking_id === 'string' &&
    (v.type === 'booking_requested' ||
      (v.type === 'booking_status' && (v.status === 'confirmed' || v.status === 'declined')) ||
      v.type === 'booking_cancelled')
  );
}

async function adminIds(supabase: Client, organizationId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('role', 'admin');
  if (error) throw error;
  return data.map((a) => a.id);
}

async function visitDelivery(supabase: Client, event: PushEvent): Promise<Delivery> {
  const { data: visit, error } = await supabase
    .from('visits')
    .select(
      `organization_id,
       sitter:profiles ( full_name ),
       booking:bookings ( household:households ( owner_id ), booking_pets ( pet:pets ( name ) ) )`,
    )
    .eq('id', event.visit_id)
    .maybeSingle();
  if (error) throw error;
  if (!visit) return { reason: 'visit not found' };

  const message = buildPushMessage(event, {
    sitterName: visit.sitter?.full_name ?? null,
    petNames: visit.booking.booking_pets.flatMap((bp) => (bp.pet ? [bp.pet.name] : [])),
  });
  if (!message) return { reason: 'no message for this event' };

  // Owners hear about everything; admins also hear about incidents.
  const recipients = new Set([visit.booking.household.owner_id]);
  if (event.type === 'incident') {
    (await adminIds(supabase, visit.organization_id)).forEach((id) => recipients.add(id));
  }
  return { message, recipients: [...recipients] };
}

async function bookingDelivery(supabase: Client, event: BookingPushEvent): Promise<Delivery> {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select(
      `organization_id, service_type, start_date, sitter_id,
       sitter:profiles ( full_name ),
       household:households ( owner_id, owner:profiles ( full_name ) ),
       booking_pets ( pet:pets ( name ) )`,
    )
    .eq('id', event.booking_id)
    .maybeSingle();
  if (error) throw error;
  if (!booking) return { reason: 'booking not found' };

  const sitterIds = booking.sitter_id ? [booking.sitter_id] : [];
  if (event.type === 'booking_cancelled') {
    // Sitters of visits this cancellation just took off the schedule.
    const { data: visits, error: visitError } = await supabase
      .from('visits')
      .select('sitter_id')
      .eq('booking_id', event.booking_id)
      .eq('status', 'cancelled')
      .gt('scheduled_end', new Date().toISOString());
    if (visitError) throw visitError;
    visits.forEach((v) => v.sitter_id && sitterIds.push(v.sitter_id));
  }

  const ownerId = booking.household.owner_id;
  const recipients = bookingRecipients(event, {
    ownerId,
    adminIds: await adminIds(supabase, booking.organization_id),
    sitterIds,
  });
  const message = buildBookingPushMessage(event, {
    ownerName: booking.household.owner?.full_name ?? null,
    sitterName: booking.sitter?.full_name ?? null,
    petNames: booking.booking_pets.flatMap((bp) => (bp.pet ? [bp.pet.name] : [])),
    serviceType: booking.service_type,
    startDate: booking.start_date,
    cancelledByOwner: event.type === 'booking_cancelled' && event.actor_id === ownerId,
  });
  return { message, recipients };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isServiceRole(req)) return json({ error: 'Forbidden' }, 403);

  const event: unknown = await req.json().catch(() => null);
  const supabase = createClient<Database>(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  let delivery: Delivery;
  try {
    if (isPushEvent(event)) delivery = await visitDelivery(supabase, event);
    else if (isBookingPushEvent(event)) delivery = await bookingDelivery(supabase, event);
    else return json({ error: 'Invalid event' }, 400);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
  if ('reason' in delivery) return json({ sent: 0, reason: delivery.reason });
  if (delivery.recipients.length === 0) return json({ sent: 0, reason: 'no recipients' });

  const { data: tokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('token')
    .in('profile_id', delivery.recipients);
  if (tokenError) return json({ error: tokenError.message }, 500);
  if (!tokens?.length) return json({ sent: 0, reason: 'no devices registered' });

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(
      tokens.map((t) => ({
        to: t.token,
        sound: 'default',
        channelId: 'default',
        ...delivery.message,
      })),
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
