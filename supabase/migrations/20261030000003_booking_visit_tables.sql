-- Bookings, visits, care logs, media, messages, incidents, push tokens.
--
-- Care history (care_events, media, incidents) uses ON DELETE RESTRICT on its visit
-- and pet so records can't silently disappear when a booking or pet is deleted.

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  household_id uuid not null,
  sitter_id uuid, -- null until an admin assigns one
  service_type public.service_type not null,
  recurrence_rule text, -- RFC 5545 RRULE, e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR
  start_date date not null,
  end_date date,
  window_start time, -- wall-clock arrival window, org timezone
  window_end time,
  duration_minutes integer check (duration_minutes > 0),
  status public.booking_status not null default 'requested',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (window_end is null or window_start is null or window_end > window_start),
  unique (id, organization_id),
  foreign key (household_id, organization_id)
    references public.households (id, organization_id) on delete cascade,
  foreign key (sitter_id, organization_id)
    references public.profiles (id, organization_id) on delete set null (sitter_id)
);

create index bookings_organization_id_idx on public.bookings (organization_id);
create index bookings_household_id_idx on public.bookings (household_id);
create index bookings_sitter_id_idx on public.bookings (sitter_id);
create index bookings_org_status_idx on public.bookings (organization_id, status);

create trigger assert_sitter_role
  before insert or update of sitter_id on public.bookings
  for each row execute function private.assert_profile_role('sitter_id', 'sitter');

-- Owners may only request bookings (no sitter, status requested) and cancel them.
create function private.guard_booking_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_client_non_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'requested' or new.sitter_id is not null then
      raise exception 'New bookings must be requested without a sitter' using errcode = '42501';
    end if;
    return new;
  end if;

  if (to_jsonb(new) - array['status', 'updated_at']) <> (to_jsonb(old) - array['status', 'updated_at'])
     or new.status <> 'cancelled'
     or old.status not in ('requested', 'confirmed') then
    raise exception 'Only cancelling a requested or confirmed booking is allowed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_booking_write
  before insert or update on public.bookings
  for each row execute function private.guard_booking_write();

create table public.booking_pets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  booking_id uuid not null,
  pet_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, pet_id),
  foreign key (booking_id, organization_id)
    references public.bookings (id, organization_id) on delete cascade,
  foreign key (pet_id, organization_id)
    references public.pets (id, organization_id) on delete cascade
);

create index booking_pets_organization_id_idx on public.booking_pets (organization_id);
create index booking_pets_pet_id_idx on public.booking_pets (pet_id);
-- booking_id is covered by the unique (booking_id, pet_id) index.

create function private.assert_pet_in_booking_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.bookings b
    join public.pets p on p.household_id = b.household_id
    where b.id = new.booking_id and p.id = new.pet_id
  ) then
    raise exception 'Pet must belong to the booking''s household' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger assert_pet_in_booking_household
  before insert or update on public.booking_pets
  for each row execute function private.assert_pet_in_booking_household();

-- ---------------------------------------------------------------------------
-- visits (concrete occurrences of a booking)
-- ---------------------------------------------------------------------------

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  booking_id uuid not null,
  sitter_id uuid,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  status public.visit_status not null default 'scheduled',
  check_in_at timestamptz,
  check_in_lat double precision check (check_in_lat between -90 and 90),
  check_in_lng double precision check (check_in_lng between -180 and 180),
  check_out_at timestamptz,
  check_out_lat double precision check (check_out_lat between -90 and 90),
  check_out_lng double precision check (check_out_lng between -180 and 180),
  summary_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end > scheduled_start),
  check (check_out_at is null or check_in_at is null or check_out_at >= check_in_at),
  unique (id, organization_id),
  foreign key (booking_id, organization_id)
    references public.bookings (id, organization_id) on delete cascade,
  foreign key (sitter_id, organization_id)
    references public.profiles (id, organization_id) on delete set null (sitter_id)
);

create index visits_organization_id_idx on public.visits (organization_id);
create index visits_booking_id_idx on public.visits (booking_id, scheduled_start);
create index visits_sitter_schedule_idx on public.visits (sitter_id, scheduled_start);
create index visits_org_schedule_idx on public.visits (organization_id, scheduled_start);

create trigger assert_sitter_role
  before insert or update of sitter_id on public.visits
  for each row execute function private.assert_profile_role('sitter_id', 'sitter');

-- Sitters may only move a visit through its working statuses and record
-- check-in/out and the summary. Scheduling and assignment stay with admins.
create function private.guard_visit_update()
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

create trigger guard_visit_update
  before update on public.visits
  for each row execute function private.guard_visit_update();

-- ---------------------------------------------------------------------------
-- Visit history: care events, media, incidents
-- ---------------------------------------------------------------------------

