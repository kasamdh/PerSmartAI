-- confirm_booking tests. Run with: npx supabase test db
-- Self-contained fixtures in a rolled-back transaction. Org time zone: America/New_York.

begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

-- ---------------------------------------------------------------------------
-- Pure helpers (fixed dates)
-- ---------------------------------------------------------------------------

select is(
  private.local_to_utc('2026-10-30', '11:00', 'America/New_York'),
  '2026-10-30 15:00:00+00'::timestamptz,
  '11:00 New York is 15:00 UTC during daylight time (EDT)'
);

select is(
  private.local_to_utc('2026-11-02', '11:00', 'America/New_York'),
  '2026-11-02 16:00:00+00'::timestamptz,
  '11:00 New York is 16:00 UTC after DST ends (EST)'
);

select results_eq(
  $$ select * from private.booking_occurrence_dates('FREQ=WEEKLY;BYDAY=MO,WE,FR', '2026-11-02', '2026-11-15') $$,
  $$ values ('2026-11-02'::date), ('2026-11-04'), ('2026-11-06'), ('2026-11-09'), ('2026-11-11'), ('2026-11-13') $$,
  'weekly BYDAY=MO,WE,FR picks Mondays, Wednesdays, and Fridays'
);

select is(
  (select count(*)::int from private.booking_occurrence_dates(null, '2026-11-02', '2026-11-04')),
  3,
  'no rule means every day from start to end'
);

select throws_ok(
  $$ select * from private.booking_occurrence_dates('FREQ=MONTHLY', '2026-11-02', '2026-11-30') $$,
  '22023', null,
  'unsupported rules are rejected, not silently ignored'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('c0000000-0000-4000-8000-0000000000a1', 'admin@conf.test'),
  ('c0000000-0000-4000-8000-0000000000a2', 'other-admin@conf.test'),
  ('c0000000-0000-4000-8000-0000000000c1', 'owner@conf.test'),
  ('c0000000-0000-4000-8000-0000000000b1', 'sitter1@conf.test'),
  ('c0000000-0000-4000-8000-0000000000b2', 'sitter2@conf.test');

insert into public.organizations (id, name, timezone) values
  ('c0000000-0000-4000-8000-000000000001', 'Conf Org', 'America/New_York'),
  ('c0000000-0000-4000-8000-000000000002', 'Other Org', 'America/New_York');

insert into public.profiles (id, organization_id, role, full_name) values
  ('c0000000-0000-4000-8000-0000000000a1', 'c0000000-0000-4000-8000-000000000001', 'admin', 'Admin'),
  ('c0000000-0000-4000-8000-0000000000c1', 'c0000000-0000-4000-8000-000000000001', 'owner', 'Owner'),
  ('c0000000-0000-4000-8000-0000000000b1', 'c0000000-0000-4000-8000-000000000001', 'sitter', 'Sitter One'),
  ('c0000000-0000-4000-8000-0000000000b2', 'c0000000-0000-4000-8000-000000000001', 'sitter', 'Sitter Two'),
  ('c0000000-0000-4000-8000-0000000000a2', 'c0000000-0000-4000-8000-000000000002', 'admin', 'Other Admin');

insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('c0000000-0000-4000-8000-0000000000d1', 'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000c1', '1 Main St', 'Town');

insert into public.bookings (id, organization_id, household_id, service_type, recurrence_rule, start_date, end_date, window_start, window_end, duration_minutes) values
  -- daily drop-ins for 3 days at 11:00 for 30 min
  ('c0000000-0000-4000-8000-0000000000f1', 'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000d1',
   'drop_in', 'FREQ=DAILY', current_date + 1, current_date + 3, '11:00', '13:00', 30),
  -- overnight
  ('c0000000-0000-4000-8000-0000000000f2', 'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000d1',
   'overnight', null, current_date + 5, current_date + 6, null, null, null),
  -- one-off walk with no end date: exactly one visit
  ('c0000000-0000-4000-8000-0000000000f3', 'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000d1',
   'walk', null, current_date + 2, null, '14:00', null, 45);

create function pg_temp.sign_in(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Who can confirm
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('c0000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select throws_ok(
  $$ select public.confirm_booking('c0000000-0000-4000-8000-0000000000f1', 'c0000000-0000-4000-8000-0000000000b1') $$,
  '42501', null,
  'owners cannot confirm bookings'
);
reset role;

select pg_temp.sign_in('c0000000-0000-4000-8000-0000000000a2');
set local role authenticated;
select throws_ok(
  $$ select public.confirm_booking('c0000000-0000-4000-8000-0000000000f1', 'c0000000-0000-4000-8000-0000000000b1') $$,
  '42501', null,
  'admins of another business cannot confirm bookings'
);
reset role;

-- ---------------------------------------------------------------------------
-- Admin confirms
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('c0000000-0000-4000-8000-0000000000a1');
set local role authenticated;

select is(
  public.confirm_booking('c0000000-0000-4000-8000-0000000000f1', 'c0000000-0000-4000-8000-0000000000b1'),
  3,
  'daily booking over 3 days creates 3 visits'
);

select is_empty(
  $$ select 1 from public.visits
     where booking_id = 'c0000000-0000-4000-8000-0000000000f1'
       and ((scheduled_start at time zone 'America/New_York')::time <> '11:00'
            or scheduled_end - scheduled_start <> interval '30 minutes'
            or sitter_id <> 'c0000000-0000-4000-8000-0000000000b1') $$,
  'visits start 11:00 local, last 30 minutes, and go to the chosen sitter'
);

select is(
  public.confirm_booking('c0000000-0000-4000-8000-0000000000f1', 'c0000000-0000-4000-8000-0000000000b2'),
  0,
  'confirming again creates no duplicate visits'
);

select is(
  (select count(*)::int from public.visits
   where booking_id = 'c0000000-0000-4000-8000-0000000000f1'
     and sitter_id = 'c0000000-0000-4000-8000-0000000000b2'),
  3,
  're-confirming with another sitter reassigns upcoming visits'
);

select is(
  public.confirm_booking('c0000000-0000-4000-8000-0000000000f2', 'c0000000-0000-4000-8000-0000000000b1'),
  1,
  'overnight booking creates one visit'
);

select ok(
  (select (scheduled_start at time zone 'America/New_York')::time = '19:00'
      and (scheduled_end at time zone 'America/New_York')::time = '08:00'
      and (scheduled_end at time zone 'America/New_York')::date = current_date + 6
   from public.visits where booking_id = 'c0000000-0000-4000-8000-0000000000f2'),
  'overnight runs 19:00 on the start date to 08:00 on the end date, local time'
);

select is(
  public.confirm_booking('c0000000-0000-4000-8000-0000000000f3', 'c0000000-0000-4000-8000-0000000000b1'),
  1,
  'a one-off booking without an end date creates exactly one visit'
);

reset role;

select * from finish();
rollback;
