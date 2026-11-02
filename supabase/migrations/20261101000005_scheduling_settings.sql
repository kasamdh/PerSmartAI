-- Scheduling settings: per-organization travel buffer and cancellation cutoff,
-- and late-cancellation flags. (The 60-day generation window lives in the shared
-- TypeScript scheduler; see 20261101000008.)

-- ---------------------------------------------------------------------------
-- Organization settings (admins update them via "admins update their organization")
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column travel_buffer_minutes integer not null default 15
    check (travel_buffer_minutes between 0 and 240),
  add column cancellation_cutoff_hours integer not null default 24
    check (cancellation_cutoff_hours between 0 and 336);

-- ---------------------------------------------------------------------------
-- Late cancellations
-- ---------------------------------------------------------------------------
-- A cancellation is late when a visit that hasn't ended starts within the
-- organization's cutoff. Visits record it individually; the booking records
-- whether any of its visits was cancelled late.

alter table public.bookings
  add column cancelled_at timestamptz,
  add column late_cancellation boolean not null default false;

alter table public.visits
  add column cancelled_at timestamptz,
  add column late_cancellation boolean not null default false;

-- Owners' updates are already limited to the status (guard_booking_write); this
-- keeps them from requesting a booking that's pre-marked as cancelled or late.
create function private.guard_booking_cancellation_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_client_non_admin()
     and (new.late_cancellation or new.cancelled_at is not null) then
    raise exception 'Cancellation fields are set by the system' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_booking_cancellation_insert
  before insert on public.bookings
  for each row execute function private.guard_booking_cancellation_insert();

-- BEFORE trigger, so it runs after guard_booking_write has checked the owner's
-- change (triggers fire in name order) and before the visits are cancelled.
create function private.stamp_booking_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.cancelled_at := now();
  new.late_cancellation := exists (
    select 1
    from public.visits v
    join public.organizations o on o.id = v.organization_id
    where v.booking_id = new.id
      and v.status = 'scheduled'
      and v.scheduled_end > now()
      and v.scheduled_start < now() + make_interval(hours => o.cancellation_cutoff_hours)
  );
  return new;
end;
$$;

create trigger stamp_booking_cancellation
  before update of status on public.bookings
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function private.stamp_booking_cancellation();

create or replace function private.cancel_visits_on_booking_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.booking_cancel_cascade', 'on', true);
  update public.visits v
     set status = 'cancelled',
         cancelled_at = now(),
         late_cancellation = v.scheduled_start < now() + make_interval(hours => o.cancellation_cutoff_hours)
    from public.organizations o
   where o.id = v.organization_id
     and v.booking_id = new.id
     and v.status = 'scheduled'
     and v.scheduled_end > now();
  perform set_config('app.booking_cancel_cascade', '', true);
  return null;
end;
$$;

-- Same as 20261101000001, letting the cascade also stamp the cancellation fields.
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

revoke all on function private.stamp_booking_cancellation() from public;
revoke all on function private.guard_booking_cancellation_insert() from public;