-- Trigger: a pet referenced by a visit record must be on that visit's booking.
create function private.assert_pet_on_visit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pet_id is not null and not exists (
    select 1
    from public.visits v
    join public.booking_pets bp on bp.booking_id = v.booking_id
    where v.id = new.visit_id and bp.pet_id = new.pet_id
  ) then
    raise exception 'Pet is not part of this visit''s booking' using errcode = '23514';
  end if;
  return new;
end;
$$;

create table public.care_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  visit_id uuid not null,
  pet_id uuid,
  type public.care_event_type not null,
  value jsonb not null default '{}' check (jsonb_typeof(value) = 'object'),
  occurred_at timestamptz not null default now(), -- when it happened (may be logged offline later)
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (visit_id, organization_id)
    references public.visits (id, organization_id) on delete restrict,
  foreign key (pet_id, organization_id)
    references public.pets (id, organization_id) on delete restrict,
  foreign key (created_by, organization_id)
    references public.profiles (id, organization_id) on delete restrict
);

create index care_events_organization_id_idx on public.care_events (organization_id);
create index care_events_visit_id_idx on public.care_events (visit_id, occurred_at);
create index care_events_pet_id_idx on public.care_events (pet_id, occurred_at);
create index care_events_created_by_idx on public.care_events (created_by);

create trigger assert_pet_on_visit
  before insert or update on public.care_events
  for each row execute function private.assert_pet_on_visit();

create table public.media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  visit_id uuid not null,
  pet_id uuid,
  storage_path text not null unique, -- {organization_id}/{visit_id}/{file} in bucket pet-media
  thumb_path text,
  type public.media_type not null,
  caption text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (visit_id, organization_id)
    references public.visits (id, organization_id) on delete restrict,
  foreign key (pet_id, organization_id)
    references public.pets (id, organization_id) on delete restrict,
  foreign key (created_by, organization_id)
    references public.profiles (id, organization_id) on delete restrict
);

create index media_organization_id_idx on public.media (organization_id);
create index media_visit_id_idx on public.media (visit_id, created_at);
create index media_pet_id_idx on public.media (pet_id, created_at);
create index media_created_by_idx on public.media (created_by);

create trigger assert_pet_on_visit
  before insert or update on public.media
  for each row execute function private.assert_pet_on_visit();

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  visit_id uuid not null,
  pet_id uuid,
  severity public.incident_severity not null,
  description text not null check (length(trim(description)) > 0),
  action_taken text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (visit_id, organization_id)
    references public.visits (id, organization_id) on delete restrict,
  foreign key (pet_id, organization_id)
    references public.pets (id, organization_id) on delete restrict,
  foreign key (created_by, organization_id)
    references public.profiles (id, organization_id) on delete restrict
);

create index incidents_organization_id_idx on public.incidents (organization_id);
create index incidents_visit_id_idx on public.incidents (visit_id);
create index incidents_pet_id_idx on public.incidents (pet_id);
create index incidents_created_by_idx on public.incidents (created_by);

create trigger assert_pet_on_visit
  before insert or update on public.incidents
  for each row execute function private.assert_pet_on_visit();

-- ---------------------------------------------------------------------------
-- messages (one thread per household)
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  household_id uuid not null,
  sender_id uuid not null default auth.uid(),
  body text,
  media_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coalesce(length(trim(body)), 0) > 0 or media_id is not null),
  foreign key (household_id, organization_id)
    references public.households (id, organization_id) on delete cascade,
  foreign key (sender_id, organization_id)
    references public.profiles (id, organization_id) on delete restrict,
  foreign key (media_id, organization_id)
    references public.media (id, organization_id) on delete set null (media_id)
);

create index messages_organization_id_idx on public.messages (organization_id);
create index messages_household_id_idx on public.messages (household_id, created_at);
create index messages_sender_id_idx on public.messages (sender_id);
create index messages_media_id_idx on public.messages (media_id);

-- Non-admin participants may only mark messages read.
create function private.guard_message_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_client_non_admin()
     and (to_jsonb(new) - array['read_at', 'updated_at']) <> (to_jsonb(old) - array['read_at', 'updated_at']) then
    raise exception 'Only read_at can be updated' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_message_update
  before update on public.messages
  for each row execute function private.guard_message_update();

-- ---------------------------------------------------------------------------
-- push_tokens
-- ---------------------------------------------------------------------------

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  profile_id uuid not null default auth.uid(),
  token text not null unique,
  platform public.push_platform not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (profile_id, organization_id)
    references public.profiles (id, organization_id) on delete cascade
);

create index push_tokens_organization_id_idx on public.push_tokens (organization_id);
create index push_tokens_profile_id_idx on public.push_tokens (profile_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers on every table
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'profiles', 'households', 'household_access', 'emergency_contacts',
    'pets', 'pet_allergies', 'pet_medications', 'feeding_plans',
    'sitter_availability', 'sitter_time_off', 'bookings', 'booking_pets', 'visits',
    'care_events', 'media', 'incidents', 'messages', 'push_tokens'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
  end loop;
end;
$$;
