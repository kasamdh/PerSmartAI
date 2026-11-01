-- Notification triggers and settings. Run with: npx supabase test db
-- Events are read from pg_net's queue (nothing is sent in tests: the Vault
-- secrets are set by the seed, but the queue is only drained after commit).

begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (id, email) values
  ('f8000000-0000-4000-8000-0000000000a1', 'admin@notify.test'),
  ('f8000000-0000-4000-8000-0000000000c1', 'owner@notify.test'),
  ('f8000000-0000-4000-8000-0000000000c2', 'owner2@notify.test'),
  ('f8000000-0000-4000-8000-0000000000b1', 'sitter1@notify.test'),
  ('f8000000-0000-4000-8000-0000000000b2', 'sitter2@notify.test');

insert into public.organizations (id, name, timezone) values
  ('f8000000-0000-4000-8000-000000000001', 'Notify Org', 'America/New_York');

insert into public.profiles (id, organization_id, role, full_name) values
  ('f8000000-0000-4000-8000-0000000000a1', 'f8000000-0000-4000-8000-000000000001', 'admin', 'Admin'),
  ('f8000000-0000-4000-8000-0000000000c1', 'f8000000-0000-4000-8000-000000000001', 'owner', 'Owner'),
  ('f8000000-0000-4000-8000-0000000000c2', 'f8000000-0000-4000-8000-000000000001', 'owner', 'Owner 2'),
  ('f8000000-0000-4000-8000-0000000000b1', 'f8000000-0000-4000-8000-000000000001', 'sitter', 'Sitter 1'),
  ('f8000000-0000-4000-8000-0000000000b2', 'f8000000-0000-4000-8000-000000000001', 'sitter', 'Sitter 2');

insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('f8000000-0000-4000-8000-0000000000d1', 'f8000000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-0000000000c1', '1 A St', 'Town');

insert into public.pets (id, organization_id, household_id, name, species) values
  ('f8000000-0000-4000-8000-0000000000e1', 'f8000000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-0000000000d1', 'Max', 'dog');

insert into public.bookings (id, organization_id, household_id, service_type, start_date, window_start, duration_minutes) values
  ('f8000000-0000-4000-8000-0000000000f1', 'f8000000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-0000000000d1',
   'walk', current_date + 1, '11:00', 30);
insert into public.booking_pets (organization_id, booking_id, pet_id) values
  ('f8000000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-0000000000f1', 'f8000000-0000-4000-8000-0000000000e1');

