-- Organization scheduling settings and late cancellations. Run with: npx supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values
  ('f4000000-0000-4000-8000-0000000000a1', 'admin@late.test'),
  ('f4000000-0000-4000-8000-0000000000c1', 'owner@late.test'),
  ('f4000000-0000-4000-8000-0000000000b1', 'sitter@late.test');

insert into public.organizations (id, name, timezone) values
  ('f4000000-0000-4000-8000-000000000001', 'Late Org', 'America/New_York');

insert into public.profiles (id, organization_id, role, full_name) values
  ('f4000000-0000-4000-8000-0000000000a1', 'f4000000-0000-4000-8000-000000000001', 'admin', 'Admin'),
  ('f4000000-0000-4000-8000-0000000000c1', 'f4000000-0000-4000-8000-000000000001', 'owner', 'Owner'),
  ('f4000000-0000-4000-8000-0000000000b1', 'f4000000-0000-4000-8000-000000000001', 'sitter', 'Sitter');

insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('f4000000-0000-4000-8000-0000000000d1', 'f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-0000000000c1', '1 A St', 'Town');

insert into public.bookings (id, organization_id, household_id, sitter_id, service_type, recurrence_rule, start_date, status) values
  -- next visit in 3 hours: cancelling is late
  ('f4000000-0000-4000-8000-0000000000f1', 'f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-0000000000d1',
   'f4000000-0000-4000-8000-0000000000b1', 'walk', 'FREQ=DAILY', current_date, 'confirmed'),
  -- next visit in 3 days: cancelling is on time
  ('f4000000-0000-4000-8000-0000000000f2', 'f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-0000000000d1',
   'f4000000-0000-4000-8000-0000000000b1', 'walk', 'FREQ=DAILY', current_date, 'confirmed');

insert into public.visits (id, organization_id, booking_id, sitter_id, scheduled_start, scheduled_end) values
  ('f4000000-0000-4000-8000-000000000101', 'f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-0000000000f1',
   'f4000000-0000-4000-8000-0000000000b1', now() + interval '3 hours', now() + interval '4 hours'),
  ('f4000000-0000-4000-8000-000000000102', 'f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-0000000000f1',
   'f4000000-0000-4000-8000-0000000000b1', now() + interval '5 days', now() + interval '5 days 1 hour'),
  ('f4000000-0000-4000-8000-000000000201', 'f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-0000000000f2',
   'f4000000-0000-4000-8000-0000000000b1', now() + interval '3 days', now() + interval '3 days 1 hour');

create function pg_temp.sign_in(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

select results_eq(
  $$ select travel_buffer_minutes, cancellation_cutoff_hours from public.organizations
     where id = 'f4000000-0000-4000-8000-000000000001' $$,
  $$ values (15, 24) $$,
  'new businesses get a 15 minute travel buffer and a 24 hour cancellation cutoff'
);

select throws_ok(
  $$ update public.organizations set travel_buffer_minutes = 500 where id = 'f4000000-0000-4000-8000-000000000001' $$,
  '23514', null,
  'travel buffer is limited to 4 hours'
);

select pg_temp.sign_in('f4000000-0000-4000-8000-0000000000c1');
set local role authenticated;
update public.organizations set cancellation_cutoff_hours = 0 where id = 'f4000000-0000-4000-8000-000000000001';
reset role;
select is(
  (select cancellation_cutoff_hours from public.organizations where id = 'f4000000-0000-4000-8000-000000000001'),
  24,
  'owners cannot change business settings'
);

select pg_temp.sign_in('f4000000-0000-4000-8000-0000000000a1');
set local role authenticated;
select lives_ok(
  $$ update public.organizations set cancellation_cutoff_hours = 12, travel_buffer_minutes = 20
     where id = 'f4000000-0000-4000-8000-000000000001' $$,
  'admins can change business settings'
);
reset role;


-- ---------------------------------------------------------------------------
-- Late cancellations (cutoff now 12 hours)
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f4000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select lives_ok(
  $$ update public.bookings set status = 'cancelled'
     where id in ('f4000000-0000-4000-8000-0000000000f1', 'f4000000-0000-4000-8000-0000000000f2') $$,
  'owner cancels both bookings'
);
reset role;

select results_eq(
  $$ select id, late_cancellation, cancelled_at is not null from public.bookings
     where id in ('f4000000-0000-4000-8000-0000000000f1', 'f4000000-0000-4000-8000-0000000000f2') order by id $$,
  $$ values ('f4000000-0000-4000-8000-0000000000f1'::uuid, true, true),
            ('f4000000-0000-4000-8000-0000000000f2'::uuid, false, true) $$,
  'a booking is late when a visit starts within the cutoff, and both record when they were cancelled'
);

select results_eq(
  $$ select id, status::text, late_cancellation, cancelled_at is not null from public.visits
     where booking_id in ('f4000000-0000-4000-8000-0000000000f1', 'f4000000-0000-4000-8000-0000000000f2') order by id $$,
  $$ values ('f4000000-0000-4000-8000-000000000101'::uuid, 'cancelled', true, true),
            ('f4000000-0000-4000-8000-000000000102'::uuid, 'cancelled', false, true),
            ('f4000000-0000-4000-8000-000000000201'::uuid, 'cancelled', false, true) $$,
  'each visit records whether its own cancellation was late'
);

select pg_temp.sign_in('f4000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select throws_ok(
  $$ update public.bookings set late_cancellation = false where id = 'f4000000-0000-4000-8000-0000000000f1' $$,
  '42501', null,
  'owners cannot clear the late flag'
);
select throws_ok(
  $$ insert into public.bookings (household_id, service_type, start_date, late_cancellation)
     values ('f4000000-0000-4000-8000-0000000000d1', 'walk', current_date + 2, true) $$,
  '42501', null,
  'owners cannot set the late flag on new bookings'
);
reset role;

select * from finish();
rollback;
