// schedule-booking: every schedule change an admin makes, checked against the
// sitter's visits, travel buffer, availability and time off before it's saved.
//
// Runs as the caller (their JWT), so RLS applies and the RPCs check that they're an
// admin of the business. The RPCs re-check overlaps and time off under a per-sitter
// lock; this function adds availability and the detailed reasons.
//
// POST { action, ... }
//   check_sitters   { booking_id, sitter_ids }                       → { results: [{ sitter_id, ok, problems }] }
//   confirm         { booking_id, sitter_id, preview? }               → { created } | { ok, problems }
//   reschedule      { booking_id, from_date, changes, preview? }      → { booking_id } | { ok, problems }
//   update_visit    { visit_id, sitter_id?, date?, time?, duration_minutes?, preview? }
//   decide_request  { request_id, approve, decline_reason? }          → applies an owner's change request
// Blocked changes return 409 { error, problems }; problems are
// [{ local_date, start, end, blocking, reasons: string[] }].

import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders, preflight } from '../_shared/cors.ts';
import type { Database } from '../_shared/database.ts';
import {
  loadBooking,
  loadOrgSettings,
  loadSitterSchedule,
  toVisitRows,
  type Client,
  type LoadedBooking,
} from '../_shared/scheduling-data.ts';
import {
  carryOverCancellations,
  checkBookingForSitter,
  describeConflict,
  findConflicts,
  isLocalDate,
  localToday,
  localToUtc,
  moveVisit,
  parseLocalTime,
  parseRecurrence,
  seriesLastDate,
  splitSeries,
  summarizeProblems,
  type ProblemSummary,
  type SeriesChanges,
} from '../_shared/scheduling/index.ts';

