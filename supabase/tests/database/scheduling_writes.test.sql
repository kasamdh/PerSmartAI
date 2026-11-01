-- Scheduling writes: storing planned visits with conflict checks, rescheduling,
-- moving and reassigning visits, nightly generation, time off requests, change
-- requests, and care times. Run with: npx supabase test db
-- Org time zone: America/New_York. Plans are written by hand here; the
-- TypeScript scheduler that computes them is tested in Jest.

begin;

create extension if not exists pgtap with schema extensions;

select plan(50);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('f5000000-0000-4000-8000-0000000000a1', 'admin@sched.test'),
  ('f5000000-0000-4000-8000-0000000000c1', 'owner1@sched.test'),
  ('f5000000-0000-4000-8000-0000000000c2', 'owner2@sched.test'),
  ('f5000000-0000-4000-8000-0000000000b1', 'sitter1@sched.test'),
  ('f5000000-0000-4000-8000-0000000000b2', 'sitter2@sched.test'),
  ('f5000000-0000-4000-8000-0000000000a9', 'admin@other.test'),
  ('f5000000-0000-4000-8000-0000000000b9', 'sitter@other.test');

insert into public.organizations (id, name, timezone) values
  ('f5000000-0000-4000-8000-000000000001', 'Sched Org', 'America/New_York'),
  ('f5000000-0000-4000-8000-000000000009', 'Other Org', 'America/New_York');

insert into public.profiles (id, organization_id, role, full_name) values
  ('f5000000-0000-4000-8000-0000000000a1', 'f5000000-0000-4000-8000-000000000001', 'admin', 'Admin'),
  ('f5000000-0000-4000-8000-0000000000c1', 'f5000000-0000-4000-8000-000000000001', 'owner', 'Owner One'),
  ('f5000000-0000-4000-8000-0000000000c2', 'f5000000-0000-4000-8000-000000000001', 'owner', 'Owner Two'),
  ('f5000000-0000-4000-8000-0000000000b1', 'f5000000-0000-4000-8000-000000000001', 'sitter', 'Sitter One'),
  ('f5000000-0000-4000-8000-0000000000b2', 'f5000000-0000-4000-8000-000000000001', 'sitter', 'Sitter Two'),
  ('f5000000-0000-4000-8000-0000000000a9', 'f5000000-0000-4000-8000-000000000009', 'admin', 'Other Admin'),
  ('f5000000-0000-4000-8000-0000000000b9', 'f5000000-0000-4000-8000-000000000009', 'sitter', 'Other Sitter');

insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('f5000000-0000-4000-8000-0000000000d1', 'f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000c1', '1 A St', 'Town'),
  ('f5000000-0000-4000-8000-0000000000d2', 'f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000c2', '2 B St', 'Town');

insert into public.pets (id, organization_id, household_id, name, species) values
  ('f5000000-0000-4000-8000-0000000000e1', 'f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000d1', 'Rex', 'dog'),
  ('f5000000-0000-4000-8000-0000000000e2', 'f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000d2', 'Mochi', 'cat');

-- f1: owner 1, daily walks days 3–5. f2, f4, f5: owner 2. f3: owner 1 again.
insert into public.bookings (id, organization_id, household_id, service_type, recurrence_rule, start_date, end_date, window_start, duration_minutes) values
  ('f5000000-0000-4000-8000-0000000000f1', 'f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000d1', 'walk', 'FREQ=DAILY', current_date + 3, current_date + 5, '11:00', 30),
  ('f5000000-0000-4000-8000-0000000000f2', 'f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000d2', 'drop_in', null, current_date + 3, null, '11:15', 30),
  ('f5000000-0000-4000-8000-0000000000f3', 'f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000d1', 'drop_in', null, current_date + 4, null, '11:30', 30),
  ('f5000000-0000-4000-8000-0000000000f4', 'f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000d2', 'drop_in', null, current_date + 6, null, '12:00', 30),
  ('f5000000-0000-4000-8000-0000000000f5', 'f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000d2', 'drop_in', null, current_date + 7, null, '12:00', 30);

