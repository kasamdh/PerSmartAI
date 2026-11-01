-- Owners ask to reschedule; admins approve (schedule-booking applies the change,
-- with conflict checks) or decline.
--
--   scope 'visit'            one visit; changes = {date, time, duration_minutes?}
--   scope 'this_and_future'  the booking from from_date on; changes = any of
--                            {recurrence_rule, end_date, window_start, window_end,
--                             duration_minutes}
-- Dates and times are wall-clock values in the organization's time zone.

create type public.change_request_status as enum ('requested', 'approved', 'declined', 'withdrawn');

create table public.schedule_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  booking_id uuid not null,
  visit_id uuid,
  scope text not null check (scope in ('visit', 'this_and_future')),
  from_date date,
  changes jsonb not null check (jsonb_typeof(changes) = 'object'),
  note text check (char_length(note) <= 500),
  status public.change_request_status not null default 'requested',
  requested_by uuid default auth.uid() references auth.users (id) on delete set null,
  decided_at timestamptz,
  decline_reason text check (char_length(decline_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'visit') = (visit_id is not null)),
  check ((scope = 'this_and_future') = (from_date is not null)),
  check (
    scope <> 'visit'
    or (changes ?& array['date', 'time'] and (changes - array['date', 'time', 'duration_minutes']) = '{}'::jsonb)
  ),
  check (
    scope <> 'this_and_future'
    or (changes - array['recurrence_rule', 'end_date', 'window_start', 'window_end', 'duration_minutes'])
       = '{}'::jsonb
  ),
  unique (id, organization_id),
  foreign key (booking_id, organization_id)
    references public.bookings (id, organization_id) on delete cascade,
  foreign key (visit_id, organization_id)
    references public.visits (id, organization_id) on delete cascade
);

create index schedule_change_requests_organization_id_idx
  on public.schedule_change_requests (organization_id, status);
create index schedule_change_requests_booking_id_idx on public.schedule_change_requests (booking_id);
create index schedule_change_requests_visit_id_idx on public.schedule_change_requests (visit_id);

create trigger set_updated_at before update on public.schedule_change_requests
  for each row execute function private.set_updated_at();

-- Owners may create a request for their own confirmed booking (the visit must be
-- one of its scheduled visits) and withdraw it while pending; nothing else.
create function private.guard_change_request_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_client_non_admin() then
    if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status <> 'requested' then
      new.decided_at := now();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'requested' or new.decided_at is not null or new.decline_reason is not null
       or new.requested_by is distinct from (select auth.uid()) then
      raise exception 'Change requests start as requested' using errcode = '42501';
    end if;
    if not exists (select 1 from public.bookings where id = new.booking_id and status = 'confirmed') then
      raise exception 'Only confirmed bookings can be rescheduled' using errcode = '22023';
    end if;
    if new.visit_id is not null and not exists (
      select 1 from public.visits
      where id = new.visit_id and booking_id = new.booking_id
        and status = 'scheduled' and scheduled_start > now()
    ) then
      raise exception 'Only upcoming scheduled visits can be rescheduled' using errcode = '22023';
    end if;
    return new;
  end if;

  if old.status <> 'requested' or new.status <> 'withdrawn'
     or (to_jsonb(new) - array['status', 'updated_at']) <> (to_jsonb(old) - array['status', 'updated_at']) then
    raise exception 'Owners can only withdraw a pending request' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_change_request_write
  before insert or update on public.schedule_change_requests
  for each row execute function private.guard_change_request_write();

alter table public.schedule_change_requests enable row level security;
revoke all on public.schedule_change_requests from anon;

create policy "admins manage schedule_change_requests" on public.schedule_change_requests
  for all to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.is_admin()))
  with check (organization_id = (select private.current_org_id()) and (select private.is_admin()));

create policy "owners read own change requests" on public.schedule_change_requests
  for select to authenticated
  using (organization_id = (select private.current_org_id()) and private.owns_booking(booking_id));

create policy "owners request changes" on public.schedule_change_requests
  for insert to authenticated
  with check (organization_id = (select private.current_org_id()) and private.owns_booking(booking_id));

create policy "owners withdraw own change requests" on public.schedule_change_requests
  for update to authenticated
  using (organization_id = (select private.current_org_id()) and private.owns_booking(booking_id))
  with check (organization_id = (select private.current_org_id()) and private.owns_booking(booking_id));

revoke all on function private.guard_change_request_write() from public;

-- Live updates for scheduling lists. Realtime applies each subscriber's SELECT
-- policies, so everyone only receives rows they can read.
alter publication supabase_realtime add table
  public.bookings,
  public.booking_care_times,
  public.sitter_availability,
  public.sitter_time_off,
  public.schedule_change_requests;
