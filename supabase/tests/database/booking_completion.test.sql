-- Nightly completion of finished bookings. Run with: npx supabase test db
-- Org time zone is UTC here so "today" is current_date.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email) values
  ('f3000000-0000-4000-8000-0000000000c1', 'owner@done.test'),
  ('f3000000-0000-4000-8000-0000000000b1', 'sitter@done.test');

insert into public.organizations (id, name, timezone) values
  ('f3000000-0000-4000-8000-000000000001', 'Done Org', 'UTC');

insert into public.profiles (id, organization_id, role, full_name) values
  ('f3000000-0000-4000-8000-0000000000c1', 'f3000000-0000-4000-8000-000000000001', 'owner', 'Owner'),
  ('f3000000-0000-4000-8000-0000000000b1', 'f3000000-0000-4000-8000-000000000001', 'sitter', 'Sitter');

insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('f3000000-0000-4000-8000-0000000000d1', 'f3000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-0000000000c1', '1 A St', 'Town');

insert into public.bookings (id, organization_id, household_id, sitter_id, service_type, recurrence_rule, start_date, end_date, status) values
  -- ended yesterday
  ('f3000000-0000-4000-8000-0000000000f1', 'f3000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-0000000000d1',
   'f3000000-0000-4000-8000-0000000000b1', 'drop_in', 'FREQ=DAILY', current_date - 10, current_date - 1, 'confirmed'),
  -- one-off two days ago, no end date
  ('f3000000-0000-4000-8000-0000000000f2', 'f3000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-0000000000d1',
   'f3000000-0000-4000-8000-0000000000b1', 'walk', null, current_date - 2, null, 'confirmed'),
  -- ends today: not over yet
  ('f3000000-0000-4000-8000-0000000000f3', 'f3000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-0000000000d1',
   'f3000000-0000-4000-8000-0000000000b1', 'drop_in', null, current_date - 3, current_date, 'confirmed'),
  -- open-ended repeat that started long ago
  ('f3000000-0000-4000-8000-0000000000f4', 'f3000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-0000000000d1',
   'f3000000-0000-4000-8000-0000000000b1', 'drop_in', 'FREQ=WEEKLY;BYDAY=MO', current_date - 100, null, 'confirmed'),
  -- ended, but its last visit is still in progress
  ('f3000000-0000-4000-8000-0000000000f5', 'f3000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-0000000000d1',
   'f3000000-0000-4000-8000-0000000000b1', 'overnight', null, current_date - 3, current_date - 1, 'confirmed'),
  -- past request nobody confirmed
  ('f3000000-0000-4000-8000-0000000000f6', 'f3000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-0000000000d1',
   null, 'walk', null, current_date - 5, null, 'requested');

insert into public.visits (organization_id, booking_id, sitter_id, scheduled_start, scheduled_end, status, check_in_at) values
  ('f3000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-0000000000f5', 'f3000000-0000-4000-8000-0000000000b1',
   now() - interval '14 hours', now() - interval '1 hour', 'in_progress', now() - interval '14 hours');

create function pg_temp.status_of(p_id uuid) returns text language sql as $$
  select status::text from public.bookings where id = p_id
$$;

set local role authenticated;
select throws_ok($$ select private.complete_finished_bookings() $$, '42501', null, 'clients cannot run it');
reset role;

select private.complete_finished_bookings();

select is(pg_temp.status_of('f3000000-0000-4000-8000-0000000000f1'), 'completed', 'a booking that ended yesterday is completed');
select is(pg_temp.status_of('f3000000-0000-4000-8000-0000000000f2'), 'completed', 'a past one-off is completed');
select is(pg_temp.status_of('f3000000-0000-4000-8000-0000000000f3'), 'confirmed', 'a booking ending today is not');
select is(pg_temp.status_of('f3000000-0000-4000-8000-0000000000f4'), 'confirmed', 'an open-ended repeat is not');
select is(pg_temp.status_of('f3000000-0000-4000-8000-0000000000f5'), 'confirmed', 'a booking with a visit still under way is not');
select is(pg_temp.status_of('f3000000-0000-4000-8000-0000000000f6'), 'requested', 'requests are left alone');

select is(
  (select schedule from cron.job where jobname = 'complete-finished-bookings'),
  '10 8 * * *',
  'completion runs nightly'
);

select * from finish();
rollback;