insert into public.booking_pets (organization_id, booking_id, pet_id) values
  ('f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000f1', 'f5000000-0000-4000-8000-0000000000e1'),
  ('f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000f2', 'f5000000-0000-4000-8000-0000000000e2');

create function pg_temp.sign_in(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- Local wall-clock time `p_days` from today, as an instant.
create function pg_temp.at(p_days integer, p_time time) returns timestamptz language sql as $$
  select ((current_date + p_days) + p_time) at time zone 'America/New_York'
$$;

-- One planned visit.
create function pg_temp.slot(p_days integer, p_time time, p_minutes integer default 30) returns jsonb language sql as $$
  select jsonb_build_object(
    'slot_start', pg_temp.at(p_days, p_time),
    'scheduled_start', pg_temp.at(p_days, p_time),
    'scheduled_end', pg_temp.at(p_days, p_time) + make_interval(mins => p_minutes)
  )
$$;

-- ---------------------------------------------------------------------------
-- apply_booking_plan: who
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select throws_ok(
  $$ select public.apply_booking_plan('f5000000-0000-4000-8000-0000000000f1', 'f5000000-0000-4000-8000-0000000000b1', '[]') $$,
  '42501', null,
  'owners cannot confirm bookings'
);
reset role;

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000a9');
set local role authenticated;
select throws_ok(
  $$ select public.apply_booking_plan('f5000000-0000-4000-8000-0000000000f1', 'f5000000-0000-4000-8000-0000000000b9', '[]') $$,
  '42501', null,
  'admins of another business cannot confirm bookings'
);
reset role;

-- ---------------------------------------------------------------------------
-- apply_booking_plan: storing plans and conflicts
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000a1');
set local role authenticated;

select is(
  public.apply_booking_plan('f5000000-0000-4000-8000-0000000000f1', 'f5000000-0000-4000-8000-0000000000b1',
    jsonb_build_array(pg_temp.slot(3, '11:00'), pg_temp.slot(4, '11:00'), pg_temp.slot(5, '11:00'))),
  3,
  'admin confirms a booking with its 3 planned visits'
);

select results_eq(
  $$ select b.status::text, b.sitter_id, count(v.*)::int, bool_and(v.slot_start = v.scheduled_start)
     from public.bookings b join public.visits v on v.booking_id = b.id
     where b.id = 'f5000000-0000-4000-8000-0000000000f1' group by b.status, b.sitter_id $$,
  $$ values ('confirmed', 'f5000000-0000-4000-8000-0000000000b1'::uuid, 3, true) $$,
  'the booking is confirmed for the sitter and each visit occupies its slot'
);

select is(
  public.apply_booking_plan('f5000000-0000-4000-8000-0000000000f1', 'f5000000-0000-4000-8000-0000000000b1',
    jsonb_build_array(pg_temp.slot(3, '11:00'), pg_temp.slot(4, '11:00'), pg_temp.slot(5, '11:00'))),
  0,
  'applying the same plan again adds nothing'
);

select is(
  public.apply_booking_plan('f5000000-0000-4000-8000-0000000000f1', 'f5000000-0000-4000-8000-0000000000b1',
    jsonb_build_array(pg_temp.slot(-3, '11:00'))),
  0,
  'visits that are already over are not stored'
);

select throws_ok(
  $$ select public.apply_booking_plan('f5000000-0000-4000-8000-0000000000f2', 'f5000000-0000-4000-8000-0000000000b1',
       jsonb_build_array(pg_temp.slot(3, '11:15'))) $$,
  '23P01', null,
  'a visit overlapping the sitter''s other visit is refused'
);

select throws_ok(
  $$ select public.apply_booking_plan('f5000000-0000-4000-8000-0000000000f2', 'f5000000-0000-4000-8000-0000000000b1',
       jsonb_build_array(pg_temp.slot(3, '11:40'))) $$,
  '23P01', null,
  'a visit 10 minutes after another home''s visit is refused (15 minute travel buffer)'
);

select results_eq(
  $$ select status::text, sitter_id, (select count(*)::int from public.visits where booking_id = b.id)
     from public.bookings b where id = 'f5000000-0000-4000-8000-0000000000f2' $$,
  $$ values ('requested', null::uuid, 0) $$,
  'a refused plan changes nothing'
);

select lives_ok(
  $$ select public.apply_booking_plan('f5000000-0000-4000-8000-0000000000f2', 'f5000000-0000-4000-8000-0000000000b1',
       jsonb_build_array(pg_temp.slot(3, '11:45'))) $$,
  'exactly the travel buffer is enough'
);

select lives_ok(
  $$ select public.apply_booking_plan('f5000000-0000-4000-8000-0000000000f3', 'f5000000-0000-4000-8000-0000000000b1',
       jsonb_build_array(pg_temp.slot(4, '11:30'))) $$,
  'back-to-back visits at the same home need no travel time'
);

reset role;

-- Sitter 2: approved time off on day 6, a pending request on day 7.
insert into public.sitter_time_off (organization_id, sitter_id, start_at, end_at, status) values
  ('f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000b2', pg_temp.at(6, '00:00'), pg_temp.at(7, '00:00'), 'approved'),
  ('f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000b2', pg_temp.at(7, '00:00'), pg_temp.at(8, '00:00'), 'requested');

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000a1');
set local role authenticated;

select throws_ok(
  $$ select public.apply_booking_plan('f5000000-0000-4000-8000-0000000000f4', 'f5000000-0000-4000-8000-0000000000b2',
       jsonb_build_array(pg_temp.slot(6, '12:00'))) $$,
  '23P01', null,
  'approved time off blocks the sitter'
);

select lives_ok(
  $$ select public.apply_booking_plan('f5000000-0000-4000-8000-0000000000f5', 'f5000000-0000-4000-8000-0000000000b2',
       jsonb_build_array(pg_temp.slot(7, '12:00'))) $$,
  'requested time off does not block (it is a warning in the app)'
);

-- ---------------------------------------------------------------------------
-- update_visit_schedule: move one visit, reassign
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select public.update_visit_schedule(
       (select id from public.visits where booking_id = 'f5000000-0000-4000-8000-0000000000f1' and slot_start = pg_temp.at(5, '11:00')),
       null, pg_temp.at(5, '14:00'), pg_temp.at(5, '14:30')) $$,
  'admin moves one visit'
);

