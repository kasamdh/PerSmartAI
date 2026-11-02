-- request_booking accepts every repeat rule the TypeScript scheduler supports, and
-- care times for multi-day stays.

-- Mirrors parseRecurrence in supabase/functions/_shared/scheduling/recurrence.ts:
-- FREQ=DAILY|WEEKLY, INTERVAL 1–52, BYDAY (weekly only, plain weekdays), UNTIL
-- (date or date-time) or COUNT 1–1000 but not both, WKST=MO. Empty is "no repeat".
create function private.is_supported_rrule(p_rule text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  part text;
  k text;
  v text;
  seen text[] := '{}';
  freq text;
begin
  if p_rule is null or btrim(p_rule) = '' then
    return true;
  end if;

  foreach part in array string_to_array(upper(regexp_replace(btrim(p_rule), '^RRULE:', '', 'i')), ';') loop
    if part !~ '^[A-Z]+=[^=]+$' then
      return false;
    end if;
    k := split_part(part, '=', 1);
    v := split_part(part, '=', 2);
    if k = any (seen) then
      return false;
    end if;
    seen := seen || k;

    case k
      when 'FREQ' then
        if v not in ('DAILY', 'WEEKLY') then return false; end if;
        freq := v;
      when 'INTERVAL' then
        if v !~ '^\d{1,3}$' or v::int not between 1 and 52 then return false; end if;
      when 'COUNT' then
        if v !~ '^\d{1,4}$' or v::int not between 1 and 1000 then return false; end if;
      when 'UNTIL' then
        if v !~ '^\d{8}(T\d{6}Z?)?$' then return false; end if;
        begin
          perform make_date(substr(v, 1, 4)::int, substr(v, 5, 2)::int, substr(v, 7, 2)::int);
        exception when others then
          return false;
        end;
      when 'BYDAY' then
        if v !~ '^(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*$' then return false; end if;
      when 'WKST' then
        if v <> 'MO' then return false; end if;
      else
        return false;
    end case;
  end loop;

  return freq is not null
    and not (freq = 'DAILY' and 'BYDAY' = any (seen))
    and not ('UNTIL' = any (seen) and 'COUNT' = any (seen));
end;
$$;

drop function public.request_booking(
  public.service_type, uuid[], date, date, time, time, integer, text, text
);

-- SECURITY INVOKER: RLS and guard_booking_write still apply, so this only works
-- for an owner booking their own household's pets. Dates and times are wall-clock
-- values in the organization's time zone. p_care_times is
-- [{care_time, duration_minutes, label}], for multi-day stays only.
create function public.request_booking(
  p_service_type public.service_type,
  p_pet_ids uuid[],
  p_start_date date,
  p_end_date date default null,
  p_window_start time default null,
  p_window_end time default null,
  p_duration_minutes integer default null,
  p_recurrence_rule text default null,
  p_notes text default null,
  p_care_times jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household uuid;
  v_today date;
  v_rule text := nullif(upper(regexp_replace(btrim(coalesce(p_recurrence_rule, '')), '^RRULE:', '', 'i')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_care jsonb := coalesce(p_care_times, '[]'::jsonb);
  v_booking uuid;
begin
  select id into v_household
  from public.households
  where owner_id = (select auth.uid())
  order by created_at
  limit 1;
  if v_household is null then
    raise exception 'Add your home address before booking' using errcode = 'P0002';
  end if;

  if coalesce(cardinality(p_pet_ids), 0) = 0 or array_position(p_pet_ids, null) is not null then
    raise exception 'Choose at least one pet' using errcode = '22023';
  end if;

  select (now() at time zone o.timezone)::date into v_today
  from public.organizations o
  where o.id = (select private.current_org_id());

  if p_start_date < v_today then
    raise exception 'Bookings can''t start in the past' using errcode = '22023';
  end if;
  if p_start_date > v_today + 365 then
    raise exception 'Bookings can start at most a year ahead' using errcode = '22023';
  end if;

  if v_rule is not null and (p_service_type = 'overnight' or not private.is_supported_rrule(v_rule)) then
    raise exception 'Unsupported recurrence rule: %', p_recurrence_rule using errcode = '22023';
  end if;
  if p_service_type in ('overnight', 'multi_day') and p_end_date is null then
    raise exception 'Stays need an end date' using errcode = '22023';
  end if;
  if p_service_type = 'multi_day' and p_end_date > p_start_date + 90 then
    raise exception 'Multi-day stays can be at most 90 days' using errcode = '22023';
  end if;
  if jsonb_typeof(v_care) <> 'array' or jsonb_array_length(v_care) > 8 then
    raise exception 'Up to 8 care times a day' using errcode = '22023';
  end if;
  if jsonb_array_length(v_care) > 0 and p_service_type <> 'multi_day' then
    raise exception 'Care times are for multi-day stays' using errcode = '22023';
  end if;
  if length(v_notes) > 1000 then
    raise exception 'Notes are too long' using errcode = '22023';
  end if;

  insert into public.bookings (
    household_id, service_type, recurrence_rule, start_date, end_date,
    window_start, window_end, duration_minutes, notes
  ) values (
    v_household, p_service_type, v_rule, p_start_date, p_end_date,
    p_window_start, p_window_end, p_duration_minutes, v_notes
  )
  returning id into v_booking;

  -- assert_pet_in_booking_household rejects pets from other households.
  insert into public.booking_pets (booking_id, pet_id)
  select v_booking, pet_id from (select distinct unnest(p_pet_ids) as pet_id) pets;

  -- Table checks reject bad times, durations, labels and duplicate times.
  insert into public.booking_care_times (booking_id, care_time, duration_minutes, label)
  select v_booking, x.care_time, coalesce(x.duration_minutes, 30), x.label
  from jsonb_to_recordset(v_care) as x(care_time time, duration_minutes integer, label text);

  return v_booking;
end;
$$;

revoke all on function public.request_booking(
  public.service_type, uuid[], date, date, time, time, integer, text, text, jsonb
) from public, anon;
grant execute on function public.request_booking(
  public.service_type, uuid[], date, date, time, time, integer, text, text, jsonb
) to authenticated;

-- request_booking runs as the caller; the validator reads no data.
revoke all on function private.is_supported_rrule(text) from public;
grant execute on function private.is_supported_rrule(text) to authenticated;
