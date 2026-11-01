-- Local development seed. Runs after migrations on `npx supabase db reset`.
-- Every seeded user's password is: password123
--
--   admin@happypaws.test   Alex Admin     admin
--   kasamdhakal55@gmail.com Kasam Dhakal  admin   (developer test login)
--   monikapokhrel55@gmail.com Monika    sitter  (assigned to Rudra's drop-ins)
--   sky@happypaws.test     Sky Sitter     sitter  (assigned to Oscar's walks)
--   rudradh@gmail.com      Rudra          owner   (Biscuit the dog, Mochi the cat)
--   oscar@example.test     Oscar Owner    owner   (Rex the dog)
--
-- Admins must sign in with two steps. Both seeded admins have an authenticator
-- factor with the dev-only secret JBSWY3DPEHPK3PXP: add it to any authenticator app
-- (or generate codes with node scripts/totp.mjs JBSWY3DPEHPK3PXP).
--
-- Visit times are relative to now() so "today" always has something on the schedule.

-- ---------------------------------------------------------------------------
-- Auth users (+ email identities so password sign-in works)
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', jsonb_build_object('full_name', u.full_name),
  now(), now(), '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-0000000000a1'::uuid, 'admin@happypaws.test', 'Alex Admin'),
  ('a0000000-0000-4000-8000-0000000000a2'::uuid, 'kasamdhakal55@gmail.com', 'Kasam Dhakal'),
  ('a0000000-0000-4000-8000-0000000000b1'::uuid, 'monikapokhrel55@gmail.com', 'Monika'),
  ('a0000000-0000-4000-8000-0000000000b2'::uuid, 'sky@happypaws.test', 'Sky Sitter'),
  ('a0000000-0000-4000-8000-0000000000c1'::uuid, 'rudradh@gmail.com', 'Rudra'),
  ('a0000000-0000-4000-8000-0000000000c2'::uuid, 'oscar@example.test', 'Oscar Owner')
) as u (id, email, full_name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.id::text like 'a0000000-0000-4000-8000-%';

-- ---------------------------------------------------------------------------
-- Organization and profiles
-- ---------------------------------------------------------------------------

insert into public.organizations (id, name, timezone) values
  ('a0000000-0000-4000-8000-000000000001', 'Happy Paws Pet Care', 'America/New_York');

insert into public.profiles (id, organization_id, role, full_name, phone) values
  ('a0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-000000000001', 'admin',  'Alex Admin',   '+15555550100'),
  ('a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-000000000001', 'admin',  'Kasam Dhakal', null),
  ('a0000000-0000-4000-8000-0000000000b1', 'a0000000-0000-4000-8000-000000000001', 'sitter', 'Monika',       '+15555550101'),
  ('a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-000000000001', 'sitter', 'Sky Sitter',   '+15555550102'),
  ('a0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-000000000001', 'owner',  'Rudra',        '+15555550201'),
  ('a0000000-0000-4000-8000-0000000000c2', 'a0000000-0000-4000-8000-000000000001', 'owner',  'Oscar Owner',  '+15555550202');

insert into public.sitter_availability (organization_id, sitter_id, weekday, start_time, end_time)
select 'a0000000-0000-4000-8000-000000000001', s.sitter_id, d.weekday, s.start_time, s.end_time
from (values
  ('a0000000-0000-4000-8000-0000000000b1'::uuid, '07:00'::time, '15:00'::time),
  ('a0000000-0000-4000-8000-0000000000b2'::uuid, '11:00'::time, '19:00'::time)
) as s (sitter_id, start_time, end_time)
cross join generate_series(1, 5) as d (weekday); -- Monday-Friday

insert into public.sitter_time_off (organization_id, sitter_id, start_at, end_at, reason) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b2',
   date_trunc('day', now()) + interval '14 days', date_trunc('day', now()) + interval '17 days', 'Vacation');

-- ---------------------------------------------------------------------------
-- Households
-- ---------------------------------------------------------------------------

insert into public.households (id, organization_id, owner_id, name, address_line1, city, region, postal_code, lat, lng) values
  ('a0000000-0000-4000-8000-0000000000d1', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000c1',
   'Rudra''s home', '12 Maple St', 'Brooklyn', 'NY', '11201', 40.6943, -73.9903),
  ('a0000000-0000-4000-8000-0000000000d2', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000c2',
   'Oscar''s apartment', '450 Pine Ave, Apt 3B', 'Brooklyn', 'NY', '11215', 40.6681, -73.9806);

