-- Admins confirm a booking: assign a sitter and generate its visits.
--
-- Booking times are wall-clock times in the organization's time zone, so visit
-- instants are computed here with Postgres time zone rules (correct across DST).
-- Supported recurrence (RFC 5545 subset): none (every day from start to end date),
-- FREQ=DAILY, FREQ=WEEKLY with optional BYDAY=MO,TU,... Visits are generated up to
-- 90 days ahead; running it again only fills gaps.

create unique index visits_booking_start_key on public.visits (booking_id, scheduled_start);

create function private.local_to_utc(p_date date, p_time time, p_time_zone text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (p_date + p_time) at time zone p_time_zone
$$;

create function private.booking_occurrence_dates(p_rule text, p_from date, p_to date)
returns setof date
language plpgsql
stable
set search_path = ''
as $$
declare
  day_codes constant text[] := array['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  freq text;
  by_day text[];
  part text;
begin
  if p_from > p_to then
    return;
  end if;

  if p_rule is null or btrim(p_rule) = '' then
    return query select d::date from generate_series(p_from, p_to, interval '1 day') d;
    return;
  end if;

  foreach part in array string_to_array(upper(regexp_replace(btrim(p_rule), '^RRULE:', '', 'i')), ';') loop
    case split_part(part, '=', 1)
      when 'FREQ' then freq := split_part(part, '=', 2);
      when 'BYDAY' then by_day := string_to_array(split_part(part, '=', 2), ',');
      else null; -- INTERVAL/UNTIL/COUNT not supported yet; end_date bounds the series
    end case;
  end loop;

  if freq = 'DAILY' then
    return query select d::date from generate_series(p_from, p_to, interval '1 day') d;
  elsif freq = 'WEEKLY' then
    return query
      select d::date
      from generate_series(p_from, p_to, interval '1 day') d
      where by_day is null
         or day_codes[extract(dow from d)::int + 1] = any (by_day);
  else
    raise exception 'Unsupported recurrence rule: %', p_rule using errcode = '22023';
  end if;
end;
$$;

create function public.confirm_booking(p_booking_id uuid, p_sitter_id uuid)
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
  if not found
     or not private.is_admin()
     or b.organization_id is distinct from private.current_org_id() then
    raise exception 'Only an admin of this business can confirm bookings' using errcode = '42501';
  end if;
  if b.status not in ('requested', 'confirmed') then
    raise exception 'Cannot confirm a % booking', b.status using errcode = '22023';
  end if;

  select timezone into tz from public.organizations where id = b.organization_id;
  today := (now() at time zone tz)::date;

  -- assert_profile_role rejects non-sitters; the composite FK rejects other orgs.
  update public.bookings set sitter_id = p_sitter_id, status = 'confirmed' where id = b.id;
  update public.visits
     set sitter_id = p_sitter_id
   where booking_id = b.id and status = 'scheduled' and scheduled_start > now();

  if b.service_type = 'overnight' then
    v_start := private.local_to_utc(b.start_date, coalesce(b.window_start, '19:00'), tz);
    v_end := private.local_to_utc(coalesce(b.end_date, b.start_date + 1), coalesce(b.window_end, '08:00'), tz);
    if v_end <= v_start then
      v_end := private.local_to_utc(b.start_date + 1, coalesce(b.window_end, '08:00'), tz);
    end if;
    if v_end > now() then
      insert into public.visits (organization_id, booking_id, sitter_id, scheduled_start, scheduled_end)
      values (b.organization_id, b.id, p_sitter_id, v_start, v_end)
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
    values (b.organization_id, b.id, p_sitter_id, v_start, v_end)
    on conflict (booking_id, scheduled_start) do nothing;
    if found then
      created := created + 1;
    end if;
  end loop;

  return created;
end;
$$;

revoke all on function public.confirm_booking(uuid, uuid) from public, anon;
grant execute on function public.confirm_booking(uuid, uuid) to authenticated;
revoke all on function private.local_to_utc(date, time, text) from public;
revoke all on function private.booking_occurrence_dates(text, date, date) from public;