type Json = Record<string, unknown>;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly problems: ProblemSummary[] = [],
  ) {
    super(message);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** Conflicts the RPCs raise (23P01) become 409s with the database's reason. */
function rpcError(error: { code?: string; message: string }): HttpError {
  if (error.code === '23P01') return new HttpError(409, error.message);
  if (error.code === '42501') return new HttpError(403, error.message);
  if (error.code === '22023' || error.code === '23514') return new HttpError(400, error.message);
  return new HttpError(500, error.message);
}

function blocked(problems: ProblemSummary[]): HttpError {
  const count = problems.filter((p) => p.blocking).length;
  return new HttpError(
    409,
    `The sitter can't take ${count === 1 ? 'one visit' : `${count} visits`}`,
    problems,
  );
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function requireBooking(client: Client, bookingId: string | null): Promise<LoadedBooking> {
  if (!bookingId) throw new HttpError(400, 'booking_id is required');
  const booking = await loadBooking(client, bookingId);
  if (!booking) throw new HttpError(404, 'Booking not found');
  return booking;
}

async function checkSitter(client: Client, booking: LoadedBooking, sitterId: string, now: Date) {
  const org = await loadOrgSettings(client, booking.organization_id);
  const sitter = await loadSitterSchedule(client, sitterId, org, now);
  const result = checkBookingForSitter(booking, sitter, org, now);
  return { org, ...result, problems: summarizeProblems(result.check, org.timeZone) };
}

async function checkSitters(client: Client, body: Json, now: Date) {
  const booking = await requireBooking(client, str(body.booking_id));
  const ids = Array.isArray(body.sitter_ids)
    ? body.sitter_ids.filter((v) => typeof v === 'string')
    : [];
  const results = [];
  for (const sitterId of ids.slice(0, 50)) {
    const { check, problems } = await checkSitter(client, booking, sitterId, now);
    results.push({ sitter_id: sitterId, ok: check.ok, blocking: check.blockingCount, problems });
  }
  return { results };
}

async function confirm(client: Client, body: Json, now: Date) {
  const booking = await requireBooking(client, str(body.booking_id));
  const sitterId = str(body.sitter_id);
  if (!sitterId) throw new HttpError(400, 'Choose a sitter');
  if (booking.status !== 'requested' && booking.status !== 'confirmed') {
    throw new HttpError(400, `This booking is ${booking.status}`);
  }

  const { plan, check, problems } = await checkSitter(client, booking, sitterId, now);
  if (!check.ok) throw blocked(problems);
  if (body.preview) return { ok: true, visits: plan.length, problems };

  const { data, error } = await client.rpc('apply_booking_plan', {
    p_booking_id: booking.id,
    p_sitter_id: sitterId,
    p_visits: toVisitRows(plan),
    p_end_date: booking.end_date ? undefined : (seriesLastDate(booking) ?? undefined),
  });
  if (error) throw rpcError(error);
  return { created: data, problems };
}

const SERIES_FIELDS = [
  'recurrence_rule',
  'end_date',
  'window_start',
  'window_end',
  'duration_minutes',
] as const;

function parseSeriesChanges(raw: unknown): SeriesChanges {
  if (typeof raw !== 'object' || raw === null) throw new HttpError(400, 'changes are required');
  const input = raw as Json;
  const changes: SeriesChanges = {};
  for (const key of Object.keys(input)) {
    if (!(SERIES_FIELDS as readonly string[]).includes(key)) {
      throw new HttpError(400, `${key} can't be changed here`);
    }
  }
  if ('recurrence_rule' in input) {
    const rule = input.recurrence_rule === null ? null : String(input.recurrence_rule);
    const parsed = parseRecurrence(rule);
    if (!parsed.ok) throw new HttpError(400, parsed.error);
    changes.recurrence_rule = rule;
  }
  if ('end_date' in input) {
    const value = input.end_date;
    if (value !== null && (typeof value !== 'string' || !isLocalDate(value))) {
      throw new HttpError(400, 'end_date must be a date like 2026-11-20');
    }
    changes.end_date = value as string | null;
  }
  for (const key of ['window_start', 'window_end'] as const) {
    if (key in input) {
      const value = input[key];
      if (value !== null && (typeof value !== 'string' || parseLocalTime(value) === null)) {
        throw new HttpError(400, `${key} must be a time like 13:00`);
      }
      changes[key] = value as string | null;
    }
  }
  if ('duration_minutes' in input) {
    const value = input.duration_minutes;
    if (
      value !== null &&
      !(Number.isInteger(value) && (value as number) > 0 && (value as number) <= 720)
    ) {
      throw new HttpError(400, 'duration_minutes must be between 1 and 720');
    }
    changes.duration_minutes = value as number | null;
  }
  return changes;
}

async function reschedule(client: Client, body: Json, now: Date) {
  const booking = await requireBooking(client, str(body.booking_id));
  const fromDate = str(body.from_date);
  if (!fromDate || !isLocalDate(fromDate)) throw new HttpError(400, 'from_date must be a date');
  if (booking.status !== 'confirmed' || !booking.sitter_id) {
    throw new HttpError(400, 'Only confirmed bookings with a sitter can be rescheduled');
  }
  const changes = parseSeriesChanges(body.changes);

  const org = await loadOrgSettings(client, booking.organization_id);
  const split = splitSeries(booking, fromDate, changes, localToday(now, org.timeZone));
  if (split.kind === 'error') throw new HttpError(400, split.error);

  // A split series gets its own care times (new ids), copied from the original.
  const isSplit = split.kind === 'split';
  const careIds = new Map<string, string>();
  const base = isSplit ? split.next : split.booking;
  const target: LoadedBooking = {
    ...booking,
    ...base,
    id: isSplit ? crypto.randomUUID() : booking.id,
    care_times: (base.care_times ?? []).map((c) => {
      if (!isSplit || !c.id) return c;
      const id = crypto.randomUUID();
      careIds.set(c.id, id);
      return { ...c, id };
    }),
  };

  const sitter = await loadSitterSchedule(client, booking.sitter_id, org, now);
  const { plan, check } = checkBookingForSitter(target, sitter, org, now, {
    fromDate,
    ignoreBookingIds: [booking.id],
  });
  const problems = summarizeProblems(check, org.timeZone);
  if (!check.ok) throw blocked(problems);
  if (body.preview) return { ok: true, visits: plan.length, problems };

  const { data: cancelled, error: cancelledError } = await client
    .from('visits')
    .select('id, scheduled_start, slot_start, care_time_id')
    .eq('booking_id', booking.id)
    .eq('status', 'cancelled')
    .gte('scheduled_start', localToUtc(fromDate, '00:00', org.timeZone).toISOString());
  if (cancelledError) throw cancelledError;
  const carry = carryOverCancellations(
    (cancelled ?? []).map((v) => ({
      ...v,
      care_time_id: v.care_time_id ? (careIds.get(v.care_time_id) ?? v.care_time_id) : null,
    })),
    plan,
    org.timeZone,
  );

  const { data, error } = await client.rpc('reschedule_booking', {
    p_booking_id: booking.id,
    p_from_date: fromDate,
    p_split: isSplit,
    p_schedule: {
      recurrence_rule: target.recurrence_rule,
      start_date: target.start_date,
      end_date: target.end_date,
      window_start: target.window_start,
      window_end: target.window_end,
      duration_minutes: target.duration_minutes,
    },
    p_care_times:
      isSplit && target.care_times?.length
        ? target.care_times.map((c) => ({
            id: c.id,
            care_time: c.time,
            duration_minutes: c.duration_minutes,
            label: c.label,
          }))
        : null,
    p_visits: toVisitRows(plan),
    p_carry: carry,
  });
  if (error) throw rpcError(error);
  return { booking_id: data, problems };
}

async function updateVisit(client: Client, body: Json, now: Date) {
  const visitId = str(body.visit_id);
  if (!visitId) throw new HttpError(400, 'visit_id is required');
  const { data: visit, error } = await client
    .from('visits')
    .select(
      'id, organization_id, sitter_id, status, scheduled_start, scheduled_end, booking:bookings ( household_id )',
    )
    .eq('id', visitId)
    .maybeSingle();
  if (error) throw error;
  if (!visit) throw new HttpError(404, 'Visit not found');
  if (visit.status !== 'scheduled')
    throw new HttpError(400, 'Only scheduled visits can be changed');

  const org = await loadOrgSettings(client, visit.organization_id);
  let start = visit.scheduled_start;
  let end = visit.scheduled_end;

  const date = str(body.date);
  const time = str(body.time);
  if (date || time) {
    if (!date || !isLocalDate(date) || !time || parseLocalTime(time) === null) {
      throw new HttpError(400, 'Give both a date (2026-11-20) and a time (13:00)');
    }
    const duration = body.duration_minutes;
    const moved = moveVisit(
      visit,
      { date, time, durationMinutes: typeof duration === 'number' ? duration : undefined },
      org.timeZone,
      now,
    );
    if (!moved.ok) throw new HttpError(400, moved.error);
    start = moved.scheduled_start;
    end = moved.scheduled_end;
  }

  const sitterId = str(body.sitter_id) ?? visit.sitter_id;
  let problems: ProblemSummary[] = [];
  if (sitterId) {
    const sitter = await loadSitterSchedule(client, sitterId, org, now);
    const booking = visit.booking as unknown as { household_id: string } | null;
    const conflicts = findConflicts(
      { start, end, household_id: booking?.household_id ?? null },
      { ...sitter, ...org, ignoreVisitIds: [visit.id] },
    );
    if (conflicts.length > 0) {
      problems = [
        {
          local_date: date ?? start.slice(0, 10),
          start,
          end,
          blocking: conflicts.some((c) => c.blocking),
          reasons: conflicts.map((c) => describeConflict(c, org.timeZone)),
        },
      ];
    }
    if (problems.some((p) => p.blocking)) throw blocked(problems);
  }
  if (body.preview) return { ok: true, problems };

  const { error: rpcErr } = await client.rpc('update_visit_schedule', {
    p_visit_id: visit.id,
    p_sitter_id: str(body.sitter_id) ?? undefined,
    p_start: start === visit.scheduled_start ? undefined : start,
    p_end: end === visit.scheduled_end ? undefined : end,
  });
  if (rpcErr) throw rpcError(rpcErr);
  return { ok: true, problems };
}

async function decideRequest(client: Client, body: Json, now: Date) {
  const requestId = str(body.request_id);
  if (!requestId) throw new HttpError(400, 'request_id is required');
  const { data: request, error } = await client
    .from('schedule_change_requests')
    .select('id, booking_id, visit_id, scope, from_date, changes, status')
    .eq('id', requestId)
    .maybeSingle();
  if (error) throw error;
  if (!request) throw new HttpError(404, 'Request not found');
  if (request.status !== 'requested')
    throw new HttpError(400, `This request was ${request.status}`);

  if (body.approve !== true) {
    const reason = str(body.decline_reason);
    const { error: declineError } = await client
      .from('schedule_change_requests')
      .update({ status: 'declined', decline_reason: reason })
      .eq('id', request.id)
      .eq('status', 'requested');
    if (declineError) throw declineError;
    return { status: 'declined' };
  }

  const changes = request.changes as Json;
  const result =
    request.scope === 'visit'
      ? await updateVisit(client, { visit_id: request.visit_id, ...changes }, now)
      : await reschedule(
          client,
          { booking_id: request.booking_id, from_date: request.from_date, changes },
          now,
        );

  const { error: approveError } = await client
    .from('schedule_change_requests')
    .update({ status: 'approved' })
    .eq('id', request.id)
    .eq('status', 'requested');
  if (approveError) throw approveError;
  return { status: 'approved', ...result };
}

// ---------------------------------------------------------------------------

const ACTIONS = {
  check_sitters: checkSitters,
  confirm,
  reschedule,
  update_visit: updateVisit,
  decide_request: decideRequest,
} as const;

Deno.serve(async (req) => {
  const cors = preflight(req);
  if (cors) return cors;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Not signed in' }, 401);

  let body: Json;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Send a JSON body' }, 400);
  }
  const action = ACTIONS[body.action as keyof typeof ACTIONS];
  if (!action) return json({ error: 'Unknown action' }, 400);

  const client = createClient<Database>(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
  );

  try {
    return json(await action(client, body, new Date()));
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message, problems: error.problems }, error.status);
    }
    console.error(error);
    return json({ error: 'Something went wrong' }, 500);
  }
});
