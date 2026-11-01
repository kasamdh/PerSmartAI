// notify-owner: sends Expo push notifications for visit, booking and sitter
// schedule events. (The name predates sitter and admin alerts.)
//
// Called only by database triggers (private.send_push_event, via pg_net) with the
// service_role JWT. The gateway verifies the JWT signature (verify_jwt = true); this
// function additionally requires role = service_role so users can't trigger pushes.
// Each recipient's notification settings are honored by sendPush.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { adminIds, loadVisitPeople } from '../_shared/alert-context.ts';
import type { Database } from '../_shared/database.ts';
import {
  isServiceRole,
  json,
  sendPush,
  type Client,
  type OutgoingPush,
} from '../_shared/expo-push.ts';
import {
  bookingRecipients,
  buildBookingPushMessage,
  buildPushMessage,
  buildSitterBookingAlert,
  buildVisitAlert,
  pushKind,
  type BookingPushEvent,
  type PushEvent,
  type SitterBookingEvent,
  type VisitAlertEvent,
} from '../_shared/push-messages.ts';

/** Messages and who gets each, or why nothing is sent. */
type Delivery = { push: OutgoingPush; recipients: string[] }[] | { reason: string };

const VISIT_EVENTS = ['visit_status', 'visit_photo', 'incident'];
const BOOKING_EVENTS = ['booking_requested', 'booking_status', 'booking_cancelled'];
const SITTER_BOOKING_EVENTS = ['booking_assigned', 'booking_unassigned', 'booking_changed'];
const VISIT_ALERT_EVENTS = [
  'visit_assigned',
  'visit_unassigned',
  'visit_changed',
  'visit_cancelled',
  'food_refused',
];

type Event = { type?: unknown; visit_id?: unknown; booking_id?: unknown };

async function visitDelivery(supabase: Client, event: PushEvent): Promise<Delivery> {
  const people = await loadVisitPeople(supabase, event.visit_id);
  if (!people) return { reason: 'visit not found' };
  const message = buildPushMessage(event, people.context);
  const kind = pushKind(event);
  if (!message || !kind) return { reason: 'no message for this event' };

  // Owners hear about everything; admins also hear about incidents, at once.
  const recipients = [people.ownerId, ...(event.type === 'incident' ? people.adminIds : [])];
  return [{ push: { ...message, kind }, recipients }];
}

async function visitAlertDelivery(supabase: Client, event: VisitAlertEvent): Promise<Delivery> {
  const people = await loadVisitPeople(supabase, event.visit_id);
  if (!people) return { reason: 'visit not found' };

  const sitterId =
    'sitter_id' in event && typeof event.sitter_id === 'string' ? event.sitter_id : people.sitterId;
  const deliveries: { push: OutgoingPush; recipients: string[] }[] = [];
  const add = (audience: 'owner' | 'sitter' | 'admin', recipients: (string | null)[]) => {
    const message = buildVisitAlert(event, people.context, audience);
    const ids = recipients.filter((id): id is string => !!id);
    if (message && ids.length) deliveries.push({ push: message, recipients: ids });
  };
  add('owner', [people.ownerId]);
  add('admin', people.adminIds);
  add('sitter', [sitterId]);
  return deliveries.length ? deliveries : { reason: 'no message for this event' };
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
  return [{ push: { ...message, kind: pushKind(event)! }, recipients }];
}

async function sitterBookingDelivery(
  supabase: Client,
  event: SitterBookingEvent,
): Promise<Delivery> {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('service_type, start_date, booking_pets ( pet:pets ( name ) )')
    .eq('id', event.booking_id)
    .maybeSingle();
  if (error) throw error;
  if (!booking) return { reason: 'booking not found' };
  const push = buildSitterBookingAlert(event, {
    petNames: booking.booking_pets.flatMap((bp) => (bp.pet ? [bp.pet.name] : [])),
    serviceType: booking.service_type,
    startDate: booking.start_date,
  });
  return [{ push, recipients: [event.sitter_id] }];
}

function route(supabase: Client, event: Event): Promise<Delivery> | null {
  const type = typeof event.type === 'string' ? event.type : '';
  if (VISIT_EVENTS.includes(type) && typeof event.visit_id === 'string') {
    return visitDelivery(supabase, event as PushEvent);
  }
  if (VISIT_ALERT_EVENTS.includes(type) && typeof event.visit_id === 'string') {
    return visitAlertDelivery(supabase, event as VisitAlertEvent);
  }
  if (BOOKING_EVENTS.includes(type) && typeof event.booking_id === 'string') {
    return bookingDelivery(supabase, event as BookingPushEvent);
  }
  if (SITTER_BOOKING_EVENTS.includes(type) && typeof event.booking_id === 'string') {
    return sitterBookingDelivery(supabase, event as SitterBookingEvent);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isServiceRole(req)) return json({ error: 'Forbidden' }, 403);

  const event = (await req.json().catch(() => null)) as Event | null;
  const supabase = createClient<Database>(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const pending = event ? route(supabase, event) : null;
  if (!pending) return json({ error: 'Invalid event' }, 400);

  try {
    const delivery = await pending;
    if ('reason' in delivery) return json({ sent: 0, reason: delivery.reason });
    const results = [];
    for (const d of delivery) results.push(await sendPush(supabase, d.push, d.recipients));
    return json({ results });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
