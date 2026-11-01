-- Scheduling writes.
--
-- Visits are planned by the shared TypeScript scheduler (supabase/functions/_shared/
-- scheduling), which the schedule-booking and generate-visits Edge Functions run.
-- The functions here store a computed plan in one transaction and re-check the
-- sitter's conflicts under a per-sitter lock, so two admins can't double-book a
-- sitter at the same moment. The Edge Functions check availability and give the
-- detailed reasons; these checks are the last line (overlap + travel buffer +
-- approved time off).
--
-- This replaces SQL visit generation (confirm_booking, generate_booking_visits and
-- the top-up-booking-visits cron job).

select cron.unschedule('top-up-booking-visits');
drop function public.confirm_booking(uuid, uuid);
drop function private.top_up_booking_visits();
drop function private.generate_booking_visits(uuid);
drop function private.booking_occurrence_dates(text, date, date);
drop function private.local_to_utc(date, time, text);

-- ---------------------------------------------------------------------------
-- Conflicts
-- ---------------------------------------------------------------------------

-- Serializes schedule changes for one sitter until the transaction ends.
create function private.lock_sitter(p_sitter_id uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('sitter:' || p_sitter_id::text, 0))
$$;

-- Why this visit's sitter can't take it, or null. Matches findConflicts in
-- conflicts.ts: no travel time is needed between visits at the same home.
create function private.visit_conflict(p_visit_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v record;
  o record;
  t record;
  fmt constant text := 'Dy Mon FMDD, FMHH12:MI AM';
begin
  select vi.id, vi.sitter_id, vi.status, vi.scheduled_start, vi.scheduled_end,
         b.household_id, org.timezone, make_interval(mins => org.travel_buffer_minutes) as buffer
    into v
    from public.visits vi
    join public.bookings b on b.id = vi.booking_id
    join public.organizations org on org.id = vi.organization_id
   where vi.id = p_visit_id;

  if not found or v.sitter_id is null or v.status in ('cancelled', 'missed') then
    return null;
  end if;

  select ov.scheduled_start, ov.scheduled_end,
         ov.scheduled_start < v.scheduled_end and v.scheduled_start < ov.scheduled_end as overlaps
    into o
    from public.visits ov
    join public.bookings ob on ob.id = ov.booking_id
   where ov.sitter_id = v.sitter_id
     and ov.id <> v.id
     and ov.status not in ('cancelled', 'missed')
     and ov.scheduled_start < v.scheduled_end
           + case when ob.household_id = v.household_id then interval '0' else v.buffer end
     and v.scheduled_start < ov.scheduled_end
           + case when ob.household_id = v.household_id then interval '0' else v.buffer end
   order by ov.scheduled_start
   limit 1;

  if found then
    return format(
      'The sitter isn''t free %s: %s another visit (%s – %s)',
      to_char(v.scheduled_start at time zone v.timezone, fmt),
      case when o.overlaps then 'it overlaps' else 'not enough travel time around' end,
      to_char(o.scheduled_start at time zone v.timezone, fmt),
      to_char(o.scheduled_end at time zone v.timezone, 'FMHH12:MI AM')
    );
  end if;

  select start_at, end_at into t
    from public.sitter_time_off
   where sitter_id = v.sitter_id
     and status = 'approved'
     and start_at < v.scheduled_end
     and v.scheduled_start < end_at
   limit 1;

  if found then
    return format(
      'The sitter has time off %s – %s',
      to_char(t.start_at at time zone v.timezone, fmt),
      to_char(t.end_at at time zone v.timezone, fmt)
    );
  end if;

  return null;
end;
$$;

-- Raises the first conflict among these visits (errcode 23P01, exclusion_violation).
create function private.assert_visits_free(p_visit_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  reason text;
begin
  foreach v_id in array coalesce(p_visit_ids, '{}') loop
    reason := private.visit_conflict(v_id);
    if reason is not null then
      raise exception '%', reason using errcode = '23P01';
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- The booking, if the caller is an admin of its organization.
create function private.require_booking_admin(p_booking_id uuid)
returns public.bookings
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if not found
     or not private.is_admin()
     or b.organization_id is distinct from private.current_org_id() then
    raise exception 'Only an admin of this business can schedule bookings' using errcode = '42501';
  end if;
  return b;
end;
$$;

-- Inserts planned visits ([{slot_start, scheduled_start, scheduled_end, care_time_id}]),
-- skipping slots the booking already has and visits that are over. Returns new ids.
create function private.insert_planned_visits(p_booking public.bookings, p_sitter_id uuid, p_visits jsonb)
returns uuid[]
language sql
security definer
set search_path = ''
as $$
  with inserted as (
    insert into public.visits (
      organization_id, booking_id, sitter_id, slot_start, scheduled_start, scheduled_end, care_time_id
    )
    select p_booking.organization_id, p_booking.id, p_sitter_id,
           x.slot_start, x.scheduled_start, x.scheduled_end, x.care_time_id
      from jsonb_to_recordset(coalesce(p_visits, '[]'::jsonb))
           as x(slot_start timestamptz, scheduled_start timestamptz, scheduled_end timestamptz, care_time_id uuid)
     where x.scheduled_end > now()
    on conflict (booking_id, slot_start) do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}') from inserted
$$;

-- Replaces a booking's care times ([{id, care_time, duration_minutes, label}]),
-- keeping rows whose id is unchanged so past visits keep their care time.
create function private.replace_care_times(p_booking public.bookings, p_care_times jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.booking_care_times
   where booking_id = p_booking.id
     and id not in (select (e ->> 'id')::uuid from jsonb_array_elements(p_care_times) e);

  insert into public.booking_care_times (id, organization_id, booking_id, care_time, duration_minutes, label)
  select x.id, p_booking.organization_id, p_booking.id, x.care_time, x.duration_minutes, x.label
    from jsonb_to_recordset(p_care_times)
         as x(id uuid, care_time time, duration_minutes integer, label text)
  on conflict (id) do update
     set care_time = excluded.care_time,
         duration_minutes = excluded.duration_minutes,
         label = excluded.label
   where public.booking_care_times.booking_id = p_booking.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_booking_plan: confirm a booking (or reassign it) with its planned visits
-- ---------------------------------------------------------------------------

create function public.apply_booking_plan(
  p_booking_id uuid,
  p_sitter_id uuid,
  p_visits jsonb,
  p_end_date date default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bookings := private.require_booking_admin(p_booking_id);
  created uuid[];
begin
  if b.status not in ('requested', 'confirmed') then
    raise exception 'Cannot confirm a % booking', b.status using errcode = '22023';
  end if;
  if p_sitter_id is null then
    raise exception 'Choose a sitter' using errcode = '22023';
  end if;

  perform private.lock_sitter(p_sitter_id);

  -- assert_profile_role rejects non-sitters; the composite FK rejects other orgs.
  -- p_end_date fills in the last date of COUNT/UNTIL rules so the booking completes.
  update public.bookings
     set sitter_id = p_sitter_id,
         status = 'confirmed',
         end_date = coalesce(end_date, p_end_date)
   where id = b.id
  returning * into b;

  update public.visits
     set sitter_id = p_sitter_id
   where booking_id = b.id and status = 'scheduled' and scheduled_start > now();

  created := private.insert_planned_visits(b, p_sitter_id, p_visits);

  perform private.assert_visits_free(array(
    select id from public.visits
    where booking_id = b.id and status = 'scheduled' and scheduled_start > now()
  ));

  return cardinality(created);
end;
$$;

-- ---------------------------------------------------------------------------
-- reschedule_booking: change a confirmed booking from a date on
-- ---------------------------------------------------------------------------
-- p_split false: the booking itself changes (nothing happened before p_from_date).
-- p_split true:  the booking ends the day before p_from_date and a new confirmed
--                booking in the same series takes over, with the same pets.
-- Either way, scheduled visits from local midnight of p_from_date are replaced by
-- p_visits, and cancelled ones move to the new slots in p_carry
-- ([{visit_id, slot_start, care_time_id}]) so they aren't recreated.
-- Returns the booking that holds the new schedule.

create function public.reschedule_booking(
  p_booking_id uuid,
  p_from_date date,
  p_split boolean,
  p_schedule jsonb,
  p_care_times jsonb,
  p_visits jsonb,
  p_carry jsonb default '[]'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bookings := private.require_booking_admin(p_booking_id);
  target public.bookings;
  tz text;
  v_from timestamptz;
  created uuid[];
  s record;
begin
  if b.status <> 'confirmed' or b.sitter_id is null then
    raise exception 'Only confirmed bookings with a sitter can be rescheduled' using errcode = '22023';
  end if;

  select timezone into tz from public.organizations where id = b.organization_id;
  if p_from_date < (now() at time zone tz)::date then
    raise exception 'Visits in the past can''t be changed' using errcode = '22023';
  end if;
  v_from := p_from_date::timestamp at time zone tz;

  select * into s from jsonb_to_record(p_schedule) as x(
    recurrence_rule text, start_date date, end_date date,
    window_start time, window_end time, duration_minutes integer
  );
  if s.recurrence_rule is not null and not private.is_supported_rrule(s.recurrence_rule) then
    raise exception 'Unsupported recurrence rule: %', s.recurrence_rule using errcode = '22023';
  end if;

  perform private.lock_sitter(b.sitter_id);

  delete from public.visits
   where booking_id = b.id and status = 'scheduled' and scheduled_start >= v_from;

  if p_split then
    update public.bookings set end_date = p_from_date - 1 where id = b.id;

    insert into public.bookings (
      organization_id, household_id, sitter_id, series_id, service_type, recurrence_rule,
      start_date, end_date, window_start, window_end, duration_minutes, status, notes
    ) values (
      b.organization_id, b.household_id, b.sitter_id, b.series_id, b.service_type, s.recurrence_rule,
      coalesce(s.start_date, p_from_date), s.end_date, s.window_start, s.window_end,
      s.duration_minutes, 'confirmed', b.notes
    )
    returning * into target;

    insert into public.booking_pets (organization_id, booking_id, pet_id)
    select organization_id, target.id, pet_id from public.booking_pets where booking_id = b.id;
  else
    update public.bookings
       set recurrence_rule = s.recurrence_rule,
           start_date = coalesce(s.start_date, start_date),
           end_date = s.end_date,
           window_start = s.window_start,
           window_end = s.window_end,
           duration_minutes = s.duration_minutes
     where id = b.id
    returning * into target;
  end if;

  if p_care_times is not null then
    perform private.replace_care_times(target, p_care_times);
  end if;

  update public.visits v
     set booking_id = target.id,
         slot_start = c.slot_start,
         care_time_id = c.care_time_id
    from jsonb_to_recordset(coalesce(p_carry, '[]'::jsonb))
         as c(visit_id uuid, slot_start timestamptz, care_time_id uuid)
   where v.id = c.visit_id
     and v.booking_id = b.id
     and v.status = 'cancelled'
     and v.scheduled_start >= v_from;

  created := private.insert_planned_visits(target, b.sitter_id, p_visits);
  perform private.assert_visits_free(created);

  return target.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- update_visit_schedule: move one visit and/or give it to another sitter
-- ---------------------------------------------------------------------------
-- The visit keeps its slot, so regenerating the series never brings back the old
-- time. Null arguments leave that field as it is.

create function public.update_visit_schedule(
  p_visit_id uuid,
  p_sitter_id uuid default null,
  p_start timestamptz default null,
  p_end timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.visits;
begin
  select * into v from public.visits where id = p_visit_id;
  if not found
     or not private.is_admin()
     or v.organization_id is distinct from private.current_org_id() then
    raise exception 'Only an admin of this business can change visits' using errcode = '42501';
  end if;
  if v.status <> 'scheduled' then
    raise exception 'Only scheduled visits can be changed' using errcode = '22023';
  end if;
  if p_start is not null and p_start <= now() then
    raise exception 'Pick a time in the future' using errcode = '22023';
  end if;

  if coalesce(p_sitter_id, v.sitter_id) is not null then
    perform private.lock_sitter(coalesce(p_sitter_id, v.sitter_id));
  end if;

  update public.visits
     set sitter_id = coalesce(p_sitter_id, sitter_id),
         scheduled_start = coalesce(p_start, scheduled_start),
         scheduled_end = coalesce(p_end, scheduled_end)
   where id = v.id;

  perform private.assert_visits_free(array[v.id]);
end;
$$;

-- ---------------------------------------------------------------------------
-- store_generated_visits: the nightly top-up (generate-visits, service_role only)
-- ---------------------------------------------------------------------------
-- New visits the sitter can't take (booked elsewhere or time off since the booking
-- was confirmed) are kept unassigned, so they show up for an admin to staff.

create function public.store_generated_visits(p_booking_id uuid, p_visits jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  created uuid[];
  unassigned integer := 0;
begin
  select * into b from public.bookings where id = p_booking_id;
  if not found or b.status <> 'confirmed' then
    return jsonb_build_object('created', 0, 'unassigned', 0);
  end if;

  if b.sitter_id is not null then
    perform private.lock_sitter(b.sitter_id);
  end if;

  created := private.insert_planned_visits(b, b.sitter_id, p_visits);

  update public.visits
     set sitter_id = null
   where id = any (created)
     and sitter_id is not null
     and private.visit_conflict(id) is not null;
  get diagnostics unassigned = row_count;

  return jsonb_build_object('created', cardinality(created), 'unassigned', unassigned);
end;
$$;

-- ---------------------------------------------------------------------------
-- Nightly generation runs the generate-visits Edge Function
-- ---------------------------------------------------------------------------
-- Same Vault secrets as send_push_event; without them nothing is sent.

create function private.invoke_edge_function(p_name text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  service_key text;
begin
  select decrypted_secret into base_url
  from vault.decrypted_secrets where name = 'edge_functions_url';
  select decrypted_secret into service_key
  from vault.decrypted_secrets where name = 'service_role_key';

  if base_url is null or service_key is null then
    return;
  end if;

  perform net.http_post(
    url := base_url || '/' || p_name,
    body := p_payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    timeout_milliseconds := 60000
  );
end;
$$;

-- 08:15 UTC: after midnight across US time zones, after complete-finished-bookings.
select cron.schedule(
  'generate-visits',
  '15 8 * * *',
  $$select private.invoke_edge_function('generate-visits', '{}'::jsonb)$$
);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function private.lock_sitter(uuid) from public;
revoke all on function private.visit_conflict(uuid) from public;
revoke all on function private.assert_visits_free(uuid[]) from public;
revoke all on function private.require_booking_admin(uuid) from public;
revoke all on function private.insert_planned_visits(public.bookings, uuid, jsonb) from public;
revoke all on function private.replace_care_times(public.bookings, jsonb) from public;
revoke all on function private.invoke_edge_function(text, jsonb) from public;

revoke all on function public.apply_booking_plan(uuid, uuid, jsonb, date) from public, anon;
grant execute on function public.apply_booking_plan(uuid, uuid, jsonb, date) to authenticated;

revoke all on function public.reschedule_booking(uuid, date, boolean, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.reschedule_booking(uuid, date, boolean, jsonb, jsonb, jsonb, jsonb) to authenticated;

revoke all on function public.update_visit_schedule(uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.update_visit_schedule(uuid, uuid, timestamptz, timestamptz) to authenticated;

revoke all on function public.store_generated_visits(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.store_generated_visits(uuid, jsonb) to service_role;