create function pg_temp.sign_in(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

-- Events of these types queued so far, oldest first.
create function pg_temp.events(p_types text[]) returns setof jsonb language sql as $$
  select convert_from(body, 'utf8')::jsonb
  from net.http_request_queue
  where url like '%/notify-owner'
    and convert_from(body, 'utf8')::jsonb ->> 'type' = any (p_types)
  order by id
$$;

-- ---------------------------------------------------------------------------
-- Bookings assigned, changed, reassigned
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f8000000-0000-4000-8000-0000000000a1');
set local role authenticated;
select public.apply_booking_plan(
  'f8000000-0000-4000-8000-0000000000f1', 'f8000000-0000-4000-8000-0000000000b1',
  jsonb_build_array(jsonb_build_object(
    'slot_start', ((current_date + 1) + time '11:00') at time zone 'America/New_York',
    'scheduled_start', ((current_date + 1) + time '11:00') at time zone 'America/New_York',
    'scheduled_end', ((current_date + 1) + time '11:30') at time zone 'America/New_York')));
reset role;

select results_eq(
  $$ select e ->> 'type', e ->> 'sitter_id' from pg_temp.events(array['booking_assigned', 'booking_unassigned', 'visit_assigned']) e $$,
  $$ values ('booking_assigned', 'f8000000-0000-4000-8000-0000000000b1') $$,
  'confirming a booking tells its sitter once (not once per visit)'
);

select pg_temp.sign_in('f8000000-0000-4000-8000-0000000000a1');
set local role authenticated;
update public.bookings set window_start = '12:00' where id = 'f8000000-0000-4000-8000-0000000000f1';
reset role;
select is(
  (select count(*)::int from pg_temp.events(array['booking_changed'])),
  1,
  'changing a confirmed booking''s times tells the sitter'
);

-- ---------------------------------------------------------------------------
-- One visit reassigned, moved, cancelled
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f8000000-0000-4000-8000-0000000000a1');
set local role authenticated;
select public.update_visit_schedule(
  (select id from public.visits where booking_id = 'f8000000-0000-4000-8000-0000000000f1'),
  'f8000000-0000-4000-8000-0000000000b2');
reset role;

select results_eq(
  $$ select e ->> 'type', e ->> 'sitter_id' from pg_temp.events(array['visit_assigned', 'visit_unassigned']) e $$,
  $$ values ('visit_assigned', null), ('visit_unassigned', 'f8000000-0000-4000-8000-0000000000b1') $$,
  'reassigning one visit tells the new sitter and the old one'
);

select pg_temp.sign_in('f8000000-0000-4000-8000-0000000000a1');
set local role authenticated;
select public.update_visit_schedule(
  (select id from public.visits where booking_id = 'f8000000-0000-4000-8000-0000000000f1'),
  null, now() + interval '2 days', now() + interval '2 days 30 minutes');
reset role;
select is(
  (select count(*)::int from pg_temp.events(array['visit_changed'])),
  1,
  'moving one visit tells its sitter'
);

select pg_temp.sign_in('f8000000-0000-4000-8000-0000000000a1');
set local role authenticated;
update public.visits set status = 'cancelled' where booking_id = 'f8000000-0000-4000-8000-0000000000f1';
reset role;
select results_eq(
  $$ select e ->> 'sitter_id' from pg_temp.events(array['visit_cancelled']) e $$,
  $$ values ('f8000000-0000-4000-8000-0000000000b2') $$,
  'cancelling one visit tells its sitter'
);

-- System jobs send nothing for schedule changes.
insert into public.visits (id, organization_id, booking_id, sitter_id, scheduled_start, scheduled_end) values
  ('f8000000-0000-4000-8000-000000000102', 'f8000000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-0000000000f1',
   'f8000000-0000-4000-8000-0000000000b1', now() + interval '3 days', now() + interval '3 days 30 minutes');
select set_config('request.jwt.claims', '', true);
update public.visits set sitter_id = null where id = 'f8000000-0000-4000-8000-000000000102';
select is(
  (select count(*)::int from pg_temp.events(array['visit_unassigned'])),
  1,
  'the nightly job leaving a visit unassigned sends no push'
);

-- ---------------------------------------------------------------------------
-- Photos are batched by alert-checks, not pushed per insert
-- ---------------------------------------------------------------------------

insert into public.visits (id, organization_id, booking_id, sitter_id, scheduled_start, scheduled_end, status, check_in_at, started_at) values
  ('f8000000-0000-4000-8000-000000000101', 'f8000000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-0000000000f1',
   'f8000000-0000-4000-8000-0000000000b1', now() - interval '10 minutes', now() + interval '20 minutes', 'in_progress',
   now() - interval '9 minutes', now() - interval '9 minutes');

select pg_temp.sign_in('f8000000-0000-4000-8000-0000000000b1');
set local role authenticated;
insert into public.media (visit_id, storage_path, type) values
  ('f8000000-0000-4000-8000-000000000101', 'f8000000-0000-4000-8000-000000000001/f8000000-0000-4000-8000-000000000101/a.jpg', 'photo'),
  ('f8000000-0000-4000-8000-000000000101', 'f8000000-0000-4000-8000-000000000001/f8000000-0000-4000-8000-000000000101/b.jpg', 'photo');
reset role;
select is(
  (select count(*)::int from pg_temp.events(array['visit_photo', 'visit_photos'])),
  0,
  'photo inserts queue nothing; the batch job sends one alert'
);

-- ---------------------------------------------------------------------------
-- Not eating: two refusals in a row
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f8000000-0000-4000-8000-0000000000b1');
set local role authenticated;

insert into public.care_events (visit_id, pet_id, type, value, occurred_at) values
  ('f8000000-0000-4000-8000-000000000101', 'f8000000-0000-4000-8000-0000000000e1', 'fed', '{"amount_eaten": "none"}', now() - interval '8 minutes');
select is((select count(*)::int from pg_temp.events(array['food_refused'])), 0, 'one refused meal: no alert yet');

insert into public.care_events (visit_id, pet_id, type, value, occurred_at) values
  ('f8000000-0000-4000-8000-000000000101', 'f8000000-0000-4000-8000-0000000000e1', 'fed', '{"amount_eaten": "half"}', now() - interval '7 minutes'),
  ('f8000000-0000-4000-8000-000000000101', 'f8000000-0000-4000-8000-0000000000e1', 'fed', '{"amount_eaten": "none"}', now() - interval '6 minutes');
select is((select count(*)::int from pg_temp.events(array['food_refused'])), 0, 'a meal eaten in between breaks the streak');

insert into public.care_events (visit_id, pet_id, type, value, occurred_at) values
  ('f8000000-0000-4000-8000-000000000101', 'f8000000-0000-4000-8000-0000000000e1', 'fed', '{"amount_eaten": "none"}', now() - interval '5 minutes');
select results_eq(
  $$ select e ->> 'pet_name', e ->> 'visit_id' from pg_temp.events(array['food_refused']) e $$,
  $$ values ('Max', 'f8000000-0000-4000-8000-000000000101') $$,
  'two refused meals in a row alert the owner and admins'
);

insert into public.care_events (visit_id, pet_id, type, value, occurred_at) values
  ('f8000000-0000-4000-8000-000000000101', 'f8000000-0000-4000-8000-0000000000e1', 'fed', '{"amount_eaten": "none"}', now() - interval '4 minutes');
select is((select count(*)::int from pg_temp.events(array['food_refused'])), 1, 'a third refusal doesn''t repeat it');

insert into public.care_events (visit_id, pet_id, type, value) values
  ('f8000000-0000-4000-8000-000000000101', 'f8000000-0000-4000-8000-0000000000e1', 'pee', '{}');
reset role;
select is(private.food_refusal_streak('f8000000-0000-4000-8000-0000000000e1', now()), 3, 'other care doesn''t affect the streak');

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f8000000-0000-4000-8000-0000000000c1');
set local role authenticated;

select lives_ok(
  $$ insert into public.notification_settings (user_id, muted)
     values ('f8000000-0000-4000-8000-0000000000c1', array['new_photos']) $$,
  'a user turns an alert off'
);
select lives_ok(
  $$ update public.notification_settings set muted = array['new_photos', 'sitter_on_the_way']
     where user_id = 'f8000000-0000-4000-8000-0000000000c1' $$,
  '…and changes them'
);
select throws_ok(
  $$ update public.notification_settings set muted = array['incident']
     where user_id = 'f8000000-0000-4000-8000-0000000000c1' $$,
  '23514', null,
  'incident alerts can''t be turned off'
);
select throws_ok(
  $$ insert into public.notification_settings (user_id, muted)
     values ('f8000000-0000-4000-8000-0000000000c2', array['new_photos']) $$,
  '42501', null,
  'nobody can change someone else''s settings'
);
select throws_ok(
  $$ select 1 from public.notification_log $$,
  '42501', null,
  'the send log is not readable by users'
);
reset role;

select pg_temp.sign_in('f8000000-0000-4000-8000-0000000000c2');
set local role authenticated;
select is_empty(
  $$ select 1 from public.notification_settings $$,
  'users only see their own settings'
);
reset role;

select pg_temp.sign_in('f8000000-0000-4000-8000-0000000000a1');
set local role authenticated;
select is_empty(
  $$ select 1 from public.notification_settings $$,
  'admins don''t see users'' settings either'
);
reset role;

select * from finish();
rollback;
