-- Visit status flow: transitions, advance_visit, recorded times, status line, and
-- care only between check-in and check-out. Run with: npx supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

-- ---------------------------------------------------------------------------
-- The transition rules
-- ---------------------------------------------------------------------------

select is(
  (select array_agg(f || '->' || t order by f, t)
   from unnest(enum_range(null::public.visit_status)) f,
        unnest(enum_range(null::public.visit_status)) t
   where private.visit_transition_allowed(f, t, false)),
  array['scheduled->on_the_way', 'on_the_way->arrived', 'arrived->in_progress', 'in_progress->completed'],
  'sitters can only take the next step'
);

select is(
  (select array_agg(f || '->' || t order by f, t)
   from unnest(enum_range(null::public.visit_status)) f,
        unnest(enum_range(null::public.visit_status)) t
   where private.visit_transition_allowed(f, t, true)
     and not private.visit_transition_allowed(f, t, false)),
  array['scheduled->missed', 'scheduled->cancelled', 'on_the_way->missed', 'on_the_way->cancelled',
        'arrived->cancelled', 'in_progress->cancelled'],
  'admins can also mark missed before check-in and cancel open visits'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('f6000000-0000-4000-8000-0000000000a1', 'admin@flow.test'),
  ('f6000000-0000-4000-8000-0000000000c1', 'owner@flow.test'),
  ('f6000000-0000-4000-8000-0000000000b1', 'sitter@flow.test'),
  ('f6000000-0000-4000-8000-0000000000b2', 'other-sitter@flow.test');

insert into public.organizations (id, name, timezone) values
  ('f6000000-0000-4000-8000-000000000001', 'Flow Org', 'America/New_York');

insert into public.profiles (id, organization_id, role, full_name) values
  ('f6000000-0000-4000-8000-0000000000a1', 'f6000000-0000-4000-8000-000000000001', 'admin', 'Admin'),
  ('f6000000-0000-4000-8000-0000000000c1', 'f6000000-0000-4000-8000-000000000001', 'owner', 'Owner'),
  ('f6000000-0000-4000-8000-0000000000b1', 'f6000000-0000-4000-8000-000000000001', 'sitter', 'Sitter'),
  ('f6000000-0000-4000-8000-0000000000b2', 'f6000000-0000-4000-8000-000000000001', 'sitter', 'Other');

insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('f6000000-0000-4000-8000-0000000000d1', 'f6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-0000000000c1', '1 A St', 'Town');

insert into public.pets (id, organization_id, household_id, name, species) values
  ('f6000000-0000-4000-8000-0000000000e1', 'f6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-0000000000d1', 'Rex', 'dog');

insert into public.bookings (id, organization_id, household_id, sitter_id, service_type, start_date, status) values
  ('f6000000-0000-4000-8000-0000000000f1', 'f6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-0000000000d1',
   'f6000000-0000-4000-8000-0000000000b1', 'drop_in', current_date, 'confirmed');

insert into public.booking_pets (organization_id, booking_id, pet_id) values
  ('f6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-0000000000f1', 'f6000000-0000-4000-8000-0000000000e1');

-- v1: walked through the whole flow. v2: checked out without logging care. v3: for admins.
insert into public.visits (id, organization_id, booking_id, sitter_id, scheduled_start, scheduled_end) values
  ('f6000000-0000-4000-8000-000000000101', 'f6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-0000000000f1',
   'f6000000-0000-4000-8000-0000000000b1', now(), now() + interval '30 minutes'),
  ('f6000000-0000-4000-8000-000000000102', 'f6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-0000000000f1',
   'f6000000-0000-4000-8000-0000000000b1', now() + interval '1 hour', now() + interval '90 minutes'),
  ('f6000000-0000-4000-8000-000000000103', 'f6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-0000000000f1',
   'f6000000-0000-4000-8000-0000000000b1', now() + interval '2 hours', now() + interval '150 minutes');

create function pg_temp.sign_in(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Sitter: one step at a time
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f6000000-0000-4000-8000-0000000000b1');
set local role authenticated;

select throws_ok(
  $$ select public.advance_visit('f6000000-0000-4000-8000-000000000101', 'arrived') $$,
  '22023', 'A visit can''t go from scheduled to arrived',
  'check-in before starting the trip is refused'
);

select throws_ok(
  $$ update public.visits set status = 'completed' where id = 'f6000000-0000-4000-8000-000000000101' $$,
  '22023', null,
  'a direct update can''t skip to completed either'
);

select throws_ok(
  $$ insert into public.care_events (visit_id, pet_id, type) values
       ('f6000000-0000-4000-8000-000000000101', 'f6000000-0000-4000-8000-0000000000e1', 'pee') $$,
  '42501', 'Check in before logging care',
  'care can''t be logged before check-in'
);

select is(
  (public.advance_visit('f6000000-0000-4000-8000-000000000101', 'on_the_way')).status::text,
  'on_the_way',
  'Start trip'
);

select lives_ok(
  $$ select public.advance_visit('f6000000-0000-4000-8000-000000000101', 'arrived', 40.69, -73.99) $$,
  'Check in with GPS'
);

select results_eq(
  $$ select status::text, on_the_way_at is not null, check_in_at is not null, check_in_lat, check_in_lng
     from public.visits where id = 'f6000000-0000-4000-8000-000000000101' $$,
  $$ values ('arrived', true, true, 40.69::double precision, -73.99::double precision) $$,
  'the server records each step''s time; check-in keeps the coordinates'
);

select lives_ok(
  $$ update public.visits set status_line = 'Out on a walk' where id = 'f6000000-0000-4000-8000-000000000101' $$,
  'sitters set the status line'
);

select lives_ok(
  $$ insert into public.care_events (visit_id, pet_id, type, value) values
       ('f6000000-0000-4000-8000-000000000101', 'f6000000-0000-4000-8000-0000000000e1', 'fed', '{"amount_eaten": "all"}') $$,
  'care is logged after check-in'
);

select results_eq(
  $$ select status::text, started_at is not null from public.visits where id = 'f6000000-0000-4000-8000-000000000101' $$,
  $$ values ('in_progress', true) $$,
  'the first care entry starts care'
);

select throws_ok(
  $$ update public.visits set started_at = now() - interval '1 hour' where id = 'f6000000-0000-4000-8000-000000000101' $$,
  '42501', null,
  'sitters can''t rewrite step times'
);

select lives_ok(
  $$ select public.advance_visit('f6000000-0000-4000-8000-000000000101', 'completed', 40.69, -73.99, '  All good!  ') $$,
  'Check out'
);

select results_eq(
  $$ select status::text, check_out_at is not null, summary_note, status_line, check_out_lat
     from public.visits where id = 'f6000000-0000-4000-8000-000000000101' $$,
  $$ values ('completed', true, 'All good!', null::text, 40.69::double precision) $$,
  'check-out records the time, place and trimmed summary, and clears the status line'
);

select throws_ok(
  $$ insert into public.care_events (visit_id, pet_id, type) values
       ('f6000000-0000-4000-8000-000000000101', 'f6000000-0000-4000-8000-0000000000e1', 'pee') $$,
  '42501', null,
  'care can''t be logged after check-out'
);

select throws_ok(
  $$ select public.advance_visit('f6000000-0000-4000-8000-000000000101', 'in_progress') $$,
  '42501', null,
  'a finished visit can''t be reopened'
);

-- v2: check in, then out, with nothing logged.
select public.advance_visit('f6000000-0000-4000-8000-000000000102', 'on_the_way');
select public.advance_visit('f6000000-0000-4000-8000-000000000102', 'arrived');
select lives_ok(
  $$ select public.advance_visit('f6000000-0000-4000-8000-000000000102', 'completed') $$,
  'checking out with nothing logged still works'
);
select results_eq(
  $$ select status::text, started_at is not null from public.visits where id = 'f6000000-0000-4000-8000-000000000102' $$,
  $$ values ('completed', true) $$,
  '…passing through in_progress rather than skipping it'
);

select throws_ok(
  $$ select public.advance_visit('f6000000-0000-4000-8000-000000000103', 'missed') $$,
  '42501', null,
  'sitters can''t mark a visit missed'
);

reset role;

-- ---------------------------------------------------------------------------
-- Others
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f6000000-0000-4000-8000-0000000000b2');
set local role authenticated;
select throws_ok(
  $$ select public.advance_visit('f6000000-0000-4000-8000-000000000103', 'on_the_way') $$,
  'P0002', null,
  'another sitter can''t move this visit'
);
reset role;

select pg_temp.sign_in('f6000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select throws_ok(
  $$ select public.advance_visit('f6000000-0000-4000-8000-000000000103', 'on_the_way') $$,
  '42501', null,
  'owners can''t move visits'
);
select is(
  (select status_line from public.visits where id = 'f6000000-0000-4000-8000-000000000101'),
  null,
  'owners can read the visit (status line included)'
);
reset role;

select pg_temp.sign_in('f6000000-0000-4000-8000-0000000000a1');
set local role authenticated;
select throws_ok(
  $$ update public.visits set status = 'completed' where id = 'f6000000-0000-4000-8000-000000000103' $$,
  '22023', null,
  'admins can''t skip steps either'
);
select lives_ok(
  $$ update public.visits set status = 'missed' where id = 'f6000000-0000-4000-8000-000000000103' $$,
  'admins mark a visit missed'
);
reset role;

-- Booking cancellation still cancels upcoming visits (system cascade).
insert into public.visits (id, organization_id, booking_id, sitter_id, scheduled_start, scheduled_end) values
  ('f6000000-0000-4000-8000-000000000104', 'f6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-0000000000f1',
   'f6000000-0000-4000-8000-0000000000b1', now() + interval '1 day', now() + interval '1 day 30 minutes');
select pg_temp.sign_in('f6000000-0000-4000-8000-0000000000c1');
set local role authenticated;
update public.bookings set status = 'cancelled' where id = 'f6000000-0000-4000-8000-0000000000f1';
reset role;
select is(
  (select status::text from public.visits where id = 'f6000000-0000-4000-8000-000000000104'),
  'cancelled',
  'cancelling the booking still cancels its upcoming visits'
);

select * from finish();
rollback;