select results_eq(
  $$ select scheduled_start, slot_start from public.visits
     where booking_id = 'f5000000-0000-4000-8000-0000000000f1' and slot_start = pg_temp.at(5, '11:00') $$,
  $$ values (pg_temp.at(5, '14:00'), pg_temp.at(5, '11:00')) $$,
  'a moved visit keeps its slot'
);

select throws_ok(
  $$ select public.update_visit_schedule(
       (select id from public.visits where booking_id = 'f5000000-0000-4000-8000-0000000000f5'),
       'f5000000-0000-4000-8000-0000000000b1', pg_temp.at(3, '11:10'), pg_temp.at(3, '11:40')) $$,
  '23P01', null,
  'moving a visit onto another of the sitter''s visits is refused'
);

select lives_ok(
  $$ select public.update_visit_schedule(
       (select id from public.visits where booking_id = 'f5000000-0000-4000-8000-0000000000f5'),
       'f5000000-0000-4000-8000-0000000000b1') $$,
  'admin reassigns a visit to a free sitter'
);

select throws_ok(
  $$ select public.update_visit_schedule(
       (select id from public.visits where booking_id = 'f5000000-0000-4000-8000-0000000000f1' and slot_start = pg_temp.at(3, '11:00')),
       null, pg_temp.at(-1, '11:00'), pg_temp.at(-1, '11:30')) $$,
  '22023', 'Pick a time in the future',
  'visits cannot be moved into the past'
);

