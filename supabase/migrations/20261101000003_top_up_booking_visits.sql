-- Keep confirmed bookings scheduled 90 days ahead.
--
-- confirm_booking only generates visits up to 90 days out, so open-ended and long
-- bookings would run dry. The generation step moves into
-- private.generate_booking_visits, which confirm_booking and a nightly pg_cron job
-- both call. It is idempotent (unique (booking_id, scheduled_start)), so the job
-- only adds the days that are newly inside the window, and never recreates a visit
-- that was cancelled.

create extension if not exists pg_cron;

-- Generates the booking's missing visits for its sitter, from today (org time zone)
-- to 90 days ahead or the booking's end. Callers check permissions.
create function private.generate_booking_visits(p_booking_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  tz text;
  today date;
  from_date date;
  to_date date;
  d date;
  v_start timestamptz;
  v_end timestamptz;
  created integer := 0;
begin
  select * into b from public.bookings where id = p_booking_id;
  if not found or b.sitter_id is null then
    return 0;
  end if;

  select timezone into tz from public.organizations where id = b.organization_id;
  today := (now() at time zone tz)::date;

  if b.service_type = 'overnight' then
    v_start := private.local_to_utc(b.start_date, coalesce(b.window_start, '19:00'), tz);
    v_end := private.local_to_utc(coalesce(b.end_date, b.start_date + 1), coalesce(b.window_end, '08:00'), tz);
    if v_end <= v_start then
      v_end := private.local_to_utc(b.start_date + 1, coalesce(b.window_end, '08:00'), tz);
    end if;
    if v_end > now() then
      insert into public.visits (organization_id, booking_id, sitter_id, scheduled_start, scheduled_end)
      values (b.organization_id, b.id, b.sitter_id, v_start, v_end)
      on conflict (booking_id, scheduled_start) do nothing;
      get diagnostics created = row_count;
    end if;
    return created;
  end if;

  from_date := greatest(b.start_date, today);
  to_date := least(
    coalesce(b.end_date, case when b.recurrence_rule is null then b.start_date else today + 90 end),
    today + 90
  );

  for d in select * from private.booking_occurrence_dates(b.recurrence_rule, from_date, to_date) loop
    v_start := private.local_to_utc(d, coalesce(b.window_start, '09:00'), tz);
    v_end := case
      when b.duration_minutes is not null then v_start + make_interval(mins => b.duration_minutes)
      when b.window_end is not null then private.local_to_utc(d, b.window_end, tz)
      else v_start + interval '30 minutes'
    end;
    continue when v_end <= now();

    insert into public.visits (organization_id, booking_id, sitter_id, scheduled_start, scheduled_end)
    values (b.organization_id, b.id, b.sitter_id, v_start, v_end)
    on conflict (booking_id, scheduled_start) do nothing;
    if found then
      created := created + 1;
    end if;
  end loop;

  return created;
end;
$$;

-- Same checks and behavior as before; generation now lives in generate_booking_visits.
create or replace function public.confirm_booking(p_booking_id uuid, p_sitter_id uuid)
returns integer
language plpgsql
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
    raise exception 'Only an admin of this business can confirm bookings' using errcode = '42501';
  end if;
  if b.status not in ('requested', 'confirmed') then
    raise exception 'Cannot confirm a % booking', b.status using errcode = '22023';
  end if;

  -- assert_profile_role rejects non-sitters; the composite FK rejects other orgs.
  update public.bookings set sitter_id = p_sitter_id, status = 'confirmed' where id = b.id;
  update public.visits
     set sitter_id = p_sitter_id
   where booking_id = b.id and status = 'scheduled' and scheduled_start > now();

  return private.generate_booking_visits(b.id);
end;
$$;

-- Nightly: extend every confirmed booking that can still have future visits.
create function private.top_up_booking_visits()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  created integer := 0;
begin
  for v_id in
    select id from public.bookings
    where status = 'confirmed'
      and sitter_id is not null
      and service_type <> 'overnight'
      and (end_date >= current_date - 1 or (end_date is null and recurrence_rule is not null))
  loop
    created := created + private.generate_booking_visits(v_id);
  end loop;
  return created;
end;
$$;

revoke all on function private.generate_booking_visits(uuid) from public, authenticated;
revoke all on function private.top_up_booking_visits() from public, authenticated;

-- 08:15 UTC: after midnight across US time zones, before most morning visits.
select cron.schedule('top-up-booking-visits', '15 8 * * *', $$select private.top_up_booking_visits()$$);
