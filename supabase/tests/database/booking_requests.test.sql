-- request_booking and cancelling bookings. Run with: npx supabase test db
-- Dates are a few days from today so the org-local "today" never matters.

begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

insert into auth.users (id, email) values
  ('f0000000-0000-4000-8000-0000000000a1', 'admin@req.test'),
  ('f0000000-0000-4000-8000-0000000000c1', 'owner.a@req.test'),
  ('f0000000-0000-4000-8000-0000000000c2', 'owner.b@req.test'),
  ('f0000000-0000-4000-8000-0000000000c3', 'owner.nohome@req.test'),
  ('f0000000-0000-4000-8000-0000000000b1', 'sitter@req.test'),
  ('f0000000-0000-4000-8000-0000000000c9', 'owner.other-org@req.test');

insert into public.organizations (id, name, timezone) values
  ('f0000000-0000-4000-8000-000000000001', 'Req Org', 'America/New_York'),
  ('f0000000-0000-4000-8000-000000000002', 'Other Org', 'America/New_York');

insert into public.profiles (id, organization_id, role, full_name) values
  ('f0000000-0000-4000-8000-0000000000a1', 'f0000000-0000-4000-8000-000000000001', 'admin', 'Admin'),
  ('f0000000-0000-4000-8000-0000000000c1', 'f0000000-0000-4000-8000-000000000001', 'owner', 'Owner A'),
  ('f0000000-0000-4000-8000-0000000000c2', 'f0000000-0000-4000-8000-000000000001', 'owner', 'Owner B'),
  ('f0000000-0000-4000-8000-0000000000c3', 'f0000000-0000-4000-8000-000000000001', 'owner', 'No Home'),
  ('f0000000-0000-4000-8000-0000000000b1', 'f0000000-0000-4000-8000-000000000001', 'sitter', 'Sitter'),
  ('f0000000-0000-4000-8000-0000000000c9', 'f0000000-0000-4000-8000-000000000002', 'owner', 'Other Org Owner');

insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('f0000000-0000-4000-8000-0000000000d1', 'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000c1', '1 A St', 'Town'),
  ('f0000000-0000-4000-8000-0000000000d2', 'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000c2', '2 B St', 'Town'),
  ('f0000000-0000-4000-8000-0000000000d9', 'f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-0000000000c9', '9 Z St', 'Elsewhere');

insert into public.pets (id, organization_id, household_id, name, species) values
  ('f0000000-0000-4000-8000-0000000000e1', 'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000d1', 'Pip', 'dog'),
  ('f0000000-0000-4000-8000-0000000000e2', 'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000d1', 'Mo', 'cat'),
  ('f0000000-0000-4000-8000-0000000000e3', 'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000d2', 'Bee', 'dog'),
  ('f0000000-0000-4000-8000-0000000000e9', 'f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-0000000000d9', 'Zed', 'dog');