reset role;

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000b1');
set local role authenticated;
select throws_ok(
  $$ select public.update_visit_schedule(
       (select id from public.visits where booking_id = 'f5000000-0000-4000-8000-0000000000f1' limit 1),
       null, pg_temp.at(9, '11:00'), pg_temp.at(9, '11:30')) $$,
  '42501', null,
  'sitters cannot move visits'
);
reset role;

-- ---------------------------------------------------------------------------
-- store_generated_visits: nightly generation (service_role only)
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000a1');
set local role authenticated;
select throws_ok(
  $$ select public.store_generated_visits('f5000000-0000-4000-8000-0000000000f1', '[]') $$,
  '42501', null,
  'clients cannot call the nightly generator'
);
reset role;

-- Sitter 1 takes another home's visit on day 8 at 11:00.
insert into public.visits (organization_id, booking_id, sitter_id, scheduled_start, scheduled_end) values
  ('f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-0000000000f2', 'f5000000-0000-4000-8000-0000000000b1',
   pg_temp.at(8, '11:00'), pg_temp.at(8, '11:30'));

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select is(
  public.store_generated_visits('f5000000-0000-4000-8000-0000000000f1',
    jsonb_build_array(pg_temp.slot(5, '11:00'), pg_temp.slot(6, '11:00'), pg_temp.slot(8, '11:00'))),
  '{"created": 2, "unassigned": 1}'::jsonb,
  'the moved visit is not recreated; a visit the sitter can no longer take is stored unassigned'
);
reset role;

select is(
  (select sitter_id from public.visits where booking_id = 'f5000000-0000-4000-8000-0000000000f1' and slot_start = pg_temp.at(8, '11:00')),
  null,
  'the conflicting visit waits for an admin to staff it'
);

-- ---------------------------------------------------------------------------
-- reschedule_booking: this and future
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000a1');
set local role authenticated;

-- The owner cancelled day 4 earlier; it must stay cancelled in the new series.
update public.visits set status = 'cancelled'
 where booking_id = 'f5000000-0000-4000-8000-0000000000f1' and slot_start = pg_temp.at(4, '11:00');

create temp table split (id uuid) on commit drop;
grant all on split to authenticated;

insert into split select public.reschedule_booking(
  'f5000000-0000-4000-8000-0000000000f1',
  current_date + 4,
  true,
  jsonb_build_object('recurrence_rule', 'FREQ=DAILY', 'start_date', current_date + 4, 'end_date', current_date + 6,
                     'window_start', '15:00', 'duration_minutes', 30),
  null,
  jsonb_build_array(pg_temp.slot(4, '15:00'), pg_temp.slot(5, '15:00'), pg_temp.slot(6, '15:00')),
  jsonb_build_array(jsonb_build_object(
    'visit_id', (select id from public.visits where booking_id = 'f5000000-0000-4000-8000-0000000000f1' and slot_start = pg_temp.at(4, '11:00')),
    'slot_start', pg_temp.at(4, '15:00')))
);

select results_eq(
  $$ select end_date, (select count(*)::int from public.visits where booking_id = b.id)
     from public.bookings b where id = 'f5000000-0000-4000-8000-0000000000f1' $$,
  $$ values (current_date + 3, 1) $$,
  'the original booking ends the day before and keeps only its earlier visit'
);

select results_eq(
  $$ select n.status::text, n.sitter_id, n.series_id = o.series_id, n.window_start, n.start_date,
            (select array_agg(pet_id) from public.booking_pets where booking_id = n.id)
     from public.bookings n, public.bookings o
     where n.id = (select id from split) and o.id = 'f5000000-0000-4000-8000-0000000000f1' $$,
  $$ values ('confirmed', 'f5000000-0000-4000-8000-0000000000b1'::uuid, true, '15:00'::time, current_date + 4,
             array['f5000000-0000-4000-8000-0000000000e1'::uuid]) $$,
  'the new booking continues the series with the same sitter and pets'
);

select results_eq(
  $$ select (scheduled_start at time zone 'America/New_York')::date - current_date, status::text
     from public.visits where booking_id = (select id from split) order by slot_start $$,
  $$ values (4, 'cancelled'), (5, 'scheduled'), (6, 'scheduled') $$,
  'the cancelled day moves to the new series instead of coming back'
);

