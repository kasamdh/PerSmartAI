-- Nightly top-up of confirmed bookings. Run with: npx supabase test db
-- "Time passing" is simulated by deleting the visits at the far end of the window.

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values
  ('f2000000-0000-4000-8000-0000000000a1', 'admin@topup.test'),
  ('f2000000-0000-4000-8000-0000000000c1', 'owner@topup.test'),
  ('f2000000-0000-4000-8000-0000000000b1', 'sitter@topup.test');

insert into public.organizations (id, name, timezone) values
  ('f2000000-0000-4000-8000-000000000001', 'Top-up Org', 'America/New_York');

insert into public.profiles (id, organization_id, role, full_name) values
  ('f2000000-0000-4000-8000-0000000000a1', 'f2000000-0000-4000-8000-000000000001', 'admin', 'Admin'),
  ('f2000000-0000-4000-8000-0000000000c1', 'f2000000-0000-4000-8000-000000000001', 'owner', 'Owner'),
  ('f2000000-0000-4000-8000-0000000000b1', 'f2000000-0000-4000-8000-000000000001', 'sitter', 'Sitter');

insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('f2000000-0000-4000-8000-0000000000d1', 'f2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-0000000000c1', '1 A St', 'Town');

insert into public.bookings (id, organization_id, household_id, service_type, recurrence_rule, start_date, end_date, window_start, duration_minutes, status) values
  -- open-ended daily drop-ins
  ('f2000000-0000-4000-8000-0000000000f1', 'f2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-0000000000d1',
   'drop_in', 'FREQ=DAILY', current_date + 1, null, '11:00', 30, 'requested'),
  -- daily for 120 days, longer than the window
  ('f2000000-0000-4000-8000-0000000000f2', 'f2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-0000000000d1',
   'walk', null, current_date + 1, current_date + 120, '15:00', 45, 'requested'),
  -- still waiting for an admin
  ('f2000000-0000-4000-8000-0000000000f3', 'f2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-0000000000d1',
   'drop_in', 'FREQ=DAILY', current_date + 1, null, '09:00', 30, 'requested');

create function pg_temp.sign_in(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.visit_count(p_booking uuid) returns int language sql as $$
  select count(*)::int from public.visits where booking_id = p_booking
$$;

select pg_temp.sign_in('f2000000-0000-4000-8000-0000000000a1');
set local role authenticated;
select public.confirm_booking('f2000000-0000-4000-8000-0000000000f1', 'f2000000-0000-4000-8000-0000000000b1');
select public.confirm_booking('f2000000-0000-4000-8000-0000000000f2', 'f2000000-0000-4000-8000-0000000000b1');

select throws_ok(
  $$ select private.top_up_booking_visits() $$,
  '42501', null,
  'clients cannot run the top-up'
);
reset role;

create temp table before_counts as
select pg_temp.visit_count('f2000000-0000-4000-8000-0000000000f1') as daily,
       pg_temp.visit_count('f2000000-0000-4000-8000-0000000000f2') as long_walk;

select ok(
  (select daily between 89 and 91 and long_walk between 89 and 91 from before_counts),
  'confirming still schedules about 90 days ahead'
);

-- Other bookings (e.g. seed data) may be topped up too; only this test's count.
select private.top_up_booking_visits();
select is(
  (select array[pg_temp.visit_count('f2000000-0000-4000-8000-0000000000f1'),
                pg_temp.visit_count('f2000000-0000-4000-8000-0000000000f2')]),
  (select array[daily, long_walk] from before_counts),
  'fully scheduled bookings get no new visits'
);

-- Simulate a month passing: the last 30 days of the window aren't generated yet,
-- and the sitter cancelled one visit that must stay cancelled.
delete from public.visits
where booking_id in ('f2000000-0000-4000-8000-0000000000f1', 'f2000000-0000-4000-8000-0000000000f2')
  and scheduled_start > now() + interval '60 days';
update public.visits set status = 'cancelled'
where id = (select id from public.visits where booking_id = 'f2000000-0000-4000-8000-0000000000f1'
            order by scheduled_start limit 1 offset 5);

select ok(
  (select pg_temp.visit_count('f2000000-0000-4000-8000-0000000000f1') < daily from before_counts),
  'the simulated month removed visits from the end of the window'
);

select private.top_up_booking_visits();

select is(
  (select array[pg_temp.visit_count('f2000000-0000-4000-8000-0000000000f1'),
                pg_temp.visit_count('f2000000-0000-4000-8000-0000000000f2')] from before_counts),
  (select array[daily, long_walk] from before_counts),
  'both bookings are back to their full count'
);

select is(
  (select count(*)::int from public.visits
   where booking_id = 'f2000000-0000-4000-8000-0000000000f1' and status = 'cancelled'),
  1,
  'a cancelled visit is not recreated'
);

select is_empty(
  $$ select 1 from public.visits
     where booking_id in ('f2000000-0000-4000-8000-0000000000f1', 'f2000000-0000-4000-8000-0000000000f2')
       and scheduled_start > now() + interval '60 days'
       and (sitter_id <> 'f2000000-0000-4000-8000-0000000000b1'
            or (scheduled_start at time zone 'America/New_York')::time not in ('11:00', '15:00')) $$,
  'new visits go to the booking''s sitter at the booked local time'
);

select is(pg_temp.visit_count('f2000000-0000-4000-8000-0000000000f3'), 0, 'requests waiting for an admin get no visits');

select is(
  (select schedule from cron.job where jobname = 'top-up-booking-visits'),
  '15 8 * * *',
  'the top-up runs nightly'
);

select * from finish();
rollback;