create function pg_temp.sign_in(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Owner A requests
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f0000000-0000-4000-8000-0000000000c1');
set local role authenticated;

create temp table req (id uuid) on commit drop;
grant all on req to authenticated;

insert into req
select public.request_booking(
  'drop_in',
  array['f0000000-0000-4000-8000-0000000000e1', 'f0000000-0000-4000-8000-0000000000e2', 'f0000000-0000-4000-8000-0000000000e1']::uuid[],
  current_date + 2, current_date + 4, '11:00', '13:00', 30, ' freq=daily ', '  Midday break  '
);

select results_eq(
  $$ select b.household_id, b.status::text, b.sitter_id, b.recurrence_rule, b.notes
     from public.bookings b join req on req.id = b.id $$,
  $$ values ('f0000000-0000-4000-8000-0000000000d1'::uuid, 'requested', null::uuid, 'FREQ=DAILY', 'Midday break') $$,
  'request is saved for the owner''s household as requested, unassigned, with a normalized rule and trimmed notes'
);

select results_eq(
  $$ select bp.pet_id from public.booking_pets bp join req on req.id = bp.booking_id order by bp.pet_id $$,
  $$ values ('f0000000-0000-4000-8000-0000000000e1'::uuid), ('f0000000-0000-4000-8000-0000000000e2'::uuid) $$,
  'each chosen pet is added once'
);

select lives_ok(
  $$ select public.request_booking('walk', array['f0000000-0000-4000-8000-0000000000e1']::uuid[], current_date + 3,
       null, '14:00', null, 45, 'FREQ=WEEKLY;BYDAY=MO,WE,FR', null) $$,
  'weekly rules with weekdays are accepted'
);

select lives_ok(
  $$ select public.request_booking('overnight', array['f0000000-0000-4000-8000-0000000000e2']::uuid[], current_date + 5,
       current_date + 7, '19:00', '08:00', null, null, null) $$,
  'overnight stays with an end date are accepted'
);

select throws_ok(
  $$ select public.request_booking('walk', array['f0000000-0000-4000-8000-0000000000e1', 'f0000000-0000-4000-8000-0000000000e3']::uuid[], current_date + 2) $$,
  '23514', null,
  'another household''s pet is rejected'
);

select is(
  (select count(*)::int from public.bookings),
  3,
  'a rejected request leaves no half-made booking behind'
);

select throws_ok(
  $$ select public.request_booking('walk', array['f0000000-0000-4000-8000-0000000000e9']::uuid[], current_date + 2) $$,
  '23514', null,
  'another business''s pet is rejected'
);

select throws_ok(
  $$ select public.request_booking('walk', array[]::uuid[], current_date + 2) $$,
  '22023', 'Choose at least one pet',
  'a booking needs at least one pet'
);

select throws_ok(
  $$ select public.request_booking('walk', array['f0000000-0000-4000-8000-0000000000e1']::uuid[], current_date - 2) $$,
  '22023', 'Bookings can''t start in the past',
  'bookings cannot start in the past'
);

select throws_ok(
  $$ select public.request_booking('walk', array['f0000000-0000-4000-8000-0000000000e1']::uuid[], current_date + 2,
       null, null, null, null, 'FREQ=MONTHLY') $$,
  '22023', null,
  'rules confirm_booking can''t expand are rejected'
);

select throws_ok(
  $$ select public.request_booking('overnight', array['f0000000-0000-4000-8000-0000000000e1']::uuid[], current_date + 2,
       current_date + 3, null, null, null, 'FREQ=DAILY') $$,
  '22023', null,
  'overnight stays cannot repeat'
);

select throws_ok(
  $$ select public.request_booking('overnight', array['f0000000-0000-4000-8000-0000000000e1']::uuid[], current_date + 2) $$,
  '22023', 'Overnight stays need an end date',
  'overnight stays need an end date'
);

select throws_ok(
  $$ insert into public.bookings (household_id, service_type, start_date, status)
     values ('f0000000-0000-4000-8000-0000000000d2', 'walk', current_date + 2, 'requested') $$,
  '42501', null,
  'owners cannot insert bookings for another household directly'
);

reset role;

-- ---------------------------------------------------------------------------
-- Who else can request, and who can see the request
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f0000000-0000-4000-8000-0000000000c3');
set local role authenticated;
select throws_ok(
  $$ select public.request_booking('walk', array['f0000000-0000-4000-8000-0000000000e1']::uuid[], current_date + 2) $$,
  'P0002', 'Add your home address before booking',
  'an owner without a home cannot book (and cannot use someone else''s pets)'
);
reset role;

select pg_temp.sign_in('f0000000-0000-4000-8000-0000000000c2');
set local role authenticated;
select is_empty(
  $$ select 1 from public.bookings where household_id = 'f0000000-0000-4000-8000-0000000000d1' $$,
  'another owner cannot see the requests'
);
reset role;

select pg_temp.sign_in('f0000000-0000-4000-8000-0000000000b1');
set local role authenticated;
select is_empty(
  $$ select 1 from public.bookings $$,
  'sitters cannot see unassigned requests'
);
reset role;

select pg_temp.sign_in('f0000000-0000-4000-8000-0000000000c9');
set local role authenticated;
select is_empty(
  $$ select 1 from public.bookings $$,
  'owners in another business cannot see the requests'
);
reset role;

-- ---------------------------------------------------------------------------
-- Cancelling a confirmed booking
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f0000000-0000-4000-8000-0000000000a1');
set local role authenticated;
select is(
  (select public.confirm_booking(id, 'f0000000-0000-4000-8000-0000000000b1') from req),
  3,
  'admin confirms the daily request into 3 visits'
);
reset role;

-- One visit the sitter has already started.
insert into public.visits (organization_id, booking_id, sitter_id, scheduled_start, scheduled_end, status, check_in_at)
select 'f0000000-0000-4000-8000-000000000001', id, 'f0000000-0000-4000-8000-0000000000b1',
       now() - interval '10 minutes', now() + interval '20 minutes', 'in_progress', now() - interval '5 minutes'
from req;

select pg_temp.sign_in('f0000000-0000-4000-8000-0000000000b1');
set local role authenticated;
select throws_ok(
  $$ update public.visits set status = 'cancelled' where booking_id = (select id from req) and status = 'scheduled' $$,
  '42501', null,
  'sitters still cannot cancel visits themselves'
);
reset role;

select pg_temp.sign_in('f0000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select lives_ok(
  $$ update public.bookings set status = 'cancelled' where id = (select id from req) $$,
  'owner cancels the confirmed booking'
);
reset role;

select results_eq(
  $$ select status::text, count(*)::int from public.visits where booking_id = (select id from req)
     group by status order by status $$,
  $$ values ('cancelled', 3), ('in_progress', 1) $$,
  'upcoming visits are cancelled; the visit under way is left for the sitter to finish'
);

select is(
  current_setting('app.booking_cancel_cascade', true),
  '',
  'the cascade flag is cleared after the cascade'
);

select * from finish();
rollback;