reset role;

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select throws_ok(
  $$ select public.reschedule_booking((select id from split), current_date + 5, false, '{}', null, '[]') $$,
  '42501', null,
  'owners cannot reschedule directly (they send a change request)'
);
reset role;

-- ---------------------------------------------------------------------------
-- Time off requests
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000b1');
set local role authenticated;

select throws_ok(
  $$ insert into public.sitter_time_off (sitter_id, start_at, end_at, status)
     values ('f5000000-0000-4000-8000-0000000000b1', pg_temp.at(20, '00:00'), pg_temp.at(21, '00:00'), 'approved') $$,
  '42501', null,
  'sitters cannot approve their own time off'
);

select lives_ok(
  $$ insert into public.sitter_time_off (sitter_id, start_at, end_at, reason)
     values ('f5000000-0000-4000-8000-0000000000b1', pg_temp.at(20, '00:00'), pg_temp.at(21, '00:00'), 'Wedding') $$,
  'sitters request time off'
);

select throws_ok(
  $$ update public.sitter_time_off set status = 'approved' where sitter_id = 'f5000000-0000-4000-8000-0000000000b1' $$,
  '42501', null,
  'sitters cannot change the status of a request'
);

select is_empty(
  $$ select 1 from public.sitter_time_off where sitter_id = 'f5000000-0000-4000-8000-0000000000b2' $$,
  'sitters cannot see other sitters'' time off'
);

reset role;

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000a1');
set local role authenticated;
update public.sitter_time_off set status = 'approved' where sitter_id = 'f5000000-0000-4000-8000-0000000000b1';
select ok(
  (select reviewed_at is not null from public.sitter_time_off where sitter_id = 'f5000000-0000-4000-8000-0000000000b1'),
  'approving records when it was reviewed'
);
reset role;

-- Approved time off that has started can't be withdrawn.
update public.sitter_time_off set start_at = now() - interval '1 hour'
 where sitter_id = 'f5000000-0000-4000-8000-0000000000b1';
select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000b1');
set local role authenticated;
select throws_ok(
  $$ delete from public.sitter_time_off where sitter_id = 'f5000000-0000-4000-8000-0000000000b1' $$,
  '42501', null,
  'sitters cannot withdraw time off that has started'
);
reset role;

-- ---------------------------------------------------------------------------
-- Schedule change requests
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000c1');
set local role authenticated;

select lives_ok(
  $$ insert into public.schedule_change_requests (booking_id, visit_id, scope, changes)
     select booking_id, id, 'visit', jsonb_build_object('date', current_date + 5, 'time', '16:00')
     from public.visits where booking_id = (select id from split) and status = 'scheduled'
     order by slot_start limit 1 $$,
  'owners ask to move one visit'
);

select throws_ok(
  $$ insert into public.schedule_change_requests (booking_id, scope, from_date, changes, status)
     values ((select id from split), 'this_and_future', current_date + 5, '{"window_start": "10:00"}', 'approved') $$,
  '42501', null,
  'owners cannot approve their own requests'
);

select throws_ok(
  $$ insert into public.schedule_change_requests (booking_id, scope, from_date, changes)
     values ((select id from split), 'this_and_future', current_date + 5, '{"sitter_id": "x"}') $$,
  '23514', null,
  'change requests only carry schedule fields'
);

select lives_ok(
  $$ update public.schedule_change_requests set status = 'withdrawn' where booking_id = (select id from split) $$,
  'owners withdraw a pending request'
);

select throws_ok(
  $$ update public.schedule_change_requests set status = 'requested' where booking_id = (select id from split) $$,
  '42501', null,
  'a withdrawn request cannot be reopened'
);

reset role;

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000c2');
set local role authenticated;

select is_empty(
  $$ select 1 from public.schedule_change_requests $$,
  'owners cannot see other owners'' change requests'
);

