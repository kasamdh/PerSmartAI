-- The visit flow: scheduled -> on_the_way -> arrived -> in_progress -> completed.
--
-- Sitters take one step at a time; admins may also mark a visit missed before
-- check-in or cancel one that isn't finished. Nobody skips a step or goes back
-- (src/features/visits/visit-status.ts mirrors these rules for the buttons).
-- Each step's time is recorded by the server. Check-in is `arrived`; care starts
-- (`in_progress`) with the first care event, or at check-out if nothing was logged.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.visits
  add column on_the_way_at timestamptz,
  add column started_at timestamptz,
  -- One line the owner sees live, e.g. "Out on a walk". Cleared when the visit ends.
  add column status_line text check (char_length(status_line) <= 120);

-- Visits already under way or done keep a plausible timeline.
update public.visits set started_at = check_in_at
 where status in ('in_progress', 'completed') and started_at is null;

alter table public.incidents
  add column media_id uuid,
  add constraint incidents_media_fkey foreign key (media_id, organization_id)
    references public.media (id, organization_id) on delete set null (media_id);

create index incidents_media_id_idx on public.incidents (media_id);

-- ---------------------------------------------------------------------------
-- Transitions
-- ---------------------------------------------------------------------------

create function private.visit_transition_allowed(
  p_from public.visit_status,
  p_to public.visit_status,
  p_admin boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'scheduled' then p_to = 'on_the_way' or (p_admin and p_to in ('missed', 'cancelled'))
    when 'on_the_way' then p_to = 'arrived' or (p_admin and p_to in ('missed', 'cancelled'))
    when 'arrived' then p_to = 'in_progress' or (p_admin and p_to = 'cancelled')
    when 'in_progress' then p_to = 'completed' or (p_admin and p_to = 'cancelled')
    else false
  end
$$;

-- BEFORE UPDATE OF status; fires after guard_visit_update (name order), so the
-- guard has already checked which columns a sitter changed.
create function private.track_visit_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Signed-in users follow the flow. System jobs (no user) and the booking
  -- cancellation cascade (cancel_visits_on_booking_cancel) are trusted.
  if (select auth.uid()) is not null
     and current_setting('app.booking_cancel_cascade', true) is distinct from 'on'
     and not private.visit_transition_allowed(old.status, new.status, private.is_admin()) then
    raise exception 'A visit can''t go from % to %', old.status, new.status using errcode = '22023';
  end if;

  case new.status
    when 'on_the_way' then
      new.on_the_way_at := coalesce(new.on_the_way_at, now());
    when 'arrived' then
      new.check_in_at := coalesce(new.check_in_at, now());
    when 'in_progress' then
      new.started_at := coalesce(new.started_at, now());
    else
      if new.status = 'completed' then
        new.check_out_at := coalesce(new.check_out_at, now());
      end if;
      new.status_line := null;
  end case;
  return new;
end;
$$;

create trigger track_visit_status
  before update of status on public.visits
  for each row execute function private.track_visit_status();

-- Same as 20261101000005, letting sitters set the status line.
create or replace function private.guard_visit_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sitter_fields constant text[] := array[
    'status', 'check_in_at', 'check_in_lat', 'check_in_lng',
    'check_out_at', 'check_out_lat', 'check_out_lng', 'summary_note', 'status_line', 'updated_at'
  ];
  cancel_fields constant text[] := array['status', 'cancelled_at', 'late_cancellation', 'updated_at'];
begin
  if not private.is_client_non_admin() then
    return new;
  end if;
  if current_setting('app.booking_cancel_cascade', true) = 'on'
     and new.status = 'cancelled'
     and (to_jsonb(new) - cancel_fields) = (to_jsonb(old) - cancel_fields) then
    return new;
  end if;
  if old.status in ('completed', 'missed', 'cancelled') then
    raise exception 'This visit is closed and can no longer be changed' using errcode = '42501';
  end if;
  if (to_jsonb(new) - sitter_fields) <> (to_jsonb(old) - sitter_fields) then
    raise exception 'Sitters can only update status, check-in/out, summary, and status line'
      using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and new.status not in ('on_the_way', 'arrived', 'in_progress', 'completed') then
    raise exception 'Sitters cannot set visit status to %', new.status using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- advance_visit: the app's way to move a visit along
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: RLS, guard_visit_update and track_visit_status all apply.
-- Times are the server's; coordinates are the device's (null if unavailable).

create function public.advance_visit(
  p_visit_id uuid,
  p_status public.visit_status,
  p_lat double precision default null,
  p_lng double precision default null,
  p_summary text default null
)
returns public.visits
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.visits;
  v_summary text := left(nullif(btrim(coalesce(p_summary, '')), ''), 500);
begin
  select * into v from public.visits where id = p_visit_id;
  if not found then
    raise exception 'Visit not found' using errcode = 'P0002';
  end if;

  -- Checking out without logging any care: care started at check-out.
  if p_status = 'completed' and v.status = 'arrived' then
    update public.visits set status = 'in_progress' where id = v.id;
  end if;

  update public.visits
     set status = p_status,
         check_in_lat = case when p_status = 'arrived' then p_lat else check_in_lat end,
         check_in_lng = case when p_status = 'arrived' then p_lng else check_in_lng end,
         check_out_lat = case when p_status = 'completed' then p_lat else check_out_lat end,
         check_out_lng = case when p_status = 'completed' then p_lng else check_out_lng end,
         summary_note = case
           when p_status = 'completed' and v_summary is not null then v_summary
           else summary_note
         end
   where id = v.id
  returning * into v;

  if not found then
    raise exception 'This visit can''t be updated. It may have been reassigned.' using errcode = '42501';
  end if;
  return v;
end;
$$;

revoke all on function public.advance_visit(uuid, public.visit_status, double precision, double precision, text) from public, anon;
grant execute on function public.advance_visit(uuid, public.visit_status, double precision, double precision, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Care is logged between check-in and check-out; the first entry starts care
-- ---------------------------------------------------------------------------

create function private.assert_visit_open_for_care()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_client_non_admin() and not exists (
    select 1 from public.visits
    where id = new.visit_id and status in ('arrived', 'in_progress')
  ) then
    raise exception 'Check in before logging care' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger assert_visit_open_for_care
  before insert or update on public.care_events
  for each row execute function private.assert_visit_open_for_care();

create function private.start_care_on_first_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.visits set status = 'in_progress' where id = new.visit_id and status = 'arrived';
  return null;
end;
$$;

create trigger start_care_on_first_event
  after insert on public.care_events
  for each row execute function private.start_care_on_first_event();

-- ---------------------------------------------------------------------------
-- Push: owners hear about check-in (arrived) rather than care starting
-- ---------------------------------------------------------------------------

create or replace function private.push_on_visit_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('on_the_way', 'arrived', 'completed') then
    perform private.send_push_event(jsonb_build_object(
      'type', 'visit_status', 'visit_id', new.id, 'status', new.status
    ));
  end if;
  return null;
end;
$$;

-- Owners see incidents in the live feed too.
alter publication supabase_realtime add table public.incidents;

revoke all on function private.visit_transition_allowed(public.visit_status, public.visit_status, boolean) from public;
revoke all on function private.track_visit_status() from public;
revoke all on function private.assert_visit_open_for_care() from public;
revoke all on function private.start_care_on_first_event() from public;