insert into public.household_access (organization_id, household_id, entry_instructions, alarm_notes, wifi_name, wifi_password) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000d1',
   'Lockbox on back gate, code 4821. Key opens the side door.', 'Alarm panel by side door, code 1357, disarm within 30s.',
   'MapleHome', 'biscuit-and-mochi'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000d2',
   'Doorman has a key. Show ID and say you are with Happy Paws.', null, 'PineAve3B', 'rexrules');

insert into public.emergency_contacts (organization_id, household_id, name, relationship, phone, is_primary) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000d1', 'Rudra', 'Owner', '+15555550201', true),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000d1', 'Nora Neighbor', 'Neighbor', '+15555550301', false),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000d2', 'Oscar Owner', 'Owner', '+15555550202', true);

-- ---------------------------------------------------------------------------
-- Pets, allergies, medications, feeding plans
-- ---------------------------------------------------------------------------

insert into public.pets (
  id, organization_id, household_id, name, species, breed, birth_date, weight_kg, sex,
  spayed_neutered, microchip, temperament_notes, vet_name, vet_phone, vet_address
) values
  ('a0000000-0000-4000-8000-0000000000e1', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000d1',
   'Biscuit', 'dog', 'Golden Retriever', '2021-04-12', 29.5, 'male', true, '985112003456789',
   'Very friendly. Pulls on leash when he sees squirrels.', 'Dr. Patel', '+15555550400', '88 Court St, Brooklyn, NY'),
  ('a0000000-0000-4000-8000-0000000000e2', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000d1',
   'Mochi', 'cat', 'Domestic Shorthair', '2019-09-01', 4.2, 'female', true, null,
   'Shy at first. Hides under the bed; do not pull her out.', 'Dr. Patel', '+15555550400', '88 Court St, Brooklyn, NY'),
  ('a0000000-0000-4000-8000-0000000000e3', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000d2',
   'Rex', 'dog', 'German Shepherd', '2018-02-20', 36.0, 'male', false, '985112009876543',
   'Reactive to other dogs. Walk on quiet streets, keep distance.', 'Park Slope Vet', '+15555550500', '210 7th Ave, Brooklyn, NY');

insert into public.pet_allergies (organization_id, pet_id, allergen, severity, reaction_notes) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000e1', 'Chicken', 'moderate', 'Itchy skin and ear infections.'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000e2', 'Fish', 'mild', 'Vomits if she eats fish-based food.'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000e3', 'Bee stings', 'severe', 'Facial swelling. Call vet immediately; Benadryl in kitchen drawer.');

insert into public.pet_medications (organization_id, pet_id, name, dose, instructions, schedule_times) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000e3', 'Apoquel', '16 mg', 'Give with food.', array['08:00', '18:00']::time[]);

insert into public.feeding_plans (organization_id, pet_id, food_brand, amount, unit, times, treats_allowed, notes) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000e1', 'Purina Pro Plan Salmon', 2, 'cup', array['07:30', '17:30']::time[], true, 'No chicken treats.'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000e2', 'Hill''s Science Diet Turkey', 0.5, 'can', array['08:00', '18:00']::time[], false, 'Refill water fountain.'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000e3', 'Orijen Large Breed', 3, 'cup', array['08:00', '18:00']::time[], true, 'Mix medication into evening meal.');

-- ---------------------------------------------------------------------------
-- Bookings and visits
-- ---------------------------------------------------------------------------

insert into public.bookings (
  id, organization_id, household_id, sitter_id, service_type, recurrence_rule,
  start_date, end_date, window_start, window_end, duration_minutes, status, notes
) values
  -- Rudra: recurring weekday drop-ins with Monika
  ('a0000000-0000-4000-8000-0000000000f1', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000d1',
   'a0000000-0000-4000-8000-0000000000b1', 'drop_in', 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
   current_date - 7, current_date + 60, '11:00', '13:00', 30, 'confirmed', 'Midday potty break and feeding.'),
  -- Oscar: walk with Sky
  ('a0000000-0000-4000-8000-0000000000f2', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000d2',
   'a0000000-0000-4000-8000-0000000000b2', 'walk', null,
   current_date + 1, current_date + 1, '14:00', '15:00', 45, 'confirmed', null),
  -- Oscar: overnight request awaiting admin assignment
  ('a0000000-0000-4000-8000-0000000000f3', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000d2',
   null, 'overnight', null,
   current_date + 20, current_date + 22, null, null, null, 'requested', 'Away for a wedding.');

