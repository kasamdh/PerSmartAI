-- Owners request bookings; cancelling a booking cancels its upcoming visits.

-- Overnight windows are arrival on the start date and departure on the end date
-- (see confirm_booking), so departure is usually earlier in the day than arrival.
alter table public.bookings drop constraint bookings_check1;
alter table public.bookings add constraint bookings_window_order_check check (
  service_type = 'overnight'
  or window_end is null or window_start is null or window_end > window_start
);

-- ---------------------------------------------------------------------------
-- request_booking: the booking and its pets in one transaction
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: RLS and guard_booking_write still apply, so this only works
-- for an owner booking their own household's pets. Dates and times are wall-clock
-- values in the organization's time zone (see confirm_booking).

create function public.request_booking(
  p_service_type public.service_type,
  p_pet_ids uuid[],
  p_start_date date,
  p_end_date date default null,
  p_window_start time default null,
  p_window_end time default null,
  p_duration_minutes integer default null,
  p_recurrence_rule text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household uuid;
  v_today date;
  v_rule text := nullif(upper(btrim(coalesce(p_recurrence_rule, ''))), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
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

  -- Only what confirm_booking can turn into visits.
  if v_rule is not null and (
       p_service_type = 'overnight'
       or v_rule !~ '^FREQ=(DAILY|WEEKLY;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*)$'
     ) then
    raise exception 'Unsupported recurrence rule: %', p_recurrence_rule using errcode = '22023';
  end if;
  if p_service_type = 'overnight' and p_end_date is null then
    raise exception 'Overnight stays need an end date' using errcode = '22023';
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

  return v_booking;
end;
$$;

revoke all on function public.request_booking(
  public.service_type, uuid[], date, date, time, time, integer, text, text
) from public, anon;
grant execute on function public.request_booking(
  public.service_type, uuid[], date, date, time, time, integer, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Cancelling a booking cancels the visits that haven't started yet
-- ---------------------------------------------------------------------------
-- Visits already under way (on the way, arrived, in progress) are left for the
-- sitter to finish. Owners can't update visits, so this runs as definer and
-- sets a transaction-local flag that guard_visit_update honors. Clients can't
-- set it: PostgREST only exposes functions in the public schema.

create function private.cancel_visits_on_booking_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.booking_cancel_cascade', 'on', true);
  update public.visits
     set status = 'cancelled'
   where booking_id = new.id
     and status = 'scheduled'
     and scheduled_end > now();
  perform set_config('app.booking_cancel_cascade', '', true);
  return null;
end;
$$;

create trigger cancel_visits_on_booking_cancel
  after update of status on public.bookings
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function private.cancel_visits_on_booking_cancel();

-- Same as 20261031000002_close_finished_visits.sql, plus the cascade bypass.
create or replace function private.guard_visit_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sitter_fields constant text[] := array[
    'status', 'check_in_at', 'check_in_lat', 'check_in_lng',
    'check_out_at', 'check_out_lat', 'check_out_lng', 'summary_note', 'updated_at'
  ];
begin
  if not private.is_client_non_admin() then
    return new;
  end if;
  if current_setting('app.booking_cancel_cascade', true) = 'on'
     and new.status = 'cancelled'
     and (to_jsonb(new) - array['status', 'updated_at']) = (to_jsonb(old) - array['status', 'updated_at']) then
    return new;
  end if;
  if old.status in ('completed', 'missed', 'cancelled') then
    raise exception 'This visit is closed and can no longer be changed' using errcode = '42501';
  end if;
  if (to_jsonb(new) - sitter_fields) <> (to_jsonb(old) - sitter_fields) then
    raise exception 'Sitters can only update status, check-in/out, and summary'
      using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and new.status not in ('on_the_way', 'arrived', 'in_progress', 'completed') then
    raise exception 'Sitters cannot set visit status to %', new.status using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.cancel_visits_on_booking_cancel() from public;