select throws_ok(
  $$ insert into public.schedule_change_requests (booking_id, scope, from_date, changes)
     values ((select id from split), 'this_and_future', current_date + 5, '{"window_start": "10:00"}') $$,
  '42501', null,
  'owners cannot request changes to other owners'' bookings'
);

reset role;

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000a9');
set local role authenticated;
select is_empty(
  $$ select 1 from public.schedule_change_requests $$,
  'admins of another business cannot see change requests'
);
reset role;

-- ---------------------------------------------------------------------------
-- Care times (multi-day stays)
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000c1');
set local role authenticated;

create temp table stay (id uuid) on commit drop;
grant all on stay to authenticated;
insert into stay select public.request_booking(
  'multi_day', array['f5000000-0000-4000-8000-0000000000e1']::uuid[], current_date + 10, current_date + 12,
  null, null, null, null, null,
  '[{"care_time": "08:00", "duration_minutes": 20, "label": "Feed"},
    {"care_time": "18:00", "duration_minutes": 45, "label": "Feed and walk"}]'
);

select results_eq(
  $$ select care_time, duration_minutes, label from public.booking_care_times
     where booking_id = (select id from stay) order by care_time $$,
  $$ values ('08:00'::time, 20, 'Feed'), ('18:00'::time, 45, 'Feed and walk') $$,
  'owners set care times when requesting a multi-day stay'
);

select is(
  (select series_id from public.bookings where id = (select id from stay)),
  (select id from stay),
  'a new booking starts its own series'
);

select lives_ok(
  $$ insert into public.bookings (household_id, service_type, start_date, series_id)
     values ('f5000000-0000-4000-8000-0000000000d1', 'walk', current_date + 9, 'f5000000-0000-4000-8000-0000000000f1') $$,
  'owners may send a series id…'
);

select throws_ok(
  $$ select public.request_booking('walk', array['f5000000-0000-4000-8000-0000000000e1']::uuid[], current_date + 10,
       null, '09:00', null, 30, null, null, '[{"care_time": "08:00", "label": "Feed"}]') $$,
  '22023', 'Care times are for multi-day stays',
  'care times are only for multi-day stays'
);

reset role;

select is_empty(
  $$ select 1 from public.bookings where start_date = current_date + 9 and series_id <> id $$,
  '…but it is replaced with the booking''s own'
);

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000c2');
set local role authenticated;
select is_empty(
  $$ select 1 from public.booking_care_times $$,
  'owners cannot see other owners'' care times'
);
reset role;

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000b2');
set local role authenticated;
select is_empty(
  $$ select 1 from public.booking_care_times $$,
  'sitters cannot see care times of bookings they are not on'
);
reset role;

select pg_temp.sign_in('f5000000-0000-4000-8000-0000000000a9');
set local role authenticated;
select is_empty(
  $$ select 1 from public.booking_care_times $$,
  'admins of another business cannot see care times'
);
reset role;

-- ---------------------------------------------------------------------------
-- Repeat rule validation matches the TypeScript parser
-- ---------------------------------------------------------------------------

select is(
  array[
    private.is_supported_rrule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231'),
    private.is_supported_rrule('RRULE:freq=daily;count=10'),
    private.is_supported_rrule(null)
  ],
  array[true, true, true],
  'supported rules pass'
);

select is(
  array[
    private.is_supported_rrule('FREQ=MONTHLY'),
    private.is_supported_rrule('FREQ=DAILY;BYDAY=MO'),
    private.is_supported_rrule('FREQ=DAILY;COUNT=2;UNTIL=20261231'),
    private.is_supported_rrule('FREQ=WEEKLY;BYDAY=1MO'),
    private.is_supported_rrule('FREQ=DAILY;UNTIL=20260230'),
    private.is_supported_rrule('FREQ=DAILY;INTERVAL=0'),
    private.is_supported_rrule('FREQ=DAILY;')
  ],
  array[false, false, false, false, false, false, false],
  'unsupported or malformed rules fail'
);

select * from finish();
rollback;
