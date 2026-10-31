-- Organizations, profiles, identity helpers, households, pets, and sitter availability.
--
-- Tenant integrity: every child row references its parent with a composite FK on
-- (parent_id, organization_id), so a row can never point at another tenant's data,
-- independent of RLS.
--
-- Wall-clock times (availability, feeding/medication times) are `time` values
-- interpreted in organizations.timezone. Instants are always `timestamptz` (UTC).

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  logo_url text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger validate_timezone
  before insert or update of timezone on public.organizations
  for each row execute function private.validate_timezone();

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users; a user belongs to exactly one organization)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role public.app_role not null,
  full_name text not null check (length(trim(full_name)) > 0),
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create index profiles_organization_id_idx on public.profiles (organization_id);
create index profiles_org_role_idx on public.profiles (organization_id, role);

-- ---------------------------------------------------------------------------
-- Identity helpers. SECURITY DEFINER so they can read profiles without
-- recursing into profiles' own RLS policies. Call them as `(select fn())` in
-- policies so Postgres evaluates them once per statement.
-- ---------------------------------------------------------------------------

create function private.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id from public.profiles where id = (select auth.uid())
$$;

-- Named current_app_role because CURRENT_ROLE is a reserved SQL keyword.
create function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() = 'admin', false)
$$;

-- True for an end-user request (signed-in JWT) from a non-admin. False for admins and
-- for trusted contexts without a user (service_role, migrations, seeds).
create function private.is_client_non_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and not private.is_admin()
$$;

-- Trigger: TG_ARGV[0] = column holding a profile id, TG_ARGV[1] = required role.
-- NULL column values are allowed (e.g. a booking with no sitter yet).
create function private.assert_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  required public.app_role := tg_argv[1]::public.app_role;
begin
  if profile_id is not null and not exists (
    select 1 from public.profiles where id = profile_id and role = required
  ) then
    raise exception '%.% must reference a profile with role %', tg_table_name, tg_argv[0], required
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Trigger: end users may not change their role or organization (admins may change
-- roles within their org; nobody moves a profile between orgs from the client).
create function private.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot be changed' using errcode = '42501';
  end if;
  if new.role is distinct from old.role and not private.is_admin() then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_profile_update
  before update on public.profiles
  for each row execute function private.guard_profile_update();

-- ---------------------------------------------------------------------------
-- households (an owner's home)
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  owner_id uuid not null,
  name text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  region text,
  postal_code text,
  country_code text not null default 'US' check (country_code ~ '^[A-Z]{2}$'),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (owner_id, organization_id)
    references public.profiles (id, organization_id) on delete cascade
);

create index households_organization_id_idx on public.households (organization_id);
create index households_owner_id_idx on public.households (owner_id);

create trigger assert_owner_role
  before insert or update of owner_id on public.households
  for each row execute function private.assert_profile_role('owner_id', 'owner');

-- Sensitive access details, split out so sitters only see them around a visit.
create table public.household_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  household_id uuid not null unique,
  entry_instructions text,
  alarm_notes text,
  wifi_name text,
  wifi_password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, organization_id)
    references public.households (id, organization_id) on delete cascade
);

create index household_access_organization_id_idx on public.household_access (organization_id);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  household_id uuid not null,
  name text not null,
  relationship text,
  phone text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, organization_id)
    references public.households (id, organization_id) on delete cascade
);

create index emergency_contacts_organization_id_idx on public.emergency_contacts (organization_id);
create index emergency_contacts_household_id_idx on public.emergency_contacts (household_id);
create unique index emergency_contacts_one_primary_idx
  on public.emergency_contacts (household_id) where is_primary;

-- ---------------------------------------------------------------------------
-- pets and care details
-- ---------------------------------------------------------------------------

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  household_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  species public.pet_species not null,
  breed text,
  birth_date date,
  weight_kg numeric(5, 2) check (weight_kg > 0),
  sex public.pet_sex not null default 'unknown',
  spayed_neutered boolean,
  microchip text,
  photo_url text, -- storage path: {organization_id}/pets/{pet_id}/{file}
  temperament_notes text,
  vet_name text,
  vet_phone text,
  vet_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (household_id, organization_id)
    references public.households (id, organization_id) on delete cascade
);

create index pets_organization_id_idx on public.pets (organization_id);
create index pets_household_id_idx on public.pets (household_id);

create table public.pet_allergies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  pet_id uuid not null,
  allergen text not null,
  severity public.allergy_severity not null,
  reaction_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (pet_id, organization_id)
    references public.pets (id, organization_id) on delete cascade
);

create index pet_allergies_organization_id_idx on public.pet_allergies (organization_id);
create index pet_allergies_pet_id_idx on public.pet_allergies (pet_id);

create table public.pet_medications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  pet_id uuid not null,
  name text not null,
  dose text,
  instructions text,
  schedule_times time[] not null default '{}', -- wall-clock, org timezone
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (pet_id, organization_id)
    references public.pets (id, organization_id) on delete cascade
);

create index pet_medications_organization_id_idx on public.pet_medications (organization_id);
create index pet_medications_pet_id_idx on public.pet_medications (pet_id);

create table public.feeding_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  pet_id uuid not null,
  food_brand text,
  amount numeric(6, 2) check (amount > 0),
  unit text, -- e.g. cup, can, g
  times time[] not null default '{}', -- wall-clock, org timezone
  treats_allowed boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (pet_id, organization_id)
    references public.pets (id, organization_id) on delete cascade
);

create index feeding_plans_organization_id_idx on public.feeding_plans (organization_id);
create index feeding_plans_pet_id_idx on public.feeding_plans (pet_id);

-- ---------------------------------------------------------------------------
-- sitter availability
-- ---------------------------------------------------------------------------

create table public.sitter_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  sitter_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null, -- wall-clock, org timezone
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  foreign key (sitter_id, organization_id)
    references public.profiles (id, organization_id) on delete cascade
);

create index sitter_availability_organization_id_idx on public.sitter_availability (organization_id);
create index sitter_availability_sitter_id_idx on public.sitter_availability (sitter_id, weekday);

create trigger assert_sitter_role
  before insert or update of sitter_id on public.sitter_availability
  for each row execute function private.assert_profile_role('sitter_id', 'sitter');

create table public.sitter_time_off (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  sitter_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  foreign key (sitter_id, organization_id)
    references public.profiles (id, organization_id) on delete cascade
);

create index sitter_time_off_organization_id_idx on public.sitter_time_off (organization_id);
create index sitter_time_off_sitter_id_idx on public.sitter_time_off (sitter_id, start_at);

create trigger assert_sitter_role
  before insert or update of sitter_id on public.sitter_time_off
  for each row execute function private.assert_profile_role('sitter_id', 'sitter');
