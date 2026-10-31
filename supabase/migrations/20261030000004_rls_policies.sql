-- Row Level Security for every table.
--
--   Admins:  full access within their organization.
--   Owners:  only their own household and everything hanging off it.
--   Sitters: households/pets on visits assigned to them (read), their own visit
--            records (write). Household access secrets only from 24h before a
--            visit starts until 24h after it ends.
--
-- Every policy also requires organization_id = current_org_id(). Helpers are
-- SECURITY DEFINER (so they don't recurse through RLS) and wrapped in
-- `(select ...)` where they don't depend on the row, so they run once per query.

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

create function private.owns_household(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.households
    where id = p_household_id and owner_id = (select auth.uid())
  )
$$;

create function private.owns_pet(p_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pets p
    join public.households h on h.id = p.household_id
    where p.id = p_pet_id and h.owner_id = (select auth.uid())
  )
$$;

create function private.owns_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings b
    join public.households h on h.id = b.household_id
    where b.id = p_booking_id and h.owner_id = (select auth.uid())
  )
$$;

create function private.owns_visit(p_visit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.visits v
    join public.bookings b on b.id = v.booking_id
    join public.households h on h.id = b.household_id
    where v.id = p_visit_id and h.owner_id = (select auth.uid())
  )
$$;

create function private.is_assigned_visit(p_visit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.visits
    where id = p_visit_id and sitter_id = (select auth.uid())
  )
$$;

create function private.sitter_can_access_household(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.visits v
    join public.bookings b on b.id = v.booking_id
    where b.household_id = p_household_id
      and v.sitter_id = (select auth.uid())
      and v.status <> 'cancelled'
  )
$$;

-- Entry instructions, alarm notes, wifi: only around an actual visit.
create function private.sitter_can_access_household_secrets(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.visits v
    join public.bookings b on b.id = v.booking_id
    where b.household_id = p_household_id
      and v.sitter_id = (select auth.uid())
      and v.status not in ('cancelled', 'missed')
      and now() between v.scheduled_start - interval '24 hours'
                    and v.scheduled_end + interval '24 hours'
  )
$$;

create function private.sitter_can_access_pet(p_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.visits v
    join public.booking_pets bp on bp.booking_id = v.booking_id
    where bp.pet_id = p_pet_id
      and v.sitter_id = (select auth.uid())
      and v.status <> 'cancelled'
  )
$$;

create function private.sitter_can_access_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings
    where id = p_booking_id and sitter_id = (select auth.uid())
  ) or exists (
    select 1 from public.visits
    where booking_id = p_booking_id and sitter_id = (select auth.uid())
  )
$$;

-- Who can see whose profile (besides themselves and admins):
--   everyone in the org can see admins; owners see sitters on their bookings/visits;
--   sitters see owners of households they serve.
create function private.can_see_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = p_profile_id and role = 'admin'
      and organization_id = private.current_org_id()
  )
  or exists (
    select 1
    from public.households h
    join public.bookings b on b.household_id = h.id
    left join public.visits v on v.booking_id = b.id
    where h.owner_id = (select auth.uid())
      and p_profile_id in (b.sitter_id, v.sitter_id)
  )
  or exists (
    select 1 from public.households h
    where h.owner_id = p_profile_id and private.sitter_can_access_household(h.id)
  )
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;
grant usage on schema private to service_role;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere; anon gets nothing
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
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

-- Admin full access within their org, for every table that has organization_id.
do $$
declare
  t text;
