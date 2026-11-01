// alert-checks: time-based alerts, called by pg_cron through
// private.invoke_edge_function with the service_role JWT.
//
//   { job: 'photos' }  every minute: one "Max: 4 new photos" alert per visit, at
//                      most every 5 minutes (decidePhotoAlert)
//   { job: 'checks' }  every 5 minutes: sitter reminders 30 minutes before visits,
//                      late check-ins (owner and admins), medication due during stays
//
// The decisions are pure (../_shared/alerts.ts, tested in Jest). notification_log
// makes each alert go out once: its row is claimed before sending.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { loadVisitPeople } from '../_shared/alert-context.ts';
import {
  decidePhotoAlert,
  lateCheckIns,
  LATE_AFTER_MS,
  medicationsDue,
  REMINDER_BEFORE_MS,
  visitReminders,
} from '../_shared/alerts.ts';
import type { Database } from '../_shared/database.ts';
import { isServiceRole, json, sendPush, type Client } from '../_shared/expo-push.ts';
import { buildVisitAlert, type VisitAlertEvent } from '../_shared/push-messages.ts';

const PHOTO_LOOKBACK_MS = 6 * 3_600_000;
const LATE_LOOKBACK_MS = 3 * 3_600_000;

/** Records an alert; false if it was already recorded (sent before). */
async function claim(
  supabase: Client,
  row: { organization_id: string; kind: string; key: string; visit_id: string | null },
): Promise<boolean> {
  const { data, error } = await supabase
    .from('notification_log')
    .upsert(row, { onConflict: 'kind,key', ignoreDuplicates: true })
    .select('id');
  if (error) throw error;
  return (data ?? []).length > 0;
}

async function alreadySent(supabase: Client, kind: string, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const { data, error } = await supabase
    .from('notification_log')
    .select('key')
    .eq('kind', kind)
    .in('key', keys);
  if (error) throw error;
  return new Set(data.map((r) => r.key));
}

/** Sends a visit alert to each audience it has a message for. */
async function alertVisit(
  supabase: Client,
  event: VisitAlertEvent,
  audiences: ('owner' | 'sitter' | 'admin')[],
): Promise<number> {
  const people = await loadVisitPeople(supabase, event.visit_id);
  if (!people) return 0;
  let sent = 0;
  for (const audience of audiences) {
    const message = buildVisitAlert(event, people.context, audience);
    const recipients =
      audience === 'owner'
        ? [people.ownerId]
        : audience === 'admin'
          ? people.adminIds
          : [people.sitterId];
    const ids = recipients.filter((id): id is string => !!id);
    if (message && ids.length) sent += (await sendPush(supabase, message, ids)).sent;
  }
  return sent;
}

async function photosJob(supabase: Client, now: Date) {
  const { data: media, error } = await supabase
    .from('media')
    .select('visit_id, organization_id, type, created_at')
    .gt('created_at', new Date(now.getTime() - PHOTO_LOOKBACK_MS).toISOString())
    .order('created_at');
  if (error) throw error;

  const byVisit = new Map<string, typeof media>();
  for (const m of media) byVisit.set(m.visit_id, [...(byVisit.get(m.visit_id) ?? []), m]);
  if (byVisit.size === 0) return { visits: 0, alerts: 0 };

  const { data: logs, error: logError } = await supabase
    .from('notification_log')
    .select('key, sent_at, covered_until')
    .eq('kind', 'new_photos')
    .in('key', [...byVisit.keys()]);
  if (logError) throw logError;
  const last = new Map(logs.map((l) => [l.key, l]));

  let alerts = 0;
  for (const [visitId, items] of byVisit) {
    const log = last.get(visitId);
    const coveredUntil = log?.covered_until ? Date.parse(log.covered_until) : -Infinity;
    const unsent = items.filter((m) => Date.parse(m.created_at) > coveredUntil);
    const decision = decidePhotoAlert({
      unsent: unsent.map((m) => new Date(m.created_at)),
      lastAlertAt: log ? new Date(log.sent_at) : null,
      now,
    });
    if (!decision.send) continue;

    const { error: upsertError } = await supabase.from('notification_log').upsert(
      {
        organization_id: items[0].organization_id,
        kind: 'new_photos',
        key: visitId,
        visit_id: visitId,
        covered_until: decision.coveredUntil.toISOString(),
        sent_at: now.toISOString(),
      },
      { onConflict: 'kind,key' },
    );
    if (upsertError) throw upsertError;
    await alertVisit(
      supabase,
      {
        type: 'visit_photos',
        visit_id: visitId,
        count: decision.count,
        has_video: unsent.some((m) => m.type === 'video'),
      },
      ['owner'],
    );
    alerts++;
  }
  return { visits: byVisit.size, alerts };
}

