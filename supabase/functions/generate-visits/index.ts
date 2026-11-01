// generate-visits: the nightly top-up. pg_cron (job generate-visits, 08:15 UTC)
// calls it through private.invoke_edge_function with the service_role JWT.
//
// Every confirmed booking that can still have visits gets the next 60 days planned
// in its organization's time zone. store_generated_visits only adds slots the
// booking doesn't have yet, so moved and cancelled visits stay as they are, and a
// new visit the sitter can no longer take is stored unassigned for an admin.

import { isServiceRole } from '../_shared/service-auth.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

import type { Database } from '../_shared/database.ts';
import { BOOKING_FIELDS, toLoadedBooking, toVisitRows } from '../_shared/scheduling-data.ts';
import { localToday, needsGeneration, planVisits } from '../_shared/scheduling/index.ts';

const PAGE = 500;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isServiceRole(req)) return json({ error: 'Forbidden' }, 403);

  const admin = createClient<Database>(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const now = new Date();

  const { data: orgs, error: orgError } = await admin.from('organizations').select('id, timezone');
  if (orgError) return json({ error: orgError.message }, 500);
  const timeZones = new Map(orgs.map((o) => [o.id, o.timezone]));

  const totals = { bookings: 0, created: 0, unassigned: 0, failed: 0 };
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin
      .from('bookings')
      .select(BOOKING_FIELDS)
      .eq('status', 'confirmed')
      .order('id')
      .range(offset, offset + PAGE - 1);
    if (error) return json({ error: error.message, ...totals }, 500);

    for (const row of data) {
      const booking = toLoadedBooking(row as never);
      const timeZone = timeZones.get(booking.organization_id);
      if (!timeZone || !needsGeneration(booking, localToday(now, timeZone))) continue;

      try {
        const plan = planVisits(booking, { timeZone, now });
        if (plan.length === 0) continue;
        const { data: stored, error: storeError } = await admin.rpc('store_generated_visits', {
          p_booking_id: booking.id,
          p_visits: toVisitRows(plan),
        });
        if (storeError) throw storeError;
        const result = stored as { created: number; unassigned: number };
        totals.bookings++;
        totals.created += result.created;
        totals.unassigned += result.unassigned;
      } catch (e) {
        // One bad booking (e.g. an unreadable rule) must not stop the others.
        totals.failed++;
        console.error(`generate-visits: booking ${booking.id}`, e);
      }
    }
    if (data.length < PAGE) break;
  }

  return json(totals);
});