begin
  foreach t in array array[
    'households', 'household_access', 'emergency_contacts',
    'pets', 'pet_allergies', 'pet_medications', 'feeding_plans',
    'sitter_availability', 'sitter_time_off', 'bookings', 'booking_pets', 'visits',
    'care_events', 'media', 'incidents', 'messages'
  ] loop
    execute format(
      'create policy "admins manage %1$s" on public.%1$I for all to authenticated
         using (organization_id = (select private.current_org_id()) and (select private.is_admin()))
         with check (organization_id = (select private.current_org_id()) and (select private.is_admin()))',
      t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- organizations (created by a service-role onboarding flow, never by clients)
-- ---------------------------------------------------------------------------

create policy "members read their organization" on public.organizations
  for select to authenticated
  using (id = (select private.current_org_id()));

create policy "admins update their organization" on public.organizations
  for update to authenticated
  using (id = (select private.current_org_id()) and (select private.is_admin()))
  with check (id = (select private.current_org_id()) and (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy "read visible profiles" on public.profiles
  for select to authenticated
  using (
    organization_id = (select private.current_org_id())
    and (
      id = (select auth.uid())
      or (select private.is_admin())
      or private.can_see_profile(id)
    )
  );

create policy "admins create profiles" on public.profiles
  for insert to authenticated
  with check (organization_id = (select private.current_org_id()) and (select private.is_admin()));

-- Role/org changes are blocked for non-admins by the guard_profile_update trigger.
create policy "update own profile or as admin" on public.profiles
  for update to authenticated
  using (
    organization_id = (select private.current_org_id())
    and (id = (select auth.uid()) or (select private.is_admin()))
  )
  with check (
    organization_id = (select private.current_org_id())
    and (id = (select auth.uid()) or (select private.is_admin()))
  );

create policy "admins delete profiles" on public.profiles
  for delete to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- households and household details
-- ---------------------------------------------------------------------------

create policy "owners manage own households" on public.households
  for all to authenticated
  using (organization_id = (select private.current_org_id()) and owner_id = (select auth.uid()))
  with check (organization_id = (select private.current_org_id()) and owner_id = (select auth.uid()));

create policy "sitters read households they visit" on public.households
  for select to authenticated
  using (
    organization_id = (select private.current_org_id())
    and private.sitter_can_access_household(id)
  );

create policy "owners manage own household access" on public.household_access
  for all to authenticated
  using (organization_id = (select private.current_org_id()) and private.owns_household(household_id))
  with check (organization_id = (select private.current_org_id()) and private.owns_household(household_id));

create policy "sitters read household access around visits" on public.household_access
  for select to authenticated
  using (
    organization_id = (select private.current_org_id())
    and private.sitter_can_access_household_secrets(household_id)
  );

create policy "owners manage own emergency contacts" on public.emergency_contacts
  for all to authenticated
  using (organization_id = (select private.current_org_id()) and private.owns_household(household_id))
  with check (organization_id = (select private.current_org_id()) and private.owns_household(household_id));

create policy "sitters read emergency contacts of households they visit" on public.emergency_contacts
  for select to authenticated
  using (
    organization_id = (select private.current_org_id())
    and private.sitter_can_access_household(household_id)
  );

-- ---------------------------------------------------------------------------
-- pets and care details
-- ---------------------------------------------------------------------------

create policy "owners manage own pets" on public.pets
  for all to authenticated
  using (organization_id = (select private.current_org_id()) and private.owns_household(household_id))
  with check (organization_id = (select private.current_org_id()) and private.owns_household(household_id));

create policy "sitters read pets on their visits" on public.pets
  for select to authenticated
  using (organization_id = (select private.current_org_id()) and private.sitter_can_access_pet(id));

do $$
declare
  t text;
begin
  foreach t in array array['pet_allergies', 'pet_medications', 'feeding_plans'] loop
    execute format(
      'create policy "owners manage own %1$s" on public.%1$I for all to authenticated
         using (organization_id = (select private.current_org_id()) and private.owns_pet(pet_id))
         with check (organization_id = (select private.current_org_id()) and private.owns_pet(pet_id))',
      t);
    execute format(
      'create policy "sitters read %1$s on their visits" on public.%1$I for select to authenticated
         using (organization_id = (select private.current_org_id()) and private.sitter_can_access_pet(pet_id))',
      t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- sitter availability
-- ---------------------------------------------------------------------------

create policy "sitters manage own availability" on public.sitter_availability
  for all to authenticated
  using (organization_id = (select private.current_org_id()) and sitter_id = (select auth.uid()))
  with check (organization_id = (select private.current_org_id()) and sitter_id = (select auth.uid()));

create policy "sitters manage own time off" on public.sitter_time_off
  for all to authenticated
  using (organization_id = (select private.current_org_id()) and sitter_id = (select auth.uid()))
  with check (organization_id = (select private.current_org_id()) and sitter_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------

create policy "owners read own bookings" on public.bookings
  for select to authenticated
  using (organization_id = (select private.current_org_id()) and private.owns_household(household_id));

create policy "owners request bookings" on public.bookings
  for insert to authenticated
  with check (
    organization_id = (select private.current_org_id())
    and private.owns_household(household_id)
    and status = 'requested'
    and sitter_id is null
  );

-- guard_booking_write limits owner updates to cancellation.
create policy "owners cancel own bookings" on public.bookings
  for update to authenticated
  using (organization_id = (select private.current_org_id()) and private.owns_household(household_id))
  with check (organization_id = (select private.current_org_id()) and private.owns_household(household_id));

create policy "sitters read assigned bookings" on public.bookings
  for select to authenticated
  using (organization_id = (select private.current_org_id()) and private.sitter_can_access_booking(id));

create policy "owners read own booking pets" on public.booking_pets
  for select to authenticated
  using (organization_id = (select private.current_org_id()) and private.owns_booking(booking_id));

create policy "owners add pets to requested bookings" on public.booking_pets
  for insert to authenticated
  with check (
    organization_id = (select private.current_org_id())
    and private.owns_booking(booking_id)
    and exists (select 1 from public.bookings b where b.id = booking_id and b.status = 'requested')
  );

create policy "owners remove pets from requested bookings" on public.booking_pets
  for delete to authenticated
  using (
    organization_id = (select private.current_org_id())
    and private.owns_booking(booking_id)
    and exists (select 1 from public.bookings b where b.id = booking_id and b.status = 'requested')
  );

create policy "sitters read booking pets on assigned bookings" on public.booking_pets
  for select to authenticated
  using (organization_id = (select private.current_org_id()) and private.sitter_can_access_booking(booking_id));

-- ---------------------------------------------------------------------------
-- visits
-- ---------------------------------------------------------------------------

create policy "owners read own visits" on public.visits
  for select to authenticated
  using (organization_id = (select private.current_org_id()) and private.owns_booking(booking_id));

create policy "sitters read assigned visits" on public.visits
  for select to authenticated
  using (organization_id = (select private.current_org_id()) and sitter_id = (select auth.uid()));

-- guard_visit_update limits which columns sitters may change.
create policy "sitters update assigned visits" on public.visits
  for update to authenticated
  using (organization_id = (select private.current_org_id()) and sitter_id = (select auth.uid()))
  with check (organization_id = (select private.current_org_id()) and sitter_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- care_events, media, incidents: owners read, assigned sitters write
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['care_events', 'media', 'incidents'] loop
    execute format(
      'create policy "owners read own %1$s" on public.%1$I for select to authenticated
         using (organization_id = (select private.current_org_id()) and private.owns_visit(visit_id))',
      t);
    execute format(
      'create policy "sitters read %1$s on assigned visits" on public.%1$I for select to authenticated
         using (organization_id = (select private.current_org_id()) and private.is_assigned_visit(visit_id))',
      t);
    execute format(
      'create policy "sitters create %1$s on assigned visits" on public.%1$I for insert to authenticated
         with check (
           organization_id = (select private.current_org_id())
           and created_by = (select auth.uid())
           and private.is_assigned_visit(visit_id)
         )',
      t);
    execute format(
      'create policy "sitters update own %1$s" on public.%1$I for update to authenticated
         using (
           organization_id = (select private.current_org_id())
           and created_by = (select auth.uid())
           and private.is_assigned_visit(visit_id)
         )
         with check (
           organization_id = (select private.current_org_id())
           and created_by = (select auth.uid())
           and private.is_assigned_visit(visit_id)
         )',
      t);
    execute format(
      'create policy "sitters delete own %1$s" on public.%1$I for delete to authenticated
         using (
           organization_id = (select private.current_org_id())
           and created_by = (select auth.uid())
           and private.is_assigned_visit(visit_id)
         )',
      t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- messages: household thread between its owner and sitters who visit it
-- ---------------------------------------------------------------------------

create policy "participants read household messages" on public.messages
  for select to authenticated
  using (
    organization_id = (select private.current_org_id())
    and (private.owns_household(household_id) or private.sitter_can_access_household(household_id))
  );

create policy "participants send household messages" on public.messages
  for insert to authenticated
  with check (
    organization_id = (select private.current_org_id())
    and sender_id = (select auth.uid())
    and (private.owns_household(household_id) or private.sitter_can_access_household(household_id))
  );

-- guard_message_update limits non-admins to setting read_at.
create policy "participants mark household messages read" on public.messages
  for update to authenticated
  using (
    organization_id = (select private.current_org_id())
    and (private.owns_household(household_id) or private.sitter_can_access_household(household_id))
  )
  with check (
    organization_id = (select private.current_org_id())
    and (private.owns_household(household_id) or private.sitter_can_access_household(household_id))
  );

-- ---------------------------------------------------------------------------
-- push_tokens: only the device owner; push sending runs with service_role
-- ---------------------------------------------------------------------------

create policy "users manage own push tokens" on public.push_tokens
  for all to authenticated
  using (organization_id = (select private.current_org_id()) and profile_id = (select auth.uid()))
  with check (organization_id = (select private.current_org_id()) and profile_id = (select auth.uid()));