async function checksJob(supabase: Client, now: Date) {
  const iso = (ms: number) => new Date(now.getTime() + ms).toISOString();

  // Reminders: scheduled visits starting in the next 30 minutes.
  const { data: upcoming, error: upcomingError } = await supabase
    .from('visits')
    .select('id, organization_id, status, sitter_id, scheduled_start')
    .eq('status', 'scheduled')
    .not('sitter_id', 'is', null)
    .gt('scheduled_start', now.toISOString())
    .lte('scheduled_start', iso(REMINDER_BEFORE_MS));
  if (upcomingError) throw upcomingError;
  const reminded = await alreadySent(
    supabase,
    'visit_reminder',
    upcoming.map((v) => v.id),
  );
  let reminders = 0;
  for (const visit of visitReminders(upcoming, now, reminded)) {
    if (
      !(await claim(supabase, {
        organization_id: visit.organization_id,
        kind: 'visit_reminder',
        key: visit.id,
        visit_id: visit.id,
      }))
    )
      continue;
    await alertVisit(supabase, { type: 'visit_reminder', visit_id: visit.id }, ['sitter']);
    reminders++;
  }

  // Late check-ins: nobody checked in 15 minutes after the window start.
  const { data: started, error: startedError } = await supabase
    .from('visits')
    .select('id, organization_id, status, scheduled_start, scheduled_end, check_in_at')
    .in('status', ['scheduled', 'on_the_way'])
    .is('check_in_at', null)
    .gte('scheduled_start', iso(-LATE_LOOKBACK_MS))
    .lte('scheduled_start', iso(-LATE_AFTER_MS));
  if (startedError) throw startedError;
  const flagged = await alreadySent(
    supabase,
    'late_check_in',
    started.map((v) => v.id),
  );
  let late = 0;
  for (const visit of lateCheckIns(started, now, flagged)) {
    if (
      !(await claim(supabase, {
        organization_id: visit.organization_id,
        kind: 'late_check_in',
        key: visit.id,
        visit_id: visit.id,
      }))
    )
      continue;
    await alertVisit(supabase, { type: 'late_check_in', visit_id: visit.id }, ['admin', 'owner']);
    late++;
  }

  // Medication due during overnight and multi-day stays under way.
  const { data: stays, error: staysError } = await supabase
    .from('visits')
    .select(
      `id, organization_id, status, scheduled_start, scheduled_end,
       organization:organizations ( timezone ),
       booking:bookings!inner (
         service_type,
         booking_pets ( pet:pets ( id, name, pet_medications ( id, name, dose, schedule_times ) ) )
       ),
       care_events ( pet_id, type, value )`,
    )
    .in('status', ['arrived', 'in_progress'])
    .in('booking.service_type', ['overnight', 'multi_day']);
  if (staysError) throw staysError;
  let meds = 0;
  for (const stay of stays) {
    try {
      meds += await stayMedications(supabase, stay, now);
    } catch (error) {
      // One stay's bad data must not stop the other alerts.
      console.error(`alert-checks: medication check for visit ${stay.id}`, error);
    }
  }

  return { reminders, late, meds };
}

type Stay = {
  id: string;
  organization_id: string;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  organization: { timezone: string } | null;
  booking: {
    service_type: string;
    booking_pets: {
      pet: {
        id: string;
        name: string;
        pet_medications: {
          id: string;
          name: string;
          dose: string | null;
          schedule_times: string[];
        }[];
      } | null;
    }[];
  };
  care_events: { pet_id: string | null; type: string; value: unknown }[];
};

async function stayMedications(supabase: Client, stay: Stay, now: Date): Promise<number> {
  let meds = 0;
  {
    const pets = stay.booking.booking_pets.flatMap((bp) => (bp.pet ? [bp.pet] : []));
    const candidates = medicationsDue(
      { ...stay, service_type: stay.booking.service_type },
      pets,
      stay.care_events,
      stay.organization?.timezone ?? 'UTC',
      now,
      new Set(),
    );
    const sent = await alreadySent(
      supabase,
      'medication_due',
      candidates.map((c) => c.key),
    );
    for (const dose of candidates.filter((c) => !sent.has(c.key))) {
      if (
        !(await claim(supabase, {
          organization_id: stay.organization_id,
          kind: 'medication_due',
          key: dose.key,
          visit_id: stay.id,
        }))
      )
        continue;
      await alertVisit(
        supabase,
        {
          type: 'medication_due',
          visit_id: stay.id,
          pet_name: dose.petName,
          title: dose.title,
          due_at: dose.dueAt,
        },
        ['sitter'],
      );
      meds++;
    }
  }
  return meds;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isServiceRole(req)) return json({ error: 'Forbidden' }, 403);
  const body = (await req.json().catch(() => ({}))) as { job?: string };

  const supabase = createClient<Database>(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const now = new Date();
  try {
    if (body.job === 'photos') return json(await photosJob(supabase, now));
    if (body.job === 'checks') return json(await checksJob(supabase, now));
    return json({ error: 'Unknown job' }, 400);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
