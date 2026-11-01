-- Occurrence slots, multi-day care times, and booking series.
--
-- Visit generation moves to the shared TypeScript scheduler (supabase/functions/
-- _shared/scheduling), which keys each generated visit by its occurrence slot.
-- slot_start stays fixed when an admin moves a visit, so regenerating never
-- recreates a visit that was moved or cancelled.

-- ---------------------------------------------------------------------------
-- visits.slot_start replaces (booking_id, scheduled_start) as the generation key
-- ---------------------------------------------------------------------------

alter table public.visits add column slot_start timestamptz;
update public.visits set slot_start = scheduled_start;
alter table public.visits alter column slot_start set not null;

drop index public.visits_booking_start_key;
create unique index visits_booking_slot_key on public.visits (booking_id, slot_start);

-- Visits created by hand occupy the slot they start in.
create function private.default_visit_slot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.slot_start := coalesce(new.slot_start, new.scheduled_start);
  return new;
end;
$$;

create trigger default_visit_slot
  before insert on public.visits
  for each row execute function private.default_visit_slot();

-- ---------------------------------------------------------------------------
-- booking_care_times: multi-day stays get one visit per care time each day
-- ---------------------------------------------------------------------------

create table public.booking_care_times (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  booking_id uuid not null,
  care_time time not null, -- wall-clock, org timezone
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 240),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, care_time),
  unique (id, organization_id),
  unique (id, booking_id, organization_id),
  foreign key (booking_id, organization_id)
    references public.bookings (id, organization_id) on delete cascade
);

create index booking_care_times_organization_id_idx on public.booking_care_times (organization_id);

create trigger set_updated_at before update on public.booking_care_times
  for each row execute function private.set_updated_at();

-- A visit's care time must belong to the visit's own booking.
alter table public.visits
  add column care_time_id uuid,
  add constraint visits_care_time_fkey foreign key (care_time_id, booking_id, organization_id)
    references public.booking_care_times (id, booking_id, organization_id)
    on delete set null (care_time_id);

create index visits_care_time_id_idx on public.visits (care_time_id);

alter table public.booking_care_times enable row level security;
revoke all on public.booking_care_times from anon;

create policy "admins manage booking_care_times" on public.booking_care_times
  for all to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.is_admin()))
  with check (organization_id = (select private.current_org_id()) and (select private.is_admin()));

create policy "owners read own booking care times" on public.booking_care_times
  for select to authenticated
  using (organization_id = (select private.current_org_id()) and private.owns_booking(booking_id));

-- Owners set care times while the booking is still a request (request_booking).
create policy "owners add care times to requested bookings" on public.booking_care_times
  for insert to authenticated
  with check (
    organization_id = (select private.current_org_id())
    and private.owns_booking(booking_id)
    and exists (select 1 from public.bookings b where b.id = booking_id and b.status = 'requested')
  );

create policy "sitters read care times on assigned bookings" on public.booking_care_times
  for select to authenticated
  using (
    organization_id = (select private.current_org_id())
    and private.sitter_can_access_booking(booking_id)
  );

-- ---------------------------------------------------------------------------
-- bookings.series_id groups the bookings a "this and future" edit splits off
-- ---------------------------------------------------------------------------

alter table public.bookings add column series_id uuid;
update public.bookings set series_id = id;
alter table public.bookings
  alter column series_id set not null,
  alter column series_id set default gen_random_uuid();

create index bookings_series_id_idx on public.bookings (series_id);
