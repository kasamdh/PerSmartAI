-- RLS isolation tests. Run with: npx supabase test db
--
-- Self-contained: builds its own fixtures inside a transaction and rolls back.
--
-- Fixture (org 1):
--   owner A -> household HA -> pets PA1 (on sitter 1's visit), PA2 (only on sitter 3's visit in 10 days)
--   owner B -> household HB -> pet PB1 (on sitter 2's visit)
--   sitter 1: visit VA (HA, PA1) starting in 1 hour
--   sitter 2: visit VB (HB, PB1) starting in 1 hour
--   sitter 3: visit VA2 (HA, PA2) starting in 10 days (outside the 24h secrets window)
-- Org 2: admin + owner C -> household HC -> pet PC1

begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres, RLS bypassed)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('b0000000-0000-4000-8000-0000000000a1', 'admin1@test.local'),
  ('b0000000-0000-4000-8000-0000000000a2', 'admin2@test.local'),
  ('b0000000-0000-4000-8000-0000000000c1', 'owner.a@test.local'),
  ('b0000000-0000-4000-8000-0000000000c2', 'owner.b@test.local'),
  ('b0000000-0000-4000-8000-0000000000c3', 'owner.c@test.local'),
  ('b0000000-0000-4000-8000-0000000000b1', 'sitter1@test.local'),
  ('b0000000-0000-4000-8000-0000000000b2', 'sitter2@test.local'),
  ('b0000000-0000-4000-8000-0000000000b3', 'sitter3@test.local');

insert into public.organizations (id, name) values
  ('b0000000-0000-4000-8000-000000000001', 'Org One'),
  ('b0000000-0000-4000-8000-000000000002', 'Org Two');

insert into public.profiles (id, organization_id, role, full_name) values
  ('b0000000-0000-4000-8000-0000000000a1', 'b0000000-0000-4000-8000-000000000001', 'admin', 'Admin One'),
  ('b0000000-0000-4000-8000-0000000000c1', 'b0000000-0000-4000-8000-000000000001', 'owner', 'Owner A'),
  ('b0000000-0000-4000-8000-0000000000c2', 'b0000000-0000-4000-8000-000000000001', 'owner', 'Owner B'),
  ('b0000000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-000000000001', 'sitter', 'Sitter 1'),
  ('b0000000-0000-4000-8000-0000000000b2', 'b0000000-0000-4000-8000-000000000001', 'sitter', 'Sitter 2'),
  ('b0000000-0000-4000-8000-0000000000b3', 'b0000000-0000-4000-8000-000000000001', 'sitter', 'Sitter 3'),
  ('b0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-000000000002', 'admin', 'Admin Two'),
  ('b0000000-0000-4000-8000-0000000000c3', 'b0000000-0000-4000-8000-000000000002', 'owner', 'Owner C');

insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('b0000000-0000-4000-8000-0000000000d1', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000c1', '1 A St', 'Town'),
  ('b0000000-0000-4000-8000-0000000000d2', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000c2', '2 B St', 'Town'),
  ('b0000000-0000-4000-8000-0000000000d3', 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-0000000000c3', '3 C St', 'City');

insert into public.household_access (organization_id, household_id, entry_instructions) values
  ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000d1', 'Code A'),
  ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000d2', 'Code B');

insert into public.pets (id, organization_id, household_id, name, species) values
  ('b0000000-0000-4000-8000-0000000000e1', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000d1', 'PA1', 'dog'),
  ('b0000000-0000-4000-8000-0000000000e2', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000d1', 'PA2', 'cat'),
  ('b0000000-0000-4000-8000-0000000000e3', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000d2', 'PB1', 'dog'),
  ('b0000000-0000-4000-8000-0000000000e4', 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-0000000000d3', 'PC1', 'cat');

insert into public.pet_allergies (organization_id, pet_id, allergen, severity) values
  ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000e3', 'Chicken', 'severe');

insert into public.feeding_plans (organization_id, pet_id, food_brand) values
  ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000e3', 'Brand B');

insert into public.bookings (id, organization_id, household_id, sitter_id, service_type, start_date, status) values
  ('b0000000-0000-4000-8000-0000000000f1', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000d1', 'b0000000-0000-4000-8000-0000000000b1', 'drop_in', current_date, 'confirmed'),
  ('b0000000-0000-4000-8000-0000000000f2', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000d2', 'b0000000-0000-4000-8000-0000000000b2', 'walk', current_date, 'confirmed'),
  ('b0000000-0000-4000-8000-0000000000f3', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000d1', 'b0000000-0000-4000-8000-0000000000b3', 'drop_in', current_date + 10, 'confirmed');

insert into public.booking_pets (organization_id, booking_id, pet_id) values
  ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000f1', 'b0000000-0000-4000-8000-0000000000e1'),
  ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000f2', 'b0000000-0000-4000-8000-0000000000e3'),
  ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000f3', 'b0000000-0000-4000-8000-0000000000e2');

insert into public.visits (id, organization_id, booking_id, sitter_id, scheduled_start, scheduled_end) values
  ('b0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000f1',
   'b0000000-0000-4000-8000-0000000000b1', now() + interval '1 hour', now() + interval '90 minutes'),
  ('b0000000-0000-4000-8000-000000000102', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000f2',
   'b0000000-0000-4000-8000-0000000000b2', now() + interval '1 hour', now() + interval '90 minutes'),
  ('b0000000-0000-4000-8000-000000000103', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000f3',
   'b0000000-0000-4000-8000-0000000000b3', now() + interval '10 days', now() + interval '10 days 30 minutes');

insert into public.visits (id, organization_id, booking_id, sitter_id, scheduled_start, scheduled_end, status, check_in_at, check_out_at) values
  ('b0000000-0000-4000-8000-000000000104', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000f1',
   'b0000000-0000-4000-8000-0000000000b1', now() - interval '1 day', now() - interval '23 hours', 'completed',
   now() - interval '1 day', now() - interval '23 hours');

-- Sitter 1 has checked in to visit 101 (care is only logged between check-in and check-out).
update public.visits set status = 'arrived', check_in_at = now()
 where id = 'b0000000-0000-4000-8000-000000000101';

-- A photo from sitter 2's visit at owner B's home.
insert into storage.objects (bucket_id, name, owner_id) values
  ('pet-media', 'b0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000102/photo.jpg',
   'b0000000-0000-4000-8000-0000000000b2');

insert into public.push_tokens (organization_id, profile_id, token, platform) values
  ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000c2', 'ExponentPushToken[owner-b-device]', 'ios');

-- Switch the session to a signed-in user (transaction-scoped).
create function pg_temp.sign_in(p_user_id uuid) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

-- ---------------------------------------------------------------------------
-- Schema guarantees
-- ---------------------------------------------------------------------------

select is_empty(
  $$ select tablename from pg_tables where schemaname = 'public' and not rowsecurity $$,
  'RLS is enabled on every public table'
);

select is_empty(
  $$ select t.table_name
     from information_schema.tables t
     where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
       and t.table_name <> 'organizations'
       and not exists (
         select 1 from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = t.table_name
           and c.column_name = 'organization_id'
       ) $$,
  'every table except organizations has organization_id'
);

-- ---------------------------------------------------------------------------
-- Owner A
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('b0000000-0000-4000-8000-0000000000c1');
set local role authenticated;

select results_eq(
  $$ select id from public.pets order by id $$,
  $$ values ('b0000000-0000-4000-8000-0000000000e1'::uuid), ('b0000000-0000-4000-8000-0000000000e2'::uuid) $$,
  'owner A sees exactly their own two pets'
);

select is_empty(
  $$ select 1 from public.pets where id = 'b0000000-0000-4000-8000-0000000000e3' $$,
  'owner A cannot read owner B''s pet'
);

select is_empty(
  $$ select 1 from public.pet_allergies where pet_id = 'b0000000-0000-4000-8000-0000000000e3'
     union all
     select 1 from public.feeding_plans where pet_id = 'b0000000-0000-4000-8000-0000000000e3' $$,
  'owner A cannot read owner B''s pet allergies or feeding plans'
);

select is_empty(
  $$ select 1 from public.households where id = 'b0000000-0000-4000-8000-0000000000d2'
     union all
     select 1 from public.household_access where household_id = 'b0000000-0000-4000-8000-0000000000d2' $$,
  'owner A cannot read owner B''s household or access details'
);

select is_empty(
  $$ select 1 from public.visits where id = 'b0000000-0000-4000-8000-000000000102' $$,
  'owner A cannot read owner B''s visits'
);

select is_empty(
  $$ update public.pets set name = 'hacked' where id = 'b0000000-0000-4000-8000-0000000000e3' returning id $$,
  'owner A cannot update owner B''s pet'
);

select throws_ok(
  $$ insert into public.pets (household_id, name, species)
     values ('b0000000-0000-4000-8000-0000000000d2', 'Intruder', 'dog') $$,
  '42501', null,
  'owner A cannot add a pet to owner B''s household'
);

select throws_ok(
  $$ update public.profiles set role = 'admin' where id = 'b0000000-0000-4000-8000-0000000000c1' $$,
  '42501', null,
  'owner A cannot promote themselves to admin'
);

select is_empty(
  $$ select 1 from storage.objects
     where name = 'b0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000102/photo.jpg' $$,
  'owner A cannot see photos from owner B''s visit'
);

select is_empty(
  $$ select 1 from public.push_tokens where token = 'ExponentPushToken[owner-b-device]' $$,
  'owner A cannot read owner B''s push tokens'
);

reset role;

-- ---------------------------------------------------------------------------
-- Owner B (positive control for storage)
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('b0000000-0000-4000-8000-0000000000c2');
set local role authenticated;

select isnt_empty(
  $$ select 1 from storage.objects
     where name = 'b0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000102/photo.jpg' $$,
  'owner B can see photos from their own visit'
);

reset role;

-- ---------------------------------------------------------------------------
-- Sitter 1
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('b0000000-0000-4000-8000-0000000000b1');
set local role authenticated;

select results_eq(
  $$ select id from public.pets $$,
  $$ values ('b0000000-0000-4000-8000-0000000000e1'::uuid) $$,
  'sitter 1 sees only the pet on their visit'
);

select is_empty(
  $$ select 1 from public.pet_allergies where pet_id = 'b0000000-0000-4000-8000-0000000000e3' $$,
  'sitter 1 cannot read allergies of a pet not on their visits'
);

select is_empty(
  $$ select 1 from public.households where id = 'b0000000-0000-4000-8000-0000000000d2'
     union all
     select 1 from public.household_access where household_id = 'b0000000-0000-4000-8000-0000000000d2' $$,
  'sitter 1 cannot read a household they have no visit for'
);

select isnt_empty(
  $$ select 1 from public.household_access where household_id = 'b0000000-0000-4000-8000-0000000000d1' $$,
  'sitter 1 can read access details within 24h of their visit'
);

select throws_ok(
  $$ insert into public.care_events (visit_id, type)
     values ('b0000000-0000-4000-8000-000000000102', 'fed') $$,
  '42501', null,
  'sitter 1 cannot log care on sitter 2''s visit'
);

select lives_ok(
  $$ insert into public.care_events (visit_id, pet_id, type, value)
     values ('b0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-0000000000e1', 'fed', '{"amount_eaten": "all"}') $$,
  'sitter 1 can log care on their own visit'
);

select throws_ok(
  $$ update public.visits set scheduled_start = scheduled_start + interval '1 day'
     where id = 'b0000000-0000-4000-8000-000000000101' $$,
  '42501', null,
  'sitter 1 cannot reschedule their visit'
);

select throws_ok(
  $$ update public.visits set status = 'in_progress', check_out_at = null
     where id = 'b0000000-0000-4000-8000-000000000104' $$,
  '42501', null,
  'sitter 1 cannot reopen a completed visit'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('pet-media', 'b0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000102/sneaky.jpg') $$,
  '42501', null,
  'sitter 1 cannot upload media to sitter 2''s visit'
);

reset role;

-- ---------------------------------------------------------------------------
-- Sitter 3 (visit is 10 days out)
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('b0000000-0000-4000-8000-0000000000b3');
set local role authenticated;

select isnt_empty(
  $$ select 1 from public.pets where id = 'b0000000-0000-4000-8000-0000000000e2' $$,
  'sitter 3 can read the pet on their upcoming visit'
);

select is_empty(
  $$ select 1 from public.household_access where household_id = 'b0000000-0000-4000-8000-0000000000d1' $$,
  'sitter 3 cannot read access details more than 24h before their visit'
);

reset role;

-- ---------------------------------------------------------------------------
-- Admin of org 2 (cross-tenant)
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('b0000000-0000-4000-8000-0000000000a2');
set local role authenticated;

select results_eq(
  $$ select id from public.pets $$,
  $$ values ('b0000000-0000-4000-8000-0000000000e4'::uuid) $$,
  'org 2 admin sees only org 2 pets'
);

select is_empty(
  $$ select 1 from public.profiles where organization_id = 'b0000000-0000-4000-8000-000000000001' $$,
  'org 2 admin cannot read org 1 profiles'
);

reset role;

select * from finish();
rollback;