insert into public.booking_pets (organization_id, booking_id, pet_id) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1', 'a0000000-0000-4000-8000-0000000000e1'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1', 'a0000000-0000-4000-8000-0000000000e2'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f2', 'a0000000-0000-4000-8000-0000000000e3'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f3', 'a0000000-0000-4000-8000-0000000000e3');

insert into public.visits (
  id, organization_id, booking_id, sitter_id, scheduled_start, scheduled_end, status,
  check_in_at, check_out_at, summary_note
) values
  -- Yesterday: completed drop-in
  ('a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1',
   'a0000000-0000-4000-8000-0000000000b1',
   date_trunc('hour', now()) - interval '1 day', date_trunc('hour', now()) - interval '1 day' + interval '30 minutes', 'completed',
   date_trunc('hour', now()) - interval '1 day' + interval '2 minutes', date_trunc('hour', now()) - interval '1 day' + interval '33 minutes',
   'Biscuit ate everything, Mochi ate half. Good walk around the block.'),
  -- Later today: upcoming drop-in
  ('a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1',
   'a0000000-0000-4000-8000-0000000000b1',
   date_trunc('hour', now()) + interval '3 hours', date_trunc('hour', now()) + interval '3 hours 30 minutes', 'scheduled',
   null, null, null),
  -- Tomorrow: Rex's walk
  ('a0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f2',
   'a0000000-0000-4000-8000-0000000000b2',
   date_trunc('hour', now()) + interval '1 day', date_trunc('hour', now()) + interval '1 day 45 minutes', 'scheduled',
   null, null, null);

insert into public.care_events (organization_id, visit_id, pet_id, type, value, occurred_at, created_by) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-0000000000e1',
   'fed', '{"amount_eaten": "all"}', date_trunc('hour', now()) - interval '1 day' + interval '5 minutes', 'a0000000-0000-4000-8000-0000000000b1'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-0000000000e2',
   'fed', '{"amount_eaten": "half"}', date_trunc('hour', now()) - interval '1 day' + interval '6 minutes', 'a0000000-0000-4000-8000-0000000000b1'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-0000000000e1',
   'walk', '{"minutes": 20}', date_trunc('hour', now()) - interval '1 day' + interval '10 minutes', 'a0000000-0000-4000-8000-0000000000b1'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-0000000000e1',
   'pee', '{}', date_trunc('hour', now()) - interval '1 day' + interval '12 minutes', 'a0000000-0000-4000-8000-0000000000b1');

insert into public.messages (organization_id, household_id, sender_id, body, created_at) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000d1', 'a0000000-0000-4000-8000-0000000000b1',
   'All done! Biscuit had a great walk and Mochi came out to say hi.', date_trunc('hour', now()) - interval '1 day' + interval '33 minutes');

-- ---------------------------------------------------------------------------
-- Local push notification config (see migration 20261031000003).
-- The service_role JWT below is the public demo key every local Supabase stack
-- uses. Production sets its own values in Vault; never commit real keys.
-- ---------------------------------------------------------------------------

select vault.create_secret('http://kong:8000/functions/v1', 'edge_functions_url');
select vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  'service_role_key'
);

-- ---------------------------------------------------------------------------
-- Two-step sign-in for the seeded admins (dev-only secret, see the top)
-- ---------------------------------------------------------------------------

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret) values
  ('a0000000-0000-4000-8000-0000000000f9', 'a0000000-0000-4000-8000-0000000000a1', 'Dev authenticator', 'totp', 'verified', now(), now(), 'JBSWY3DPEHPK3PXP'),
  ('a0000000-0000-4000-8000-0000000000fa', 'a0000000-0000-4000-8000-0000000000a2', 'Dev authenticator', 'totp', 'verified', now(), now(), 'JBSWY3DPEHPK3PXP');
