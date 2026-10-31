-- Pet profile permissions and the primary emergency contact function.

begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email) values
  ('e0000000-0000-4000-8000-0000000000a1', 'admin@pets.test'),
  ('e0000000-0000-4000-8000-0000000000c1', 'owner.a@pets.test'),
  ('e0000000-0000-4000-8000-0000000000c2', 'owner.b@pets.test'),
  ('e0000000-0000-4000-8000-0000000000b1', 'sitter@pets.test');

insert into public.organizations (id, name) values ('e0000000-0000-4000-8000-000000000001', 'Pets Org');

insert into public.profiles (id, organization_id, role, full_name) values
  ('e0000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-000000000001', 'admin', 'Admin'),
  ('e0000000-0000-4000-8000-0000000000c1', 'e0000000-0000-4000-8000-000000000001', 'owner', 'Owner A'),
  ('e0000000-0000-4000-8000-0000000000c2', 'e0000000-0000-4000-8000-000000000001', 'owner', 'Owner B'),
  ('e0000000-0000-4000-8000-0000000000b1', 'e0000000-0000-4000-8000-000000000001', 'sitter', 'Sitter');

insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('e0000000-0000-4000-8000-0000000000d1', 'e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-0000000000c1', '1 A St', 'Town');

insert into public.emergency_contacts (id, organization_id, household_id, name, phone, is_primary) values
  ('e0000000-0000-4000-8000-000000000301', 'e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-0000000000d1', 'First', '+15550001', true),
  ('e0000000-0000-4000-8000-000000000302', 'e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-0000000000d1', 'Second', '+15550002', false);

insert into public.pets (id, organization_id, household_id, name, species) values
  ('e0000000-0000-4000-8000-0000000000e1', 'e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-0000000000d1', 'Pip', 'dog');
insert into public.pet_allergies (organization_id, pet_id, allergen, severity) values
  ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-0000000000e1', 'Chicken', 'severe');

insert into public.bookings (id, organization_id, household_id, sitter_id, service_type, start_date, status) values
  ('e0000000-0000-4000-8000-0000000000f1', 'e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-0000000000d1', 'e0000000-0000-4000-8000-0000000000b1', 'walk', current_date, 'confirmed');
insert into public.booking_pets (organization_id, booking_id, pet_id) values
  ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-0000000000f1', 'e0000000-0000-4000-8000-0000000000e1');
insert into public.visits (organization_id, booking_id, sitter_id, scheduled_start, scheduled_end) values
  ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-0000000000f1', 'e0000000-0000-4000-8000-0000000000b1', now() + interval '1 hour', now() + interval '90 minutes');

insert into storage.objects (bucket_id, name, owner_id) values
  ('pet-media', 'e0000000-0000-4000-8000-000000000001/pets/e0000000-0000-4000-8000-0000000000e1/existing.jpg', 'e0000000-0000-4000-8000-0000000000c1');

create function pg_temp.sign_in(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- Owner A ---------------------------------------------------------------------

select pg_temp.sign_in('e0000000-0000-4000-8000-0000000000c1');
set local role authenticated;

select lives_ok(
  $$ select public.set_primary_emergency_contact('e0000000-0000-4000-8000-000000000302') $$,
  'owner can make another contact primary'
);
select results_eq(
  $$ select name from public.emergency_contacts where is_primary $$,
  $$ values ('Second') $$,
  'exactly one primary contact remains, the new one'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('pet-media', 'e0000000-0000-4000-8000-000000000001/pets/e0000000-0000-4000-8000-0000000000e1/new.jpg') $$,
  'owner can upload a photo of their pet'
);
reset role;

-- Owner B ---------------------------------------------------------------------

select pg_temp.sign_in('e0000000-0000-4000-8000-0000000000c2');
set local role authenticated;
select throws_ok(
  $$ select public.set_primary_emergency_contact('e0000000-0000-4000-8000-000000000301') $$,
  'P0002', null,
  'another owner can''t touch the household''s contacts (they can''t even see them)'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('pet-media', 'e0000000-0000-4000-8000-000000000001/pets/e0000000-0000-4000-8000-0000000000e1/evil.jpg') $$,
  '42501', null,
  'another owner can''t upload photos of someone else''s pet'
);
reset role;

-- Assigned sitter: read-only ----------------------------------------------------

select pg_temp.sign_in('e0000000-0000-4000-8000-0000000000b1');
set local role authenticated;
select isnt_empty(
  $$ select 1 from public.pet_allergies where pet_id = 'e0000000-0000-4000-8000-0000000000e1' $$,
  'assigned sitter can read the allergies'
);
select isnt_empty(
  $$ select 1 from public.emergency_contacts where household_id = 'e0000000-0000-4000-8000-0000000000d1' $$,
  'assigned sitter can read emergency contacts'
);
select isnt_empty(
  $$ select 1 from storage.objects where name like 'e0000000-0000-4000-8000-000000000001/pets/%' $$,
  'assigned sitter can see pet photos'
);
select is_empty(
  $$ update public.pets set name = 'Renamed' where id = 'e0000000-0000-4000-8000-0000000000e1' returning id $$,
  'assigned sitter can''t edit the pet'
);
select throws_ok(
  $$ insert into public.pet_allergies (pet_id, allergen, severity)
     values ('e0000000-0000-4000-8000-0000000000e1', 'Beef', 'mild') $$,
  '42501', null,
  'assigned sitter can''t add allergies'
);
select throws_ok(
  $$ select public.set_primary_emergency_contact('e0000000-0000-4000-8000-000000000301') $$,
  '42501', null,
  'assigned sitter can''t change the primary contact'
);
reset role;

-- Admin -------------------------------------------------------------------------

select pg_temp.sign_in('e0000000-0000-4000-8000-0000000000a1');
set local role authenticated;
select isnt_empty(
  $$ update public.pets set temperament_notes = 'Friendly' where id = 'e0000000-0000-4000-8000-0000000000e1' returning id $$,
  'admin can edit any pet in the business'
);
reset role;

select * from finish();
rollback;
